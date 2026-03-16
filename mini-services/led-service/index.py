#!/usr/bin/env python3
"""
LED Bluetooth Control Service
=============================

A FastAPI-based service for controlling MohuanLED Bluetooth lights.
Provides REST API and WebSocket for real-time communication.
"""

import asyncio
import colorsys
import logging
from typing import Optional, List
from contextlib import asynccontextmanager
from dataclasses import dataclass
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    print("Error: 'bleak' package is required. Install with: pip install bleak")
    raise

# Configure logging
logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)

# Command bytearrays for LED control
TURN_ON_CMD = bytearray.fromhex("69 96 02 01 01")
TURN_OFF_CMD = bytearray.fromhex("69 96 02 01 00")


@dataclass
class LEDState:
    """LED state container"""
    is_on: bool = False
    rgb_color: tuple = (255, 255, 255)
    brightness: int = 255
    effect: Optional[str] = None
    mac_address: Optional[str] = None
    uuid: Optional[str] = None
    is_connected: bool = False


class LEDController:
    """
    Controller for MohuanLED Bluetooth lights.
    """
    
    def __init__(self):
        self.client: Optional[BleakClient] = None
        self.state = LEDState()
        self.websocket_clients: List[WebSocket] = []
        self._effect_task: Optional[asyncio.Task] = None
        self._stop_effect = False
    
    async def broadcast_state(self):
        """Broadcast current state to all WebSocket clients"""
        state_dict = {
            "is_on": self.state.is_on,
            "rgb_color": list(self.state.rgb_color),
            "brightness": self.state.brightness,
            "effect": self.state.effect,
            "mac_address": self.state.mac_address,
            "uuid": self.state.uuid,
            "is_connected": self.state.is_connected
        }
        
        for ws in self.websocket_clients:
            try:
                await ws.send_json({"type": "state", "data": state_dict})
            except:
                pass
    
    async def scan_devices(self) -> List[dict]:
        """Scan for LED devices"""
        LOGGER.info("Scanning for LED devices...")
        devices = await BleakScanner.discover()
        
        led_devices = []
        for device in devices:
            if device.name and "BJ_LED_M" in device.name:
                device_info = {
                    "name": device.name,
                    "mac_address": device.address,
                    "uuids": device.metadata.get("uuids", []) if hasattr(device, 'metadata') else []
                }
                led_devices.append(device_info)
                LOGGER.info(f"Found LED: {device.name} at {device.address}")
        
        return led_devices
    
    async def get_device_uuids(self, mac_address: str) -> List[str]:
        """Get available UUIDs for a device"""
        uuid_list = []
        async with BleakClient(mac_address) as client:
            services = await client.get_services()
            for service in services:
                for char in service.characteristics:
                    uuid_list.append(char.uuid)
        return uuid_list
    
    async def connect(self, mac_address: str, uuid: Optional[str] = None) -> bool:
        """Connect to LED device"""
        try:
            # Disconnect existing connection
            await self.disconnect()
            
            # Auto-detect UUID if not provided
            if not uuid:
                uuids = await self.get_device_uuids(mac_address)
                for test_uuid in uuids:
                    try:
                        test_client = BleakClient(mac_address)
                        await test_client.connect()
                        await test_client.write_gatt_char(test_uuid, TURN_ON_CMD, False)
                        await test_client.write_gatt_char(test_uuid, TURN_OFF_CMD, False)
                        await test_client.disconnect()
                        uuid = test_uuid
                        LOGGER.info(f"Found compatible UUID: {uuid}")
                        break
                    except Exception as e:
                        LOGGER.debug(f"UUID {test_uuid} not compatible: {e}")
                        try:
                            await test_client.disconnect()
                        except:
                            pass
            
            if not uuid:
                raise ValueError("No compatible UUID found for the LED device")
            
            # Connect with the found UUID
            self.client = BleakClient(mac_address)
            await self.client.connect()
            
            self.state.mac_address = mac_address
            self.state.uuid = uuid
            self.state.is_connected = True
            
            LOGGER.info(f"Connected to LED at {mac_address}")
            await self.broadcast_state()
            return True
            
        except Exception as e:
            LOGGER.error(f"Failed to connect: {e}")
            self.state.is_connected = False
            await self.broadcast_state()
            raise
    
    async def disconnect(self):
        """Disconnect from LED device"""
        self._stop_effect = True
        if self._effect_task:
            self._effect_task.cancel()
            try:
                await self._effect_task
            except:
                pass
        
        if self.client and self.client.is_connected:
            await self.client.disconnect()
            LOGGER.info(f"Disconnected from LED at {self.state.mac_address}")
        
        self.client = None
        self.state.is_connected = False
        self.state.mac_address = None
        self.state.uuid = None
        await self.broadcast_state()
    
    async def _ensure_connected(self):
        """Ensure LED is connected"""
        if not self.client or not self.client.is_connected:
            raise ConnectionError("LED is not connected")
    
    async def _write(self, data: bytearray):
        """Write data to LED"""
        await self._ensure_connected()
        await self.client.write_gatt_char(self.state.uuid, data, False)
    
    async def turn_on(self):
        """Turn LED on"""
        await self._ensure_connected()
        await self._write(TURN_ON_CMD)
        self.state.is_on = True
        await self.broadcast_state()
        LOGGER.info("LED turned on")
    
    async def turn_off(self):
        """Turn LED off"""
        await self._ensure_connected()
        await self._write(TURN_OFF_CMD)
        self.state.is_on = False
        self._stop_effect = True
        self.state.effect = None
        await self.broadcast_state()
        LOGGER.info("LED turned off")
    
    async def set_color(self, red: int, green: int, blue: int, brightness: Optional[int] = None):
        """Set LED color"""
        await self._ensure_connected()
        
        if brightness is None:
            brightness = self.state.brightness
        
        # Apply brightness
        r = int(red * brightness / 255)
        g = int(green * brightness / 255)
        b = int(blue * brightness / 255)
        
        # Build packet
        packet = bytearray.fromhex("69 96 05 02")
        packet.append(r)
        packet.append(g)
        packet.append(b)
        
        await self._write(packet)
        self.state.rgb_color = (red, green, blue)
        self.state.brightness = brightness
        await self.broadcast_state()
    
    async def set_brightness(self, brightness: int):
        """Set LED brightness"""
        self.state.brightness = max(0, min(255, brightness))
        r, g, b = self.state.rgb_color
        await self.set_color(r, g, b, self.state.brightness)
    
    async def fade_to_color(self, start: tuple, end: tuple, duration: float):
        """Fade between two colors"""
        steps = 50
        delay = duration / steps
        
        r1, g1, b1 = start
        r2, g2, b2 = end
        
        for step in range(steps + 1):
            if self._stop_effect:
                return
            r = int(r1 + (r2 - r1) * step / steps)
            g = int(g1 + (g2 - g1) * step / steps)
            b = int(b1 + (b2 - b1) * step / steps)
            await self.set_color(r, g, b)
            await asyncio.sleep(delay)
    
    async def rainbow_cycle(self, duration: float = 10.0):
        """Rainbow cycle effect"""
        self._stop_effect = False
        self.state.effect = "rainbow"
        await self.broadcast_state()
        
        steps = 360
        delay = duration / steps
        
        for hue in range(steps):
            if self._stop_effect:
                break
            r, g, b = [int(c * 255) for c in colorsys.hsv_to_rgb(hue / 360, 1.0, 1.0)]
            await self.set_color(r, g, b)
            await asyncio.sleep(delay)
        
        self.state.effect = None
        await self.broadcast_state()
    
    async def breathing_effect(self, color: tuple, duration: float = 3.0):
        """Breathing effect"""
        self._stop_effect = False
        self.state.effect = "breathing"
        await self.broadcast_state()
        
        steps = 50
        delay = duration / (steps * 2)
        r, g, b = color
        
        # Fade in
        for step in range(steps):
            if self._stop_effect:
                break
            brightness = int((step / steps) * 255)
            await self.set_color(r, g, b, brightness)
            await asyncio.sleep(delay)
        
        # Fade out
        for step in range(steps, 0, -1):
            if self._stop_effect:
                break
            brightness = int((step / steps) * 255)
            await self.set_color(r, g, b, brightness)
            await asyncio.sleep(delay)
        
        self.state.effect = None
        await self.broadcast_state()
    
    async def strobe_effect(self, color: tuple, flashes: int = 10, duration: float = 2.0):
        """Strobe effect"""
        self._stop_effect = False
        self.state.effect = "strobe"
        await self.broadcast_state()
        
        delay = duration / (flashes * 2)
        r, g, b = color
        
        for i in range(flashes):
            if self._stop_effect:
                break
            await self.set_color(r, g, b)
            await asyncio.sleep(delay)
            await self._write(TURN_OFF_CMD)
            await asyncio.sleep(delay)
        
        self.state.effect = None
        self.state.is_on = False
        await self.broadcast_state()


# Global controller instance
controller = LEDController()


# Pydantic models for API
class ConnectRequest(BaseModel):
    mac_address: str
    uuid: Optional[str] = None

class ColorRequest(BaseModel):
    red: int
    green: int
    blue: int
    brightness: Optional[int] = None

class BrightnessRequest(BaseModel):
    brightness: int

class EffectRequest(BaseModel):
    duration: float = 10.0
    color: Optional[List[int]] = None
    flashes: Optional[int] = 10


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    LOGGER.info("LED Control Service starting...")
    yield
    LOGGER.info("LED Control Service shutting down...")
    await controller.disconnect()


# Create FastAPI app
app = FastAPI(
    title="MohuanLED Control Service",
    description="Bluetooth LED control API",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# REST API Endpoints
@app.get("/")
async def root():
    return {"service": "MohuanLED Control Service", "status": "running"}


@app.get("/state")
async def get_state():
    """Get current LED state"""
    return {
        "is_on": controller.state.is_on,
        "rgb_color": list(controller.state.rgb_color),
        "brightness": controller.state.brightness,
        "effect": controller.state.effect,
        "mac_address": controller.state.mac_address,
        "uuid": controller.state.uuid,
        "is_connected": controller.state.is_connected
    }


@app.get("/scan")
async def scan_devices():
    """Scan for LED devices"""
    devices = await controller.scan_devices()
    return {"devices": devices}


@app.post("/connect")
async def connect_device(request: ConnectRequest):
    """Connect to LED device"""
    await controller.connect(request.mac_address, request.uuid)
    return {"success": True, "mac_address": controller.state.mac_address}


@app.post("/disconnect")
async def disconnect_device():
    """Disconnect from LED device"""
    await controller.disconnect()
    return {"success": True}


@app.post("/on")
async def turn_on():
    """Turn LED on"""
    await controller.turn_on()
    return {"success": True}


@app.post("/off")
async def turn_off():
    """Turn LED off"""
    await controller.turn_off()
    return {"success": True}


@app.post("/color")
async def set_color(request: ColorRequest):
    """Set LED color"""
    await controller.set_color(request.red, request.green, request.blue, request.brightness)
    return {"success": True}


@app.post("/brightness")
async def set_brightness(request: BrightnessRequest):
    """Set LED brightness"""
    await controller.set_brightness(request.brightness)
    return {"success": True}


@app.post("/effects/rainbow")
async def rainbow_effect(request: EffectRequest):
    """Start rainbow effect"""
    asyncio.create_task(controller.rainbow_cycle(request.duration))
    return {"success": True, "effect": "rainbow"}


@app.post("/effects/breathing")
async def breathing_effect(request: EffectRequest):
    """Start breathing effect"""
    color = tuple(request.color) if request.color else controller.state.rgb_color
    asyncio.create_task(controller.breathing_effect(color, request.duration))
    return {"success": True, "effect": "breathing"}


@app.post("/effects/strobe")
async def strobe_effect(request: EffectRequest):
    """Start strobe effect"""
    color = tuple(request.color) if request.color else (255, 255, 255)
    flashes = request.flashes or 10
    asyncio.create_task(controller.strobe_effect(color, flashes, request.duration))
    return {"success": True, "effect": "strobe"}


@app.post("/effects/stop")
async def stop_effects():
    """Stop current effect"""
    controller._stop_effect = True
    controller.state.effect = None
    await controller.broadcast_state()
    return {"success": True}


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    controller.websocket_clients.append(websocket)
    
    # Send current state
    state_dict = {
        "is_on": controller.state.is_on,
        "rgb_color": list(controller.state.rgb_color),
        "brightness": controller.state.brightness,
        "effect": controller.state.effect,
        "mac_address": controller.state.mac_address,
        "uuid": controller.state.uuid,
        "is_connected": controller.state.is_connected
    }
    await websocket.send_json({"type": "state", "data": state_dict})
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming commands if needed
            try:
                message = json.loads(data)
                LOGGER.debug(f"WebSocket message: {message}")
            except:
                pass
    except WebSocketDisconnect:
        controller.websocket_clients.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3030)
