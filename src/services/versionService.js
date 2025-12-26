import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';

// GitHub raw file URL - This is your single source of truth for version info
// Update this file in your repo to trigger updates for all users
const GITHUB_VERSION_URL = 'https://raw.githubusercontent.com/javeedin/reerpPOSMobileApp/claude/general-session-3r6VJ/version.json';

/**
 * Get current app version from app.json
 */
export const getCurrentVersion = () => {
  return Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';
};

/**
 * Get current build number
 */
export const getCurrentBuildNumber = () => {
  if (Platform.OS === 'android') {
    return Constants.expoConfig?.android?.versionCode || 1;
  }
  return Constants.expoConfig?.ios?.buildNumber || '1';
};

/**
 * Compare version strings (e.g., "1.2.0" vs "1.1.0")
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
};

/**
 * Check if update is required
 * Returns: { updateRequired, forceUpdate, latestVersion, downloadUrl, releaseNotes }
 */
export const checkForUpdate = async () => {
  const currentVersion = getCurrentVersion();
  console.log('[VersionService] Current app version:', currentVersion);

  try {
    // Fetch version info from GitHub
    console.log('[VersionService] Checking GitHub for updates...');
    const response = await axios.get(GITHUB_VERSION_URL, {
      timeout: 10000,
      headers: { 'Cache-Control': 'no-cache' } // Avoid cached responses
    });

    const versionInfo = response.data;
    console.log('[VersionService] GitHub version info:', versionInfo);

    const config = versionInfo;

    if (!config) {
      console.log('[VersionService] No version config found');
      return { updateRequired: false, forceUpdate: false };
    }

    const latestVersion = config.latestVersion || config.latest_version || config.version || currentVersion;
    const minVersion = config.minVersion || config.min_version || config.minimumVersion || '1.0.0';
    const downloadUrl = config.downloadUrl || config.download_url || config.apkUrl || '';
    const releaseNotes = config.releaseNotes || config.release_notes || config.notes || '';
    const forceUpdate = config.forceUpdate === true || config.force_update === 'Y' || config.force_update === true;

    // Check if update is available
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    // Check if force update is required (current version < minimum version)
    const requiresForceUpdate = compareVersions(minVersion, currentVersion) > 0;

    console.log('[VersionService] Check result:', {
      currentVersion,
      latestVersion,
      minVersion,
      hasUpdate,
      requiresForceUpdate,
      forceUpdate,
    });

    return {
      updateRequired: hasUpdate,
      forceUpdate: requiresForceUpdate || forceUpdate,
      latestVersion,
      minVersion,
      currentVersion,
      downloadUrl,
      releaseNotes,
    };
  } catch (error) {
    console.error('[VersionService] Error checking for update:', error.message);
    // Don't block the app if version check fails
    return {
      updateRequired: false,
      forceUpdate: false,
      error: error.message,
    };
  }
};

/**
 * Open download URL in browser
 */
export const openDownloadUrl = async (url) => {
  if (!url) {
    console.error('[VersionService] No download URL provided');
    return false;
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      console.error('[VersionService] Cannot open URL:', url);
      return false;
    }
  } catch (error) {
    console.error('[VersionService] Error opening download URL:', error);
    return false;
  }
};

/**
 * Format version for display
 */
export const formatVersion = (version) => {
  return `v${version}`;
};

export default {
  getCurrentVersion,
  getCurrentBuildNumber,
  compareVersions,
  checkForUpdate,
  openDownloadUrl,
  formatVersion,
};
