import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getMenuData, getMenuOptions, saveMenuData } from '../services/api';

const MenuScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [menus, setMenus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load menus from API
  const loadMenus = async (forceRefresh = false) => {
    try {
      let menuData = null;

      // Try cached data first (unless forcing refresh)
      if (!forceRefresh) {
        menuData = await getMenuData();
      }

      // If no cached data or forcing refresh, fetch from API
      if (!menuData || (Array.isArray(menuData) && menuData.length === 0) || forceRefresh) {
        console.log('[MenuScreen] Fetching menus from API...');
        const username = user?.username || '';
        const apiResult = await getMenuOptions(username);

        console.log('[MenuScreen] API Result:', JSON.stringify(apiResult).substring(0, 1000));

        if (apiResult.success && apiResult.data) {
          menuData = apiResult.data;
          // Save to cache for later use
          await saveMenuData(menuData);
        }
      }

      // Handle nested structure: [{ Menu: "Order Management", SubMenuItems: [...] }, ...]
      let menuList = [];

      if (menuData && Array.isArray(menuData)) {
        // Check if it's nested structure with Menu sections
        if (menuData.length > 0 && menuData[0].SubMenuItems) {
          // Extract all SubMenuItems from all sections with section info
          menuData.forEach(section => {
            if (section.SubMenuItems && Array.isArray(section.SubMenuItems)) {
              section.SubMenuItems.forEach(item => {
                menuList.push({
                  ...item,
                  _sectionName: section.Menu, // Keep track of which section it belongs to
                });
              });
            }
          });
          console.log('[MenuScreen] Extracted', menuList.length, 'items from nested structure');
        } else {
          // It's already a flat array
          menuList = menuData;
          console.log('[MenuScreen] Menu is flat array with', menuList.length, 'items');
        }
      } else if (menuData && menuData.items && Array.isArray(menuData.items)) {
        menuList = menuData.items;
        console.log('[MenuScreen] Menu has items array with', menuList.length, 'items');
      }

      console.log('[MenuScreen] Total menus loaded:', menuList.length);
      if (menuList.length > 0) {
        console.log('[MenuScreen] Sample menu:', JSON.stringify(menuList[0]).substring(0, 500));
      }

      setMenus(menuList);
    } catch (error) {
      console.error('[MenuScreen] Error loading menus:', error);
      setMenus([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMenus(true);
  };

  // Get icon and color based on transaction_type
  const getMenuStyle = (menu) => {
    const type = (menu.transaction_type || '').toUpperCase();
    if (type === 'SALES') {
      return { icon: 'cart', color: '#4CAF50', bgColor: '#E8F5E9' };
    } else if (type === 'RETURNS') {
      return { icon: 'return-down-back', color: '#FF9800', bgColor: '#FFF3E0' };
    } else if ((menu.name || '').toLowerCase().includes('report')) {
      return { icon: 'document-text', color: '#9C27B0', bgColor: '#F3E5F5' };
    } else if ((menu.name || '').toLowerCase().includes('scan')) {
      return { icon: 'scan', color: '#2196F3', bgColor: '#E3F2FD' };
    }
    return { icon: 'apps', color: '#607D8B', bgColor: '#ECEFF1' };
  };

  const handleMenuPress = (menu) => {
    // Navigate to MenuDetailScreen with the menu item
    navigation.navigate('MenuDetail', { item: menu });
  };

  // Group menus by transaction_type
  const salesMenus = menus.filter(m => (m.transaction_type || '').toUpperCase() === 'SALES');
  const returnsMenus = menus.filter(m => (m.transaction_type || '').toUpperCase() === 'RETURNS');
  const otherMenus = menus.filter(m => {
    const type = (m.transaction_type || '').toUpperCase();
    return type !== 'SALES' && type !== 'RETURNS';
  });

  // Static menu items (always show these)
  const staticMenuSections = [
    {
      title: 'Quick Access',
      items: [
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
      ],
    },
    {
      title: 'Data & Sync',
      items: [
        { icon: 'sync-outline', title: 'Sync Data', screen: 'SyncData', color: '#3F51B5' },
        { icon: 'folder-outline', title: 'Synced Data', screen: 'SyncedDataView', color: '#009688' },
      ],
    },
  ];

  const handleStaticMenuPress = (screen) => {
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
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading menus...</Text>
          </View>
        ) : (
          <>
            {/* API Menus - Sales */}
            {salesMenus.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sales ({salesMenus.length})</Text>
                <View style={styles.menuGrid}>
                  {salesMenus.map((menu, index) => {
                    const menuStyle = getMenuStyle(menu);
                    return (
                      <TouchableOpacity
                        key={menu.name || index}
                        style={styles.menuItem}
                        onPress={() => handleMenuPress(menu)}
                      >
                        <View style={[styles.iconContainer, { backgroundColor: menuStyle.bgColor }]}>
                          <Ionicons name={menuStyle.icon} size={28} color={menuStyle.color} />
                        </View>
                        <Text style={styles.menuItemTitle} numberOfLines={2}>
                          {menu.name}
                        </Text>
                        <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                          {menu.pricelist || 'Default'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* API Menus - Returns */}
            {returnsMenus.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Returns ({returnsMenus.length})</Text>
                <View style={styles.menuGrid}>
                  {returnsMenus.map((menu, index) => {
                    const menuStyle = getMenuStyle(menu);
                    return (
                      <TouchableOpacity
                        key={menu.name || index}
                        style={styles.menuItem}
                        onPress={() => handleMenuPress(menu)}
                      >
                        <View style={[styles.iconContainer, { backgroundColor: menuStyle.bgColor }]}>
                          <Ionicons name={menuStyle.icon} size={28} color={menuStyle.color} />
                        </View>
                        <Text style={styles.menuItemTitle} numberOfLines={2}>
                          {menu.name}
                        </Text>
                        <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                          {menu.pricelist || 'Default'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* API Menus - Other */}
            {otherMenus.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Other Menus ({otherMenus.length})</Text>
                <View style={styles.menuGrid}>
                  {otherMenus.map((menu, index) => {
                    const menuStyle = getMenuStyle(menu);
                    return (
                      <TouchableOpacity
                        key={menu.name || index}
                        style={styles.menuItem}
                        onPress={() => handleMenuPress(menu)}
                      >
                        <View style={[styles.iconContainer, { backgroundColor: menuStyle.bgColor }]}>
                          <Ionicons name={menuStyle.icon} size={28} color={menuStyle.color} />
                        </View>
                        <Text style={styles.menuItemTitle} numberOfLines={2}>
                          {menu.name}
                        </Text>
                        <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                          {menu.transaction_type || 'N/A'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Show message if no API menus */}
            {menus.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#999999" />
                <Text style={styles.emptyText}>No menus found from API</Text>
                <Text style={styles.emptySubtext}>User: {user?.username || 'Unknown'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Static Menu Sections */}
            {staticMenuSections.map((section, sectionIndex) => (
              <View key={sectionIndex} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.menuGrid}>
                  {section.items.map((item, itemIndex) => (
                    <TouchableOpacity
                      key={itemIndex}
                      style={styles.menuItem}
                      onPress={() => handleStaticMenuPress(item.screen)}
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
          </>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#999999',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  menuItemSubtitle: {
    fontSize: 9,
    color: '#999999',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default MenuScreen;
