import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// GitHub raw file URL - This is your single source of truth for version info
const GITHUB_VERSION_URL = 'https://raw.githubusercontent.com/javeedin/reerpPOSMobileApp/claude/general-session-3r6VJ/version.json';

// Storage keys
const INSTALLED_VERSION_KEY = 'installed_app_version';

/**
 * Get installed version from AsyncStorage
 */
export const getInstalledVersion = async () => {
  try {
    const version = await AsyncStorage.getItem(INSTALLED_VERSION_KEY);
    return version || '1.0.0';
  } catch (error) {
    console.error('[VersionService] Error getting installed version:', error);
    return '1.0.0';
  }
};

/**
 * Save installed version to AsyncStorage
 */
export const setInstalledVersion = async (version) => {
  try {
    await AsyncStorage.setItem(INSTALLED_VERSION_KEY, version);
    console.log('[VersionService] Saved installed version:', version);
  } catch (error) {
    console.error('[VersionService] Error saving installed version:', error);
  }
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
  const installedVersion = await getInstalledVersion();
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
      return { updateRequired: false, forceUpdate: false };
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
    return { updateRequired: false, forceUpdate: false, error: error.message };
  }
};

/**
 * Open download URL and mark version
 */
export const downloadAndInstall = async (downloadUrl, version) => {
  try {
    console.log('[VersionService] Opening download URL:', downloadUrl);

    // Save the version we're downloading
    await setInstalledVersion(version);

    // Open URL in browser to download
    const supported = await Linking.canOpenURL(downloadUrl);
    if (supported) {
      await Linking.openURL(downloadUrl);
      return { success: true };
    }
    return { success: false, error: 'Cannot open URL' };
  } catch (error) {
    console.error('[VersionService] Download error:', error);
    return { success: false, error: error.message };
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
 * Mark version as installed
 */
export const markVersionInstalled = async (version) => {
  await setInstalledVersion(version);
};

/**
 * Get current version for display
 */
export const getCurrentVersion = async () => {
  return await getInstalledVersion();
};

export default {
  getInstalledVersion,
  setInstalledVersion,
  getCurrentVersion,
  compareVersions,
  checkForUpdate,
  downloadAndInstall,
  openDownloadUrl,
  markVersionInstalled,
};
