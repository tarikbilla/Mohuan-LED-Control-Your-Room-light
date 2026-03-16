/**
 * MohuanLED Bluetooth Controller
 * 
 * Uses Web Bluetooth API for direct BLE communication from the browser.
 * No backend service required!
 * 
 * Supported browsers: Chrome, Edge, Opera (requires HTTPS or localhost)
 */

// LED Command definitions
const TURN_ON_CMD = new Uint8Array([0x69, 0x96, 0x02, 0x01, 0x01]);
const TURN_OFF_CMD = new Uint8Array([0x69, 0x96, 0x02, 0x01, 0x00]);

// LED Service UUID (common for MohuanLED devices)
const LED_SERVICE_UUID = '0000ee02-0000-1000-2000-00805f9b34fb';
const LED_CHARACTERISTIC_UUID = '0000ee02-0000-1000-2000-00805f9b34fb';

export interface LEDState {
  isOn: boolean;
  rgbColor: [number, number, number];
  brightness: number;
  effect: string | null;
  isConnected: boolean;
  deviceName: string | null;
}

export interface LEDDevice {
  name: string;
  id: string;
}

class LEDBluetoothController {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private state: LEDState = {
    isOn: false,
    rgbColor: [255, 255, 255],
    brightness: 255,
    effect: null,
    isConnected: false,
    deviceName: null,
  };
  private stateListeners: Set<(state: LEDState) => void> = new Set();
  private effectInterval: NodeJS.Timeout | null = null;

  /**
   * Check if Web Bluetooth is supported
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Get current state
   */
  getState(): LEDState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: LEDState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyState(): void {
    const state = this.getState();
    this.stateListeners.forEach(listener => listener(state));
  }

  /**
   * Update state
   */
  private updateState(partial: Partial<LEDState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyState();
  }

  /**
   * Scan and connect to LED device
   */
  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }

    try {
      // Request Bluetooth device
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'BJ_LED_M' },
          { namePrefix: 'LED' },
          { services: [LED_SERVICE_UUID] },
        ],
        optionalServices: ['generic_access', LED_SERVICE_UUID],
      });

      console.log('Device found:', this.device.name);

      // Handle disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.onDisconnected();
      });

      // Connect to GATT server
      this.server = await this.device.gatt?.connect();
      
      if (!this.server) {
        throw new Error('Failed to connect to GATT server');
      }

      // Get service and characteristic
      try {
        this.service = await this.server.getPrimaryService(LED_SERVICE_UUID);
        this.characteristic = await this.service.getCharacteristic(LED_CHARACTERISTIC_UUID);
      } catch {
        // Try to discover services automatically
        const services = await this.server.getPrimaryServices();
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write) {
                this.service = service;
                this.characteristic = char;
                console.log('Found writable characteristic:', char.uuid);
                break;
              }
            }
            if (this.characteristic) break;
          } catch (e) {
            console.log('Service exploration error:', e);
          }
        }
      }

      if (!this.characteristic) {
        throw new Error('No writable characteristic found');
      }

      this.updateState({
        isConnected: true,
        deviceName: this.device.name || 'Unknown',
      });

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    }
  }

  /**
   * Handle disconnection
   */
  private onDisconnected(): void {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.stopEffect();
    this.updateState({
      isConnected: false,
      isOn: false,
      deviceName: null,
      effect: null,
    });
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.onDisconnected();
  }

  /**
   * Write command to LED
   */
  private async write(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Not connected to LED');
    }
    await this.characteristic.writeValue(data);
  }

  /**
   * Turn LED on
   */
  async turnOn(): Promise<void> {
    await this.write(TURN_ON_CMD);
    this.updateState({ isOn: true });
  }

  /**
   * Turn LED off
   */
  async turnOff(): Promise<void> {
    this.stopEffect();
    await this.write(TURN_OFF_CMD);
    this.updateState({ isOn: false, effect: null });
  }

  /**
   * Set LED color (RGB)
   */
  async setColor(r: number, g: number, b: number, brightness?: number): Promise<void> {
    const br = brightness ?? this.state.brightness;
    
    // Apply brightness scaling
    const red = Math.round((r * br) / 255);
    const green = Math.round((g * br) / 255);
    const blue = Math.round((b * br) / 255);

    // Build color packet
    const colorCmd = new Uint8Array([0x69, 0x96, 0x05, 0x02, red, green, blue]);
    await this.write(colorCmd);
    
    this.updateState({
      rgbColor: [r, g, b],
      brightness: br,
    });
  }

  /**
   * Set brightness
   */
  async setBrightness(brightness: number): Promise<void> {
    const [r, g, b] = this.state.rgbColor;
    await this.setColor(r, g, b, brightness);
  }

  /**
   * Stop current effect
   */
  stopEffect(): void {
    if (this.effectInterval) {
      clearInterval(this.effectInterval);
      this.effectInterval = null;
    }
    this.updateState({ effect: null });
  }

  /**
   * Rainbow cycle effect
   */
  async startRainbowEffect(duration: number = 10): Promise<void> {
    this.stopEffect();
    this.updateState({ effect: 'rainbow' });
    
    const steps = 360;
    const delay = (duration * 1000) / steps;
    let hue = 0;

    this.effectInterval = setInterval(async () => {
      if (!this.state.isConnected || this.state.effect !== 'rainbow') {
        this.stopEffect();
        return;
      }

      const [r, g, b] = this.hsvToRgb(hue / 360, 1, 1);
      await this.setColor(r, g, b);
      
      hue = (hue + 1) % 360;
    }, delay);
  }

  /**
   * Breathing effect
   */
  async startBreathingEffect(duration: number = 3): Promise<void> {
    this.stopEffect();
    this.updateState({ effect: 'breathing' });
    
    const steps = 50;
    const delay = (duration * 1000) / (steps * 2);
    let step = 0;
    let increasing = true;
    const [r, g, b] = this.state.rgbColor;

    this.effectInterval = setInterval(async () => {
      if (!this.state.isConnected || this.state.effect !== 'breathing') {
        this.stopEffect();
        return;
      }

      const brightness = Math.round((step / steps) * 255);
      await this.setColor(r, g, b, brightness);

      if (increasing) {
        step++;
        if (step >= steps) increasing = false;
      } else {
        step--;
        if (step <= 0) increasing = true;
      }
    }, delay);
  }

  /**
   * Strobe effect
   */
  async startStrobeEffect(duration: number = 2, flashes: number = 10): Promise<void> {
    this.stopEffect();
    this.updateState({ effect: 'strobe' });
    
    const delay = (duration * 1000) / (flashes * 2);
    let count = 0;
    let isOn = true;
    const [r, g, b] = this.state.rgbColor;

    this.effectInterval = setInterval(async () => {
      if (!this.state.isConnected || count >= flashes * 2) {
        this.stopEffect();
        await this.turnOff();
        return;
      }

      if (isOn) {
        await this.setColor(r, g, b, 255);
      } else {
        await this.write(TURN_OFF_CMD);
      }

      isOn = !isOn;
      count++;
    }, delay);
  }

  /**
   * Convert HSV to RGB
   */
  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    let r, g, b;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
      default: r = 0; g = 0; b = 0;
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
}

// Singleton instance
export const ledController = new LEDBluetoothController();
