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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { queryHistoricalOrders, getOnhand } from '../services/syncService';
import { getRequisitions } from '../services/stockRequisitionService';

const { width } = Dimensions.get('window');
const TILE_WIDTH = width * 0.88;
const TILE_MARGIN = 8;

// 10 Unique Card Designs
const CARD_DESIGNS = [
  // Design 1: Gradient Wave
  {
    id: 'wave',
    gradient: ['#667eea', '#764ba2'],
    pattern: 'wave',
    emoji: '📊',
  },
  // Design 2: Sunset Glow
  {
    id: 'sunset',
    gradient: ['#fa709a', '#fee140'],
    pattern: 'diagonal',
    emoji: '🌅',
  },
  // Design 3: Ocean Deep
  {
    id: 'ocean',
    gradient: ['#4facfe', '#00f2fe'],
    pattern: 'circles',
    emoji: '🌊',
  },
  // Design 4: Forest Green
  {
    id: 'forest',
    gradient: ['#43e97b', '#38f9d7'],
    pattern: 'leaves',
    emoji: '🌿',
  },
  // Design 5: Royal Purple
  {
    id: 'royal',
    gradient: ['#9D50BB', '#6E48AA'],
    pattern: 'stars',
    emoji: '👑',
  },
  // Design 6: Fire Energy
  {
    id: 'fire',
    gradient: ['#FF512F', '#F09819'],
    pattern: 'flames',
    emoji: '🔥',
  },
  // Design 7: Midnight Blue
  {
    id: 'midnight',
    gradient: ['#2C3E50', '#4CA1AF'],
    pattern: 'moon',
    emoji: '🌙',
  },
  // Design 8: Cotton Candy
  {
    id: 'candy',
    gradient: ['#f5576c', '#f093fb'],
    pattern: 'bubbles',
    emoji: '🍬',
  },
  // Design 9: Aurora
  {
    id: 'aurora',
    gradient: ['#00C9FF', '#92FE9D'],
    pattern: 'aurora',
    emoji: '✨',
  },
  // Design 10: Golden Hour
  {
    id: 'golden',
    gradient: ['#F7971E', '#FFD200'],
    pattern: 'sun',
    emoji: '☀️',
  },
];

// Special Day Themes
const SPECIAL_THEMES = {
  // Black Friday
  blackFriday: {
    gradient: ['#000000', '#434343'],
    title: '🛍️ BLACK FRIDAY SALE!',
    message: 'Amazing sales today!',
    confetti: true,
  },
  // Sunday - Rest Day
  sunday: {
    gradient: ['#11998e', '#38ef7d'],
    title: '☀️ SUNDAY VIBES',
    message: 'Relax and prosper!',
    peaceful: true,
  },
  // Christmas
  christmas: {
    gradient: ['#165B33', '#BB2528'],
    title: '🎄 MERRY CHRISTMAS!',
    message: 'Holiday magic!',
    festive: true,
  },
  // New Year
  newYear: {
    gradient: ['#FFD700', '#FFA500'],
    title: '🎉 HAPPY NEW YEAR!',
    message: 'New beginnings!',
    celebration: true,
  },
  // Weekend
  saturday: {
    gradient: ['#8E2DE2', '#4A00E0'],
    title: '🎊 WEEKEND MODE',
    message: 'Weekend warrior!',
  },
};

// Check for special days
const getSpecialTheme = (date) => {
  const month = date.getMonth();
  const day = date.getDate();
  const dayOfWeek = date.getDay();

  // Black Friday (4th Friday of November)
  if (month === 10) { // November
    const firstDay = new Date(date.getFullYear(), 10, 1).getDay();
    const firstFriday = firstDay <= 5 ? 6 - firstDay : 13 - firstDay;
    const blackFriday = firstFriday + 21;
    if (day === blackFriday) return 'blackFriday';
  }

  // Christmas
  if (month === 11 && day === 25) return 'christmas';

  // New Year
  if (month === 0 && day === 1) return 'newYear';

  // Sunday
  if (dayOfWeek === 0) return 'sunday';

  // Saturday
  if (dayOfWeek === 6) return 'saturday';

  return null;
};

// Get motivational message based on performance
const getMotivationalMessage = (data) => {
  if (!data.comparison) return null;

  const percentChange = data.previousSales > 0
    ? ((data.totalSales - data.previousSales) / data.previousSales * 100).toFixed(0)
    : 0;

  if (data.comparison > 0) {
    if (percentChange > 50) return '🚀 INCREDIBLE! You crushed it!';
    if (percentChange > 25) return '🔥 ON FIRE! Keep it up!';
    if (percentChange > 10) return '📈 Great progress!';
    return '👍 Nice improvement!';
  } else if (data.comparison < 0) {
    if (percentChange < -50) return '💪 Tomorrow is another day!';
    if (percentChange < -25) return '🎯 Focus and conquer!';
    return '⚡ Room to grow!';
  }
  return '⭐ Steady as she goes!';
};

// Quick Action Icons Component
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

// Sales Tile Component with unique designs
const SalesTile = ({ data, index }) => {
  const specialTheme = getSpecialTheme(data.date);
  const design = specialTheme
    ? { gradient: SPECIAL_THEMES[specialTheme].gradient, ...CARD_DESIGNS[index % CARD_DESIGNS.length] }
    : CARD_DESIGNS[index % CARD_DESIGNS.length];

  const isToday = data.isToday;
  const motivationalMsg = getMotivationalMessage(data);

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  const formatDate = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <LinearGradient
      colors={design.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.salesTile, isToday && styles.todayTile]}
    >
      {/* Special Theme Badge */}
      {specialTheme && SPECIAL_THEMES[specialTheme] && (
        <View style={styles.specialBadge}>
          <Text style={styles.specialBadgeText}>{SPECIAL_THEMES[specialTheme].title}</Text>
        </View>
      )}

      {/* Today Badge */}
      {isToday && !specialTheme && (
        <View style={styles.todayBadge}>
          <Text style={styles.todayBadgeText}>📍 TODAY</Text>
        </View>
      )}

      {/* Design Emoji */}
      <Text style={styles.designEmoji}>{design.emoji}</Text>

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
              size={18}
              color={data.comparison >= 0 ? '#4ADE80' : '#F87171'}
            />
            <Text style={[styles.comparisonText, { color: data.comparison >= 0 ? '#4ADE80' : '#F87171' }]}>
              {data.comparison >= 0 ? '+' : ''}{formatCurrency(data.comparison)}
            </Text>
          </View>
        )}

        {/* Motivational Message */}
        {motivationalMsg && (
          <Text style={styles.motivationalMsg}>{motivationalMsg}</Text>
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
          <Text style={styles.tileStatLabel}>Customers</Text>
        </View>
        <View style={styles.tileStatDivider} />
        <View style={styles.tileStatItem}>
          <Text style={styles.tileStatValue}>{data.itemCount || 0}</Text>
          <Text style={styles.tileStatLabel}>Items</Text>
        </View>
      </View>

      {/* Top Customers */}
      {data.topCustomers && data.topCustomers.length > 0 && (
        <View style={styles.tileSection}>
          <Text style={styles.tileSectionTitle}>🏆 Top Customers</Text>
          {data.topCustomers.slice(0, 2).map((customer, idx) => (
            <View key={idx} style={styles.tileListItem}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{idx + 1}</Text>
              </View>
              <Text style={styles.tileListName} numberOfLines={1}>{customer.name}</Text>
              <Text style={styles.tileListValue}>{formatCurrency(customer.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top Items */}
      {data.topItems && data.topItems.length > 0 && (
        <View style={styles.tileSection}>
          <Text style={styles.tileSectionTitle}>🔥 Hot Items</Text>
          {data.topItems.slice(0, 2).map((item, idx) => (
            <View key={idx} style={styles.tileListItem}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{idx + 1}</Text>
              </View>
              <Text style={styles.tileListName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.tileListValue}>x{item.qty}</Text>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );
};

// Inventory Card Component
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
        <Text style={styles.inventoryUom}>{item.primaryUOMCode || 'EA'}</Text>
      </View>
    </View>
  );
};

// Store Request Card Component
const RequestCard = ({ request }) => {
  const statusColors = {
    DRAFT: '#FF9800',
    CONFIRMED: '#4CAF50',
    SUBMITTED: '#2196F3',
    CANCELLED: '#F44336',
  };

  return (
    <TouchableOpacity style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestSeq}>{request.seqNo}</Text>
        <View style={[styles.requestStatus, { backgroundColor: statusColors[request.status] + '20' }]}>
          <Text style={[styles.requestStatusText, { color: statusColors[request.status] }]}>
            {request.status}
          </Text>
        </View>
      </View>
      <Text style={styles.requestStore}>{request.sourceSubinventory} → {request.destSubinventory}</Text>
      <View style={styles.requestFooter}>
        <Text style={styles.requestDate}>
          {new Date(request.requestDate).toLocaleDateString()}
        </Text>
        <Text style={styles.requestLines}>{request.lines?.length || 0} items</Text>
      </View>
    </TouchableOpacity>
  );
};

const HomeScreen = ({ navigation }) => {
  const { user, isSyncing, syncProgress } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [salesTiles, setSalesTiles] = useState([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateRange, setDateRange] = useState({ start: -3, end: 4 });
  const [topStock, setTopStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [storeRequests, setStoreRequests] = useState([]);
  const flatListRef = useRef(null);
  const initialScrollDone = useRef(false);

  // Generate sales data from order history
  const generateSalesDataForDate = useCallback(async (targetDate, previousDaySales = null) => {
    const dateStart = new Date(targetDate);
    dateStart.setHours(0, 0, 0, 0);

    try {
      // Query orders from server
      const result = await queryHistoricalOrders({
        fromDate: dateStart,
        toDate: dateStart,
        salesrepNumber: user?.username || '',
      });

      const orders = result.success ? (result.orders || []) : [];

      // Calculate totals
      const totalSales = orders.reduce((sum, order) => {
        return sum + (order.calculatedTotalNet || 0);
      }, 0);

      // Get customer aggregation
      const customerTotals = {};
      orders.forEach(order => {
        const customerName = order.customerName || order.accountNumber || 'Unknown';
        customerTotals[customerName] = (customerTotals[customerName] || 0) + (order.calculatedTotalNet || 0);
      });

      const topCustomers = Object.entries(customerTotals)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      // Get item aggregation
      const itemTotals = {};
      orders.forEach(order => {
        (order.lines || []).forEach(line => {
          const itemName = line.description || line.itemNumber || 'Unknown';
          itemTotals[itemName] = (itemTotals[itemName] || 0) + (parseFloat(line.quantity) || 1);
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
        previousSales: previousDaySales,
        orderCount: orders.length,
        customerCount: Object.keys(customerTotals).length,
        itemCount: Object.keys(itemTotals).length,
        topCustomers,
        topItems,
        comparison: previousDaySales !== null ? totalSales - previousDaySales : null,
      };
    } catch (error) {
      console.error('Error fetching sales data:', error);
      return {
        date: dateStart,
        isToday: dateStart.getTime() === new Date().setHours(0, 0, 0, 0),
        totalSales: 0,
        orderCount: 0,
        customerCount: 0,
        itemCount: 0,
        topCustomers: [],
        topItems: [],
        comparison: null,
      };
    }
  }, [user]);

  // Load sales tiles
  const loadSalesTiles = useCallback(async (startOffset, endOffset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tiles = [];
    let previousDaySales = null;

    for (let i = startOffset; i <= endOffset; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      const tileData = await generateSalesDataForDate(targetDate, previousDaySales);
      tiles.push(tileData);
      previousDaySales = tileData.totalSales;
    }

    return tiles;
  }, [generateSalesDataForDate]);

  // Load inventory data
  const loadInventoryData = useCallback(async () => {
    try {
      const onhandData = await getOnhand() || [];

      // Sort by quantity for top stock
      const sorted = [...onhandData].sort((a, b) =>
        (b.primaryQuantity || 0) - (a.primaryQuantity || 0)
      );

      setTopStock(sorted.slice(0, 20));

      // Low stock (non-zero, sorted ascending)
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

  // Initial load
  const initialLoad = useCallback(async () => {
    setIsLoadingTiles(true);

    await Promise.all([
      loadSalesTiles(dateRange.start, dateRange.end).then(tiles => setSalesTiles(tiles)),
      loadInventoryData(),
      loadStoreRequests(),
    ]);

    setIsLoadingTiles(false);
  }, [loadSalesTiles, loadInventoryData, loadStoreRequests, dateRange]);

  // Load more tiles
  const loadMoreTiles = useCallback(async (direction) => {
    if (loadingMore) return;
    setLoadingMore(true);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (direction === 'left') {
        const newStart = dateRange.start - 3;
        const newTiles = [];

        for (let i = newStart; i < dateRange.start; i++) {
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + i);
          const tileData = await generateSalesDataForDate(targetDate, null);
          newTiles.push(tileData);
        }

        setSalesTiles(prev => [...newTiles, ...prev]);
        setDateRange(prev => ({ ...prev, start: newStart }));
      } else {
        const newEnd = dateRange.end + 3;
        const newTiles = [];

        for (let i = dateRange.end + 1; i <= newEnd; i++) {
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + i);
          const tileData = await generateSalesDataForDate(targetDate, null);
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

  // Handle scroll end
  const handleScrollEnd = useCallback((event) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;

    if (contentOffset.x < 50) {
      loadMoreTiles('left');
    }

    if (contentOffset.x + layoutMeasurement.width > contentSize.width - 50) {
      loadMoreTiles('right');
    }
  }, [loadMoreTiles]);

  // Scroll to today
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

  useFocusEffect(
    useCallback(() => {
      initialLoad();
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
    initialScrollDone.current = false;
    await initialLoad();
    setRefreshing(false);
  };

  const renderTile = ({ item, index }) => (
    <SalesTile data={item} index={index} />
  );

  const getItemLayout = (data, index) => ({
    length: TILE_WIDTH + TILE_MARGIN * 2,
    offset: (TILE_WIDTH + TILE_MARGIN * 2) * index,
    index,
  });

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
        <QuickActions navigation={navigation} />

        {/* Sales Tiles */}
        <View style={styles.salesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📈 Sales Overview</Text>
            <TouchableOpacity onPress={() => {
              const todayIndex = salesTiles.findIndex(t => t.isToday);
              if (todayIndex >= 0) {
                flatListRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.5 });
              }
            }}>
              <Text style={styles.todayLink}>Today →</Text>
            </TouchableOpacity>
          </View>

          {isLoadingTiles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading sales data...</Text>
            </View>
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
              onScrollToIndexFailed={() => {}}
            />
          )}
        </View>

        {/* Top 20 Stock */}
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

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <View style={styles.inventorySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⚠️ Low Stock Alert</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}>
                <Text style={styles.seeAllLink}>See All →</Text>
              </TouchableOpacity>
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
        {storeRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔄 Recent Store Requests</Text>
              <TouchableOpacity onPress={() => navigation.navigate('StoreRequests')}>
                <Text style={styles.seeAllLink}>See All →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.requestsList}>
                {storeRequests.slice(0, 10).map((request, index) => (
                  <RequestCard key={index} request={request} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
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
  // Section Headers
  sectionHeader: {
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
  seeAllLink: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  // Sales Section
  salesSection: {
    marginBottom: 24,
  },
  tilesContainer: {
    paddingHorizontal: 10,
  },
  salesTile: {
    width: TILE_WIDTH,
    marginHorizontal: TILE_MARGIN,
    borderRadius: 24,
    padding: 20,
    minHeight: 380,
    position: 'relative',
    overflow: 'hidden',
  },
  todayTile: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  specialBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  specialBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  todayBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  todayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  designEmoji: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontSize: 28,
    opacity: 0.8,
  },
  tileHeader: {
    marginTop: 40,
    marginBottom: 16,
  },
  tileDay: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tileDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
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
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  comparisonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  motivationalMsg: {
    fontSize: 13,
    color: '#FFFFFF',
    marginTop: 8,
    fontWeight: '600',
  },
  tileStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
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
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tileStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  tileSection: {
    marginTop: 8,
  },
  tileSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 10,
  },
  tileListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
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
    fontWeight: '700',
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  // Inventory Section
  inventorySection: {
    marginBottom: 24,
  },
  inventoryList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  inventoryCard: {
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lowStockCard: {
    borderWidth: 2,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFF5F5',
  },
  inventoryRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  topRank: {
    backgroundColor: '#E3F2FD',
  },
  lowRank: {
    backgroundColor: '#FFCDD2',
  },
  inventoryRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  inventoryInfo: {
    marginBottom: 10,
  },
  inventoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  inventoryCode: {
    fontSize: 11,
    color: '#666666',
  },
  inventoryQty: {
    alignItems: 'flex-end',
  },
  inventoryQtyText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2196F3',
  },
  lowQtyText: {
    color: '#F44336',
  },
  inventoryUom: {
    fontSize: 10,
    color: '#999999',
  },
  // Requests Section
  requestsSection: {
    marginBottom: 24,
  },
  requestsList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  requestCard: {
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requestSeq: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  requestStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  requestStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  requestStore: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  requestDate: {
    fontSize: 11,
    color: '#999999',
  },
  requestLines: {
    fontSize: 11,
    color: '#2196F3',
    fontWeight: '600',
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
