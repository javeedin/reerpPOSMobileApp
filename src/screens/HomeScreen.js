import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { queryHistoricalOrders, getOnhand } from '../services/syncService';
import { getRequisitions } from '../services/stockRequisitionService';

const { width } = Dimensions.get('window');
const TILE_WIDTH = width * 0.72;
const TILE_MARGIN = 6;
const TOTAL_DAYS = 12;

// Storage key for cached sales data
const SALES_CACHE_KEY = 'home_sales_cache';
// Cache never expires for historical days - only today is refreshed

// Store options for requisition
const STORE_OPTIONS = [
  {
    id: 'dpstore',
    name: 'DP Store',
    subtitle: 'Main Store',
    organizationCode: 'GIC',
    subinventory: 'DUTY PAID',
    icon: 'business',
  },
  {
    id: 'gphstore',
    name: 'GPH Store',
    subtitle: 'Pharmacy',
    organizationCode: 'GPH',
    subinventory: 'STORES',
    icon: 'medkit',
  },
];

// 10 Unique Card Designs
const CARD_DESIGNS = [
  { id: 'wave', gradient: ['#667eea', '#764ba2'], emoji: '📊' },
  { id: 'sunset', gradient: ['#fa709a', '#fee140'], emoji: '🌅' },
  { id: 'ocean', gradient: ['#4facfe', '#00f2fe'], emoji: '🌊' },
  { id: 'forest', gradient: ['#43e97b', '#38f9d7'], emoji: '🌿' },
  { id: 'royal', gradient: ['#9D50BB', '#6E48AA'], emoji: '👑' },
  { id: 'fire', gradient: ['#FF512F', '#F09819'], emoji: '🔥' },
  { id: 'midnight', gradient: ['#2C3E50', '#4CA1AF'], emoji: '🌙' },
  { id: 'candy', gradient: ['#f5576c', '#f093fb'], emoji: '🍬' },
  { id: 'aurora', gradient: ['#00C9FF', '#92FE9D'], emoji: '✨' },
  { id: 'golden', gradient: ['#F7971E', '#FFD200'], emoji: '☀️' },
];

// Special Day Themes
const SPECIAL_THEMES = {
  blackFriday: { gradient: ['#000000', '#434343'], title: '🛍️ BLACK FRIDAY!' },
  sunday: { gradient: ['#11998e', '#38ef7d'], title: '☀️ SUNDAY' },
  christmas: { gradient: ['#165B33', '#BB2528'], title: '🎄 CHRISTMAS!' },
  newYear: { gradient: ['#FFD700', '#FFA500'], title: '🎉 NEW YEAR!' },
  saturday: { gradient: ['#8E2DE2', '#4A00E0'], title: '🎊 WEEKEND' },
};

const getSpecialTheme = (date) => {
  const month = date.getMonth();
  const day = date.getDate();
  const dayOfWeek = date.getDay();

  if (month === 10) {
    const firstDay = new Date(date.getFullYear(), 10, 1).getDay();
    const firstFriday = firstDay <= 5 ? 6 - firstDay : 13 - firstDay;
    const blackFriday = firstFriday + 21;
    if (day === blackFriday) return 'blackFriday';
  }
  if (month === 11 && day === 25) return 'christmas';
  if (month === 0 && day === 1) return 'newYear';
  if (dayOfWeek === 0) return 'sunday';
  if (dayOfWeek === 6) return 'saturday';
  return null;
};

// Quick Actions
const QuickActions = ({ navigation }) => {
  const actions = [
    { icon: 'cart-outline', label: 'New Order', onPress: () => navigation.navigate('CustomerSelection'), color: '#2196F3' },
    { icon: 'scan-outline', label: 'Scan', onPress: () => navigation.navigate('Scan'), color: '#9C27B0' },
    { icon: 'sync-outline', label: 'Sync', onPress: () => navigation.navigate('SyncData'), color: '#4CAF50' },
    { icon: 'cube-outline', label: 'Stock', onPress: () => navigation.navigate('MainTabs', { screen: 'Inventory' }), color: '#FF9800' },
    { icon: 'cash-outline', label: 'Lodgement', onPress: () => navigation.navigate('LodgementReport'), color: '#E91E63' },
    { icon: 'card-outline', label: 'Credit', onPress: () => navigation.navigate('CreditCheck'), color: '#00BCD4' },
  ];

  return (
    <View style={styles.quickActionsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
        {actions.map((action, index) => (
          <TouchableOpacity key={index} style={styles.quickActionItem} onPress={action.onPress}>
            <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Compact Sales Tile
const SalesTile = ({ data, index, lastWeekSales }) => {
  const specialTheme = getSpecialTheme(data.date);
  const design = specialTheme
    ? { gradient: SPECIAL_THEMES[specialTheme].gradient, ...CARD_DESIGNS[index % CARD_DESIGNS.length] }
    : CARD_DESIGNS[index % CARD_DESIGNS.length];

  const isToday = data.isToday;
  const weekComparison = lastWeekSales !== null ? data.totalSales - lastWeekSales : null;

  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const getDayName = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const formatDate = (date) => `${date.getDate()}/${date.getMonth() + 1}`;

  return (
    <LinearGradient
      colors={design.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.salesTile, isToday && styles.todayTile]}
    >
      {specialTheme && SPECIAL_THEMES[specialTheme] && (
        <View style={styles.specialBadge}>
          <Text style={styles.specialBadgeText}>{SPECIAL_THEMES[specialTheme].title}</Text>
        </View>
      )}

      {isToday && !specialTheme && (
        <View style={styles.todayBadge}>
          <Text style={styles.todayBadgeText}>TODAY</Text>
        </View>
      )}

      <Text style={styles.designEmoji}>{design.emoji}</Text>

      <View style={styles.tileHeader}>
        <Text style={styles.tileDay}>{getDayName(data.date)}</Text>
        <Text style={styles.tileDate}>{formatDate(data.date)}</Text>
      </View>

      <View style={styles.tileSalesContainer}>
        <Text style={styles.tileSalesAmount}>{formatCurrency(data.totalSales)}</Text>
        {weekComparison !== null && (
          <View style={styles.comparisonContainer}>
            <Ionicons
              name={weekComparison >= 0 ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={weekComparison >= 0 ? '#4ADE80' : '#F87171'}
            />
            <Text style={[styles.comparisonText, { color: weekComparison >= 0 ? '#4ADE80' : '#F87171' }]}>
              {weekComparison >= 0 ? '+' : ''}{formatCurrency(weekComparison)} vs last wk
            </Text>
          </View>
        )}
      </View>

      <View style={styles.tileStats}>
        <View style={styles.tileStatItem}>
          <Text style={styles.tileStatValue}>{data.orderCount || 0}</Text>
          <Text style={styles.tileStatLabel}>Orders</Text>
        </View>
        <View style={styles.tileStatDivider} />
        <View style={styles.tileStatItem}>
          <Text style={styles.tileStatValue}>{data.customerCount || 0}</Text>
          <Text style={styles.tileStatLabel}>Cust</Text>
        </View>
      </View>

      {/* Top Customers */}
      {data.topCustomers && data.topCustomers.length > 0 && (
        <View style={styles.tileSection}>
          <Text style={styles.tileSectionTitle}>Top Customers</Text>
          {data.topCustomers.slice(0, 2).map((customer, idx) => (
            <Text key={idx} style={styles.tileListText} numberOfLines={1}>
              {idx + 1}. {customer.name} - {formatCurrency(customer.amount)}
            </Text>
          ))}
        </View>
      )}

      {/* Top Items */}
      {data.topItems && data.topItems.length > 0 && (
        <View style={styles.tileSection}>
          <Text style={styles.tileSectionTitle}>Top Items</Text>
          {data.topItems.slice(0, 2).map((item, idx) => (
            <Text key={idx} style={styles.tileListText} numberOfLines={1}>
              {idx + 1}. {item.name} x{item.qty}
            </Text>
          ))}
        </View>
      )}
    </LinearGradient>
  );
};

// Summary Graph Card
const SummaryCard = ({ salesData, allCustomers, allItems, paymentBreakdown }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  // Calculate max for graph scaling
  const maxSales = Math.max(...salesData.map(d => d.totalSales || 0), 1);
  const totalSales = salesData.reduce((sum, d) => sum + (d.totalSales || 0), 0);
  const totalOrders = salesData.reduce((sum, d) => sum + (d.orderCount || 0), 0);

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>📊 12-Day Summary</Text>

      {/* Mini Graph */}
      <View style={styles.graphContainer}>
        {salesData.map((day, idx) => {
          const height = maxSales > 0 ? (day.totalSales / maxSales) * 60 : 0;
          return (
            <View key={idx} style={styles.graphBar}>
              <View style={[styles.graphBarFill, { height: Math.max(height, 4) }]} />
              <Text style={styles.graphBarLabel}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.date.getDay()]}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.summaryStats}>
        <View style={styles.summaryStatItem}>
          <Text style={styles.summaryStatValue}>{formatCurrency(totalSales)}</Text>
          <Text style={styles.summaryStatLabel}>Total Sales</Text>
        </View>
        <View style={styles.summaryStatItem}>
          <Text style={styles.summaryStatValue}>{totalOrders}</Text>
          <Text style={styles.summaryStatLabel}>Orders</Text>
        </View>
      </View>

      {/* Top 10 Customers */}
      {allCustomers.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>🏆 Top 10 Customers</Text>
          {allCustomers.slice(0, 10).map((c, idx) => (
            <View key={idx} style={styles.summaryListItem}>
              <Text style={styles.summaryRank}>{idx + 1}</Text>
              <Text style={styles.summaryName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(c.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top 10 Items */}
      {allItems.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>🔥 Top 10 Items</Text>
          {allItems.slice(0, 10).map((item, idx) => (
            <View key={idx} style={styles.summaryListItem}>
              <Text style={styles.summaryRank}>{idx + 1}</Text>
              <Text style={styles.summaryName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.summaryValue}>x{item.qty}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Payment Methods */}
      {Object.keys(paymentBreakdown).length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>💳 Payments by Method</Text>
          {Object.entries(paymentBreakdown).map(([method, amount], idx) => (
            <View key={idx} style={styles.summaryListItem}>
              <Text style={styles.summaryName}>{method}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Inventory Card
const InventoryCard = ({ item, rank, type }) => {
  const isLowStock = type === 'low';
  return (
    <View style={[styles.inventoryCard, isLowStock && styles.lowStockCard]}>
      <View style={[styles.inventoryRank, isLowStock ? styles.lowRank : styles.topRank]}>
        <Text style={styles.inventoryRankText}>{rank}</Text>
      </View>
      <View style={styles.inventoryInfo}>
        <Text style={styles.inventoryName} numberOfLines={1}>{item.itemDescription || item.itemNumber}</Text>
        <Text style={styles.inventoryCode}>{item.itemNumber}</Text>
      </View>
      <View style={styles.inventoryQty}>
        <Text style={[styles.inventoryQtyText, isLowStock && styles.lowQtyText]}>
          {Math.round(item.primaryQuantity || 0)}
        </Text>
      </View>
    </View>
  );
};

// Request Card
const RequestCard = ({ request }) => {
  const statusColors = { DRAFT: '#FF9800', CONFIRMED: '#4CAF50', SUBMITTED: '#2196F3', CANCELLED: '#F44336' };
  return (
    <TouchableOpacity style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestSeq}>{request.seqNo}</Text>
        <View style={[styles.requestStatus, { backgroundColor: statusColors[request.status] + '20' }]}>
          <Text style={[styles.requestStatusText, { color: statusColors[request.status] }]}>{request.status}</Text>
        </View>
      </View>
      <Text style={styles.requestStore}>{request.sourceSubinventory} → {request.destSubinventory}</Text>
      <Text style={styles.requestDate}>{new Date(request.requestDate).toLocaleDateString()} · {request.lines?.length || 0} items</Text>
    </TouchableOpacity>
  );
};

// Source Store Selection Modal
const SourceStoreModal = ({ visible, onSelect, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableOpacity
        style={styles.storeModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.storeModalContainer}>
          <View style={styles.storeModalHeader}>
            <Text style={styles.storeModalTitle}>Select Source Store</Text>
            <TouchableOpacity onPress={onClose} style={styles.storeModalClose}>
              <Ionicons name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>
          <Text style={styles.storeModalSubtitle}>Choose which store to request items from</Text>

          <View style={styles.storeOptions}>
            {STORE_OPTIONS.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={styles.storeOption}
                onPress={() => onSelect(store)}
              >
                <View style={styles.storeIconBox}>
                  <Ionicons name={store.icon} size={28} color="#2196F3" />
                </View>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{store.name}</Text>
                  <Text style={styles.storeSubtitle}>{store.subtitle}</Text>
                  <Text style={styles.storeParams}>
                    {store.organizationCode} / {store.subinventory}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#CCCCCC" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const HomeScreen = ({ navigation }) => {
  const { user, isSyncing, syncProgress } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [salesTiles, setSalesTiles] = useState([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(true);
  const [topStock, setTopStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [storeRequests, setStoreRequests] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState({});
  const [showStoreModal, setShowStoreModal] = useState(false);
  const dataLoadedRef = useRef(false);

  // Load cached data - cache never expires for historical data
  const loadCachedSalesData = async () => {
    try {
      const cached = await AsyncStorage.getItem(SALES_CACHE_KEY);
      if (cached) {
        const { data, aggregates } = JSON.parse(cached);
        // Restore dates from ISO strings
        const restoredData = data.map(d => ({ ...d, date: new Date(d.date) }));
        return { tiles: restoredData, aggregates };
      }
    } catch (error) {
      console.error('Error loading cached sales:', error);
    }
    return null;
  };

  // Save data to cache with aggregates
  const saveSalesDataToCache = async (data, aggregates) => {
    try {
      const cacheData = { data, aggregates };
      await AsyncStorage.setItem(SALES_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching sales:', error);
    }
  };

  // Fetch only today's data for refresh
  const fetchTodayOnly = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const result = await queryHistoricalOrders({
        fromDate: today,
        toDate: today,
        salesrepNumber: user?.username || '',
      });

      const orders = result.success ? (result.orders || []) : [];
      const totalSales = orders.reduce((sum, o) => sum + (o.calculatedTotalNet || 0), 0);

      // Get day-specific top customers
      const dayCustomers = {};
      orders.forEach(order => {
        const name = order.accountName || order.customerName || order.accountNumber || 'Unknown';
        dayCustomers[name] = (dayCustomers[name] || 0) + (order.calculatedTotalNet || 0);
      });

      // Get day-specific top items
      const dayItems = {};
      orders.forEach(order => {
        (order.lines || []).forEach(line => {
          const name = line.itemDescription || line.description || line.itemNumber || 'Unknown';
          dayItems[name] = (dayItems[name] || 0) + (parseFloat(line.orderedQuantity) || parseFloat(line.quantity) || 1);
        });
      });

      return {
        date: today,
        isToday: true,
        totalSales,
        orderCount: orders.length,
        customerCount: Object.keys(dayCustomers).length,
        topCustomers: Object.entries(dayCustomers)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3),
        topItems: Object.entries(dayItems)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 3),
      };
    } catch (error) {
      console.error('Error fetching today data:', error);
      return null;
    }
  }, [user]);

  // Fetch all 12 days of sales data at once
  const fetchAllSalesData = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Query last 12 days in one request
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - (TOTAL_DAYS - 1));

    try {
      const result = await queryHistoricalOrders({
        fromDate,
        toDate: today,
        salesrepNumber: user?.username || '',
      });

      const orders = result.success ? (result.orders || []) : [];

      // Group orders by date
      const ordersByDate = {};
      const customerTotals = {};
      const itemTotals = {};
      const payments = {};

      orders.forEach(order => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        const dateKey = orderDate.toISOString().split('T')[0];

        if (!ordersByDate[dateKey]) {
          ordersByDate[dateKey] = [];
        }
        ordersByDate[dateKey].push(order);

        // Aggregate customers
        const customerName = order.accountName || order.customerName || order.accountNumber || 'Unknown';
        customerTotals[customerName] = (customerTotals[customerName] || 0) + (order.calculatedTotalNet || 0);

        // Aggregate items
        (order.lines || []).forEach(line => {
          const itemName = line.itemDescription || line.description || line.itemNumber || 'Unknown';
          itemTotals[itemName] = (itemTotals[itemName] || 0) + (parseFloat(line.orderedQuantity) || parseFloat(line.quantity) || 1);
        });

        // Aggregate payments
        (order.payments || []).forEach(payment => {
          const method = payment.paymentMode || payment.method || 'OTHER';
          payments[method] = (payments[method] || 0) + (parseFloat(payment.amountPay) || parseFloat(payment.amount) || 0);
        });
      });

      // Build tiles for each day
      const tiles = [];
      for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);
        const dateKey = targetDate.toISOString().split('T')[0];
        const dayOrders = ordersByDate[dateKey] || [];

        const totalSales = dayOrders.reduce((sum, o) => sum + (o.calculatedTotalNet || 0), 0);

        // Get day-specific top customers
        const dayCustomers = {};
        dayOrders.forEach(order => {
          const name = order.accountName || order.customerName || order.accountNumber || 'Unknown';
          dayCustomers[name] = (dayCustomers[name] || 0) + (order.calculatedTotalNet || 0);
        });

        // Get day-specific top items
        const dayItems = {};
        dayOrders.forEach(order => {
          (order.lines || []).forEach(line => {
            const name = line.itemDescription || line.description || line.itemNumber || 'Unknown';
            dayItems[name] = (dayItems[name] || 0) + (parseFloat(line.orderedQuantity) || parseFloat(line.quantity) || 1);
          });
        });

        tiles.push({
          date: targetDate,
          isToday: i === 0,
          totalSales,
          orderCount: dayOrders.length,
          customerCount: Object.keys(dayCustomers).length,
          topCustomers: Object.entries(dayCustomers)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3),
          topItems: Object.entries(dayItems)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 3),
        });
      }

      // Sort customers and items globally
      const sortedCustomers = Object.entries(customerTotals)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

      const sortedItems = Object.entries(itemTotals)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);

      return {
        tiles,
        aggregates: {
          customers: sortedCustomers,
          items: sortedItems,
          payments,
        },
      };
    } catch (error) {
      console.error('Error fetching sales data:', error);
      return { tiles: [], aggregates: { customers: [], items: [], payments: {} } };
    }
  }, [user]);

  // Load inventory data
  const loadInventoryData = useCallback(async () => {
    try {
      const onhandData = await getOnhand() || [];
      const sorted = [...onhandData].sort((a, b) => (b.primaryQuantity || 0) - (a.primaryQuantity || 0));
      setTopStock(sorted.slice(0, 20));

      const lowSorted = onhandData
        .filter(item => (item.primaryQuantity || 0) > 0 && (item.primaryQuantity || 0) < 50)
        .sort((a, b) => (a.primaryQuantity || 0) - (b.primaryQuantity || 0));
      setLowStock(lowSorted.slice(0, 20));
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  }, []);

  // Load store requests
  const loadStoreRequests = useCallback(async () => {
    try {
      const requests = await getRequisitions();
      setStoreRequests(requests.slice(0, 20));
    } catch (error) {
      console.error('Error loading store requests:', error);
    }
  }, []);

  // Initial load - check cache first
  const initialLoad = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && dataLoadedRef.current) {
      return; // Data already loaded, don't reload
    }

    setIsLoadingTiles(true);

    // Try to load from cache first
    if (!forceRefresh) {
      const cached = await loadCachedSalesData();
      if (cached && cached.tiles && cached.tiles.length > 0) {
        setSalesTiles(cached.tiles);
        if (cached.aggregates) {
          setAllCustomers(cached.aggregates.customers || []);
          setAllItems(cached.aggregates.items || []);
          setPaymentBreakdown(cached.aggregates.payments || {});
        }
        setIsLoadingTiles(false);
        dataLoadedRef.current = true;

        // Still load inventory and requests in background
        loadInventoryData();
        loadStoreRequests();
        return;
      }
    }

    // Fetch fresh data
    const [salesResult] = await Promise.all([
      fetchAllSalesData(),
      loadInventoryData(),
      loadStoreRequests(),
    ]);

    setSalesTiles(salesResult.tiles);
    setAllCustomers(salesResult.aggregates.customers);
    setAllItems(salesResult.aggregates.items);
    setPaymentBreakdown(salesResult.aggregates.payments);
    saveSalesDataToCache(salesResult.tiles, salesResult.aggregates);
    setIsLoadingTiles(false);
    dataLoadedRef.current = true;
  }, [fetchAllSalesData, loadInventoryData, loadStoreRequests]);

  // Get last week's sales for comparison
  const getLastWeekSales = (tileIndex) => {
    if (tileIndex >= 7 && salesTiles[tileIndex - 7]) {
      return salesTiles[tileIndex - 7].totalSales;
    }
    return null;
  };

  useFocusEffect(
    useCallback(() => {
      initialLoad(false); // Don't force refresh on focus
    }, [initialLoad])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert('Exit App', 'Are you sure you want to exit?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);

    // Only fetch today's data, keep cached data for previous days
    const todayData = await fetchTodayOnly();

    if (todayData && salesTiles.length > 0) {
      // Update only today's tile (last one in array)
      const updatedTiles = [...salesTiles];
      const todayIndex = updatedTiles.findIndex(t => t.isToday);
      if (todayIndex >= 0) {
        updatedTiles[todayIndex] = todayData;
      } else {
        // Today tile should be the last one
        updatedTiles[updatedTiles.length - 1] = todayData;
      }
      setSalesTiles(updatedTiles);

      // Get current aggregates and update with new today data
      const cached = await loadCachedSalesData();
      const aggregates = cached?.aggregates || { customers: allCustomers, items: allItems, payments: paymentBreakdown };
      saveSalesDataToCache(updatedTiles, aggregates);
    }

    // Also refresh inventory and requests
    await Promise.all([loadInventoryData(), loadStoreRequests()]);

    setRefreshing(false);
  };

  // Handle source store selection for new request
  const handleSourceStoreSelect = (store) => {
    setShowStoreModal(false);
    navigation.navigate('MainTabs', {
      screen: 'Inventory',
      params: {
        sourceStore: store,
        requestMode: true,
      },
    });
  };

  const renderTile = ({ item, index }) => (
    <SalesTile data={item} index={index} lastWeekSales={getLastWeekSales(index)} />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      <Modal visible={isSyncing} transparent animationType="fade">
        <View style={styles.syncOverlay}>
          <View style={styles.syncModal}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.syncTitle}>Syncing Data</Text>
            <Text style={styles.syncProgress}>{syncProgress}</Text>
          </View>
        </View>
      </Modal>

      <SourceStoreModal
        visible={showStoreModal}
        onSelect={handleSourceStoreSelect}
        onClose={() => setShowStoreModal(false)}
      />

      <LinearGradient colors={['#1A1A2E', '#16213E']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.username || 'User'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Story')}>
              <Ionicons name="play-circle-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2196F3" />}
      >
        <QuickActions navigation={navigation} />

        {/* Sales Tiles */}
        <View style={styles.salesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📈 Sales Overview (Last 12 Days)</Text>
          </View>

          {isLoadingTiles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading sales...</Text>
            </View>
          ) : (
            <FlatList
              data={salesTiles}
              renderItem={renderTile}
              keyExtractor={(item, index) => `tile-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tilesContainer}
              snapToInterval={TILE_WIDTH + TILE_MARGIN * 2}
              decelerationRate="fast"
            />
          )}
        </View>

        {/* Summary Card */}
        {salesTiles.length > 0 && (
          <SummaryCard
            salesData={salesTiles}
            allCustomers={allCustomers}
            allItems={allItems}
            paymentBreakdown={paymentBreakdown}
          />
        )}

        {/* Top Stock */}
        <View style={styles.inventorySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📦 Top 20 Stock</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}>
              <Text style={styles.seeAllLink}>See All →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.inventoryList}>
              {topStock.slice(0, 10).map((item, index) => (
                <InventoryCard key={index} item={item} rank={index + 1} type="top" />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Low Stock */}
        {lowStock.length > 0 && (
          <View style={styles.inventorySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⚠️ Low Stock Alert</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.inventoryList}>
                {lowStock.slice(0, 10).map((item, index) => (
                  <InventoryCard key={index} item={item} rank={index + 1} type="low" />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Store Requests */}
        <View style={styles.requestsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔄 Store Requests</Text>
            <TouchableOpacity onPress={() => navigation.navigate('StoreRequests')}>
              <Text style={styles.seeAllLink}>See All →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.requestsList}>
              {/* New Request Button */}
              <TouchableOpacity
                style={styles.newRequestCard}
                onPress={() => setShowStoreModal(true)}
              >
                <View style={styles.newRequestIcon}>
                  <Ionicons name="add-circle" size={40} color="#2196F3" />
                </View>
                <Text style={styles.newRequestText}>New Request</Text>
                <Text style={styles.newRequestSubtext}>Select source store</Text>
              </TouchableOpacity>

              {storeRequests.slice(0, 10).map((request, index) => (
                <RequestCard key={index} request={request} />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: {},
  welcomeText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textTransform: 'capitalize' },
  headerRight: { flexDirection: 'row', gap: 6 },
  headerButton: { padding: 6, position: 'relative' },
  notificationBadge: { position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF5252' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  // Quick Actions
  quickActionsContainer: { backgroundColor: '#FFFFFF', paddingVertical: 12, marginBottom: 12 },
  quickActionsContent: { paddingHorizontal: 12 },
  quickActionItem: { alignItems: 'center', marginRight: 16, width: 60 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickActionLabel: { fontSize: 10, color: '#1A1A1A', fontWeight: '500', textAlign: 'center' },
  // Section Headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  seeAllLink: { fontSize: 12, color: '#666666', fontWeight: '500' },
  // Sales Section
  salesSection: { marginBottom: 16 },
  tilesContainer: { paddingHorizontal: 8 },
  salesTile: { width: TILE_WIDTH, marginHorizontal: TILE_MARGIN, borderRadius: 16, padding: 14, minHeight: 240, position: 'relative', overflow: 'hidden' },
  todayTile: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  specialBadge: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.3)', paddingVertical: 4, alignItems: 'center' },
  specialBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  todayBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  todayBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  designEmoji: { position: 'absolute', top: 10, left: 10, fontSize: 20, opacity: 0.8 },
  tileHeader: { marginTop: 28, marginBottom: 8 },
  tileDay: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  tileDate: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  tileSalesContainer: { marginBottom: 10 },
  tileSalesAmount: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  comparisonContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  comparisonText: { fontSize: 10, fontWeight: '600' },
  tileStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 10, marginBottom: 10 },
  tileStatItem: { flex: 1, alignItems: 'center' },
  tileStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  tileStatValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  tileStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  tileSection: { marginTop: 4 },
  tileSectionTitle: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  tileListText: { fontSize: 10, color: '#FFFFFF', marginBottom: 2 },
  loadingContainer: { height: 200, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 12, color: '#666666' },
  // Summary Card
  summaryCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  graphContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80, marginBottom: 16, paddingHorizontal: 4 },
  graphBar: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  graphBarFill: { width: '100%', backgroundColor: '#2196F3', borderRadius: 4 },
  graphBarLabel: { fontSize: 9, color: '#999999', marginTop: 4 },
  summaryStats: { flexDirection: 'row', marginBottom: 16 },
  summaryStatItem: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#F8F8F8', borderRadius: 10, marginHorizontal: 4 },
  summaryStatValue: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  summaryStatLabel: { fontSize: 11, color: '#666666', marginTop: 2 },
  summarySection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 16 },
  summarySectionTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 10 },
  summaryListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  summaryRank: { width: 24, fontSize: 12, fontWeight: '600', color: '#999999' },
  summaryName: { flex: 1, fontSize: 13, color: '#1A1A1A' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#2196F3' },
  // Inventory
  inventorySection: { marginBottom: 16 },
  inventoryList: { flexDirection: 'row', paddingHorizontal: 12, gap: 10 },
  inventoryCard: { width: 140, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  lowStockCard: { borderWidth: 1, borderColor: '#FFCDD2', backgroundColor: '#FFF5F5' },
  inventoryRank: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  topRank: { backgroundColor: '#E3F2FD' },
  lowRank: { backgroundColor: '#FFCDD2' },
  inventoryRankText: { fontSize: 11, fontWeight: '700', color: '#1A1A1A' },
  inventoryInfo: { marginBottom: 8 },
  inventoryName: { fontSize: 11, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  inventoryCode: { fontSize: 9, color: '#666666' },
  inventoryQty: { alignItems: 'flex-end' },
  inventoryQtyText: { fontSize: 16, fontWeight: '800', color: '#2196F3' },
  lowQtyText: { color: '#F44336' },
  // Requests
  requestsSection: { marginBottom: 16 },
  requestsList: { flexDirection: 'row', paddingHorizontal: 12, gap: 10 },
  requestCard: { width: 160, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestSeq: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  requestStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  requestStatusText: { fontSize: 8, fontWeight: '700' },
  requestStore: { fontSize: 10, color: '#666666', marginBottom: 6 },
  requestDate: { fontSize: 9, color: '#999999' },
  // Sync Modal
  syncOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  syncModal: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 32, alignItems: 'center', width: '80%', maxWidth: 300 },
  syncTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginTop: 16 },
  syncProgress: { fontSize: 12, color: '#2196F3', marginTop: 8 },
  // New Request Card
  newRequestCard: { width: 160, backgroundColor: '#E3F2FD', borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2196F3', borderStyle: 'dashed' },
  newRequestIcon: { marginBottom: 8 },
  newRequestText: { fontSize: 14, fontWeight: '700', color: '#2196F3', marginBottom: 2 },
  newRequestSubtext: { fontSize: 10, color: '#666666' },
  // Source Store Modal
  storeModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  storeModalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  storeModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  storeModalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  storeModalClose: { padding: 4 },
  storeModalSubtitle: { fontSize: 13, color: '#666666', paddingHorizontal: 20, marginTop: 8 },
  storeOptions: { padding: 20 },
  storeOption: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8F8F8', borderRadius: 12, marginBottom: 12 },
  storeIconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  storeInfo: { flex: 1 },
  storeName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  storeSubtitle: { fontSize: 12, color: '#666666', marginBottom: 2 },
  storeParams: { fontSize: 10, color: '#999999' },
});

export default HomeScreen;
