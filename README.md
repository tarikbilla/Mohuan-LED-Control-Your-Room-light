# 🌈 MohuanLED Controller

A modern Next.js web application for controlling MohuanLED Bluetooth lights. Supports **two connection modes**:

1. **Web Bluetooth API** - Direct browser-to-LED communication (Chrome, Edge, Opera)
2. **Backend API** - Via Python service for environments where Web Bluetooth is blocked

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Web Bluetooth](https://img.shields.io/badge/Web%20Bluetooth-API-blue?style=flat-square&logo=bluetooth)
![Python](https://img.shields.io/badge/Python-3.8+-green?style=flat-square&logo=python)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 📸 Screenshot

![MohuanLED Controller Screenshot](./public/screenshot.png)

## ✨ Features

- 🔌 **Dual Connection Modes**
  - Web Bluetooth (direct browser connection)
  - Backend API (via Python service)
- 💡 **Power Control** - Turn lights on/off with a single click
- 🎨 **Color Picker** - Full RGB color selection with preset colors
- ☀️ **Brightness Control** - Adjustable brightness from 0-100%
- ⚡ **Dynamic Effects**
  - Rainbow Cycle
  - Breathing Effect
  - Strobe Light
- 📱 **Responsive Design** - Works on desktop and mobile
- 🔄 **Auto-Fallback** - Automatically switches to Backend API when Web Bluetooth is unavailable

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and Bun (or npm/yarn)
- Bluetooth adapter (built-in or USB)
- MohuanLED light device
- **For Web Bluetooth**: Chrome, Edge, or Opera
- **For Backend API**: Python 3.8+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tarikbilla/Mohuan-LED-Control-Your-Room-light.git
   cd Mohuan-LED-Control-Your-Room-light
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Install Python dependencies** (for Backend API mode)
   ```bash
   pip install bleak fastapi uvicorn
   ```

### Running the Application

#### Option 1: Web Bluetooth Mode (Recommended for Local)

```bash
# Start Next.js development server
bun run dev
```

Then open `http://localhost:3000` in Chrome/Edge/Opera and select "Web Bluetooth" mode.

#### Option 2: Backend API Mode (For Restricted Environments)

```bash
# Terminal 1: Start Python backend
python led-backend/led_service.py

# Terminal 2: Start Next.js frontend
bun run dev
```

Then open `http://localhost:3000` and select "Backend API" mode.

## 📁 Project Structure

```
├── led-backend/
│   ├── led_service.py        # Python Bluetooth service
│   └── requirements.txt       # Python dependencies
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main UI component
│   │   ├── layout.tsx        # App layout
│   │   ├── globals.css       # Global styles
│   │   └── api/led/          # API proxy routes
│   ├── components/ui/        # shadcn/ui components
│   ├── hooks/                # Custom React hooks
│   └── lib/
│       ├── led-controller.ts # Hybrid LED controller
│       └── utils.ts          # Utility functions
├── package.json              # Dependencies
├── tailwind.config.ts        # Tailwind configuration
└── README.md                 # This file
```

## 🎮 Usage

### Web Bluetooth Mode

1. Open app in Chrome/Edge/Opera
2. Select "Web Bluetooth" mode
3. Click "Connect to LED"
4. Select your MohuanLED device from the popup
5. Control your light!

### Backend API Mode

1. Start the Python backend: `python led-backend/led_service.py`
2. Open the app in any browser
3. Select "Backend API" mode
4. Click "Connect to LED"
5. The backend will auto-discover and connect to your LED

## 🌐 Browser Support

### Web Bluetooth Mode

| Browser | Support |
|---------|---------|
| Chrome | ✅ Full support |
| Edge | ✅ Full support |
| Opera | ✅ Full support |
| Firefox | ❌ Not supported |
| Safari | ⚠️ Limited support |

### Backend API Mode

| Browser | Support |
|---------|---------|
| All browsers | ✅ Full support |

## 🔧 LED Commands

| Command | Bytes |
|---------|-------|
| Turn On | `0x69 0x96 0x02 0x01 0x01` |
| Turn Off | `0x69 0x96 0x02 0x01 0x00` |
| Set Color | `0x69 0x96 0x05 0x02 R G B` |

## 🛠️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Bluetooth (Web)**: Web Bluetooth API
- **Bluetooth (Backend)**: bleak (Python)
- **Backend**: FastAPI + Uvicorn

## 📝 Development

```bash
# Run development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Lint code
bun run lint
```

## 🐛 Troubleshooting

### Web Bluetooth Issues

**"Access to the feature 'bluetooth' is disallowed"**
- You're in an iframe or restricted environment
- Switch to "Backend API" mode and run the Python service

**"No devices found"**
- Make sure your LED is powered on
- Ensure Bluetooth is enabled on your computer
- Try refreshing the page

### Backend API Issues

**"LED backend not running"**
- Start the Python service: `python led-backend/led_service.py`

**"No LED devices found" (Backend)**
- Make sure your LED is powered on
- Check if Bluetooth is enabled

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original library: [Walkercito/MohuanLED-Bluetooth_LED](https://github.com/Walkercito/MohuanLED-Bluetooth_LED)
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [bleak](https://github.com/hbldh/bleak) - Bluetooth Low Energy platform agnostic library
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

Made with ❤️ for smart lighting enthusiasts
