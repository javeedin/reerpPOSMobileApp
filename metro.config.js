const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude electron folder from Metro bundling
config.resolver.blockList = [
  /electron\/.*/,
  /electron-dist\/.*/,
];

// Exclude sql.js from native builds (it's only used for web)
// This prevents the "fs" module error on Android/iOS
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Mock sql.js for native platforms (Android/iOS)
  if (moduleName === 'sql.js' && platform !== 'web') {
    return {
      type: 'empty',
    };
  }
  // Mock react-native-tcp-socket for Expo Go compatibility
  // This module has native code not available in Expo Go and causes a crash on startup.
  // Printing will work in EAS development/production builds where native modules are linked.
  if (moduleName === 'react-native-tcp-socket') {
    return {
      type: 'empty',
    };
  }
  // Let Metro handle everything else
  return context.resolveRequest(context, moduleName, platform);
};

// Also exclude from watching
config.watchFolders = config.watchFolders || [];

module.exports = config;
