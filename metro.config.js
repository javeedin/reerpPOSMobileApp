const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude electron folder from Metro bundling
config.resolver.blockList = [
  /electron\/.*/,
  /electron-dist\/.*/,
];

// Also exclude from watching
config.watchFolders = config.watchFolders || [];

module.exports = config;
