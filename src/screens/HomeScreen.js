import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  StatusBar,
  Modal,
  ActivityIndicator,
  BackHandler,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getOrders, ORDER_STATUS, PAYMENT_METHODS } from '../services/orderService';
import { getOnhand } from '../services/syncService';
import { getAllLocalAdjustments } from '../services/onhandService';

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2;

// Icon mapping based on menu item names
const getMenuIcon = (name) => {
  const lowerName = (name || '').toLowerCase();

  // Sales related
  if (lowerName.includes('sales') || lowerName.includes('sell')) return 'cart';
  if (lowerName.includes('order')) return 'receipt';
  if (lowerName.includes('pos') || lowerName.includes('point of sale')) return 'card';

  // Purchase related
  if (lowerName.includes('purchase') || lowerName.includes('buy')) return 'bag';
  if (lowerName.includes('vendor') || lowerName.includes('supplier')) return 'business';

  // Inventory related
  if (lowerName.includes('inventory') || lowerName.includes('stock')) return 'cube';
  if (lowerName.includes('warehouse')) return 'home';
  if (lowerName.includes('transfer')) return 'swap-horizontal';
  if (lowerName.includes('receiving') || lowerName.includes('receive')) return 'arrow-down-circle';
  if (lowerName.includes('shipping') || lowerName.includes('ship')) return 'airplane';
  if (lowerName.includes('cycle count') || lowerName.includes('count')) return 'sync';
  if (lowerName.includes('adjustment')) return 'create';

  // Customer related
  if (lowerName.includes('customer') || lowerName.includes('client')) return 'people';
  if (lowerName.includes('contact')) return 'call';

  // Financial
  if (lowerName.includes('price') || lowerName.includes('pricing')) return 'pricetag';
  if (lowerName.includes('payment')) return 'wallet';
  if (lowerName.includes('invoice')) return 'document-text';
  if (lowerName.includes('discount')) return 'gift';
  if (lowerName.includes('tax')) return 'calculator';

  // Reports
  if (lowerName.includes('report')) return 'bar-chart';
  if (lowerName.includes('analytics') || lowerName.includes('dashboard')) return 'analytics';
  if (lowerName.includes('summary')) return 'list';

  // Returns
  if (lowerName.includes('return') || lowerName.includes('refund')) return 'return-down-back';

  // Miscellaneous
  if (lowerName.includes('setting')) return 'settings';
  if (lowerName.includes('user') || lowerName.includes('account')) return 'person';
  if (lowerName.includes('search') || lowerName.includes('find')) return 'search';
  if (lowerName.includes('scan') || lowerName.includes('barcode')) return 'barcode';
  if (lowerName.includes('print')) return 'print';
  if (lowerName.includes('notification') || lowerName.includes('alert')) return 'notifications';
  if (lowerName.includes('location')) return 'location';
  if (lowerName.includes('item') || lowerName.includes('product')) return 'cube-outline';
  if (lowerName.includes('category')) return 'folder';
  if (lowerName.includes('lodgment') || lowerName.includes('deposit')) return 'cash';
  if (lowerName.includes('delivery')) return 'car';
  if (lowerName.includes('pick') || lowerName.includes('picking')) return 'hand-left';
  if (lowerName.includes('pack') || lowerName.includes('packing')) return 'archive';

  // Default
  return 'apps';
};

// Module icon mapping
const getModuleIcon = (moduleName) => {
  const lowerName = (moduleName || '').toLowerCase();

  if (lowerName.includes('sales')) return 'cart';
  if (lowerName.includes('purchase')) return 'bag';
  if (lowerName.includes('inventory')) return 'cube';
  if (lowerName.includes('warehouse')) return 'home';
  if (lowerName.includes('customer')) return 'people';
  if (lowerName.includes('report')) return 'bar-chart';
  if (lowerName.includes('setting')) return 'settings';
  if (lowerName.includes('order')) return 'receipt';
  if (lowerName.includes('finance') || lowerName.includes('accounting')) return 'wallet';
  if (lowerName.includes('admin')) return 'shield';

  return 'grid';
};

// KPI Card Component
const KPICard = ({ title, value, icon, color, trend, trendValue, isMultiline }) => (
  <View style={[styles.kpiCard, { borderLeftColor: color }]}>
    <View style={styles.kpiHeader}>
      <View style={[styles.kpiIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      {trend && trendValue && (
        <View style={[styles.trendBadge, { backgroundColor: trend === 'up' ? colors.accentGreen + '15' : colors.accentRed + '15' }]}>
          <Ionicons
            name={trend === 'up' ? 'trending-up' : 'trending-down'}
            size={14}
            color={trend === 'up' ? colors.accentGreen : colors.accentRed}
          />
          <Text style={[styles.trendText, { color: trend === 'up' ? colors.accentGreen : colors.accentRed }]}>
            {trendValue}
          </Text>
        </View>
      )}
      {!trend && trendValue && (
        <View style={[styles.trendBadge, { backgroundColor: colors.textMuted + '15' }]}>
          <Text style={[styles.trendText, { color: colors.textMuted }]}>
            {trendValue}
          </Text>
        </View>
      )}
    </View>
    <Text style={[styles.kpiValue, isMultiline && styles.kpiValueMultiline]} numberOfLines={isMultiline ? 4 : 1}>
      {value}
    </Text>
    <Text style={styles.kpiTitle}>{title}</Text>
  </View>
);

// Module Card Component
const ModuleCard = ({ module, onPress, isExpanded }) => (
  <TouchableOpacity
    style={[styles.moduleCard, isExpanded && styles.moduleCardExpanded]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.moduleContent}>
      <View style={styles.moduleIconContainer}>
        <Ionicons name={getModuleIcon(module.Menu)} size={28} color={colors.accent} />
      </View>
      <View style={styles.moduleInfo}>
        <Text style={styles.moduleName}>{module.Menu}</Text>
        <Text style={styles.moduleCount}>
          {module.SubMenuItems?.length || 0} items
        </Text>
      </View>
      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={24}
        color={colors.textMuted}
      />
    </View>
  </TouchableOpacity>
);

// Menu Item Component
const MenuItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={() => onPress(item)} activeOpacity={0.7}>
    <View style={styles.menuItemContent}>
      <View style={styles.menuItemIconContainer}>
        <Ionicons name={getMenuIcon(item.name)} size={24} color={colors.accent} />
      </View>
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.ordertype && (
          <Text style={styles.menuItemType}>{item.ordertype}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </View>
  </TouchableOpacity>
);

// Quick Links Section
const QuickLinks = ({ menuData, onItemPress, onSyncPress, onScanPress }) => {
  const quickLinkItems = [];
  menuData?.forEach(module => {
    module.SubMenuItems?.forEach(item => {
      if (item.quicklink === 'yes' && quickLinkItems.length < 5) {
        quickLinkItems.push({ ...item, moduleName: module.Menu });
      }
    });
  });

  return (
    <View style={styles.quickLinksSection}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickLinksContainer}
      >
        {/* Scan - Static Quick Action */}
        <TouchableOpacity
          style={styles.quickLinkItem}
          onPress={onScanPress}
        >
          <View style={[styles.quickLinkIconContainer, { backgroundColor: (colors.accentPurple || '#9C27B0') + '15' }]}>
            <Ionicons name="scan" size={28} color={colors.accentPurple || '#9C27B0'} />
          </View>
          <Text style={styles.quickLinkName} numberOfLines={2}>
            Scan
          </Text>
        </TouchableOpacity>

        {/* Sync Data - Static Quick Action */}
        <TouchableOpacity
          style={styles.quickLinkItem}
          onPress={onSyncPress}
        >
          <View style={[styles.quickLinkIconContainer, { backgroundColor: colors.accentGreen + '15' }]}>
            <Ionicons name="sync" size={28} color={colors.accentGreen} />
          </View>
          <Text style={styles.quickLinkName} numberOfLines={2}>
            Sync Data
          </Text>
        </TouchableOpacity>

        {quickLinkItems.map((item, index) => (
          <TouchableOpacity
            key={`quick-${index}`}
            style={styles.quickLinkItem}
            onPress={() => onItemPress(item)}
          >
            <View style={styles.quickLinkIconContainer}>
              <Ionicons name={getMenuIcon(item.name)} size={28} color={colors.accent} />
            </View>
            <Text style={styles.quickLinkName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  const { user, menuData, refreshMenuData, isSyncing, syncProgress } = useAuth();
  const [expandedModule, setExpandedModule] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiData, setKpiData] = useState([
    { title: "Today's Sales", value: 'MUR 0', icon: 'cart', color: colors.accent },
    { title: 'Orders', value: '0', icon: 'receipt', color: colors.accentGreen },
    { title: 'Payments', value: 'Loading...', icon: 'wallet', color: colors.accentOrange },
    { title: 'Inventory', value: '0 items', icon: 'cube', color: colors.accentPurple },
  ]);

  // Load KPI data from real sources
  const loadKpiData = useCallback(async () => {
    try {
      // Get all orders
      const allOrders = await getOrders();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter today's orders (confirmed only)
      const todaysOrders = allOrders.filter(order => {
        if (order.status !== ORDER_STATUS.CONFIRMED) return false;
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });

      // Calculate today's sales total
      const todaysSales = todaysOrders.reduce((sum, order) => {
        return sum + (order.totals?.totalNet || 0);
      }, 0);

      // Count total orders today
      const ordersCount = todaysOrders.length;

      // Calculate payment breakdown
      const paymentBreakdown = {};
      todaysOrders.forEach(order => {
        (order.payments || []).forEach(payment => {
          const method = payment.method || 'OTHER';
          paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (payment.amount || 0);
        });
      });

      // Format payment breakdown for display
      const paymentMethods = Object.keys(paymentBreakdown);
      let paymentDisplay = 'No payments';
      if (paymentMethods.length > 0) {
        paymentDisplay = paymentMethods.map(m => `${m}: ${paymentBreakdown[m].toFixed(0)}`).join('\n');
      }

      // Get inventory data with local adjustments
      const onhandData = await getOnhand() || [];
      const localAdjustments = await getAllLocalAdjustments();

      // Calculate adjusted quantities
      let totalItems = onhandData.length;
      let totalQty = 0;

      onhandData.forEach(item => {
        const baseQty = parseFloat(item.onHandQty) || 0;
        const adjustment = localAdjustments[item.itemNumber] || 0;
        const adjustedQty = baseQty + adjustment;
        totalQty += adjustedQty;
      });

      // Update KPI data
      setKpiData([
        {
          title: "Today's Sales",
          value: todaysSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
          icon: 'cart',
          color: colors.accent,
          trendValue: `${ordersCount} orders`
        },
        {
          title: 'Orders Today',
          value: ordersCount.toString(),
          icon: 'receipt',
          color: colors.accentGreen,
        },
        {
          title: 'Payments',
          value: paymentDisplay,
          icon: 'wallet',
          color: colors.accentOrange,
          isMultiline: true,
        },
        {
          title: 'Inventory',
          value: `${totalItems}`,
          icon: 'cube',
          color: colors.accentPurple,
          trendValue: `Qty: ${Math.round(totalQty).toLocaleString()}`
        },
      ]);
    } catch (error) {
      console.error('Error loading KPI data:', error);
    }
  }, []);

  // Load KPI data on mount and when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadKpiData();
    }, [loadKpiData])
  );

  // Handle back button - prevent going back from home screen
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ]
        );
        return true; // Prevent default back behavior
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshMenuData(), loadKpiData()]);
    setRefreshing(false);
  };

  const handleModulePress = (moduleId) => {
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const handleMenuItemPress = (item) => {
    navigation.navigate('MenuDetail', { item });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Sync Progress Modal */}
      <Modal
        visible={isSyncing}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.syncOverlay}>
          <View style={styles.syncModal}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.syncTitle}>Syncing Data</Text>
            <Text style={styles.syncProgress}>{syncProgress}</Text>
            <Text style={styles.syncHint}>Please wait...</Text>
          </View>
        </View>
      </Modal>

      {/* Blue Header Only */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('AccountDetails')} style={styles.menuButton}>
          <Ionicons name="person-circle" size={32} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.username || 'User'}</Text>
        </View>
        <View style={styles.headerRightButtons}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing || isSyncing}
          >
            <Ionicons
              name={refreshing || isSyncing ? "sync" : "refresh-outline"}
              size={22}
              color={refreshing || isSyncing ? 'rgba(255,255,255,0.5)' : '#FFFFFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.storyButton}
            onPress={() => navigation.navigate('Story')}
          >
            <Ionicons name="play-circle-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={26} color="#FFFFFF" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* White Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* KPI Cards Section */}
        <View style={styles.kpiSection}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <View style={styles.kpiGrid}>
            {kpiData.map((kpi, index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </View>
        </View>

        {/* Quick Links */}
        <QuickLinks
          menuData={menuData}
          onItemPress={handleMenuItemPress}
          onScanPress={() => navigation.navigate('Scan')}
          onSyncPress={() => navigation.navigate('SyncData')}
        />

        {/* Modules Section */}
        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>Modules</Text>
          {menuData && menuData.length > 0 ? (
            menuData.map((module) => (
              <View key={module.Id}>
                <ModuleCard
                  module={module}
                  onPress={() => handleModulePress(module.Id)}
                  isExpanded={expandedModule === module.Id}
                />
                {expandedModule === module.Id && (
                  <View style={styles.menuItemsContainer}>
                    {module.SubMenuItems?.map((item, index) => (
                      <MenuItem
                        key={`${module.Id}-${index}`}
                        item={item}
                        onPress={handleMenuItemPress}
                      />
                    ))}
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>No modules available</Text>
            </View>
          )}
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
  // Header Styles (Blue)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 20,
  },
  menuButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshButton: {
    padding: 6,
  },
  storyButton: {
    padding: 6,
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.accentRed,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Content Styles (White)
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  // KPI Styles
  kpiSection: {
    marginTop: 20,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 12,
  },
  kpiCard: {
    width: cardWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  kpiValueMultiline: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  kpiTitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Quick Links Styles
  quickLinksSection: {
    marginTop: 24,
  },
  quickLinksContainer: {
    paddingHorizontal: 16,
  },
  quickLinkItem: {
    width: 90,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickLinkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLinkName: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  // Modules Styles
  modulesSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  moduleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  moduleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  moduleCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Menu Items Styles
  menuItemsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  menuItemType: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  // Sync Modal Styles
  syncOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  syncTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  syncProgress: {
    fontSize: 14,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 8,
  },
  syncHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default HomeScreen;
