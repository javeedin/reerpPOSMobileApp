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
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { calculateTripStats, calculateSingleTripStats, clearTripCache } from '../services/tripService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

// Dark green theme colors
const THEME = {
  primary: '#1B5E20',
  primaryLight: '#2E7D32',
  primaryDark: '#0D3311',
  accent: '#4CAF50',
  accentLight: '#81C784',
  accentDark: '#388E3C',
  background: '#E8F5E9',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

// Quick Services for Trip Management
const QUICK_SERVICES = [
  { id: 'verify', icon: 'checkmark-circle-outline', label: 'Verify\nOrders', color: THEME.accent },
  { id: 'deliver', icon: 'cube-outline', label: 'Deliver\nOrders', color: THEME.info },
  { id: 'capacity', icon: 'speedometer-outline', label: 'Lorry\nCapacity', color: THEME.warning },
  { id: 'reports', icon: 'bar-chart-outline', label: 'Trip\nReports', color: '#9C27B0' },
  { id: 'refresh', icon: 'refresh-outline', label: 'Refresh\nData', color: THEME.primaryLight },
];

// Header Component
const TripHeader = ({ user, navigation, onRefresh, dateRange }) => {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[THEME.primaryDark, THEME.primary, THEME.primaryLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 10 }]}
    >
      <View style={styles.headerTop}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerGreeting}>Trip Management</Text>
            <Text style={styles.headerTagline}>
              {dateRange?.fromDate || 'Today'} - {dateRange?.toDate || 'Today'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon} onPress={onRefresh}>
            <Ionicons name="refresh" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('TripQuery')}
          >
            <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

// Summary Card Carousel
const SummaryCarousel = ({ stats, navigation }) => {
  const scrollX = useRef(new Animated.Value(0)).current;

  const cards = [
    {
      id: 'trips',
      title: 'Total Trips',
      subtitle: 'Active Deliveries',
      amount: stats.totalTrips,
      icon: 'truck-delivery',
      iconType: 'material',
      gradient: [THEME.primaryDark, THEME.primary],
      status: 'Active',
      extra: `${stats.lorries?.length || 0} Lorries`,
      isCount: true,
    },
    {
      id: 'orders',
      title: 'Total Orders',
      subtitle: 'In All Trips',
      amount: stats.totalOrders,
      icon: 'cube',
      iconType: 'ionicon',
      gradient: ['#004D40', '#00796B'],
      status: 'Processing',
      extra: `${stats.deliveredOrders} Delivered`,
      isCount: true,
    },
    {
      id: 'verified',
      title: 'Verified Orders',
      subtitle: 'Ready for Delivery',
      amount: stats.verifiedOrders,
      icon: 'checkmark-circle',
      iconType: 'ionicon',
      gradient: ['#1565C0', '#1976D2'],
      status: 'Verified',
      extra: `${stats.pendingOrders} Pending`,
      isCount: true,
    },
  ];

  const renderCard = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.summaryCard}
      onPress={() => {}}
    >
      <LinearGradient
        colors={item.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.summaryCardGradient}
      >
        <View style={styles.summaryCardHeader}>
          <Text style={styles.summaryCardTitle}>{item.title}</Text>
          <View style={styles.summaryCardStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.summaryCardSubtitle}>{item.subtitle}</Text>

        <View style={styles.summaryCardAmount}>
          <Text style={styles.amountText}>{item.amount}</Text>
        </View>

        <View style={styles.summaryCardFooter}>
          <View style={styles.summaryCardExtra}>
            {item.iconType === 'material' ? (
              <MaterialCommunityIcons name={item.icon} size={16} color="rgba(255,255,255,0.8)" />
            ) : (
              <Ionicons name={item.icon} size={16} color="rgba(255,255,255,0.8)" />
            )}
            <Text style={styles.extraText}>{item.extra}</Text>
          </View>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
      />
      <View style={styles.pagination}>
        {cards.map((_, index) => {
          const inputRange = [(index - 1) * (CARD_WIDTH + 16), index * (CARD_WIDTH + 16), (index + 1) * (CARD_WIDTH + 16)];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 20, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={index}
              style={[styles.paginationDot, { width: dotWidth, opacity }]}
            />
          );
        })}
      </View>
    </View>
  );
};

// Quick Services Section
const QuickServicesSection = ({ navigation, onRefresh }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitleGreen}>Quick <Text style={styles.sectionTitleBlack}>Actions</Text></Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickServicesScroll}>
      {QUICK_SERVICES.map((service) => (
        <TouchableOpacity
          key={service.id}
          style={styles.quickServiceItem}
          onPress={() => {
            if (service.id === 'refresh') {
              onRefresh();
            }
          }}
        >
          <View style={[styles.quickServiceIcon, { backgroundColor: service.color + '20' }]}>
            <Ionicons name={service.icon} size={28} color={service.color} />
          </View>
          <Text style={styles.quickServiceLabel}>{service.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

// Capacity Bar Component
const CapacityBar = ({ percentage, size = 'normal' }) => {
  const getColor = () => {
    if (percentage >= 90) return THEME.error;
    if (percentage >= 70) return THEME.warning;
    return THEME.success;
  };

  return (
    <View style={[styles.capacityBarContainer, size === 'small' && styles.capacityBarSmall]}>
      <View style={styles.capacityBarBackground}>
        <View
          style={[
            styles.capacityBarFill,
            { width: `${Math.min(percentage, 100)}%`, backgroundColor: getColor() },
          ]}
        />
      </View>
      <Text style={[styles.capacityText, size === 'small' && styles.capacityTextSmall]}>
        {percentage.toFixed(0)}%
      </Text>
    </View>
  );
};

// Trip Card Component
const TripCard = ({ trip, onPress }) => {
  const stats = calculateSingleTripStats(trip);

  return (
    <TouchableOpacity style={styles.tripCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.tripCardHeader}>
        <View style={styles.tripIdContainer}>
          <MaterialCommunityIcons name="truck-delivery" size={24} color={THEME.primary} />
          <View style={styles.tripIdInfo}>
            <Text style={styles.tripIdLabel}>Trip #{trip.tripId}</Text>
            <Text style={styles.tripDate}>{trip.tripDate} • {trip.tripDay?.trim()}</Text>
          </View>
        </View>
        <View style={[styles.tripBadge, { backgroundColor: THEME.primary + '20' }]}>
          <Text style={[styles.tripBadgeText, { color: THEME.primary }]}>{trip.tripLorry}</Text>
        </View>
      </View>

      <View style={styles.tripCardDivider} />

      <View style={styles.tripCardStats}>
        <View style={styles.tripStat}>
          <Text style={styles.tripStatValue}>{stats.totalOrders}</Text>
          <Text style={styles.tripStatLabel}>Orders</Text>
        </View>
        <View style={styles.tripStatDivider} />
        <View style={styles.tripStat}>
          <Text style={[styles.tripStatValue, { color: THEME.success }]}>{stats.verifiedOrders}</Text>
          <Text style={styles.tripStatLabel}>Verified</Text>
        </View>
        <View style={styles.tripStatDivider} />
        <View style={styles.tripStat}>
          <Text style={[styles.tripStatValue, { color: THEME.info }]}>{stats.deliveredOrders}</Text>
          <Text style={styles.tripStatLabel}>Delivered</Text>
        </View>
        <View style={styles.tripStatDivider} />
        <View style={styles.tripStat}>
          <Text style={[styles.tripStatValue, { color: THEME.warning }]}>{stats.pendingOrders}</Text>
          <Text style={styles.tripStatLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.tripCardFooter}>
        <View style={styles.tripFooterLeft}>
          <Ionicons name="location-outline" size={14} color={THEME.textLight} />
          <Text style={styles.tripFooterText}>Bay: {trip.tripLoadingBay || 'N/A'}</Text>
        </View>
        <View style={styles.tripFooterRight}>
          <Text style={styles.tripFooterLabel}>Capacity:</Text>
          <CapacityBar percentage={stats.capacityUsed} size="small" />
        </View>
      </View>

      <View style={styles.tripCardAmount}>
        <Text style={styles.tripAmountLabel}>Total Amount</Text>
        <Text style={styles.tripAmountValue}>
          ₹{stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Trips List Section
const TripsListSection = ({ trips, navigation }) => (
  <View style={styles.tripsListContainer}>
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitleGreen}>Active <Text style={styles.sectionTitleBlack}>Trips</Text></Text>
      <Text style={styles.tripCount}>{trips.length} trips</Text>
    </View>

    {trips.map((trip) => (
      <TripCard
        key={trip.tripId}
        trip={trip}
        onPress={() => navigation.navigate('TripDetails', { trip })}
      />
    ))}
  </View>
);

// Main Trip Home Screen
const TripHomeScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalOrders: 0,
    verifiedOrders: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    lorries: [],
  });

  useEffect(() => {
    if (route.params?.tripData) {
      setTripData(route.params.tripData);
      const calculatedStats = calculateTripStats(route.params.tripData.trips);
      setStats(calculatedStats);
      setLoading(false);
    }
  }, [route.params?.tripData]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Navigate back to query screen to refresh data
    await clearTripCache();
    navigation.replace('TripQuery');
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Loading trip data...</Text>
      </View>
    );
  }

  const trips = tripData?.trips || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />

      <TripHeader
        user={user}
        navigation={navigation}
        onRefresh={onRefresh}
        dateRange={{
          fromDate: tripData?.fromDate,
          toDate: tripData?.toDate,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.primary}
            colors={[THEME.primary]}
          />
        }
      >
        {/* Summary Cards Carousel */}
        <SummaryCarousel stats={stats} navigation={navigation} />

        {/* Quick Services */}
        <QuickServicesSection navigation={navigation} onRefresh={onRefresh} />

        {/* Trips List */}
        <TripsListSection trips={trips} navigation={navigation} />

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Header
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {},
  headerGreeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTagline: {
    fontSize: 12,
    color: THEME.accentLight,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Carousel
  carouselContainer: {
    marginTop: 8,
  },
  carouselContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryCard: {
    width: CARD_WIDTH,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  summaryCardGradient: {
    padding: 16,
    minHeight: 150,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryCardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  summaryCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  summaryCardAmount: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  summaryCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCardExtra: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  extraText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 6,
  },
  viewAllButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.primary,
    marginHorizontal: 3,
  },

  // Section Styles
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitleGreen: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 16,
  },
  sectionTitleBlack: {
    color: THEME.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripCount: {
    fontSize: 14,
    color: THEME.textLight,
  },

  // Quick Services
  quickServicesScroll: {
    paddingRight: 20,
  },
  quickServiceItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 70,
  },
  quickServiceIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickServiceLabel: {
    fontSize: 11,
    color: THEME.text,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Capacity Bar
  capacityBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  capacityBarSmall: {
    maxWidth: 80,
  },
  capacityBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  capacityBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text,
    minWidth: 35,
  },
  capacityTextSmall: {
    fontSize: 10,
    minWidth: 30,
  },

  // Trip Card
  tripsListContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  tripCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: THEME.primary,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripIdInfo: {
    marginLeft: 12,
  },
  tripIdLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  tripDate: {
    fontSize: 12,
    color: THEME.textLight,
    marginTop: 2,
  },
  tripBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tripBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripCardDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 14,
  },
  tripCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tripStat: {
    alignItems: 'center',
    flex: 1,
  },
  tripStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
  },
  tripStatLabel: {
    fontSize: 11,
    color: THEME.textLight,
    marginTop: 4,
  },
  tripStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tripFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripFooterText: {
    fontSize: 12,
    color: THEME.textLight,
    marginLeft: 6,
  },
  tripFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 20,
  },
  tripFooterLabel: {
    fontSize: 11,
    color: THEME.textLight,
    marginRight: 8,
  },
  tripCardAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tripAmountLabel: {
    fontSize: 12,
    color: THEME.textLight,
  },
  tripAmountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
});

export default TripHomeScreen;
