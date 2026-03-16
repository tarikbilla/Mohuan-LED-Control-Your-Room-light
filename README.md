# 🌈 MohuanLED Controller

A modern Next.js web application for controlling MohuanLED Bluetooth lights. Features a beautiful UI with color picker, brightness control, and dynamic lighting effects.

![MohuanLED Controller](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Python](https://img.shields.io/badge/Python-3.8+-blue?style=flat-square&logo=python)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## ✨ Features

- 🔌 **Bluetooth LE Connection** - Scan and connect to MohuanLED devices
- 💡 **Power Control** - Turn lights on/off with a single click
- 🎨 **Color Picker** - Full RGB color selection with preset colors
- ☀️ **Brightness Control** - Adjustable brightness from 0-100%
- ⚡ **Dynamic Effects**
  - Rainbow Cycle
  - Breathing Effect
  - Strobe Light
- 📡 **Real-time Updates** - WebSocket connection for live status
- 📱 **Responsive Design** - Works on desktop and mobile

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   API Proxy     │────▶│  Python BLE     │
│   (Port 3000)   │     │   (REST API)    │     │   Service       │
│                 │     │                 │     │   (Port 3030)   │
│   React UI      │◀────│   WebSocket     │◀────│   FastAPI       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- Node.js 18+ and Bun
- Bluetooth adapter (built-in or USB)
- MohuanLED light device

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tarikbilla/Mohuan-LED-Control-Your-Room-light.git
   cd Mohuan-LED-Control-Your-Room-light
   ```

2. **Install Python dependencies**
   ```bash
   pip install bleak fastapi uvicorn websockets
   ```

3. **Install Node.js dependencies**
   ```bash
   bun install
   ```

### Running the Application

1. **Start the LED Bluetooth Service** (Terminal 1)
   ```bash
   cd mini-services/led-service
   python3 index.py
   ```

2. **Start the Next.js Frontend** (Terminal 2)
   ```bash
   bun run dev
   ```

3. **Open in browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
├── mini-services/
│   └── led-service/
│       ├── index.py          # Python BLE service
│       └── requirements.txt   # Python dependencies
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main UI component
│   │   ├── layout.tsx        # App layout
│   │   └── api/
│   │       └── led/          # API proxy routes
│   └── components/ui/        # shadcn/ui components
├── mohuan_led_controller.py  # Standalone Python CLI
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## 🎮 Usage

### Web Interface

1. **Scan for Devices** - Click "Scan for Devices" to discover nearby LEDs
2. **Connect** - Click on your device to connect
3. **Control** - Use the color picker, brightness slider, and effect buttons
4. **Disconnect** - Click "Disconnect" when done

### Standalone Python CLI

For quick command-line control:

```bash
# Scan for devices
python mohuan_led_controller.py --scan

# Turn on
python mohuan_led_controller.py --on --mac YOUR_MAC_ADDRESS

# Set color (RGB)
python mohuan_led_controller.py --color 255 0 0 --mac YOUR_MAC_ADDRESS

# Rainbow effect
python mohuan_led_controller.py --rainbow 10 --mac YOUR_MAC_ADDRESS

# Run demo
python mohuan_led_controller.py --demo
```

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/state` | GET | Get current LED state |
| `/scan` | GET | Scan for LED devices |
| `/connect` | POST | Connect to a device |
| `/disconnect` | POST | Disconnect from device |
| `/on` | POST | Turn LED on |
| `/off` | POST | Turn LED off |
| `/color` | POST | Set RGB color |
| `/brightness` | POST | Set brightness |
| `/effects/rainbow` | POST | Start rainbow effect |
| `/effects/breathing` | POST | Start breathing effect |
| `/effects/strobe` | POST | Start strobe effect |
| `/effects/stop` | POST | Stop current effect |
| `/ws` | WebSocket | Real-time state updates |

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python, FastAPI, Uvicorn
- **Bluetooth**: bleak (Bluetooth Low Energy)
- **Real-time**: WebSocket

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original library: [Walkercito/MohuanLED-Bluetooth_LED](https://github.com/Walkercito/MohuanLED-Bluetooth_LED)
- [bleak](https://github.com/hbldh/bleak) - Bluetooth Low Energy platform agnostic library
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

Made with ❤️ for smart lighting enthusiasts
