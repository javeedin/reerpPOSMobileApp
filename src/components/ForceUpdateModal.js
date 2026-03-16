import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

/**
 * ForceUpdateModal - Blocks the app and forces user to update
 *
 * Props:
 * - visible: boolean - Show/hide modal
 * - currentVersion: string - Current app version
 * - latestVersion: string - Latest available version
 * - releaseNotes: string - What's new in this update
 * - downloadUrl: string - URL to download the APK
 * - forceUpdate: boolean - If true, user cannot dismiss
 * - onUpdate: function - Called when user taps Update
 * - onLater: function - Called when user taps Later (only if not forced)
 * - isDownloading: boolean - Show downloading state
 */
const ForceUpdateModal = ({
  visible,
  currentVersion = '1.0.0',
  latestVersion = '1.0.1',
  releaseNotes = '',
  downloadUrl,
  forceUpdate = false,
  onUpdate,
  onLater,
  isDownloading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header with icon */}
          <LinearGradient
            colors={['#4CAF50', '#45a049']}
            style={styles.header}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-download" size={48} color="#FFFFFF" />
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>
              {forceUpdate ? 'Update Required' : 'Update Available'}
            </Text>

            <Text style={styles.subtitle}>
              A new version of FCPos is available
            </Text>

            {/* Version info */}
            <View style={styles.versionContainer}>
              <View style={styles.versionBox}>
                <Text style={styles.versionLabel}>Current</Text>
                <Text style={styles.versionNumber}>v{currentVersion}</Text>
              </View>
              <Ionicons name="arrow-forward" size={24} color="#CCCCCC" />
              <View style={styles.versionBox}>
                <Text style={styles.versionLabel}>Latest</Text>
                <Text style={[styles.versionNumber, styles.newVersion]}>v{latestVersion}</Text>
              </View>
            </View>

            {/* Release notes */}
            {releaseNotes ? (
              <View style={styles.releaseNotesContainer}>
                <Text style={styles.releaseNotesTitle}>What's New:</Text>
                <Text style={styles.releaseNotesText}>{releaseNotes}</Text>
              </View>
            ) : null}

            {/* Force update warning */}
            {forceUpdate && (
              <View style={styles.warningContainer}>
                <Ionicons name="warning" size={20} color="#FF9800" />
                <Text style={styles.warningText}>
                  This update is required to continue using the app
                </Text>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {/* Update Button */}
              <TouchableOpacity
                style={[styles.button, styles.updateButton]}
                onPress={onUpdate}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="download" size={20} color="#FFFFFF" />
                    <Text style={styles.updateButtonText}>Update Now</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Later Button - only show if not forced */}
              {!forceUpdate && (
                <TouchableOpacity
                  style={[styles.button, styles.laterButton]}
                  onPress={onLater}
                  disabled={isDownloading}
                >
                  <Text style={styles.laterButtonText}>Later</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Download info */}
            <Text style={styles.downloadInfo}>
              {forceUpdate
                ? 'You must update to continue'
                : 'Update to get the latest features'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 40,
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 16,
  },
  versionBox: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  versionLabel: {
    fontSize: 11,
    color: '#999999',
    marginBottom: 4,
  },
  versionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  newVersion: {
    color: '#4CAF50',
  },
  releaseNotesContainer: {
    width: '100%',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  releaseNotesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  releaseNotesText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  updateButton: {
    backgroundColor: '#4CAF50',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  laterButton: {
    backgroundColor: '#F0F0F0',
  },
  laterButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  downloadInfo: {
    fontSize: 11,
    color: '#999999',
    marginTop: 16,
  },
});

export default ForceUpdateModal;
