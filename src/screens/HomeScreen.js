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
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getOrders, ORDER_STATUS } from '../services/orderService';
import { getOnhand } from '../services/syncService';

const { width } = Dimensions.get('window');
const TILE_WIDTH = width * 0.85;
const TILE_MARGIN = 10;

// Tile colors for variety
const TILE_COLORS = [
  { primary: '#667eea', secondary: '#764ba2' },
  { primary: '#f093fb', secondary: '#f5576c' },
  { primary: '#4facfe', secondary: '#00f2fe' },
  { primary: '#43e97b', secondary: '#38f9d7' },
  { primary: '#fa709a', secondary: '#fee140' },
  { primary: '#a8edea', secondary: '#fed6e3' },
  { primary: '#ff9a9e', secondary: '#fecfef' },
];

// Quick Action Icons Component
const QuickActions = ({ navigation }) => {
  const actions = [
    { icon: 'cart-outline', label: 'New Order', onPress: () => navigation.navigate('CustomerSelection'), color: '#2196F3' },
    { icon: 'scan-outline', label: 'Scan', onPress: () => navigation.navigate('Scan'), color: '#9C27B0' },
    { icon: 'sync-outline', label: 'Sync', onPress: () => navigation.navigate('SyncData'), color: '#4CAF50' },
    { icon: 'cube-outline', label: 'Stock', onPress: () => navigation.navigate('MainTabs', { screen: 'Inventory' }), color: '#FF9800' },
    { icon: 'document-text-outline', label: 'Reports', onPress: () => navigation.navigate('LodgementReport'), color: '#E91E63' },
    { icon: 'card-outline', label: 'Credit', onPress: () => navigation.navigate('CreditCheck'), color: '#00BCD4' },
  ];

  return (
    <View style={styles.quickActionsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActionsContent}
      >
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickActionItem}
            onPress={action.onPress}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon} size={26} color={action.color} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Sales Tile Component
const SalesTile = ({ data, colorIndex }) => {
  const tileColors = TILE_COLORS[colorIndex % TILE_COLORS.length];
  const isToday = data.isToday;

  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  const formatDate = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  return (
    <LinearGradient
      colors={[tileColors.primary, tileColors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.salesTile, isToday && styles.todayTile]}
    >
      {isToday && (
        <View style={styles.todayBadge}>
          <Text style={styles.todayBadgeText}>TODAY</Text>
        </View>
      )}

      <View style={styles.tileHeader}>
        <Text style={styles.tileDay}>{getDayName(data.date)}</Text>
        <Text style={styles.tileDate}>{formatDate(data.date)}</Text>
      </View>

      <View style={styles.tileSalesContainer}>
        <Text style={styles.tileSalesLabel}>Total Sales</Text>
        <Text style={styles.tileSalesAmount}>MUR {formatCurrency(data.totalSales)}</Text>
        {data.comparison !== null && (
          <View style={styles.comparisonContainer}>
            <Ionicons
              name={data.comparison >= 0 ? 'trending-up' : 'trending-down'}
              size={16}
              color={data.comparison >= 0 ? '#4ADE80' : '#F87171'}
            />
            <Text style={[styles.comparisonText, { color: data.comparison >= 0 ? '#4ADE80' : '#F87171' }]}>
              {data.comparison >= 0 ? '+' : ''}{formatCurrency(data.comparison)} vs prev day
            </Text>
          </View>
        )}
      </View>

      <View style={styles.tileStats}>
        <View style={styles.tileStatItem}>
          <Ionicons name="receipt-outline" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={styles.tileStatValue}>{data.orderCount}</Text>
          <Text style={styles.tileStatLabel}>Orders</Text>
        </View>
        <View style={styles.tileStatDivider} />
        <View style={styles.tileStatItem}>
          <Ionicons name="people-outline" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={styles.tileStatValue}>{data.customerCount}</Text>
          <Text style={styles.tileStatLabel}>Customers</Text>
        </View>
      </View>

      {data.topCustomers && data.topCustomers.length > 0 && (
        <View style={styles.tileSection}>
          <Text style={styles.tileSectionTitle}>Top Customers</Text>
          {data.topCustomers.slice(0, 3).map((customer, idx) => (
            <View key={idx} style={styles.tileListItem}>
              <Text style={styles.tileListRank}>{idx + 1}.</Text>
              <Text style={styles.tileListName} numberOfLines={1}>{customer.name}</Text>
              <Text style={styles.tileListValue}>MUR {formatCurrency(customer.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {data.topItems && data.topItems.length > 0 && (
        <View style={styles.tileSection}>
          <Text style={styles.tileSectionTitle}>Top Items</Text>
          {data.topItems.slice(0, 4).map((item, idx) => (
            <View key={idx} style={styles.tileListItem}>
              <Text style={styles.tileListRank}>{idx + 1}.</Text>
              <Text style={styles.tileListName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.tileListValue}>x{item.qty}</Text>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );
};

// Empty Tile for loading state
const LoadingTile = () => (
  <View style={[styles.salesTile, styles.loadingTile]}>
    <ActivityIndicator size="large" color="#2196F3" />
    <Text style={styles.loadingText}>Loading sales data...</Text>
  </View>
);

const HomeScreen = ({ navigation }) => {
  const { user, isSyncing, syncProgress } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [salesTiles, setSalesTiles] = useState([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateRange, setDateRange] = useState({ start: -3, end: 4 }); // Days from today
  const flatListRef = useRef(null);
  const initialScrollDone = useRef(false);

  // Generate sales data for a specific date
  const generateSalesDataForDate = useCallback(async (targetDate, allOrders, previousDaySales = null) => {
    const dateStart = new Date(targetDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(targetDate);
    dateEnd.setHours(23, 59, 59, 999);

    // Filter orders for this date
    const dayOrders = allOrders.filter(order => {
      if (order.status !== ORDER_STATUS.CONFIRMED) return false;
      const orderDate = new Date(order.orderDate);
      return orderDate >= dateStart && orderDate <= dateEnd;
    });

    // Calculate total sales
    const totalSales = dayOrders.reduce((sum, order) => {
      return sum + (order.totals?.totalNet || 0);
    }, 0);

    // Get unique customers and their totals
    const customerTotals = {};
    dayOrders.forEach(order => {
      const customerName = order.customerInfo?.name || order.customerInfo?.customerNumber || 'Unknown';
      customerTotals[customerName] = (customerTotals[customerName] || 0) + (order.totals?.totalNet || 0);
    });

    const topCustomers = Object.entries(customerTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    // Get top items
    const itemTotals = {};
    dayOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const itemName = item.description || item.itemNumber || 'Unknown';
        itemTotals[itemName] = (itemTotals[itemName] || 0) + (item.quantity || 1);
      });
    });

    const topItems = Object.entries(itemTotals)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = dateStart.getTime() === today.getTime();

    return {
      date: dateStart,
      isToday,
      totalSales,
      orderCount: dayOrders.length,
      customerCount: Object.keys(customerTotals).length,
      topCustomers,
      topItems,
      comparison: previousDaySales !== null ? totalSales - previousDaySales : null,
    };
  }, []);

  // Load sales tiles for date range
  const loadSalesTiles = useCallback(async (startOffset, endOffset) => {
    try {
      const allOrders = await getOrders();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tiles = [];
      let previousDaySales = null;

      // Generate tiles from oldest to newest
      for (let i = startOffset; i <= endOffset; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);

        const tileData = await generateSalesDataForDate(targetDate, allOrders, previousDaySales);
        tiles.push(tileData);
        previousDaySales = tileData.totalSales;
      }

      return tiles;
    } catch (error) {
      console.error('Error loading sales tiles:', error);
      return [];
    }
  }, [generateSalesDataForDate]);

  // Initial load
  const initialLoad = useCallback(async () => {
    setIsLoadingTiles(true);
    const tiles = await loadSalesTiles(dateRange.start, dateRange.end);
    setSalesTiles(tiles);
    setIsLoadingTiles(false);
  }, [loadSalesTiles, dateRange]);

  // Load more tiles (left or right)
  const loadMoreTiles = useCallback(async (direction) => {
    if (loadingMore) return;
    setLoadingMore(true);

    try {
      const allOrders = await getOrders();

      if (direction === 'left') {
        // Load older dates
        const newStart = dateRange.start - 3;
        const newTiles = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = newStart; i < dateRange.start; i++) {
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + i);
          const tileData = await generateSalesDataForDate(targetDate, allOrders, null);
          newTiles.push(tileData);
        }

        setSalesTiles(prev => [...newTiles, ...prev]);
        setDateRange(prev => ({ ...prev, start: newStart }));
      } else {
        // Load newer dates
        const newEnd = dateRange.end + 3;
        const newTiles = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = dateRange.end + 1; i <= newEnd; i++) {
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + i);
          const tileData = await generateSalesDataForDate(targetDate, allOrders, null);
          newTiles.push(tileData);
        }

        setSalesTiles(prev => [...prev, ...newTiles]);
        setDateRange(prev => ({ ...prev, end: newEnd }));
      }
    } catch (error) {
      console.error('Error loading more tiles:', error);
    }

    setLoadingMore(false);
  }, [loadingMore, dateRange, generateSalesDataForDate]);

  // Handle scroll end to load more
  const handleScrollEnd = useCallback((event) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;

    // Near start - load older dates
    if (contentOffset.x < 50) {
      loadMoreTiles('left');
    }

    // Near end - load newer dates
    if (contentOffset.x + layoutMeasurement.width > contentSize.width - 50) {
      loadMoreTiles('right');
    }
  }, [loadMoreTiles]);

  // Scroll to today on initial load
  useEffect(() => {
    if (!isLoadingTiles && salesTiles.length > 0 && flatListRef.current && !initialScrollDone.current) {
      const todayIndex = salesTiles.findIndex(tile => tile.isToday);
      if (todayIndex >= 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: todayIndex,
            animated: false,
            viewPosition: 0.5
          });
          initialScrollDone.current = true;
        }, 100);
      }
    }
  }, [isLoadingTiles, salesTiles]);

  // Load data on mount and focus
  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  // Handle back button
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
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    initialScrollDone.current = false;
    await initialLoad();
    setRefreshing(false);
  };

  const renderTile = ({ item, index }) => (
    <SalesTile data={item} colorIndex={index} />
  );

  const getItemLayout = (data, index) => ({
    length: TILE_WIDTH + TILE_MARGIN * 2,
    offset: (TILE_WIDTH + TILE_MARGIN * 2) * index,
    index,
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* Sync Progress Modal */}
      <Modal visible={isSyncing} transparent animationType="fade">
        <View style={styles.syncOverlay}>
          <View style={styles.syncModal}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.syncTitle}>Syncing Data</Text>
            <Text style={styles.syncProgress}>{syncProgress}</Text>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <LinearGradient colors={['#1A1A2E', '#16213E']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.username || 'User'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Story')}>
              <Ionicons name="play-circle-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2196F3" />
        }
      >
        {/* Quick Actions */}
        <QuickActions navigation={navigation} />

        {/* Sales Tiles Section */}
        <View style={styles.salesSection}>
          <View style={styles.saleHeaderRow}>
            <Text style={styles.sectionTitle}>Sales Overview</Text>
            <TouchableOpacity onPress={() => flatListRef.current?.scrollToIndex({
              index: salesTiles.findIndex(t => t.isToday),
              animated: true,
              viewPosition: 0.5
            })}>
              <Text style={styles.todayLink}>Go to Today</Text>
            </TouchableOpacity>
          </View>

          {isLoadingTiles ? (
            <LoadingTile />
          ) : (
            <FlatList
              ref={flatListRef}
              data={salesTiles}
              renderItem={renderTile}
              keyExtractor={(item, index) => `tile-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tilesContainer}
              snapToInterval={TILE_WIDTH + TILE_MARGIN * 2}
              decelerationRate="fast"
              onMomentumScrollEnd={handleScrollEnd}
              getItemLayout={getItemLayout}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false
                  });
                }, 100);
              }}
              ListHeaderComponent={
                loadingMore ? (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color="#2196F3" />
                  </View>
                ) : null
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color="#2196F3" />
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {/* Summary Cards */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.summaryGrid}>
            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
            >
              <View style={[styles.summaryIconBg, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="cart-outline" size={24} color="#2196F3" />
              </View>
              <Text style={styles.summaryLabel}>Orders</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}
            >
              <View style={[styles.summaryIconBg, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="cube-outline" size={24} color="#FF9800" />
              </View>
              <Text style={styles.summaryLabel}>Inventory</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => navigation.navigate('HistoryOrders')}
            >
              <View style={[styles.summaryIconBg, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="time-outline" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.summaryLabel}>History</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => navigation.navigate('StoreRequests')}
            >
              <View style={[styles.summaryIconBg, { backgroundColor: '#FCE4EC' }]}>
                <Ionicons name="swap-horizontal-outline" size={24} color="#E91E63" />
              </View>
              <Text style={styles.summaryLabel}>Requests</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {},
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5252',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  // Quick Actions
  quickActionsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionsContent: {
    paddingHorizontal: 16,
  },
  quickActionItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 70,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Sales Section
  salesSection: {
    marginBottom: 20,
  },
  saleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  todayLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  tilesContainer: {
    paddingHorizontal: 10,
  },
  salesTile: {
    width: TILE_WIDTH,
    marginHorizontal: TILE_MARGIN,
    borderRadius: 20,
    padding: 20,
    minHeight: 320,
  },
  todayTile: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  todayBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileHeader: {
    marginBottom: 16,
  },
  tileDay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  tileSalesContainer: {
    marginBottom: 16,
  },
  tileSalesLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  tileSalesAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  comparisonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tileStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  tileStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  tileStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tileStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  tileStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  tileSection: {
    marginTop: 8,
  },
  tileSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  tileListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tileListRank: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    width: 20,
  },
  tileListName: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  tileListValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingTile: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  loadingMoreContainer: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Summary Section
  summarySection: {
    paddingHorizontal: 20,
  },
  summaryGrid: {
    marginTop: 12,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Sync Modal
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
  },
  syncTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 16,
  },
  syncProgress: {
    fontSize: 14,
    color: '#2196F3',
    marginTop: 8,
  },
});

export default HomeScreen;
