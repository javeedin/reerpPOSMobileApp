import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Lucy Dialog Component
const LucyDialog = ({ visible, onClose }) => {
  const [query, setQuery] = useState('');

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.lucyOverlay}>
        <View style={styles.lucyDialog}>
          <View style={styles.lucyHeader}>
            <View style={styles.lucyBadge}>
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.lucyHeaderText}>
              <Text style={styles.lucyTitle}>Lucy</Text>
              <Text style={styles.lucySubtitle}>AutoPilot Assistant</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.lucyClose}>
              <Ionicons name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          <View style={styles.lucyContent}>
            <Text style={styles.lucyMessage}>
              Hi! I'm Lucy, your AutoPilot assistant. This feature is coming soon!
            </Text>
            <View style={styles.lucySuggestions}>
              <Text style={styles.lucySuggestionsTitle}>Try asking:</Text>
              <Text style={styles.lucySuggestion}>• "Show me today's sales"</Text>
              <Text style={styles.lucySuggestion}>• "Who are my top customers?"</Text>
              <Text style={styles.lucySuggestion}>• "Check stock for item X"</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Orders Flyout Menu
const OrdersFlyout = ({ visible, onClose, navigation }) => {
  if (!visible) return null;

  const handleNavigate = (screen) => {
    onClose();
    navigation.navigate(screen);
  };

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
          <View style={styles.flyoutContent}>
            <Text style={styles.flyoutTitle}>Orders</Text>

            <TouchableOpacity
              style={styles.flyoutOption}
              onPress={() => handleNavigate('Orders')}
            >
              <View style={[styles.flyoutIconContainer, { backgroundColor: '#2196F320' }]}>
                <Ionicons name="phone-portrait-outline" size={20} color="#2196F3" />
              </View>
              <View style={styles.flyoutOptionInfo}>
                <Text style={styles.flyoutOptionTitle}>Local Orders</Text>
                <Text style={styles.flyoutOptionDesc}>Orders on this device</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flyoutOption}
              onPress={() => handleNavigate('HistoryOrders')}
            >
              <View style={[styles.flyoutIconContainer, { backgroundColor: '#4CAF5020' }]}>
                <Ionicons name="cloud-outline" size={20} color="#4CAF50" />
              </View>
              <View style={styles.flyoutOptionInfo}>
                <Text style={styles.flyoutOptionTitle}>Order History</Text>
                <Text style={styles.flyoutOptionDesc}>Query from server</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flyoutOption}
              onPress={() => handleNavigate('StoreRequests')}
            >
              <View style={[styles.flyoutIconContainer, { backgroundColor: '#FF980020' }]}>
                <Ionicons name="swap-horizontal-outline" size={20} color="#FF9800" />
              </View>
              <View style={styles.flyoutOptionInfo}>
                <Text style={styles.flyoutOptionTitle}>Store Requests</Text>
                <Text style={styles.flyoutOptionDesc}>Stock requisitions</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Main Bottom Toolbar Component
const BottomToolbar = ({ activeTab = 'Home' }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [showOrdersFlyout, setShowOrdersFlyout] = useState(false);
  const [showLucyDialog, setShowLucyDialog] = useState(false);

  const tabs = [
    { name: 'Home', icon: 'home', iconFocused: 'home' },
    { name: 'You', icon: 'person-outline', iconFocused: 'person' },
    { name: 'Orders', icon: 'cart-outline', iconFocused: 'cart', hasFlyout: true },
    { name: 'Inventory', icon: 'cube-outline', iconFocused: 'cube' },
    { name: 'Menu', icon: 'menu-outline', iconFocused: 'menu' },
    { name: 'Lucy', icon: 'sparkles-outline', iconFocused: 'sparkles', isDialog: true },
  ];

  const handleTabPress = (tab) => {
    if (tab.hasFlyout) {
      setShowOrdersFlyout(true);
    } else if (tab.isDialog) {
      setShowLucyDialog(true);
    } else {
      navigation.navigate('MainTabs', { screen: tab.name });
    }
  };

  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <>
      <View style={[styles.toolbar, { paddingBottom: bottomPadding }]}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.name;
          const iconName = isActive ? tab.iconFocused : tab.icon;

          return (
            <TouchableOpacity
              key={index}
              style={styles.tabItem}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconContainer, isActive && styles.tabIconContainerActive]}>
                <Ionicons
                  name={iconName}
                  size={24}
                  color={isActive ? '#2196F3' : '#666666'}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <OrdersFlyout
        visible={showOrdersFlyout}
        onClose={() => setShowOrdersFlyout(false)}
        navigation={navigation}
      />

      <LucyDialog
        visible={showLucyDialog}
        onClose={() => setShowLucyDialog(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 10,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabIconContainer: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tabIconContainerActive: {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
  },
  tabLabel: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#000000',
    fontWeight: '700',
  },
  // Lucy Dialog
  lucyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  lucyDialog: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  lucyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  lucyBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lucyHeaderText: {
    flex: 1,
  },
  lucyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  lucySubtitle: {
    fontSize: 12,
    color: '#666666',
  },
  lucyClose: {
    padding: 8,
  },
  lucyContent: {
    padding: 24,
  },
  lucyMessage: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 20,
  },
  lucySuggestions: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  lucySuggestionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 10,
  },
  lucySuggestion: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 6,
  },
  // Orders Flyout
  flyoutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  flyoutContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  flyoutContent: {
    padding: 20,
  },
  flyoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  flyoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 10,
  },
  flyoutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  flyoutOptionInfo: {
    flex: 1,
  },
  flyoutOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  flyoutOptionDesc: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
});

export default BottomToolbar;
