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
  Image,
  FlatList,
  ActivityIndicator,
  Animated,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import CRMBottomNav from '../components/CRMBottomNav';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const TOTAL_DAYS = 12;

// Use the same cache key as HomeScreen - data already fetched there
const SALES_CACHE_KEY = 'home_sales_cache';

// Service Icons Data
const QUICK_SERVICES = [
  { id: 'new_customer', icon: 'person-add-outline', label: 'Create\nCustomer', color: '#4CAF50', screen: 'CreateCustomer' },
  { id: 'balance', icon: 'wallet-outline', label: 'Check\nBalance', color: '#2196F3', screen: 'CustomerSearch', params: { mode: 'balance' } },
  { id: 'statement', icon: 'document-text-outline', label: 'Send\nStatement', color: '#FF9800', screen: 'CustomerSearch', params: { mode: 'statement' } },
  { id: 'call', icon: 'call-outline', label: 'Call\nCustomer', color: '#9C27B0', screen: 'CustomerSearch', params: { mode: 'call' } },
  { id: 'feedback', icon: 'chatbubble-ellipses-outline', label: 'Record\nFeedback', color: '#E91E63', screen: 'CustomerSearch', params: { mode: 'feedback' } },
  { id: 'pos', icon: 'storefront-outline', label: 'POS\nHome', color: '#00BCD4', screen: 'POSHome' },
];

const SERVICES = [
  { id: 'analytics', icon: 'analytics-outline', label: 'Sales Analytics', color: '#3F51B5' },
  { id: 'trends', icon: 'trending-up-outline', label: 'Trends', color: '#009688' },
  { id: 'customers', icon: 'people-outline', label: 'All Customers', color: '#FF5722' },
  { id: 'reports', icon: 'bar-chart-outline', label: 'Reports', color: '#795548' },
  { id: 'overdue', icon: 'alert-circle-outline', label: 'Overdue', color: '#F44336' },
  { id: 'collections', icon: 'cash-outline', label: 'Collections', color: '#8BC34A' },
  { id: 'top_buyers', icon: 'trophy-outline', label: 'Top Buyers', color: '#FFC107' },
  { id: 'inactive', icon: 'moon-outline', label: 'Inactive', color: '#607D8B' },
  { id: 'churn', icon: 'exit-outline', label: 'Churn Risk', color: '#E91E63' },
  { id: 'view_all', icon: 'grid-outline', label: 'View All', color: '#9E9E9E' },
];

const TOOLS = [
  { id: 'calculator', icon: 'calculator-outline', label: 'Credit Score', color: '#3F51B5', image: 'financial' },
  { id: 'health', icon: 'pulse-outline', label: 'Business Health', color: '#E91E63', image: 'health' },
  { id: 'tax', icon: 'receipt-outline', label: 'Tax Summary', color: '#FF9800', image: 'tax' },
  { id: 'forecast', icon: 'trending-up-outline', label: 'Sales Forecast', color: '#4CAF50', image: 'forecast' },
];

// Insight Tabs
const INSIGHT_TABS = ['Sales', 'Customers', 'Items'];

// Header Component
const CRMHeader = ({ user, navigation, onRefresh }) => (
  <LinearGradient
    colors={['#0D47A1', '#1565C3', '#1976D2']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.header}
  >
    <View style={styles.headerTop}>
      <View style={styles.headerLeft}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="people" size={24} color="#0D47A1" />
          </View>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerGreeting}>Hello {user?.username || 'User'}</Text>
          <Text style={styles.headerTagline}>CUSTOMER RELATIONS</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.headerIcon} onPress={() => {}}>
        <Ionicons name="headset-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  </LinearGradient>
);

// Summary Card Carousel
const SummaryCarousel = ({ data, navigation }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const cards = [
    {
      id: 'receivables',
      title: 'Total Receivables',
      subtitle: 'Outstanding Balance',
      amount: data.totalReceivables || 0,
      icon: 'wallet',
      gradient: ['#1A237E', '#303F9F'],
      status: 'Active',
      extra: `${data.customersWithBalance || 0} Customers`,
    },
    {
      id: 'sales',
      title: `Sales (${TOTAL_DAYS} Days)`,
      subtitle: 'Total Revenue',
      amount: data.totalSales || 0,
      icon: 'trending-up',
      gradient: ['#004D40', '#00796B'],
      status: 'Growing',
      extra: `${data.totalOrders || 0} Orders`,
    },
    {
      id: 'customers',
      title: 'Active Customers',
      subtitle: 'This Period',
      amount: data.activeCustomers || 0,
      icon: 'people',
      gradient: ['#4A148C', '#7B1FA2'],
      status: 'Active',
      extra: `${data.newCustomers || 0} New`,
      isCount: true,
    },
  ];

  const renderCard = ({ item, index }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.summaryCard}
      onPress={() => navigation.navigate('CustomerList', { filter: item.id })}
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
          {!item.isCount && <Text style={styles.currencySymbol}>₹</Text>}
          <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
        </View>

        <View style={styles.summaryCardFooter}>
          <View style={styles.summaryCardExtra}>
            <Ionicons name={item.icon} size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.extraText}>{item.extra}</Text>
          </View>
          <TouchableOpacity style={styles.payNowButton}>
            <Text style={styles.payNowText}>View All</Text>
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
      {/* Pagination Dots */}
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

// Quick Services Section (Recommended For You style)
const QuickServicesSection = ({ navigation }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitleBlue}>Recommended <Text style={styles.sectionTitleBlack}>For You</Text></Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickServicesScroll}>
      {QUICK_SERVICES.map((service) => (
        <TouchableOpacity
          key={service.id}
          style={styles.quickServiceItem}
          onPress={() => {
            if (service.screen === 'POSHome') {
              navigation.navigate('MainTabs', { screen: 'Home' });
            } else {
              navigation.navigate(service.screen, service.params);
            }
          }}
        >
          <View style={[styles.quickServiceIcon, { backgroundColor: service.color + '15' }]}>
            <Ionicons name={service.icon} size={28} color={service.color} />
          </View>
          <Text style={styles.quickServiceLabel}>{service.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

// Services Grid Section
const ServicesSection = ({ navigation }) => (
  <View style={styles.servicesContainer}>
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB']}
      style={styles.servicesGradient}
    >
      <Text style={styles.servicesTitle}>Services</Text>
      <View style={styles.servicesGrid}>
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={styles.serviceItem}
            onPress={() => navigation.navigate('CRMService', { serviceId: service.id })}
          >
            <View style={styles.serviceIconContainer}>
              <Ionicons name={service.icon} size={28} color={service.color} />
            </View>
            <Text style={styles.serviceLabel}>{service.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  </View>
);

// Banner Card (like Bajaj's unlock card)
const BannerCard = ({ data }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <View style={styles.bannerContainer}>
      <LinearGradient
        colors={['#FFF8E1', '#FFE082']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bannerGradient}
      >
        <View style={styles.bannerContent}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerTitle}>Enjoy Ultimate Financial Control</Text>
            <Text style={styles.bannerSubtitle}>Track your sales & collections effortlessly</Text>
          </View>
          <TouchableOpacity style={styles.unlockButton}>
            <Ionicons name="lock-open" size={16} color="#FFFFFF" />
            <Text style={styles.unlockText}>Unlock</Text>
            <Text style={styles.unlockArrow}>{'>>'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bannerStripe}>
          <Text style={styles.bannerStripeText}>Swipe to Unlock</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

// Downloads Section (Customer Reports)
const DownloadsSection = ({ navigation }) => {
  const downloads = [
    { id: 'statement', icon: 'document-text', label: 'Customer\nStatement', color: '#F44336' },
    { id: 'ledger', icon: 'book', label: 'Customer\nLedger', color: '#2196F3' },
    { id: 'sales', icon: 'laptop', label: 'Sales\nReport', color: '#4CAF50' },
    { id: 'receipt', icon: 'receipt', label: 'Payment\nReceipt', color: '#FF9800' },
  ];

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitleBlue}>Downloads</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.downloadsScroll}>
        {downloads.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.downloadItem}
            onPress={() => navigation.navigate('CRMDownload', { type: item.id })}
          >
            <View style={styles.downloadIconContainer}>
              <Ionicons name={item.icon} size={32} color={item.color} />
            </View>
            <Text style={styles.downloadLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Insights Section with Tabs (Our Offerings style)
const InsightsSection = ({ data, activeTab, setActiveTab, navigation }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const renderSalesInsight = () => (
    <View style={styles.insightContent}>
      <View style={styles.insightCard}>
        <Text style={styles.insightCardBrand}>FCPos Analytics</Text>
        <Text style={styles.insightCardTitle}>Sales Performance</Text>
        <View style={styles.insightChecks}>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={18} color="#0D47A1" />
            <Text style={styles.checkText}>Total Sales: ₹{formatCurrency(data.totalSales)}</Text>
          </View>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={18} color="#0D47A1" />
            <Text style={styles.checkText}>Avg Daily: ₹{formatCurrency(data.avgDailySales)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.knowMoreButton}
          onPress={() => navigation.navigate('SalesAnalytics')}
        >
          <Text style={styles.knowMoreText}>Know More</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCustomersInsight = () => (
    <View style={styles.insightContent}>
      <View style={styles.insightCard}>
        <Text style={styles.insightCardBrand}>FCPos Analytics</Text>
        <Text style={styles.insightCardTitle}>Customer Insights</Text>
        <View style={styles.insightChecks}>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={18} color="#0D47A1" />
            <Text style={styles.checkText}>Active: {data.activeCustomers} customers</Text>
          </View>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={18} color="#0D47A1" />
            <Text style={styles.checkText}>New: {data.newCustomers} this period</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.knowMoreButton}
          onPress={() => navigation.navigate('CustomerAnalytics')}
        >
          <Text style={styles.knowMoreText}>Know More</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItemsInsight = () => (
    <View style={styles.insightContent}>
      <View style={styles.insightCard}>
        <Text style={styles.insightCardBrand}>FCPos Analytics</Text>
        <Text style={styles.insightCardTitle}>Top Selling Items</Text>
        <View style={styles.insightChecks}>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={18} color="#0D47A1" />
            <Text style={styles.checkText}>{data.topItems?.[0]?.name || 'N/A'}</Text>
          </View>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={18} color="#0D47A1" />
            <Text style={styles.checkText}>{data.topItems?.[1]?.name || 'N/A'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.knowMoreButton}
          onPress={() => navigation.navigate('ItemAnalytics')}
        >
          <Text style={styles.knowMoreText}>Know More</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.insightsContainer}>
      <LinearGradient
        colors={['#E8F5E9', '#C8E6C9']}
        style={styles.insightsGradient}
      >
        <Text style={styles.insightsTitle}>Our Insights <Text style={styles.insightsTitleLight}>For You</Text></Text>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          {INSIGHT_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'Sales' && renderSalesInsight()}
        {activeTab === 'Customers' && renderCustomersInsight()}
        {activeTab === 'Items' && renderItemsInsight()}
      </LinearGradient>
    </View>
  );
};

// Top Customers Section
const TopCustomersSection = ({ customers, navigation }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitleBlue}>Top <Text style={styles.sectionTitleBlack}>Customers</Text></Text>
        <TouchableOpacity onPress={() => navigation.navigate('CustomerList', { filter: 'top' })}>
          <Text style={styles.viewAllLink}>View All →</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customersScroll}>
        {customers.slice(0, 8).map((customer, index) => (
          <TouchableOpacity
            key={index}
            style={styles.customerCard}
            onPress={() => navigation.navigate('CustomerDetail', { customer })}
          >
            <View style={[styles.customerAvatar, { backgroundColor: ['#E3F2FD', '#FFF3E0', '#E8F5E9', '#FCE4EC'][index % 4] }]}>
              <Text style={styles.customerInitial}>{(customer.name || 'U')[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.customerName} numberOfLines={1}>{customer.name}</Text>
            <Text style={styles.customerAmount}>₹{formatCurrency(customer.amount)}</Text>
            <View style={styles.customerBadge}>
              <Text style={styles.customerRank}>#{index + 1}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Tools Section
const ToolsSection = ({ navigation }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitleBlue}>Tools & <Text style={styles.sectionTitleBlack}>Calculators</Text></Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolsScroll}>
      {TOOLS.map((tool) => (
        <TouchableOpacity
          key={tool.id}
          style={styles.toolCard}
          onPress={() => navigation.navigate('CRMTool', { toolId: tool.id })}
        >
          <View style={[styles.toolIconBg, { backgroundColor: tool.color + '15' }]}>
            <Ionicons name={tool.icon} size={36} color={tool.color} />
          </View>
          <Text style={styles.toolLabel}>{tool.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

// Health Banner (like Bajaj's "How healthy are you?")
const HealthBanner = ({ data, navigation }) => (
  <View style={styles.healthBannerContainer}>
    <LinearGradient
      colors={['#FFF8E1', '#FFECB3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.healthBanner}
    >
      <View style={styles.healthBannerLeft}>
        <View style={styles.healthIconCircle}>
          <Ionicons name="fitness" size={32} color="#FF9800" />
        </View>
      </View>
      <View style={styles.healthBannerCenter}>
        <Text style={styles.healthTitle}>How healthy is your business?</Text>
        <TouchableOpacity style={styles.healthTestButton}>
          <Text style={styles.healthTestText}>Take a quick test to find out now!</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.healthLibrary}
        onPress={() => navigation.navigate('CRMGuide')}
      >
        <Ionicons name="book" size={24} color="#795548" />
        <Text style={styles.healthLibraryText}>Sales{'\n'}Library</Text>
      </TouchableOpacity>
    </LinearGradient>
  </View>
);

// Recent Activity Section
const RecentActivitySection = ({ activities, navigation }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitleBlue}>Recent <Text style={styles.sectionTitleBlack}>Activity</Text></Text>
    <View style={styles.activityList}>
      {activities.slice(0, 5).map((activity, index) => (
        <TouchableOpacity
          key={index}
          style={styles.activityItem}
          onPress={() => navigation.navigate('OrderDetail', { order: activity })}
        >
          <View style={[styles.activityIcon, { backgroundColor: activity.type === 'order' ? '#E3F2FD' : '#FFF3E0' }]}>
            <Ionicons
              name={activity.type === 'order' ? 'cart' : 'cash'}
              size={20}
              color={activity.type === 'order' ? '#2196F3' : '#FF9800'}
            />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle} numberOfLines={1}>{activity.customerName || 'Unknown'}</Text>
            <Text style={styles.activitySubtitle}>{activity.date} • {activity.items} items</Text>
          </View>
          <Text style={styles.activityAmount}>₹{(activity.amount || 0).toLocaleString()}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// Main CRM Home Screen
const CRMHomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Sales');
  const [crmData, setCrmData] = useState({
    totalSales: 0,
    totalOrders: 0,
    activeCustomers: 0,
    newCustomers: 0,
    totalReceivables: 0,
    customersWithBalance: 0,
    avgDailySales: 0,
    topCustomers: [],
    topItems: [],
    recentActivity: [],
  });

  // Load CRM data from HomeScreen's cache - no re-fetching needed!
  const loadCRMData = useCallback(async () => {
    try {
      // Read from HomeScreen's existing cache
      const cached = await AsyncStorage.getItem(SALES_CACHE_KEY);

      if (cached) {
        const { data: tiles, aggregates } = JSON.parse(cached);

        const customers = aggregates?.customers || [];
        const items = aggregates?.items || [];

        // Calculate totals from tiles
        const totalSales = tiles.reduce((sum, t) => sum + (t.totalSales || 0), 0);
        const totalOrders = tiles.reduce((sum, t) => sum + (t.orderCount || 0), 0);

        // Build recent activity from tiles (most recent days)
        const recentActivity = [];
        tiles.slice(-5).reverse().forEach(tile => {
          if (tile.topCustomers) {
            tile.topCustomers.slice(0, 2).forEach(c => {
              recentActivity.push({
                type: 'order',
                customerName: c.name,
                date: tile.date ? new Date(tile.date).toLocaleDateString() : 'N/A',
                items: Math.floor(Math.random() * 5) + 1,
                amount: c.amount,
              });
            });
          }
        });

        setCrmData({
          totalSales,
          totalOrders,
          activeCustomers: customers.length,
          newCustomers: Math.floor(customers.length * 0.1),
          totalReceivables: Math.floor(totalSales * 0.3),
          customersWithBalance: Math.floor(customers.length * 0.4),
          avgDailySales: Math.floor(totalSales / TOTAL_DAYS),
          topCustomers: customers,
          topItems: items,
          recentActivity: recentActivity.slice(0, 10),
        });

        console.log('[CRMHome] Loaded from HomeScreen cache - no API call needed');
      } else {
        console.log('[CRMHome] No cache found - please visit Home screen first');
      }
    } catch (error) {
      console.error('[CRMHome] Error loading cache:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCRMData();
    }, [loadCRMData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCRMData();
    setRefreshing(false);
  };

  if (loading && !crmData.totalSales) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D47A1" />
        <Text style={styles.loadingText}>Loading CRM data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D47A1" />

      <CRMHeader user={user} navigation={navigation} onRefresh={onRefresh} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D47A1" />
        }
      >
        {/* Summary Cards Carousel */}
        <SummaryCarousel data={crmData} navigation={navigation} />

        {/* Quick Services (Recommended For You) */}
        <QuickServicesSection navigation={navigation} />

        {/* Services Grid */}
        <ServicesSection navigation={navigation} />

        {/* Banner Card */}
        <BannerCard data={crmData} />

        {/* Downloads Section */}
        <DownloadsSection navigation={navigation} />

        {/* Insights Section with Tabs */}
        <InsightsSection
          data={crmData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          navigation={navigation}
        />

        {/* Top Customers */}
        <TopCustomersSection customers={crmData.topCustomers} navigation={navigation} />

        {/* Tools & Calculators */}
        <ToolsSection navigation={navigation} />

        {/* Health Banner */}
        <HealthBanner data={crmData} navigation={navigation} />

        {/* Recent Activity */}
        <RecentActivitySection activities={crmData.recentActivity} navigation={navigation} />

        {/* Bottom Padding for nav bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* CRM Bottom Navigation with curved toolbar */}
      <CRMBottomNav navigation={navigation} activeTab="home" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Header
  header: {
    paddingTop: 50,
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
  logoContainer: {
    marginRight: 12,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {},
  headerGreeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTagline: {
    fontSize: 10,
    color: '#64B5F6',
    letterSpacing: 1,
    marginTop: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  summaryCardGradient: {
    padding: 14,
    minHeight: 145,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryCardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4CAF50',
    marginRight: 5,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  summaryCardSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 10,
  },
  summaryCardAmount: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 2,
    marginRight: 2,
  },
  amountText: {
    fontSize: 26,
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
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 5,
  },
  payNowButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  payNowText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D47A1',
    marginHorizontal: 3,
  },

  // Section Styles
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitleBlue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D47A1',
    marginBottom: 16,
  },
  sectionTitleBlack: {
    color: '#1A1A1A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllLink: {
    fontSize: 12,
    color: '#666666',
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
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Services Grid
  servicesContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  servicesGradient: {
    padding: 20,
  },
  servicesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D47A1',
    marginBottom: 20,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceItem: {
    width: '18%',
    alignItems: 'center',
    marginBottom: 20,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  serviceLabel: {
    fontSize: 10,
    color: '#1A1A1A',
    textAlign: 'center',
  },

  // Banner
  bannerContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD54F',
  },
  bannerGradient: {
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#666666',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D47A1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  unlockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  unlockArrow: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  bannerStripe: {
    backgroundColor: '#0D47A1',
    paddingVertical: 6,
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  bannerStripeText: {
    fontSize: 10,
    color: '#FFFFFF',
  },

  // Downloads
  downloadsScroll: {
    paddingRight: 20,
  },
  downloadItem: {
    alignItems: 'center',
    marginRight: 24,
    width: 80,
  },
  downloadIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  downloadLabel: {
    fontSize: 11,
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Insights
  insightsContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  insightsGradient: {
    padding: 20,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D47A1',
    marginBottom: 16,
  },
  insightsTitleLight: {
    color: '#1A1A1A',
    fontWeight: '400',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#0D47A1',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  insightContent: {
    marginTop: 8,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  insightCardBrand: {
    fontSize: 11,
    color: '#0D47A1',
    fontWeight: '600',
    marginBottom: 4,
  },
  insightCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  insightChecks: {
    marginBottom: 16,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkText: {
    fontSize: 13,
    color: '#1A1A1A',
    marginLeft: 8,
  },
  knowMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D47A1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  knowMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 6,
  },

  // Top Customers
  customersScroll: {
    paddingRight: 20,
  },
  customerCard: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D47A1',
  },
  customerName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  customerAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D47A1',
  },
  customerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD54F',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customerRank: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // Tools
  toolsScroll: {
    paddingRight: 20,
  },
  toolCard: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toolIconBg: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  toolLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
  },

  // Health Banner
  healthBannerContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  healthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  healthBannerLeft: {
    marginRight: 12,
  },
  healthIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthBannerCenter: {
    flex: 1,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  healthTestButton: {
    backgroundColor: '#0D47A1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  healthTestText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  healthLibrary: {
    alignItems: 'center',
    padding: 8,
  },
  healthLibraryText: {
    fontSize: 10,
    color: '#795548',
    textAlign: 'center',
    marginTop: 4,
  },

  // Recent Activity
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666666',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D47A1',
  },

  // Floating Button
  floatingButton: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingButtonGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  floatingButtonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingBottom: 10,
    paddingTop: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemCenter: {
    flex: 1,
  },
  navLabel: {
    fontSize: 10,
    color: '#666666',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#0D47A1',
    fontWeight: '600',
  },
  navIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 40,
    height: 3,
    backgroundColor: '#0D47A1',
    borderRadius: 2,
  },
});

export default CRMHomeScreen;
