import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';

const MenuScreen = () => {
  const navigation = useNavigation();

  const menuSections = [
    {
      title: 'Orders & Sales',
      items: [
        { icon: 'cart-outline', title: 'New Order', screen: 'CustomerSelection', color: '#2196F3' },
        { icon: 'document-text-outline', title: 'Local Orders', screen: 'Orders', color: '#4CAF50' },
        { icon: 'cloud-outline', title: 'Order History', screen: 'HistoryOrders', color: '#9C27B0' },
        { icon: 'receipt-outline', title: 'Lodgement Report', screen: 'LodgementReport', color: '#FF9800' },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { icon: 'cube-outline', title: 'Stock On Hand', screen: 'Inventory', color: '#00BCD4' },
        { icon: 'swap-horizontal-outline', title: 'Store Requests', screen: 'StoreRequests', color: '#E91E63' },
        { icon: 'scan-outline', title: 'Scan Items', screen: 'Scan', color: '#795548' },
        { icon: 'layers-outline', title: 'Reconciliation', screen: 'BatchReconciliation', color: '#607D8B' },
      ],
    },
    {
      title: 'Data & Sync',
      items: [
        { icon: 'sync-outline', title: 'Sync Data', screen: 'SyncData', color: '#3F51B5' },
        { icon: 'folder-outline', title: 'Synced Data', screen: 'SyncedDataView', color: '#009688' },
        { icon: 'document-attach-outline', title: 'Scan Template', screen: 'ScanTemplate', color: '#FF5722' },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', title: 'Account Details', screen: 'AccountDetails', color: '#673AB7' },
        { icon: 'card-outline', title: 'Credit Check', screen: 'CreditCheck', color: '#F44336' },
        { icon: 'create-outline', title: 'Signature', screen: 'Signature', color: '#8BC34A' },
      ],
    },
  ];

  const handleMenuPress = (screen) => {
    if (screen === 'Orders') {
      navigation.navigate('MainTabs', { screen: 'Orders' });
    } else if (screen === 'Inventory') {
      navigation.navigate('MainTabs', { screen: 'Inventory' });
    } else {
      navigation.navigate(screen);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuGrid}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.menuItem}
                  onPress={() => handleMenuPress(item.screen)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={28} color={item.color} />
                  </View>
                  <Text style={styles.menuItemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
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
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
    paddingLeft: 4,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    width: '25%',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuItemTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
  },
});

export default MenuScreen;
