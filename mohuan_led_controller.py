#!/usr/bin/env python3
"""
🌈 MohuanLED Bluetooth Controller - Single File Version for macOS
===============================================================

A Python library to control MohuanLED brand lights via Bluetooth.
This is a consolidated single-file version for easy deployment on macOS.

Original repository: https://github.com/Walkercito/MohuanLED-Bluetooth_LED

Requirements:
- Python 3.8 or higher
- bleak (pip install bleak)
- python-dotenv (optional, for .env file support)

Usage:
------
1. Direct connection (if you know MAC and UUID):

    import asyncio
    from mohuan_led_controller import BJLEDInstance

    async def main():
        led = BJLEDInstance(
            address='64:11:a8:00:8b:a6',      # Your LED's MAC address
            uuid='0000ee02-0000-1000-2000-00805f9b34fb'  # Your LED's UUID
        )
        try:
            await led.turn_on()
            await led.set_color_to_rgb(255, 0, 0)  # Red
            await asyncio.sleep(5)
            await led.turn_off()
        finally:
            await led._disconnect()

    asyncio.run(main())

2. Dynamic discovery (scan for devices):

    import asyncio
    from mohuan_led_controller import BJLEDInstance

    async def main():
        led = BJLEDInstance()  # Will scan for 'BJ_LED_M' devices
        try:
            await led.initialize()  # Scans and connects
            await led.turn_on()
            await led.set_color_to_rgb(0, 255, 0)  # Green
            await asyncio.sleep(5)
            await led.turn_off()
        finally:
            await led._disconnect()

    asyncio.run(main())

Features:
- Turn LEDs on/off
- Set RGB colors
- Fade between colors
- Rainbow cycle effect
- Breathing effect
- Strobe light effect
- Wave effect

License: MIT
"""

import os
import asyncio
import colorsys
import logging
from typing import Tuple, List, Optional

# Try to load dotenv (optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# bleak is required for Bluetooth LE
try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    print("Error: 'bleak' package is required. Install with: pip install bleak")
    raise

# Configure logging
LOGGER = logging.getLogger(__name__)

# Environment variables (optional)
LED_MAC_ADDRESS = os.getenv("LED_MAC_ADDRESS")
LED_UUID = os.getenv("LED_UUID")

# Command bytearrays for LED control
TURN_ON_CMD = bytearray.fromhex("69 96 02 01 01")
TURN_OFF_CMD = bytearray.fromhex("69 96 02 01 00")


class Scanner:
    """
    Scanner class for discovering MohuanLED Bluetooth devices.
    
    Scans for BLE devices named 'BJ_LED_M' and retrieves their
    MAC addresses and available UUIDs for communication.
    """
    
    async def scan_led(self) -> Tuple[Optional[str], Optional[object]]:
        """
        Scan for LED devices.
        
        Returns:
            Tuple of (MAC address, device object) or (None, None) if not found
        """
        print("🔍 Scanning for LED devices...")
        devices = await BleakScanner.discover()
        
        for device in devices:
            if device.name and "BJ_LED_M" in device.name:
                print(f"✅ Found LED: {device.name} with MAC: {device.address}")
                if hasattr(device, 'metadata') and 'uuids' in device.metadata:
                    print(f"   UUIDs: {device.metadata['uuids']}")
                return device.address, device
        
        print("❌ No LED device found. Make sure it's powered on and in range.")
        return None, None

    async def scan_uuids(self, address: str) -> List[str]:
        """
        Scan for available UUIDs on a specific device.
        
        Args:
            address: MAC address of the device
            
        Returns:
            List of characteristic UUIDs
        """
        print(f"🔍 Scanning UUIDs for {address}...")
        uuid_list = []
        
        async with BleakClient(address) as client:
            services = await client.get_services()
            for service in services:
                print(f"   Service UUID: {service.uuid}")
                for char in service.characteristics:
                    print(f"   Characteristic UUID: {char.uuid}")
                    uuid_list.append(char.uuid)
        
        return uuid_list

    async def run(self) -> Tuple[Optional[str], List[str]]:
        """
        Run the full scanning process.
        
        Returns:
            Tuple of (MAC address, list of UUIDs)
        """
        mac_address, device = await self.scan_led()
        if mac_address:
            uuids = await self.scan_uuids(mac_address)
            return mac_address, uuids
        else:
            return None, []


class BJLEDInstance:
    """
    Main class for controlling MohuanLED Bluetooth lights.
    
    This class provides methods to connect to, control, and apply effects
    to MohuanLED brand lights via Bluetooth Low Energy (BLE).
    
    Attributes:
        _mac: MAC address of the LED device
        _uuid: UUID for the write characteristic
        _client: BleakClient instance for BLE communication
        _is_on: Current power state
        _rgb_color: Current RGB color
        _brightness: Current brightness (0-255)
        _effect: Current effect name
        _effect_speed: Effect speed
        _color_mode: Current color mode
        _scanner: Scanner instance for device discovery
    """
    
    def __init__(self, address: str = None, uuid: str = None, 
                 reset: bool = False, delay: int = 120) -> None:
        """
        Initialize a BJLEDInstance.
        
        Args:
            address: MAC address of the LED device (optional, will scan if not provided)
            uuid: UUID for the write characteristic (optional, will auto-detect if not provided)
            reset: Whether to reset the LED on connect
            delay: Connection delay in seconds
        """
        self.loop = asyncio.get_event_loop()
        self._mac = address or LED_MAC_ADDRESS
        self._uuid = uuid or LED_UUID
        self._reset = reset
        self._delay = delay
        self._client: BleakClient | None = None
        self._is_on = None
        self._rgb_color = None
        self._brightness = 255
        self._effect = None
        self._effect_speed = 0x64
        self._color_mode = "RGB"
        self._scanner = Scanner()

    async def initialize(self) -> None:
        """
        Initialize the LED connection.
        
        If MAC address or UUID is not provided, this will scan for
        devices and automatically detect the correct UUID.
        
        Raises:
            ValueError: If no LED device is found or no compatible UUID
        """
        if not self._mac or not self._uuid:
            LOGGER.info("MAC or UUID not provided. Searching for LED...")
            self._mac, uuids = await self._scanner.run()
            
            if not self._mac:
                raise ValueError("LED device not found. Make sure it is powered on and within range.")
            
            if uuids:
                await self._test_uuids(uuids)
            
            if not self._uuid:
                raise ValueError("No compatible UUID found for the LED device.")
        
        print(f"✅ Initialized LED with MAC: {self._mac}")
        print(f"   UUID: {self._uuid}")

    async def _test_uuids(self, uuids: List[str]) -> None:
        """
        Test UUIDs to find a compatible one for writing.
        
        Args:
            uuids: List of UUIDs to test
        """
        for uuid in uuids:
            try:
                self._uuid = uuid
                await self._ensure_connected()
                await self._write(TURN_ON_CMD)
                await self._write(TURN_OFF_CMD)
                LOGGER.info(f"Found compatible UUID: {uuid}")
                print(f"✅ Found compatible UUID: {uuid}")
                return
            except Exception as e:
                LOGGER.debug(f"UUID {uuid} not compatible: {str(e)}")
                await self._disconnect()
        
        self._uuid = None

    async def _ensure_connected(self) -> None:
        """
        Ensure the LED is connected.
        
        Raises:
            ValueError: If MAC address or UUID is not set
        """
        if not self._mac or not self._uuid:
            raise ValueError("MAC address or UUID is not set. Cannot connect.")
        
        if self._client and self._client.is_connected:
            return
        
        LOGGER.debug(f"Connecting to LED with MAC: {self._mac}")
        print(f"🔗 Connecting to LED at {self._mac}...")
        
        self._client = BleakClient(self._mac)
        await self._client.connect()
        
        print(f"✅ Connected to LED at {self._mac}")
        LOGGER.debug(f"Connected to LED at {self._mac}")

    async def _disconnect(self) -> None:
        """Disconnect from the LED device."""
        if self._client and self._client.is_connected:
            await self._client.disconnect()
            print(f"🔌 Disconnected from LED at {self._mac}")
            LOGGER.debug(f"Disconnected from LED at {self._mac}")

    async def _write(self, data: bytearray):
        """
        Write data to the LED device.
        
        Args:
            data: Bytearray to send to the device
        """
        await self._ensure_connected()
        await self._client.write_gatt_char(self._uuid, data, False)
        LOGGER.debug(f"Command {data.hex()} sent to LED at {self._mac}")

    async def turn_on(self):
        """Turn the LED on."""
        await self._ensure_connected()
        await self._write(TURN_ON_CMD)
        self._is_on = True
        print(f"💡 LED turned ON")
        LOGGER.info(f"LED at {self._mac} turned on")

    async def turn_off(self):
        """Turn the LED off."""
        await self._ensure_connected()
        await self._write(TURN_OFF_CMD)
        self._is_on = False
        print(f"🌑 LED turned OFF")
        LOGGER.info(f"LED at {self._mac} turned off")

    async def set_color_to_rgb(self, red: int, green: int, blue: int, brightness: int = None):
        """
        Set the LED to a specific RGB color.
        
        Args:
            red: Red value (0-255)
            green: Green value (0-255)
            blue: Blue value (0-255)
            brightness: Optional brightness (0-255), defaults to stored brightness
        """
        if brightness is None:
            brightness = self._brightness

        # Apply brightness scaling
        red = int(red * brightness / 255)
        green = int(green * brightness / 255)
        blue = int(blue * brightness / 255)

        # Build the RGB packet
        rgb_packet = bytearray.fromhex("69 96 05 02")
        rgb_packet.append(red)
        rgb_packet.append(green)
        rgb_packet.append(blue)

        await self._write(rgb_packet)
        self._rgb_color = (red, green, blue)
        
        print(f"🎨 LED set to RGB({red}, {green}, {blue})")
        LOGGER.info(f"LED at {self._mac} set to RGB color: {self._rgb_color}")

    async def set_brightness(self, brightness: int):
        """
        Set the LED brightness.
        
        Args:
            brightness: Brightness value (0-255)
        """
        self._brightness = max(0, min(255, brightness))
        print(f"☀️ Brightness set to {self._brightness}")

    async def fade_to_color(self, start_color: tuple, end_color: tuple, duration: float):
        """
        Fade effect between two colors.
        
        Args:
            start_color: Starting RGB tuple (r, g, b)
            end_color: Ending RGB tuple (r, g, b)
            duration: Duration of the fade in seconds
        """
        steps = 100
        delay = duration / steps

        r1, g1, b1 = start_color
        r2, g2, b2 = end_color

        for step in range(steps + 1):
            red = int(r1 + (r2 - r1) * step / steps)
            green = int(g1 + (g2 - g1) * step / steps)
            blue = int(b1 + (b2 - b1) * step / steps)

            await self.set_color_to_rgb(red, green, blue)
            await asyncio.sleep(delay)

        print(f"✨ Faded to color {end_color}")
        LOGGER.info(f"LED at {self._mac} faded to color: {self._rgb_color}")

    async def fade_between_colors(self, colors: list, duration_per_color: float):
        """
        Fade effect between multiple colors.
        
        Args:
            colors: List of RGB tuples [(r, g, b), ...]
            duration_per_color: Duration for each color transition in seconds
        """
        for i in range(len(colors) - 1):
            start_color = colors[i]
            end_color = colors[i + 1]
            await self.fade_to_color(start_color, end_color, duration_per_color)

        print(f"🌈 Completed fade between {len(colors)} colors")
        LOGGER.info(f"Completed fade between {len(colors)} colors.")

    async def wave_effect(self, colors: list, duration_per_wave: float):
        """
        Wave effect between multiple colors.
        
        Args:
            colors: List of RGB tuples [(r, g, b), ...]
            duration_per_wave: Duration per wave in seconds
        """
        steps = len(colors) - 1
        delay = duration_per_wave / steps

        for i in range(steps):
            start_color = colors[i]
            end_color = colors[i + 1]
            await self.fade_to_color(start_color, end_color, duration_per_wave)

        print(f"🌊 Completed wave effect")
        LOGGER.info(f"Completed wave effect.")

    async def rainbow_cycle(self, duration_per_color: float):
        """
        Rainbow cycle animation.
        
        Cycles through all hues in the color spectrum.
        
        Args:
            duration_per_color: Total duration of the cycle in seconds
        """
        print("🌈 Starting rainbow cycle...")
        steps = 360
        delay = duration_per_color / steps

        for hue in range(steps):
            r, g, b = [int(c * 255) for c in colorsys.hsv_to_rgb(hue / 360, 1.0, 1.0)]
            await self.set_color_to_rgb(r, g, b)
            await asyncio.sleep(delay)

        print("✨ Rainbow cycle complete!")
        LOGGER.info(f"Completed rainbow cycle.")

    async def breathing_light(self, color: tuple, duration: float):
        """
        Breathing effect - fades in and out.
        
        Args:
            color: RGB tuple (r, g, b)
            duration: Duration of one breath cycle in seconds
        """
        print(f"🫁 Starting breathing effect with color {color}...")
        steps = 100
        delay = duration / (steps * 2)

        r, g, b = color
        
        # Fade in
        for step in range(steps):
            brightness = int((step / steps) * 255)
            await self.set_color_to_rgb(r, g, b, brightness)
            await asyncio.sleep(delay)

        # Fade out
        for step in range(steps, 0, -1):
            brightness = int((step / steps) * 255)
            await self.set_color_to_rgb(r, g, b, brightness)
            await asyncio.sleep(delay)

        print(f"✨ Breathing effect complete!")
        LOGGER.info(f"Completed breathing effect with color {color}")

    async def strobe_light(self, color: tuple, duration: float, flashes: int):
        """
        Strobe light effect - rapid flashing.
        
        Args:
            color: RGB tuple (r, g, b)
            duration: Total duration of the effect in seconds
            flashes: Number of flashes
        """
        print(f"⚡ Starting strobe effect ({flashes} flashes)...")
        r, g, b = color
        delay = duration / (flashes * 2)

        for i in range(flashes):
            await self.set_color_to_rgb(r, g, b)
            await asyncio.sleep(delay)
            await self.turn_off()
            await asyncio.sleep(delay)
            print(f"   Flash {i + 1}/{flashes}")

        print(f"✨ Strobe effect complete!")
        LOGGER.info(f"Completed strobe effect with color {color} and {flashes} flashes.")

    async def color_cycle(self, colors: list, duration_per_color: float):
        """
        Continuously cycle through a list of colors.
        
        Note: This runs forever until interrupted.
        
        Args:
            colors: List of RGB tuples [(r, g, b), ...]
            duration_per_color: Duration for each color transition in seconds
        """
        print("🔄 Starting continuous color cycle (press Ctrl+C to stop)...")
        try:
            while True:
                await self.fade_between_colors(colors, duration_per_color)
                # Also fade from last back to first
                await self.fade_to_color(colors[-1], colors[0], duration_per_color)
        except asyncio.CancelledError:
            print("\n⏹️ Color cycle stopped")
            raise

    @property
    def is_on(self) -> bool:
        """Get the current power state."""
        return self._is_on

    @property
    def rgb_color(self) -> tuple:
        """Get the current RGB color."""
        return self._rgb_color

    @property
    def brightness(self) -> int:
        """Get the current brightness."""
        return self._brightness


# =============================================================================
# DEMO / CLI USAGE
# =============================================================================

async def demo():
    """
    Demo function showing various LED effects.
    """
    print("\n" + "="*60)
    print("🌈 MohuanLED Bluetooth Controller Demo")
    print("="*60 + "\n")
    
    led = BJLEDInstance()
    
    try:
        # Initialize and scan for device
        await led.initialize()
        
        # Turn on
        await led.turn_on()
        await asyncio.sleep(1)
        
        # Set to red
        print("\n🎨 Setting color to RED...")
        await led.set_color_to_rgb(255, 0, 0)
        await asyncio.sleep(2)
        
        # Set to green
        print("\n🎨 Setting color to GREEN...")
        await led.set_color_to_rgb(0, 255, 0)
        await asyncio.sleep(2)
        
        # Set to blue
        print("\n🎨 Setting color to BLUE...")
        await led.set_color_to_rgb(0, 0, 255)
        await asyncio.sleep(2)
        
        # Fade between colors
        print("\n✨ Fading between colors...")
        await led.fade_between_colors(
            [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0)],
            duration_per_color=2.0
        )
        
        # Rainbow cycle
        print("\n🌈 Rainbow cycle (5 seconds)...")
        await led.rainbow_cycle(5.0)
        
        # Breathing effect
        print("\n🫁 Breathing effect (3 seconds)...")
        await led.breathing_light((255, 100, 50), 3.0)
        
        # Strobe effect
        print("\n⚡ Strobe effect (5 flashes)...")
        await led.strobe_light((255, 255, 255), 2.0, 5)
        
        # Turn off
        print("\n🌑 Turning off...")
        await led.turn_off()
        
        print("\n✅ Demo complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        
    finally:
        await led._disconnect()


def main():
    """Main entry point for CLI usage."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="🌈 MohuanLED Bluetooth Controller",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run demo
  python mohuan_led_controller.py --demo
  
  # Turn on
  python mohuan_led_controller.py --on --mac 64:11:a8:00:8b:a6
  
  # Set color
  python mohuan_led_controller.py --color 255 0 0 --mac 64:11:a8:00:8b:a6
  
  # Rainbow cycle
  python mohuan_led_controller.py --rainbow 10 --mac 64:11:a8:00:8b:a6
  
  # Scan for devices
  python mohuan_led_controller.py --scan
        """
    )
    
    parser.add_argument("--demo", action="store_true", help="Run demo with all effects")
    parser.add_argument("--scan", action="store_true", help="Scan for LED devices")
    parser.add_argument("--on", action="store_true", help="Turn LED on")
    parser.add_argument("--off", action="store_true", help="Turn LED off")
    parser.add_argument("--color", nargs=3, type=int, metavar=("R", "G", "B"),
                        help="Set RGB color (0-255 for each)")
    parser.add_argument("--brightness", type=int, metavar="B",
                        help="Set brightness (0-255)")
    parser.add_argument("--rainbow", type=float, metavar="DURATION",
                        help="Run rainbow cycle for specified duration")
    parser.add_argument("--breathing", type=float, metavar="DURATION",
                        help="Run breathing effect for specified duration")
    parser.add_argument("--strobe", nargs=2, type=float, metavar=("DURATION", "FLASHES"),
                        help="Run strobe effect (duration, number of flashes)")
    parser.add_argument("--mac", type=str, help="MAC address of LED device")
    parser.add_argument("--uuid", type=str, help="UUID for write characteristic")
    
    args = parser.parse_args()
    
    async def run_cli():
        if args.demo:
            await demo()
            return
        
        if args.scan:
            scanner = Scanner()
            mac, uuids = await scanner.run()
            if mac:
                print(f"\n📋 Found device:")
                print(f"   MAC: {mac}")
                print(f"   UUIDs: {uuids}")
            return
        
        # For other commands, we need to connect to the LED
        led = BJLEDInstance(address=args.mac, uuid=args.uuid)
        
        try:
            await led.initialize()
            
            if args.on:
                await led.turn_on()
            
            if args.off:
                await led.turn_off()
            
            if args.brightness is not None:
                await led.set_brightness(args.brightness)
            
            if args.color:
                r, g, b = args.color
                await led.set_color_to_rgb(r, g, b)
            
            if args.rainbow:
                await led.rainbow_cycle(args.rainbow)
            
            if args.breathing:
                await led.breathing_light((255, 100, 50), args.breathing)
            
            if args.strobe:
                duration, flashes = args.strobe
                await led.strobe_light((255, 255, 255), duration, int(flashes))
                
        except Exception as e:
            print(f"❌ Error: {e}")
        finally:
            await led._disconnect()
    
    asyncio.run(run_cli())


if __name__ == "__main__":
    main()
