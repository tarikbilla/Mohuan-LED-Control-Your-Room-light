# 🌈 MohuanLED Controller

A modern Next.js web application for controlling MohuanLED Bluetooth lights directly from your browser. No backend required - uses the Web Bluetooth API for direct BLE communication!

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Web Bluetooth](https://img.shields.io/badge/Web%20Bluetooth-API-blue?style=flat-square&logo=bluetooth)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## ✨ Features

- 🔌 **Direct Bluetooth LE Connection** - Connect directly from the browser, no backend needed!
- 💡 **Power Control** - Turn lights on/off with a single click
- 🎨 **Color Picker** - Full RGB color selection with preset colors
- ☀️ **Brightness Control** - Adjustable brightness from 0-100%
- ⚡ **Dynamic Effects**
  - Rainbow Cycle
  - Breathing Effect
  - Strobe Light
- 📱 **Responsive Design** - Works on desktop and mobile
- 🚀 **Pure Next.js** - No Python, no backend services!

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App                          │
│                                                         │
│   ┌─────────────┐    ┌─────────────────────────────┐   │
│   │  React UI   │───▶│  Web Bluetooth API          │   │
│   │  (Browser)  │◀───│  (Direct BLE Communication) │   │
│   └─────────────┘    └─────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   MohuanLED Device    │
              │   (Bluetooth LE)      │
              └───────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and Bun (or npm/yarn)
- Bluetooth adapter (built-in or USB)
- MohuanLED light device
- **Supported browser**: Chrome, Edge, or Opera (Firefox/Safari have limited Web Bluetooth support)

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

3. **Run the development server**
   ```bash
   bun run dev
   # or
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main UI component
│   │   ├── layout.tsx        # App layout
│   │   └── globals.css       # Global styles
│   ├── components/ui/        # shadcn/ui components
│   ├── hooks/                # Custom React hooks
│   └── lib/
│       ├── led-controller.ts # Web Bluetooth LED controller
│       └── utils.ts          # Utility functions
├── package.json              # Dependencies
├── tailwind.config.ts        # Tailwind configuration
└── README.md                 # This file
```

## 🎮 Usage

### Web Interface

1. **Connect** - Click "Connect to LED" button
2. **Select Device** - Choose your MohuanLED device from the browser popup
3. **Turn On** - Click the power button or toggle the switch
4. **Control** - Use the color picker, brightness slider, and effect buttons
5. **Disconnect** - Click "Disconnect" when done

### Supported Browsers

| Browser | Support |
|---------|---------|
| Chrome | ✅ Full support |
| Edge | ✅ Full support |
| Opera | ✅ Full support |
| Firefox | ❌ Not supported |
| Safari | ⚠️ Limited support |

## 🔧 How It Works

This app uses the **Web Bluetooth API** to communicate directly with MohuanLED devices:

1. **Device Discovery** - `navigator.bluetooth.requestDevice()` scans for BLE devices
2. **GATT Connection** - Connects to the device's GATT server
3. **Characteristic Write** - Sends commands to control the LED

### LED Commands

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
- **Bluetooth**: Web Bluetooth API

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

### "Web Bluetooth is not supported"
- Use Chrome, Edge, or Opera browser
- Ensure you're on HTTPS or localhost
- Check if Bluetooth is enabled on your device

### "No devices found"
- Make sure your LED is powered on
- Ensure Bluetooth is enabled on your computer
- Try refreshing the page and scanning again

### "Connection failed"
- The LED might be connected to another device
- Try resetting the LED by turning it off and on
- Move closer to the LED

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original library: [Walkercito/MohuanLED-Bluetooth_LED](https://github.com/Walkercito/MohuanLED-Bluetooth_LED)
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

Made with ❤️ for smart lighting enthusiasts
