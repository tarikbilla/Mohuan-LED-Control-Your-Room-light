"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Palette,
  Sun,
  Zap,
  Rainbow,
  Wind,
  StopCircle,
  Circle,
  Wifi,
  WifiOff,
  AlertTriangle,
  Info,
  Server,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ledController, LEDState, ConnectionMode } from "@/lib/led-controller";

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

export default function LEDController() {
  const { toast } = useToast();
  
  // State
  const [ledState, setLedState] = useState<LEDState>({
    isOn: false,
    rgbColor: [255, 255, 255],
    brightness: 255,
    effect: null,
    isConnected: false,
    deviceName: null,
    mode: 'unknown',
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ffffff");
  const [error, setError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('web-bluetooth');
  const [isWebBluetoothAvailable, setIsWebBluetoothAvailable] = useState(true);

  // Subscribe to LED controller state changes
  useEffect(() => {
    // Check Web Bluetooth availability
    const webBTAvailable = ledController.isWebBluetoothSupported();
    setIsWebBluetoothAvailable(webBTAvailable);
    
    if (!webBTAvailable) {
      setConnectionMode('backend-api');
      ledController.setMode('backend-api');
    }

    const unsubscribe = ledController.subscribe((state) => {
      setLedState(state);
      if (state.rgbColor) {
        const [r, g, b] = state.rgbColor;
        setSelectedColor(
          `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
        );
      }
    });

    return () => unsubscribe();
  }, []);

  // Connect to LED
  const connectDevice = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      ledController.setMode(connectionMode);
      await ledController.connect();
      toast({
        title: "Connected!",
        description: `Connected to ${ledController.getState().deviceName} via ${connectionMode === 'web-bluetooth' ? 'Web Bluetooth' : 'Backend API'}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      toast({
        title: "Connection Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [connectionMode, toast]);

  // Disconnect
  const disconnect = useCallback(async () => {
    await ledController.disconnect();
    toast({
      title: "Disconnected",
      description: "LED disconnected",
    });
  }, [toast]);

  // Turn on
  const turnOn = useCallback(async () => {
    setIsLoading(true);
    try {
      await ledController.turnOn();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to turn on LED",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Turn off
  const turnOff = useCallback(async () => {
    setIsLoading(true);
    try {
      await ledController.turnOff();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to turn off LED",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Set color
  const setColor = useCallback(async (r: number, g: number, b: number, brightness?: number) => {
    try {
      await ledController.setColor(r, g, b, brightness);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to set color",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Set brightness
  const setBrightness = useCallback(async (value: number) => {
    try {
      await ledController.setBrightness(value);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to set brightness",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Start effect
  const startEffect = useCallback(async (effect: string, duration: number = 10) => {
    try {
      switch (effect) {
        case "rainbow":
          await ledController.startRainbowEffect(duration);
          break;
        case "breathing":
          await ledController.startBreathingEffect(3);
          break;
        case "strobe":
          await ledController.startStrobeEffect(2, 10);
          break;
      }
      toast({
        title: "Effect Started",
        description: `${effect.charAt(0).toUpperCase() + effect.slice(1)} effect started`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : `Failed to start ${effect} effect`,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Stop effects
  const stopEffects = useCallback(() => {
    ledController.stopEffect();
    toast({
      title: "Effects Stopped",
    });
  }, [toast]);

  // Handle color picker change
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setSelectedColor(hex);
    
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    setColor(r, g, b);
  };

  // Get effect icon
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
              <p className="text-sm text-gray-400">Bluetooth LED Control • Next.js</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection Mode Badge */}
            {ledState.isConnected && (
              <Badge variant="outline" className={
                ledState.mode === 'web-bluetooth' 
                  ? "border-blue-500/30 text-blue-400"
                  : "border-green-500/30 text-green-400"
              }>
                {ledState.mode === 'web-bluetooth' ? (
                  <>
                    <Globe className="h-3 w-3 mr-1" />
                    Web Bluetooth
                  </>
                ) : (
                  <>
                    <Server className="h-3 w-3 mr-1" />
                    Backend API
                  </>
                )}
              </Badge>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {ledState.isConnected ? (
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
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Web Bluetooth Not Available Warning */}
        {!isWebBluetoothAvailable && (
          <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-500">Web Bluetooth Unavailable</AlertTitle>
            <AlertDescription className="text-yellow-200">
              Web Bluetooth is not available in this environment. Using Backend API mode instead.
              <br />
              <strong>Make sure to run the Python backend:</strong>
              <code className="block mt-2 p-2 bg-black/30 rounded text-sm">
                python led-backend/led_service.py
              </code>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Connection */}
          <div className="space-y-6">
            {/* Device Connection */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bluetooth className="h-5 w-5 text-blue-400" />
                  Device Connection
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Connect to your MohuanLED device
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Connection Mode Selector */}
                {isWebBluetoothAvailable && !ledState.isConnected && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-400">Connection Mode</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={connectionMode === 'web-bluetooth' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setConnectionMode('web-bluetooth')}
                        className={connectionMode === 'web-bluetooth' 
                          ? "bg-blue-500 hover:bg-blue-600"
                          : "border-white/20 hover:bg-white/10"
                        }
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Web Bluetooth
                      </Button>
                      <Button
                        variant={connectionMode === 'backend-api' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setConnectionMode('backend-api')}
                        className={connectionMode === 'backend-api'
                          ? "bg-green-500 hover:bg-green-600"
                          : "border-white/20 hover:bg-white/10"
                        }
                      >
                        <Server className="h-4 w-4 mr-2" />
                        Backend API
                      </Button>
                    </div>
                  </div>
                )}
                
                {!ledState.isConnected ? (
                  <>
                    <Button
                      onClick={connectDevice}
                      disabled={isConnecting}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                    >
                      {isConnecting ? (
                        <>
                          <Circle className="h-4 w-4 mr-2 animate-pulse" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Bluetooth className="h-4 w-4 mr-2" />
                          Connect to LED
                        </>
                      )}
                    </Button>
                    
                    {connectionMode === 'backend-api' && (
                      <p className="text-xs text-gray-500 text-center">
                        Requires Python backend running on port 3030
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Circle className="h-3 w-3 fill-green-400 text-green-400" />
                        <span className="font-medium text-green-400">Connected</span>
                      </div>
                      <p className="text-sm text-gray-400">
                        Device: {ledState.deviceName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Mode: {ledState.mode === 'web-bluetooth' ? 'Web Bluetooth' : 'Backend API'}
                      </p>
                    </div>
                    
                    <Button
                      onClick={disconnect}
                      variant="destructive"
                      className="w-full"
                    >
                      <BluetoothOff className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Status */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Status
                  {ledState.effect && (
                    <Badge variant="secondary" className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
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
                      {ledState.isOn ? (
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
                          backgroundColor: `rgb(${ledState.rgbColor[0]}, ${ledState.rgbColor[1]}, ${ledState.rgbColor[2]})`
                        }}
                      />
                      <span className="font-mono text-xs">
                        RGB({ledState.rgbColor.join(", ")})
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400">Device</p>
                    <p className="font-medium text-sm truncate">
                      {ledState.deviceName || "Not connected"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-4 w-4 text-blue-400" />
                  How to Use
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-400 space-y-2">
                <p><strong>Web Bluetooth:</strong> Direct browser connection</p>
                <p><strong>Backend API:</strong> Requires Python service</p>
                <Separator className="my-3 bg-white/10" />
                <code className="block p-2 bg-black/30 rounded text-xs">
                  python led-backend/led_service.py
                </code>
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
                    disabled={!ledState.isConnected || isLoading || ledState.isOn}
                    size="lg"
                    className="h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50"
                  >
                    <Lightbulb className="h-8 w-8" />
                  </Button>
                  
                  <Button
                    onClick={turnOff}
                    disabled={!ledState.isConnected || isLoading || !ledState.isOn}
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
                      checked={ledState.isOn}
                      disabled={!ledState.isConnected || isLoading}
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
                      disabled={!ledState.isConnected || !ledState.isOn}
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
                        disabled={!ledState.isConnected || !ledState.isOn}
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
                    disabled={!ledState.isConnected || !ledState.isOn}
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
                  disabled={!ledState.isConnected || !ledState.isOn || ledState.effect === "rainbow"}
                  className="w-full h-16 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 hover:opacity-90"
                >
                  <Rainbow className="h-5 w-5 mr-2" />
                  Rainbow Cycle
                </Button>
                
                {/* Breathing Effect */}
                <Button
                  onClick={() => startEffect("breathing", 3)}
                  disabled={!ledState.isConnected || !ledState.isOn || ledState.effect === "breathing"}
                  className="w-full h-16 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Wind className="h-5 w-5 mr-2" />
                  Breathing
                </Button>
                
                {/* Strobe Effect */}
                <Button
                  onClick={() => startEffect("strobe", 2)}
                  disabled={!ledState.isConnected || !ledState.isOn || ledState.effect === "strobe"}
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

            {/* Effect Preview */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>LED Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg bg-black/50 overflow-hidden relative">
                  {/* Simulated LED Preview */}
                  <div
                    className={`absolute inset-4 rounded-lg transition-all duration-300 ${
                      ledState.isOn ? "opacity-100" : "opacity-0"
                    }`}
                    style={{
                      backgroundColor: ledState.isOn
                        ? `rgb(${ledState.rgbColor[0]}, ${ledState.rgbColor[1]}, ${ledState.rgbColor[2]})`
                        : "transparent",
                      boxShadow: ledState.isOn
                        ? `0 0 ${ledState.brightness / 5}px ${ledState.rgbColor.join(",")}, inset 0 0 ${ledState.brightness / 10}px rgba(255,255,255,0.2)`
                        : "none",
                      filter: `brightness(${(ledState.brightness / 255) * 1.5})`,
                    }}
                  />
                  
                  {!ledState.isConnected && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <p>Connect to LED to preview</p>
                    </div>
                  )}
                  
                  {ledState.isConnected && !ledState.isOn && (
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
          <p>MohuanLED Controller</p>
          <p>Web Bluetooth + Backend API</p>
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
