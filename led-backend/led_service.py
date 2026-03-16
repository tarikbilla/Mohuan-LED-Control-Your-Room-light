#!/usr/bin/env python3
"""
MohuanLED Bluetooth Backend Service
====================================

A FastAPI-based service for controlling MohuanLED Bluetooth lights.
Run this on your Mac to control your LED lights.

Usage:
    python led_service.py

The service will run on http://localhost:3030
"""

import asyncio
import colorsys
import logging
from typing import Optional, List
from dataclasses import dataclass
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    print("=" * 60)
    print("ERROR: 'bleak' package is required!")
    print("Install it with: pip install bleak")
    print("=" * 60)
    raise

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
    device_name: Optional[str] = None
    is_connected: bool = False


# Pydantic models for API
class ColorRequest(BaseModel):
    red: int
    green: int
    blue: int
    brightness: Optional[int] = None


class BrightnessRequest(BaseModel):
    brightness: int


class ConnectRequest(BaseModel):
    pass  # Auto-scan and connect


class EffectRequest(BaseModel):
    duration: float = 10.0
    flashes: Optional[int] = 10


class LEDController:
    """Controller for MohuanLED Bluetooth lights."""
    
    def __init__(self):
        self.client: Optional[BleakClient] = None
        self.state = LEDState()
        self.uuid: Optional[str] = None
        self._effect_task: Optional[asyncio.Task] = None
        self._stop_effect = False
    
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
                }
                led_devices.append(device_info)
                LOGGER.info(f"Found LED: {device.name} at {device.address}")
        
        if not led_devices:
            LOGGER.info("No LED devices found")
        
        return led_devices
    
    async def connect(self) -> bool:
        """Scan and connect to the first available LED device"""
        try:
            # Disconnect existing connection
            await self.disconnect()
            
            # Scan for devices
            devices = await self.scan_devices()
            if not devices:
                raise Exception("No LED devices found. Make sure your LED is powered on.")
            
            # Connect to first device
            device = devices[0]
            mac_address = device["mac_address"]
            
            LOGGER.info(f"Connecting to {device['name']} at {mac_address}...")
            
            self.client = BleakClient(mac_address)
            await self.client.connect()
            
            # Find writable characteristic
            services = await self.client.get_services()
            for service in services:
                for char in service.characteristics:
                    if "write" in char.properties:
                        self.uuid = char.uuid
                        LOGGER.info(f"Found writable characteristic: {self.uuid}")
                        break
                if self.uuid:
                    break
            
            if not self.uuid:
                raise Exception("No writable characteristic found")
            
            self.state.mac_address = mac_address
            self.state.device_name = device["name"]
            self.state.is_connected = True
            
            LOGGER.info(f"Connected to {device['name']}")
            return True
            
        except Exception as e:
            LOGGER.error(f"Connection error: {e}")
            self.state.is_connected = False
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
            LOGGER.info("Disconnected from LED")
        
        self.client = None
        self.state.is_connected = False
        self.state.mac_address = None
        self.state.device_name = None
    
    async def _write(self, data: bytearray):
        """Write data to LED"""
        if not self.client or not self.client.is_connected:
            raise Exception("Not connected to LED")
        await self.client.write_gatt_char(self.uuid, data, False)
    
    async def turn_on(self):
        """Turn LED on"""
        await self._write(TURN_ON_CMD)
        self.state.is_on = True
        LOGGER.info("LED turned on")
    
    async def turn_off(self):
        """Turn LED off"""
        self._stop_effect = True
        self.state.effect = None
        await self._write(TURN_OFF_CMD)
        self.state.is_on = False
        LOGGER.info("LED turned off")
    
    async def set_color(self, red: int, green: int, blue: int, brightness: Optional[int] = None):
        """Set LED color"""
        if brightness is None:
            brightness = self.state.brightness
        
        # Apply brightness scaling
        r = int(red * brightness / 255)
        g = int(green * brightness / 255)
        b = int(blue * brightness / 255)
        
        # Build color packet
        packet = bytearray.fromhex("69 96 05 02")
        packet.extend([r, g, b])
        
        await self._write(packet)
        self.state.rgb_color = (red, green, blue)
        self.state.brightness = brightness
    
    async def set_brightness(self, brightness: int):
        """Set brightness"""
        self.state.brightness = max(0, min(255, brightness))
        r, g, b = self.state.rgb_color
        await self.set_color(r, g, b, self.state.brightness)
    
    def get_state(self) -> dict:
        """Get current state"""
        return {
            "is_on": self.state.is_on,
            "rgb_color": list(self.state.rgb_color),
            "brightness": self.state.brightness,
            "effect": self.state.effect,
            "mac_address": self.state.mac_address,
            "device_name": self.state.device_name,
            "is_connected": self.state.is_connected
        }
    
    async def _run_rainbow(self, duration: float):
        """Rainbow effect implementation"""
        self.state.effect = "rainbow"
        steps = 360
        delay = duration / steps
        
        for hue in range(steps):
            if self._stop_effect:
                break
            r, g, b = [int(c * 255) for c in colorsys.hsv_to_rgb(hue / 360, 1.0, 1.0)]
            await self.set_color(r, g, b)
            await asyncio.sleep(delay)
        
        self.state.effect = None
    
    async def _run_breathing(self, duration: float):
        """Breathing effect implementation"""
        self.state.effect = "breathing"
        steps = 50
        delay = duration / (steps * 2)
        r, g, b = self.state.rgb_color
        
        while not self._stop_effect:
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
    
    async def _run_strobe(self, duration: float, flashes: int):
        """Strobe effect implementation"""
        self.state.effect = "strobe"
        delay = duration / (flashes * 2)
        r, g, b = self.state.rgb_color
        
        for _ in range(flashes):
            if self._stop_effect:
                break
            await self.set_color(r, g, b, 255)
            await asyncio.sleep(delay)
            await self._write(TURN_OFF_CMD)
            await asyncio.sleep(delay)
        
        self.state.effect = None
        self.state.is_on = False
    
    async def start_rainbow(self, duration: float = 10.0):
        """Start rainbow effect"""
        self._stop_effect = True
        await asyncio.sleep(0.1)
        self._stop_effect = False
        self._effect_task = asyncio.create_task(self._run_rainbow(duration))
    
    async def start_breathing(self, duration: float = 3.0):
        """Start breathing effect"""
        self._stop_effect = True
        await asyncio.sleep(0.1)
        self._stop_effect = False
        self._effect_task = asyncio.create_task(self._run_breathing(duration))
    
    async def start_strobe(self, duration: float = 2.0, flashes: int = 10):
        """Start strobe effect"""
        self._stop_effect = True
        await asyncio.sleep(0.1)
        self._stop_effect = False
        self._effect_task = asyncio.create_task(self._run_strobe(duration, flashes))
    
    def stop_effect(self):
        """Stop current effect"""
        self._stop_effect = True
        self.state.effect = None


# Global controller instance
controller = LEDController()

# Create FastAPI app
app = FastAPI(
    title="MohuanLED Backend Service",
    description="Bluetooth LED control API for macOS",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API Endpoints
@app.get("/")
async def root():
    return {"service": "MohuanLED Backend", "status": "running"}


@app.get("/state")
async def get_state():
    """Get current LED state"""
    return controller.get_state()


@app.get("/scan")
async def scan_devices():
    """Scan for LED devices"""
    devices = await controller.scan_devices()
    return {"devices": devices}


@app.post("/connect")
async def connect_device():
    """Connect to LED device"""
    try:
        await controller.connect()
        return {"success": True, "device": controller.state.device_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/disconnect")
async def disconnect_device():
    """Disconnect from LED device"""
    await controller.disconnect()
    return {"success": True}


@app.post("/on")
async def turn_on():
    """Turn LED on"""
    try:
        await controller.turn_on()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/off")
async def turn_off():
    """Turn LED off"""
    try:
        await controller.turn_off()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/color")
async def set_color(request: ColorRequest):
    """Set LED color"""
    try:
        await controller.set_color(request.red, request.green, request.blue, request.brightness)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/brightness")
async def set_brightness(request: BrightnessRequest):
    """Set LED brightness"""
    try:
        await controller.set_brightness(request.brightness)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/effects/rainbow")
async def rainbow_effect(request: EffectRequest):
    """Start rainbow effect"""
    try:
        await controller.start_rainbow(request.duration)
        return {"success": True, "effect": "rainbow"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/effects/breathing")
async def breathing_effect(request: EffectRequest):
    """Start breathing effect"""
    try:
        await controller.start_breathing(request.duration)
        return {"success": True, "effect": "breathing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/effects/strobe")
async def strobe_effect(request: EffectRequest):
    """Start strobe effect"""
    try:
        await controller.start_strobe(request.duration, request.flashes or 10)
        return {"success": True, "effect": "strobe"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/effects/stop")
async def stop_effects():
    """Stop current effect"""
    controller.stop_effect()
    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🌈 MohuanLED Backend Service")
    print("=" * 60)
    print("Running on http://localhost:3030")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=3030)
