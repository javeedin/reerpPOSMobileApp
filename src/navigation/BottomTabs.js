import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import {
  HomeScreen,
  OrdersScreen,
  InventoryScreen,
  ReportsScreen,
} from '../screens';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

// Orders Flyout Menu Component
const OrdersFlyout = ({ visible, onClose, onSelectLocal, onSelectHistory }) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.flyoutOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.flyoutContainer}>
          <View style={styles.flyoutArrow} />
          <View style={styles.flyoutContent}>
            <Text style={styles.flyoutTitle}>Orders</Text>

            <TouchableOpacity
              style={styles.flyoutOption}
              onPress={onSelectLocal}
            >
              <View style={[styles.flyoutIconContainer, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name="phone-portrait-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.flyoutOptionInfo}>
                <Text style={styles.flyoutOptionTitle}>Local Orders</Text>
                <Text style={styles.flyoutOptionDesc}>Orders saved on this device</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flyoutOption}
              onPress={onSelectHistory}
            >
              <View style={[styles.flyoutIconContainer, { backgroundColor: (colors.accentGreen || '#4CAF50') + '20' }]}>
                <Ionicons name="cloud-outline" size={20} color={colors.accentGreen || '#4CAF50'} />
              </View>
              <View style={styles.flyoutOptionInfo}>
                <Text style={styles.flyoutOptionTitle}>Order History</Text>
                <Text style={styles.flyoutOptionDesc}>Query orders from server</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  const [showOrdersFlyout, setShowOrdersFlyout] = useState(false);
  const mainNavigation = useNavigation();

  const handleOrdersPress = () => {
    setShowOrdersFlyout(true);
  };

  const handleSelectLocal = () => {
    setShowOrdersFlyout(false);
    navigation.navigate('Orders');
  };

  const handleSelectHistory = () => {
    setShowOrdersFlyout(false);
    mainNavigation.navigate('HistoryOrders');
  };

  return (
    <View style={styles.tabBarContainer}>
      <LinearGradient
        colors={[colors.backgroundCard, colors.primaryDark]}
        style={[styles.tabBar, { paddingBottom: bottomPadding + 10 }]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            // Special handling for Orders tab
            if (route.name === 'Orders') {
              handleOrdersPress();
              return;
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = isFocused ? 'home' : 'home-outline';
              break;
            case 'Orders':
              iconName = isFocused ? 'cart' : 'cart-outline';
              break;
            case 'Inventory':
              iconName = isFocused ? 'cube' : 'cube-outline';
              break;
            case 'Reports':
              iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return (
            <TouchableOpacity
              key={index}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconContainer, isFocused && styles.tabIconContainerActive]}>
                <Ionicons
                  name={iconName}
                  size={24}
                  color={isFocused ? colors.accent : colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
              {isFocused && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </LinearGradient>

      {/* Orders Flyout Menu */}
      <OrdersFlyout
        visible={showOrdersFlyout}
        onClose={() => setShowOrdersFlyout(false)}
        onSelectLocal={handleSelectLocal}
        onSelectHistory={handleSelectHistory}
      />
    </View>
  );
};

const BottomTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ tabBarLabel: 'Orders' }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ tabBarLabel: 'Inventory' }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ tabBarLabel: 'Reports' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIconContainer: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tabIconContainerActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  tabLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    top: -10,
    width: 24,
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  // Flyout Styles
  flyoutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  flyoutContainer: {
    marginHorizontal: 12,
    marginBottom: 100,
    alignItems: 'center',
  },
  flyoutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginBottom: -1,
  },
  flyoutContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  flyoutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  flyoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  flyoutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flyoutOptionInfo: {
    flex: 1,
  },
  flyoutOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  flyoutOptionDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default BottomTabs;
