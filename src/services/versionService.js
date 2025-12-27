import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import axios from 'axios';

// GitHub raw file URL - This is your single source of truth for version info
const GITHUB_VERSION_URL = 'https://raw.githubusercontent.com/javeedin/reerpPOSMobileApp/claude/general-session-3r6VJ/version.json';

// Storage keys
const INSTALLED_VERSION_KEY = 'installed_app_version';
const DOWNLOADED_VERSION_KEY = 'downloaded_app_version';

/**
 * Get installed version from AsyncStorage
 * This is the version user has installed (not hardcoded)
 */
export const getInstalledVersion = async () => {
  try {
    const version = await AsyncStorage.getItem(INSTALLED_VERSION_KEY);
    return version || '1.0.0'; // Default to 1.0.0 if not set
  } catch (error) {
    console.error('[VersionService] Error getting installed version:', error);
    return '1.0.0';
  }
};

/**
 * Save installed version to AsyncStorage
 * Call this after successful app update/install
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
 * Get last downloaded version (to avoid re-downloading)
 */
export const getDownloadedVersion = async () => {
  try {
    return await AsyncStorage.getItem(DOWNLOADED_VERSION_KEY);
  } catch (error) {
    return null;
  }
};

/**
 * Save downloaded version
 */
export const setDownloadedVersion = async (version) => {
  try {
    await AsyncStorage.setItem(DOWNLOADED_VERSION_KEY, version);
  } catch (error) {
    console.error('[VersionService] Error saving downloaded version:', error);
  }
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
 * Compares GitHub version with stored installed version
 */
export const checkForUpdate = async () => {
  const installedVersion = await getInstalledVersion();
  const downloadedVersion = await getDownloadedVersion();

  console.log('[VersionService] Installed version:', installedVersion);
  console.log('[VersionService] Last downloaded version:', downloadedVersion);

  try {
    // Fetch version info from GitHub with cache-busting
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
      console.log('[VersionService] No version config found');
      return { updateRequired: false, forceUpdate: false };
    }

    const latestVersion = config.latestVersion || config.version || installedVersion;
    const minVersion = config.minVersion || '1.0.0';
    const downloadUrl = config.downloadUrl || '';
    const releaseNotes = config.releaseNotes || '';
    const forceUpdate = config.forceUpdate === true;

    // Check if update is available (latest > installed)
    const hasUpdate = compareVersions(latestVersion, installedVersion) > 0;

    // Check if already downloaded this version
    const alreadyDownloaded = downloadedVersion === latestVersion;

    // Check if force update is required
    const requiresForceUpdate = compareVersions(minVersion, installedVersion) > 0;

    console.log('[VersionService] Check result:', {
      installedVersion,
      latestVersion,
      hasUpdate,
      alreadyDownloaded,
      requiresForceUpdate,
    });

    return {
      updateRequired: hasUpdate && !alreadyDownloaded,
      forceUpdate: requiresForceUpdate || forceUpdate,
      latestVersion,
      minVersion,
      installedVersion,
      downloadUrl,
      releaseNotes,
      alreadyDownloaded,
    };
  } catch (error) {
    console.error('[VersionService] Error checking for update:', error.message);
    return {
      updateRequired: false,
      forceUpdate: false,
      error: error.message,
    };
  }
};

/**
 * Download APK silently and trigger install
 */
export const downloadAndInstall = async (downloadUrl, version, onProgress) => {
  if (!downloadUrl) {
    console.error('[VersionService] No download URL provided');
    return { success: false, error: 'No download URL' };
  }

  try {
    console.log('[VersionService] Starting download:', downloadUrl);

    const fileName = `fcpos_${version.replace(/\./g, '_')}.apk`;
    const fileUri = FileSystem.documentDirectory + fileName;

    // Download the APK
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        console.log('[VersionService] Download progress:', Math.round(progress * 100) + '%');
        if (onProgress) {
          onProgress(progress);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    console.log('[VersionService] Download complete:', result.uri);

    // Save downloaded version
    await setDownloadedVersion(version);

    // Trigger install
    if (Platform.OS === 'android') {
      // Get content URI for the file
      const contentUri = await FileSystem.getContentUriAsync(result.uri);

      // Launch install intent
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });

      return { success: true, fileUri: result.uri };
    } else {
      // iOS - open in browser
      await Linking.openURL(downloadUrl);
      return { success: true };
    }
  } catch (error) {
    console.error('[VersionService] Download/install error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Open download URL in browser (fallback)
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
 * Mark current version as installed (call after app update)
 */
export const markVersionInstalled = async (version) => {
  await setInstalledVersion(version);
  // Clear downloaded version since it's now installed
  await AsyncStorage.removeItem(DOWNLOADED_VERSION_KEY);
};

/**
 * Get current version for display
 */
export const getCurrentVersion = async () => {
  return await getInstalledVersion();
};

/**
 * Format version for display
 */
export const formatVersion = (version) => {
  return `v${version}`;
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
  formatVersion,
};
