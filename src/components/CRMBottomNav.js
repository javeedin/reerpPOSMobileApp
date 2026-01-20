import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CRMBottomNav = ({ navigation, activeTab = 'home' }) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);

  const navItems = [
    { key: 'home', label: 'Home', icon: 'home', route: 'CRMHome' },
    { key: 'search', label: 'My Profile', icon: 'person', route: 'CustomerSearch' },
    { key: 'customers', label: 'Customers', icon: 'people', route: 'CustomerList' },
    { key: 'offers', label: 'Offers', icon: 'pricetag', route: null },
    { key: 'more', label: 'More', icon: 'apps', route: 'MainTabs' },
  ];

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.toolbar}>
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          const isCenter = item.key === 'customers';

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, isCenter && styles.centerItem]}
              onPress={() => {
                if (item.route === 'MainTabs') {
                  navigation.navigate('MainTabs', { screen: 'Home' });
                } else if (item.route) {
                  navigation.navigate(item.route);
                }
              }}
            >
              <View style={[
                styles.iconWrapper,
                isCenter && styles.centerIconWrapper,
                isCenter && isActive && styles.centerIconWrapperActive
              ]}>
                <Ionicons
                  name={isActive ? item.icon : `${item.icon}-outline`}
                  size={isCenter ? 26 : 24}
                  color={isCenter ? '#FFFFFF' : (isActive ? '#0D47A1' : '#666666')}
                />
              </View>
              <Text style={[
                styles.navLabel,
                isActive && styles.navLabelActive,
                isCenter && styles.centerLabel
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  toolbar: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  centerItem: {
    marginTop: -20,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0D47A1',
    elevation: 6,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  centerIconWrapperActive: {
    backgroundColor: '#1565C3',
  },
  navLabel: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0D47A1',
    fontWeight: '600',
  },
  centerLabel: {
    marginTop: 4,
    color: '#0D47A1',
    fontWeight: '600',
  },
});

export default CRMBottomNav;
