import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import axios from 'axios';

// GitHub raw file URL - This is your single source of truth for version info
const GITHUB_VERSION_URL = 'https://raw.githubusercontent.com/javeedin/reerpPOSMobileApp/claude/general-session-3r6VJ/version.json';

/**
 * Get installed version from the actual APK/app binary
 * This reads the version from app.json that's baked into the APK
 */
export const getInstalledVersion = () => {
  // This reads the native app version from the APK itself
  // For Android: versionName from build.gradle
  // Falls back to app.json version
  const nativeVersion = Application.nativeApplicationVersion;
  console.log('[VersionService] Native app version:', nativeVersion);
  return nativeVersion || '1.0.0';
};

/**
 * Compare version strings
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
 */
export const checkForUpdate = async () => {
  const installedVersion = getInstalledVersion();
  console.log('[VersionService] Installed version:', installedVersion);

  try {
    console.log('[VersionService] Checking GitHub for updates...');
    const cacheBuster = `?t=${Date.now()}`;
    const response = await axios.get(GITHUB_VERSION_URL + cacheBuster, {
      timeout: 10000,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    const config = response.data;
    console.log('[VersionService] GitHub version info:', config);

    if (!config) {
      return { updateRequired: false, forceUpdate: false, installedVersion };
    }

    const latestVersion = config.latestVersion || installedVersion;
    const minVersion = config.minVersion || '1.0.0';
    const downloadUrl = config.downloadUrl || '';
    const releaseNotes = config.releaseNotes || '';
    const forceUpdate = config.forceUpdate === true;

    const hasUpdate = compareVersions(latestVersion, installedVersion) > 0;
    const requiresForceUpdate = compareVersions(minVersion, installedVersion) > 0;

    console.log('[VersionService] Check result:', {
      installedVersion,
      latestVersion,
      hasUpdate,
      requiresForceUpdate,
    });

    return {
      updateRequired: hasUpdate,
      forceUpdate: requiresForceUpdate || forceUpdate,
      latestVersion,
      minVersion,
      installedVersion,
      downloadUrl,
      releaseNotes,
    };
  } catch (error) {
    console.error('[VersionService] Error checking for update:', error.message);
    return { updateRequired: false, forceUpdate: false, installedVersion, error: error.message };
  }
};

/**
 * Open download URL in browser
 */
export const openDownloadUrl = async (url) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[VersionService] Error opening URL:', error);
    return false;
  }
};

/**
 * Get current version for display (synchronous)
 */
export const getCurrentVersion = () => {
  return getInstalledVersion();
};

export default {
  getInstalledVersion,
  getCurrentVersion,
  compareVersions,
  checkForUpdate,
  openDownloadUrl,
};
