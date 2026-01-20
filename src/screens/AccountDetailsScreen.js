import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconContainer}>
      <Ionicons name={icon} size={20} color={colors.accent} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  </View>
);

const AccountDetailsScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Blue Header Only */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      {/* White Content Area */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[colors.secondary, colors.secondaryDark]}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>
                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
            <View style={styles.onlineIndicator} />
          </View>
          <Text style={styles.userName}>{user?.username || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.accentGreen} />
            <Text style={styles.roleText}>Active User</Text>
          </View>
        </View>

        {/* Account Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          <InfoRow icon="person-outline" label="Username" value={user?.username} />
          <InfoRow icon="server-outline" label="Instance" value={user?.instance} />
          <InfoRow icon="time-outline" label="Login Time" value={formatDate(user?.loginTime)} />
        </View>

        {/* Warehouse Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Warehouse Details</Text>
          <InfoRow icon="business-outline" label="Organization" value={user?.ORGANIZATION_NAME || user?.organization_name} />
          <InfoRow icon="cube-outline" label="Warehouse" value={user?.WAREHOUSE || user?.warehouse} />
          <InfoRow icon="layers-outline" label="Subinventory" value={user?.SUBINVENTORY || user?.subinventory} />
          <InfoRow icon="location-outline" label="Location" value={user?.LOCATION || user?.location} />
        </View>

        {/* User Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>User Details</Text>
          <InfoRow icon="mail-outline" label="Email" value={user?.EMAIL || user?.email} />
          <InfoRow icon="call-outline" label="Phone" value={user?.PHONE || user?.phone} />
          <InfoRow icon="briefcase-outline" label="Department" value={user?.DEPARTMENT || user?.department} />
          <InfoRow icon="people-outline" label="Role" value={user?.ROLE || user?.role} />
        </View>

        {/* System Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>System Information</Text>
          <InfoRow icon="finger-print-outline" label="User ID" value={user?.USER_ID || user?.user_id} />
          <InfoRow icon="key-outline" label="Responsibility" value={user?.RESPONSIBILITY || user?.responsibility} />
          <InfoRow icon="calendar-outline" label="Last Sync" value={formatDate(user?.LAST_SYNC || user?.last_sync)} />
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.actionButtonText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('SyncData')}
          >
            <Ionicons name="sync-outline" size={22} color={colors.accent} />
            <Text style={styles.actionButtonText}>Sync Data</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="help-circle-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.actionButtonText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.accentRed} />
            <Text style={[styles.actionButtonText, styles.logoutText]}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.accentRed} />
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>ReERP POS v1.0.0</Text>
          <Text style={styles.copyrightText}>Powered by Oracle Fusion</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accentGreen,
    borderWidth: 3,
    borderColor: colors.background,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  roleText: {
    fontSize: 13,
    color: colors.accentGreen,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  actionsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  logoutButton: {
    marginTop: 10,
  },
  logoutText: {
    color: colors.accentRed,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: colors.textMuted,
    opacity: 0.7,
  },
});

export default AccountDetailsScreen;
