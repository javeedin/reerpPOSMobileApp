# ReERP POS Mobile App

A complete Point of Sale (POS) mobile application built with React Native and Expo, designed to work with Oracle Fusion.

## Features

- **Splash Screen** - Animated splash screen with ReERP POS branding
- **Authentication** - Secure login with username, password, and instance selection
- **Dashboard** - KPI cards, modules, and menu items from API
- **Bottom Navigation** - Quick access to Home, Orders, Inventory, and Reports
- **Hamburger Menu** - Full navigation drawer with account details
- **Dark Blue Theme** - Professional dark theme throughout the app

## Tech Stack

- React Native with Expo
- React Navigation (Stack, Bottom Tabs, Drawer)
- Axios for API calls
- AsyncStorage for local data persistence
- Expo Vector Icons
- Linear Gradient

## Project Structure

```
src/
├── components/       # Reusable UI components
├── context/          # React Context (Auth)
├── navigation/       # Navigation configuration
├── screens/          # App screens
├── services/         # API services
└── theme/            # Colors and typography
```

## Screens

1. **SplashScreen** - App loading screen with animated logo
2. **LoginScreen** - User authentication
3. **HomeScreen** - Dashboard with KPIs, modules, and menus
4. **OrdersScreen** - Order management
5. **InventoryScreen** - Stock management
6. **ReportsScreen** - Business reports
7. **AccountDetailsScreen** - User profile and settings
8. **MenuDetailScreen** - Individual menu item details

## API Endpoints

### Login
```
GET /LOGIN/user/?username={username}&password={password}
```

### Menu Options
```
GET /APPMENU/MENU/{username}
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on device/emulator:
```bash
# iOS
npm run ios

# Android
npm run android
```

## Configuration

The app connects to Oracle Fusion APIs. Base URL is configured in `src/services/api.js`.

## Theme

The app uses a dark blue theme with the following primary colors:
- Primary Dark: #0A1628
- Primary: #1E3A5F
- Accent: #00D9FF
- Secondary: #3498DB

## License

Proprietary - All rights reserved.

## Powered By

Oracle Fusion
