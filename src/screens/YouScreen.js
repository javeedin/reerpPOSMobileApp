import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import { getNotifSettings, saveNotifSettings, sendTestNotification } from '../services/notificationService';

const YouScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  // Notification settings state
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [desktopIp, setDesktopIp] = useState('');
  const [notifExpanded, setNotifExpanded] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

  useEffect(() => {
    getNotifSettings().then(s => {
      setNotifEnabled(s.enabled);
      setDesktopIp(s.desktopIp || '');
    });
  }, []);

  const handleToggleNotif = async (value) => {
    setNotifEnabled(value);
    await saveNotifSettings({ enabled: value, desktopIp });
    if (value && !notifExpanded) setNotifExpanded(true);
  };

  const handleSaveIp = async () => {
    const trimmed = desktopIp.trim();
    await saveNotifSettings({ enabled: notifEnabled, desktopIp: trimmed });
    Alert.alert('Saved', `Desktop IP set to ${trimmed}`);
  };

  const handleTestNotif = async () => {
    const trimmed = desktopIp.trim();
    if (!trimmed) {
      Alert.alert('No IP', 'Enter the desktop IP address first.');
      return;
    }
    setTestingNotif(true);
    try {
      const ok = await sendTestNotification(trimmed);
      Alert.alert(ok ? 'Success' : 'Failed', ok ? 'Test notification sent!' : 'Desktop did not respond. Check IP and that the server is running.');
    } catch (e) {
      Alert.alert('Error', 'Could not reach desktop: ' + e.message);
    } finally {
      setTestingNotif(false);
    }
  };

  const menuItems = [
    { icon: 'person-outline', title: 'Account Details', screen: 'AccountDetails' },
    { icon: 'print-outline', title: 'Printer Settings', screen: 'PrinterSettings' },
    { icon: 'settings-outline', title: 'Settings', screen: null },
    { icon: 'help-circle-outline', title: 'Help & Support', screen: null },
    { icon: 'information-circle-outline', title: 'About', screen: null },
  ];

  const handleMenuPress = (screen) => {
    if (screen) navigation.navigate(screen);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{user?.userName || user?.username || 'You'}</Text>
        <Text style={styles.headerSubtitle}>Account</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={64} color="#2196F3" />
          </View>
          <Text style={styles.userName}>{user?.userName || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          <Text style={styles.userOrg}>{user?.orgName || 'Organization'}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.screen)}
              disabled={!item.screen}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIconContainer}>
                  <Ionicons name={item.icon} size={22} color="#2196F3" />
                </View>
                <Text style={[styles.menuItemTitle, !item.screen && styles.menuItemDisabled]}>
                  {item.title}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Desktop Notifications Card */}
        <View style={styles.notifCard}>
          {/* Header row — toggle */}
          <TouchableOpacity
            style={styles.notifHeaderRow}
            onPress={() => setNotifExpanded(v => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: notifEnabled ? '#E8F5E9' : '#F5F5F5' }]}>
                <Ionicons
                  name="desktop-outline"
                  size={22}
                  color={notifEnabled ? '#388E3C' : '#2196F3'}
                />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>Desktop Notifications</Text>
                <Text style={styles.notifSubtitle}>
                  {notifEnabled ? (desktopIp ? `→ ${desktopIp}:8766` : 'Enabled — set IP below') : 'Disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={handleToggleNotif}
              trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
              thumbColor={notifEnabled ? '#388E3C' : '#9E9E9E'}
            />
          </TouchableOpacity>

          {/* Expandable IP section */}
          {notifExpanded && (
            <View style={styles.notifBody}>
              <Text style={styles.notifLabel}>Desktop Computer IP Address</Text>
              <TextInput
                style={styles.ipInput}
                value={desktopIp}
                onChangeText={setDesktopIp}
                placeholder="e.g. 192.168.1.100"
                placeholderTextColor="#BDBDBD"
                keyboardType="decimal-pad"
                autoCorrect={false}
              />
              <Text style={styles.notifHint}>
                The desktop app must be running and listening on port 8766.
              </Text>
              <View style={styles.notifActions}>
                <TouchableOpacity style={styles.saveIpBtn} onPress={handleSaveIp}>
                  <Ionicons name="save-outline" size={16} color="#FFF" />
                  <Text style={styles.saveIpBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.testBtn, testingNotif && { opacity: 0.6 }]}
                  onPress={handleTestNotif}
                  disabled={testingNotif}
                >
                  {testingNotif ? (
                    <ActivityIndicator size="small" color="#1565C0" />
                  ) : (
                    <Ionicons name="paper-plane-outline" size={16} color="#1565C0" />
                  )}
                  <Text style={styles.testBtnText}>{testingNotif ? 'Sending…' : 'Test'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#FF5252" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  userOrg: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  menuItemDisabled: {
    color: '#999999',
  },
  // Notification card
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  notifSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  notifBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 14,
  },
  notifLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ipInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  notifHint: {
    fontSize: 11,
    color: '#999',
    marginBottom: 14,
  },
  notifActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveIpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingVertical: 10,
  },
  saveIpBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingVertical: 10,
  },
  testBtnText: {
    color: '#1565C0',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF5252',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999999',
  },
});

export default YouScreen;
