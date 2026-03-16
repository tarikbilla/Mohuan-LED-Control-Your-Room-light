"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Lightbulb,
  LightbulbOff,
  Bluetooth,
  BluetoothOff,
  Search,
  Palette,
  Sun,
  Zap,
  Rainbow,
  Wind,
  StopCircle,
  RefreshCw,
  Circle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
interface LEDDevice {
  name: string;
  mac_address: string;
  uuids: string[];
}

interface LEDState {
  is_on: boolean;
  rgb_color: [number, number, number];
  brightness: number;
  effect: string | null;
  mac_address: string | null;
  uuid: string | null;
  is_connected: boolean;
}

// LED Service API (port 3030)
const LED_SERVICE_PORT = 3030;
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/led${endpoint}?XTransformPort=${LED_SERVICE_PORT}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
};

export default function LEDController() {
  const { toast } = useToast();
  
  // State
  const [ledState, setLedState] = useState<LEDState>({
    is_on: false,
    rgb_color: [255, 255, 255],
    brightness: 255,
    effect: null,
    mac_address: null,
    uuid: null,
    is_connected: false,
  });
  
  const [devices, setDevices] = useState<LEDDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ffffff");
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = `/api/led/ws?XTransformPort=${LED_SERVICE_PORT}`;
    const ws = new WebSocket(`ws://${window.location.host}${wsUrl}`);
    
    ws.onopen = () => {
      setWsConnected(true);
      console.log("WebSocket connected");
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "state") {
          setLedState(message.data);
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    };
    
    ws.onclose = () => {
      setWsConnected(false);
      console.log("WebSocket disconnected");
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    
    wsRef.current = ws;
  }, []);

  // Fetch current state
  const fetchState = useCallback(async () => {
    try {
      const data = await apiCall("/state");
      setLedState(data);
      if (data.rgb_color) {
        const [r, g, b] = data.rgb_color;
        setSelectedColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
      }
    } catch (e) {
      console.error("Failed to fetch state:", e);
    }
  }, []);

  // Scan for devices
  const scanDevices = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const data = await apiCall("/scan");
      setDevices(data.devices || []);
      if (data.devices?.length === 0) {
        toast({
          title: "No devices found",
          description: "Make sure your LED is powered on and in range.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Found devices",
          description: `Found ${data.devices.length} LED device(s)`,
        });
      }
    } catch (e) {
      setError("Failed to scan for devices");
      toast({
        title: "Scan failed",
        description: "Could not scan for Bluetooth devices",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to device
  const connectDevice = async (macAddress: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      await apiCall("/connect", {
        method: "POST",
        body: JSON.stringify({ mac_address: macAddress }),
      });
      toast({
        title: "Connected",
        description: `Connected to LED at ${macAddress}`,
      });
    } catch (e) {
      setError("Failed to connect to device");
      toast({
        title: "Connection failed",
        description: "Could not connect to the LED device",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const disconnect = async () => {
    try {
      await apiCall("/disconnect", { method: "POST" });
      toast({
        title: "Disconnected",
        description: "LED disconnected",
      });
    } catch (e) {
      toast({
        title: "Disconnect failed",
        description: "Could not disconnect from LED",
        variant: "destructive",
      });
    }
  };

  // Turn on
  const turnOn = async () => {
    setIsLoading(true);
    try {
      await apiCall("/on", { method: "POST" });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to turn on LED",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Turn off
  const turnOff = async () => {
    setIsLoading(true);
    try {
      await apiCall("/off", { method: "POST" });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to turn off LED",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Set color
  const setColor = async (r: number, g: number, b: number, brightness?: number) => {
    try {
      await apiCall("/color", {
        method: "POST",
        body: JSON.stringify({ red: r, green: g, blue: b, brightness }),
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to set color",
        variant: "destructive",
      });
    }
  };

  // Set brightness
  const setBrightness = async (value: number) => {
    try {
      await apiCall("/brightness", {
        method: "POST",
        body: JSON.stringify({ brightness: value }),
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to set brightness",
        variant: "destructive",
      });
    }
  };

  // Start effect
  const startEffect = async (effect: string, duration: number = 10, color?: [number, number, number], flashes?: number) => {
    try {
      const body: Record<string, unknown> = { duration };
      if (color) body.color = color;
      if (flashes) body.flashes = flashes;
      
      await apiCall(`/effects/${effect}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast({
        title: "Effect started",
        description: `${effect.charAt(0).toUpperCase() + effect.slice(1)} effect started`,
      });
    } catch (e) {
      toast({
        title: "Error",
        description: `Failed to start ${effect} effect`,
        variant: "destructive",
      });
    }
  };

  // Stop effects
  const stopEffects = async () => {
    try {
      await apiCall("/effects/stop", { method: "POST" });
      toast({
        title: "Effects stopped",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to stop effects",
        variant: "destructive",
      });
    }
  };

  // Handle color picker change
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setSelectedColor(hex);
    
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    setColor(r, g, b);
  };

  // Preset colors
  const presetColors = [
    { name: "Red", color: "#ff0000" },
    { name: "Green", color: "#00ff00" },
    { name: "Blue", color: "#0000ff" },
    { name: "Yellow", color: "#ffff00" },
    { name: "Cyan", color: "#00ffff" },
    { name: "Magenta", color: "#ff00ff" },
    { name: "Orange", color: "#ff8000" },
    { name: "Purple", color: "#8000ff" },
    { name: "Pink", color: "#ff0080" },
    { name: "White", color: "#ffffff" },
    { name: "Warm", color: "#ffaa55" },
    { name: "Cool", color: "#55aaff" },
  ];

  // Initialize
  useEffect(() => {
    fetchState();
    connectWebSocket();
    
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchState, connectWebSocket]);

  // Effect icons
  const getEffectIcon = (effect: string | null) => {
    switch (effect) {
      case "rainbow":
        return <Rainbow className="h-4 w-4" />;
      case "breathing":
        return <Wind className="h-4 w-4" />;
      case "strobe":
        return <Zap className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">MohuanLED Controller</h1>
              <p className="text-sm text-gray-400">Bluetooth LED Control</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {ledState.is_connected ? (
                <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/30">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
            
            {/* WebSocket Status */}
            <div className="flex items-center gap-2">
              {wsConnected ? (
                <Badge variant="outline" className="border-green-500/30 text-green-400">
                  <Circle className="h-2 w-2 fill-green-400 mr-1" />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                  <Circle className="h-2 w-2 fill-yellow-400 mr-1" />
                  Reconnecting...
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Connection */}
          <div className="space-y-6">
            {/* Device Scanner */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bluetooth className="h-5 w-5 text-blue-400" />
                  Device Connection
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Scan and connect to your MohuanLED device
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={scanDevices}
                  disabled={isScanning || isConnecting}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Scan for Devices
                    </>
                  )}
                </Button>
                
                {/* Device List */}
                {devices.length > 0 && (
                  <ScrollArea className="h-40 rounded-lg border border-white/10">
                    <div className="p-2 space-y-2">
                      {devices.map((device) => (
                        <div
                          key={device.mac_address}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                          onClick={() => !ledState.is_connected && connectDevice(device.mac_address)}
                        >
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="text-xs text-gray-400">{device.mac_address}</p>
                          </div>
                          {ledState.mac_address === device.mac_address ? (
                            <Badge variant="default" className="bg-green-500">Connected</Badge>
                          ) : (
                            <Button size="sm" variant="ghost">
                              Connect
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                {/* Disconnect Button */}
                {ledState.is_connected && (
                  <Button
                    onClick={disconnect}
                    variant="destructive"
                    className="w-full"
                  >
                    <BluetoothOff className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Current Status */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Status
                  {ledState.effect && (
                    <Badge variant="secondary" className="ml-2">
                      {getEffectIcon(ledState.effect)}
                      <span className="ml-1">{ledState.effect}</span>
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Power</p>
                    <p className="font-medium flex items-center gap-2">
                      {ledState.is_on ? (
                        <>
                          <Lightbulb className="h-4 w-4 text-yellow-400" />
                          <span className="text-green-400">ON</span>
                        </>
                      ) : (
                        <>
                          <LightbulbOff className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-400">OFF</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Brightness</p>
                    <p className="font-medium">{Math.round((ledState.brightness / 255) * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Color</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{
                          backgroundColor: `rgb(${ledState.rgb_color[0]}, ${ledState.rgb_color[1]}, ${ledState.rgb_color[2]})`
                        }}
                      />
                      <span className="font-mono text-xs">
                        RGB({ledState.rgb_color.join(", ")})
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400">MAC</p>
                    <p className="font-mono text-xs">
                      {ledState.mac_address || "Not connected"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Main Controls */}
          <div className="space-y-6">
            {/* Power Control */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Power Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    onClick={turnOn}
                    disabled={!ledState.is_connected || isLoading || ledState.is_on}
                    size="lg"
                    className="h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50"
                  >
                    <Lightbulb className="h-8 w-8" />
                  </Button>
                  
                  <Button
                    onClick={turnOff}
                    disabled={!ledState.is_connected || isLoading || !ledState.is_on}
                    size="lg"
                    variant="outline"
                    className="h-20 w-20 rounded-full border-white/20 hover:bg-white/10 disabled:opacity-50"
                  >
                    <LightbulbOff className="h-8 w-8" />
                  </Button>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="power-switch">Power</Label>
                    <Switch
                      id="power-switch"
                      checked={ledState.is_on}
                      disabled={!ledState.is_connected || isLoading}
                      onCheckedChange={(checked) => checked ? turnOn() : turnOff()}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Color Control */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-pink-400" />
                  Color Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Color Picker */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={handleColorChange}
                      disabled={!ledState.is_connected || !ledState.is_on}
                      className="w-32 h-32 rounded-full cursor-pointer border-4 border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        boxShadow: `0 0 60px ${selectedColor}40`,
                      }}
                    />
                  </div>
                </div>
                
                {/* Preset Colors */}
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Quick Colors</p>
                  <div className="grid grid-cols-6 gap-2">
                    {presetColors.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setSelectedColor(preset.color);
                          const r = parseInt(preset.color.slice(1, 3), 16);
                          const g = parseInt(preset.color.slice(3, 5), 16);
                          const b = parseInt(preset.color.slice(5, 7), 16);
                          setColor(r, g, b);
                        }}
                        disabled={!ledState.is_connected || !ledState.is_on}
                        className="w-full aspect-square rounded-lg border border-white/20 hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: preset.color }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Brightness Control */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-yellow-400" />
                  Brightness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Slider
                    value={[ledState.brightness]}
                    min={0}
                    max={255}
                    step={1}
                    disabled={!ledState.is_connected || !ledState.is_on}
                    onValueChange={(value) => setBrightness(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>0%</span>
                    <span className="text-white font-medium">
                      {Math.round((ledState.brightness / 255) * 100)}%
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Effects */}
          <div className="space-y-6">
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-400" />
                  Effects
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Apply dynamic lighting effects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rainbow Effect */}
                <Button
                  onClick={() => startEffect("rainbow", 10)}
                  disabled={!ledState.is_connected || !ledState.is_on || ledState.effect === "rainbow"}
                  className="w-full h-16 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 hover:opacity-90"
                >
                  <Rainbow className="h-5 w-5 mr-2" />
                  Rainbow Cycle
                </Button>
                
                {/* Breathing Effect */}
                <Button
                  onClick={() => startEffect("breathing", 3, ledState.rgb_color)}
                  disabled={!ledState.is_connected || !ledState.is_on || ledState.effect === "breathing"}
                  className="w-full h-16 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Wind className="h-5 w-5 mr-2" />
                  Breathing
                </Button>
                
                {/* Strobe Effect */}
                <Button
                  onClick={() => startEffect("strobe", 2, [255, 255, 255], 10)}
                  disabled={!ledState.is_connected || !ledState.is_on || ledState.effect === "strobe"}
                  className="w-full h-16 bg-gradient-to-r from-yellow-500 to-red-500 hover:from-yellow-600 hover:to-red-600"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Strobe Light
                </Button>
                
                <Separator className="bg-white/10" />
                
                {/* Stop Effects */}
                <Button
                  onClick={stopEffects}
                  disabled={!ledState.effect}
                  variant="destructive"
                  className="w-full"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Stop Effects
                </Button>
              </CardContent>
            </Card>

            {/* Effect Settings */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Effect Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg bg-black/50 overflow-hidden relative">
                  {/* Simulated LED Preview */}
                  <div
                    className={`absolute inset-4 rounded-lg transition-all duration-300 ${
                      ledState.is_on ? "opacity-100" : "opacity-0"
                    }`}
                    style={{
                      backgroundColor: ledState.is_on
                        ? `rgb(${ledState.rgb_color[0]}, ${ledState.rgb_color[1]}, ${ledState.rgb_color[2]})`
                        : "transparent",
                      boxShadow: ledState.is_on
                        ? `0 0 ${ledState.brightness / 5}px ${ledState.rgb_color.join(",")}, inset 0 0 ${ledState.brightness / 10}px rgba(255,255,255,0.2)`
                        : "none",
                      filter: `brightness(${(ledState.brightness / 255) * 1.5})`,
                    }}
                  />
                  
                  {!ledState.is_connected && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <p>Connect to LED to preview</p>
                    </div>
                  )}
                  
                  {ledState.is_connected && !ledState.is_on && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <p>Turn on to preview</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 bg-black/20 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm text-gray-400">
          <p>MohuanLED Controller for macOS</p>
          <p>Built with Next.js & Bluetooth LE</p>
        </div>
      </footer>

      {/* Error Dialog */}
      <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setError(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
