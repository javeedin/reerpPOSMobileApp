# ReERP POS Mobile App

A complete Point of Sale (POS) mobile application built with React Native and Expo, integrated with Oracle Fusion Cloud.

## Features

- **Animated Splash Screen** - Beautiful branded splash screen with ReERP POS logo and animations
- **Secure Login** - Username, Password, and Instance Name authentication
- **Dashboard with KPIs** - Real-time sales metrics and performance indicators
- **Module-based Menu System** - Organized menu items by business modules:
  - Order Management
  - Receivables
  - Inventory Receipts
  - And more...
- **Quick Actions** - Fast access to frequently used features
- **Oracle Fusion Integration** - Seamless connection to Oracle Fusion Cloud backend

## Tech Stack

- React Native with Expo
- React Navigation
- Expo Linear Gradient
- Axios for API calls
- Context API for state management

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator / Physical Device

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd reerpPOSMobileApp
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm start
```

4. Run on your device
- Press `a` for Android
- Press `i` for iOS
- Scan QR code with Expo Go app on your device

## Project Structure

```
src/
├── components/       # Reusable UI components
├── constants/        # Colors, themes, and constants
├── context/          # React Context providers
├── navigation/       # Navigation configuration
├── screens/          # App screens
│   ├── SplashScreen.js
│   ├── LoginScreen.js
│   └── HomeScreen.js
└── services/         # API services
    └── api.js
```

## API Endpoints

- **Login**: `GET /LOGIN/user/?username={user}&password={pass}`
- **Menu Items**: `GET /APPMENU/MENU/{username}`

## License

Proprietary - All rights reserved
