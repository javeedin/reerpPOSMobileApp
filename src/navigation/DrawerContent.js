import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const DrawerMenuItem = ({ icon, label, onPress, isActive, badge }) => (
  <TouchableOpacity
    style={[styles.menuItem, isActive && styles.menuItemActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons
      name={icon}
      size={22}
      color={isActive ? colors.accent : colors.textSecondary}
    />
    <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>{label}</Text>
    {badge && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const DrawerContent = (props) => {
  const { navigation, state } = props;
  const { user, logout, menuData } = useAuth();

  const currentRoute = state?.routes[state.index]?.name;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        style={styles.header}
      >
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[colors.secondary, colors.secondaryDark]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
            <View style={styles.onlineIndicator} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.username || 'User'}</Text>
            <Text style={styles.userInstance}>{user?.instance || 'PROD'}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('AccountDetails')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Warehouse Info */}
        {user?.WAREHOUSE && (
          <View style={styles.warehouseInfo}>
            <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.warehouseText}>
              {user.WAREHOUSE} - {user.SUBINVENTORY || 'N/A'}
            </Text>
          </View>
        )}
      </LinearGradient>

      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Navigation */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>MAIN MENU</Text>
          <DrawerMenuItem
            icon="home"
            label="Dashboard"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            isActive={currentRoute === 'MainTabs'}
          />
          <DrawerMenuItem
            icon="cart"
            label="Orders"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
            badge="5"
          />
          <DrawerMenuItem
            icon="cube"
            label="Inventory"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}
          />
          <DrawerMenuItem
            icon="stats-chart"
            label="Reports"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Reports' })}
          />
        </View>

        {/* Dynamic Modules from API */}
        {menuData && menuData.length > 0 && (
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>MODULES</Text>
            {menuData.map((module, index) => (
              <DrawerMenuItem
                key={module.Id || index}
                icon="grid"
                label={module.Menu}
                onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
                badge={module.SubMenuItems?.length?.toString()}
              />
            ))}
          </View>
        )}

        {/* Account Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <DrawerMenuItem
            icon="person"
            label="Account Details"
            onPress={() => navigation.navigate('AccountDetails')}
          />
          <DrawerMenuItem
            icon="sync"
            label="Sync Data"
            onPress={() => {}}
          />
          <DrawerMenuItem
            icon="help-circle"
            label="Help & Support"
            onPress={() => {}}
          />
          <DrawerMenuItem
            icon="information-circle"
            label="About"
            onPress={() => {}}
          />
        </View>
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.accentRed} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>ReERP POS v1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accentGreen,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  userInstance: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
  },
  warehouseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  warehouseText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingTop: 10,
  },
  menuSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: colors.backgroundCard,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
    marginLeft: 14,
  },
  menuLabelActive: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: colors.accentRed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentRed,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default DrawerContent;
