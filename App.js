import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';
import ForceUpdateModal from './src/components/ForceUpdateModal';
import { checkForUpdate, openDownloadUrl, getCurrentVersion } from './src/services/versionService';

export default function App() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Check for updates on app launch
    checkAppVersion();
  }, []);

  const checkAppVersion = async () => {
    try {
      const result = await checkForUpdate();
      console.log('[App] Version check result:', result);

      if (result.updateRequired || result.forceUpdate) {
        setUpdateInfo(result);
        setShowUpdateModal(true);
      }
    } catch (error) {
      console.error('[App] Version check error:', error);
      // Don't block the app if version check fails
    }
  };

  const handleUpdate = async () => {
    if (updateInfo?.downloadUrl) {
      setIsDownloading(true);
      const success = await openDownloadUrl(updateInfo.downloadUrl);
      setIsDownloading(false);

      // If it's not a force update, close the modal after opening download
      if (!updateInfo.forceUpdate && success) {
        setShowUpdateModal(false);
      }
    }
  };

  const handleLater = () => {
    // Only allow closing if it's not a force update
    if (!updateInfo?.forceUpdate) {
      setShowUpdateModal(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#0A1628" />
        <AppNavigator />

        {/* Force Update Modal */}
        <ForceUpdateModal
          visible={showUpdateModal}
          currentVersion={getCurrentVersion()}
          latestVersion={updateInfo?.latestVersion || '1.0.0'}
          releaseNotes={updateInfo?.releaseNotes || ''}
          downloadUrl={updateInfo?.downloadUrl || ''}
          forceUpdate={updateInfo?.forceUpdate || false}
          onUpdate={handleUpdate}
          onLater={handleLater}
          isDownloading={isDownloading}
        />
      </AuthProvider>
    </View>
  );
}
