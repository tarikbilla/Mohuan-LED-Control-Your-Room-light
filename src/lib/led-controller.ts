/**
 * MohuanLED Bluetooth Controller
 * 
 * Hybrid controller that supports two modes:
 * 1. Web Bluetooth API - Direct browser-to-LED communication (when available)
 * 2. Backend API - Via Python service running on localhost:3030
 * 
 * Automatically detects which mode to use based on browser capabilities.
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
  mode: 'web-bluetooth' | 'backend-api' | 'demo' | 'unknown';
}

export type ConnectionMode = 'web-bluetooth' | 'backend-api' | 'demo';

class LEDBluetoothController {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private state: LEDState = {
    isOn: false,
    rgbColor: [255, 255, 255],
    brightness: 255,
    effect: null,
    isConnected: false,
    deviceName: null,
    mode: 'unknown',
  };
  private stateListeners: Set<(state: LEDState) => void> = new Set();
  private effectInterval: NodeJS.Timeout | null = null;
  private mode: ConnectionMode = 'web-bluetooth';
  private isDemoMode = false;

  /**
   * Check if Web Bluetooth is supported
   */
  isWebBluetoothSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    if (!('bluetooth' in navigator)) return false;
    
    // Check if we're in a secure context
    if (!window.isSecureContext) return false;
    
    // Try to check if bluetooth feature is allowed
    try {
      // This might throw in restricted environments
      return typeof navigator.bluetooth.requestDevice === 'function';
    } catch {
      return false;
    }
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
   * Get current connection mode
   */
  getMode(): ConnectionMode {
    return this.mode;
  }

  /**
   * Set connection mode
   */
  setMode(mode: ConnectionMode): void {
    this.mode = mode;
    this.updateState({ mode });
  }

  /**
   * Connect using Web Bluetooth API
   */
  private async connectWebBluetooth(): Promise<boolean> {
    if (!this.isWebBluetoothSupported()) {
      throw new Error('Web Bluetooth is not supported or allowed in this context.');
    }

    try {
      // Request Bluetooth device
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'BJ_LED_M' },
          { namePrefix: 'LED' },
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

      // Find writable characteristic
      const services = await this.server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write) {
            this.characteristic = char;
            console.log('Found writable characteristic:', char.uuid);
            break;
          }
        }
        if (this.characteristic) break;
      }

      if (!this.characteristic) {
        throw new Error('No writable characteristic found');
      }

      this.mode = 'web-bluetooth';
      this.updateState({
        isConnected: true,
        deviceName: this.device.name || 'Unknown',
        mode: 'web-bluetooth',
      });

      return true;
    } catch (error) {
      console.error('Web Bluetooth connection error:', error);
      throw error;
    }
  }

  /**
   * Connect using Demo Mode (simulated Bluetooth for testing)
   */
  private async connectDemoMode(): Promise<boolean> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.mode = 'demo';
    this.isDemoMode = true;
    this.updateState({
      isConnected: true,
      deviceName: 'Demo LED (Simulated)',
      mode: 'demo',
      isOn: false,
    });
    
    return true;
  }

  /**
   * Connect using Backend API
   */
  private async connectBackendAPI(): Promise<boolean> {
    try {
      // First check if backend is running
      const healthCheck = await fetch('/api/led');
      if (!healthCheck.ok) {
        throw new Error('LED backend service is not running. Please start it with: python led-backend/led_service.py');
      }

      // Connect via backend
      const response = await fetch('/api/led/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Extract the detailed error message from the backend
        const errorMessage = errorData.detail || errorData.error || 'Failed to connect via backend';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      this.mode = 'backend-api';
      this.updateState({
        isConnected: true,
        deviceName: data.device || 'LED Device',
        mode: 'backend-api',
      });

      // Start polling for state updates
      this.startStatePolling();

      return true;
    } catch (error) {
      console.error('Backend API connection error:', error);
      throw error;
    }
  }

  /**
   * Poll backend for state updates
   */
  private pollingInterval: NodeJS.Timeout | null = null;
  
  private startStatePolling(): void {
    if (this.pollingInterval) return;
    
    this.pollingInterval = setInterval(async () => {
      if (this.mode !== 'backend-api' || !this.state.isConnected) {
        return;
      }
      
      try {
        const response = await fetch('/api/led');
        if (response.ok) {
          const data = await response.json();
          this.updateState({
            isOn: data.is_on,
            rgbColor: data.rgb_color,
            brightness: data.brightness,
            effect: data.effect,
            deviceName: data.device_name,
            isConnected: data.is_connected,
          });
        }
      } catch (e) {
        console.error('State polling error:', e);
      }
    }, 1000);
  }

  private stopStatePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Connect to LED (uses selected mode)
   */
  async connect(): Promise<boolean> {
    console.log('Connect called with mode:', this.mode);
    
    // If demo mode is selected, use that
    if (this.mode === 'demo') {
      console.log('Using demo mode');
      return await this.connectDemoMode();
    }
    
    // If backend mode is selected, use that
    if (this.mode === 'backend-api') {
      console.log('Using backend API mode');
      return await this.connectBackendAPI();
    }
    
    // Web Bluetooth mode - check if supported first
    if (!this.isWebBluetoothSupported()) {
      throw new Error('Web Bluetooth is not available in this environment. Please select "Backend" or "Demo" mode.');
    }
    
    // Try Web Bluetooth
    console.log('Trying Web Bluetooth');
    return await this.connectWebBluetooth();
  }

  /**
   * Connect using backend API specifically
   */
  async connectWithBackend(): Promise<boolean> {
    return await this.connectBackendAPI();
  }

  /**
   * Connect using demo mode
   */
  async connectWithDemo(): Promise<boolean> {
    return await this.connectDemoMode();
  }

  /**
   * Handle disconnection
   */
  private onDisconnected(): void {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.stopEffect();
    this.stopStatePolling();
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
    this.stopEffect();
    this.isDemoMode = false;
    
    if (this.mode === 'web-bluetooth' && this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    } else if (this.mode === 'backend-api') {
      try {
        await fetch('/api/led/disconnect', { method: 'POST' });
      } catch (e) {
        console.error('Disconnect error:', e);
      }
    }
    
    this.stopStatePolling();
    this.onDisconnected();
  }

  /**
   * Write command to LED
   */
  private async writeWebBluetooth(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Not connected to LED');
    }
    await this.characteristic.writeValue(data);
  }

  /**
   * Turn LED on
   */
  async turnOn(): Promise<void> {
    if (this.mode === 'demo') {
      // Simulate turn on
      await new Promise(resolve => setTimeout(resolve, 100));
      this.updateState({ isOn: true });
      return;
    }
    
    if (this.mode === 'web-bluetooth') {
      await this.writeWebBluetooth(TURN_ON_CMD);
      this.updateState({ isOn: true });
    } else {
      const response = await fetch('/api/led/on', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to turn on');
    }
  }

  /**
   * Turn LED off
   */
  async turnOff(): Promise<void> {
    this.stopEffect();
    
    if (this.mode === 'demo') {
      // Simulate turn off
      await new Promise(resolve => setTimeout(resolve, 100));
      this.updateState({ isOn: false, effect: null });
      return;
    }
    
    if (this.mode === 'web-bluetooth') {
      await this.writeWebBluetooth(TURN_OFF_CMD);
      this.updateState({ isOn: false, effect: null });
    } else {
      const response = await fetch('/api/led/off', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to turn off');
    }
  }

  /**
   * Set LED color (RGB)
   */
  async setColor(r: number, g: number, b: number, brightness?: number): Promise<void> {
    const br = brightness ?? this.state.brightness;
    
    if (this.mode === 'demo') {
      // Simulate color change
      await new Promise(resolve => setTimeout(resolve, 50));
      this.updateState({
        rgbColor: [r, g, b],
        brightness: br,
      });
      return;
    }
    
    if (this.mode === 'web-bluetooth') {
      // Apply brightness scaling
      const red = Math.round((r * br) / 255);
      const green = Math.round((g * br) / 255);
      const blue = Math.round((b * br) / 255);

      const colorCmd = new Uint8Array([0x69, 0x96, 0x05, 0x02, red, green, blue]);
      await this.writeWebBluetooth(colorCmd);
      
      this.updateState({
        rgbColor: [r, g, b],
        brightness: br,
      });
    } else {
      const response = await fetch('/api/led/color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ red: r, green: g, blue: b, brightness: br }),
      });
      if (!response.ok) throw new Error('Failed to set color');
    }
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
    
    if (this.mode === 'backend-api') {
      fetch('/api/led/effects/stop', { method: 'POST' }).catch(() => {});
    }
    
    this.updateState({ effect: null });
  }

  /**
   * Rainbow cycle effect
   */
  async startRainbowEffect(duration: number = 10): Promise<void> {
    this.stopEffect();
    
    if (this.mode === 'backend-api') {
      const response = await fetch('/api/led/effects/rainbow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      });
      if (!response.ok) throw new Error('Failed to start rainbow effect');
      this.updateState({ effect: 'rainbow' });
      return;
    }

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
    
    if (this.mode === 'backend-api') {
      const response = await fetch('/api/led/effects/breathing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      });
      if (!response.ok) throw new Error('Failed to start breathing effect');
      this.updateState({ effect: 'breathing' });
      return;
    }

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
    
    if (this.mode === 'backend-api') {
      const response = await fetch('/api/led/effects/strobe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, flashes }),
      });
      if (!response.ok) throw new Error('Failed to start strobe effect');
      this.updateState({ effect: 'strobe' });
      return;
    }

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
        await this.writeWebBluetooth(TURN_OFF_CMD);
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
