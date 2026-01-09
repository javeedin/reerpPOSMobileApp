import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { fetchPickerPerformance, getWMSDateRange } from '../services/wmsService';

const { width } = Dimensions.get('window');

// Tab Button Component
const TabButton = ({ title, isActive, onPress, icon }) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.tabButtonActive]}
    onPress={onPress}
  >
    <Ionicons
      name={icon}
      size={18}
      color={isActive ? '#1565C0' : '#666'}
    />
    <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
      {title}
    </Text>
  </TouchableOpacity>
);

// Stat Card Component
const StatCard = ({ icon, label, value, subValue, color = '#1565C0' }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subValue && <Text style={styles.statSubValue}>{subValue}</Text>}
  </View>
);

// Progress Bar Component
const ProgressBar = ({ value, max, color = '#4CAF50', label }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarHeader}>
        <Text style={styles.progressBarLabel}>{label}</Text>
        <Text style={styles.progressBarValue}>{value} / {max}</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

// Daily Performance Card
const DailyCard = ({ date, orders, totalMinutes, totalLines, avgTime }) => (
  <View style={styles.dailyCard}>
    <View style={styles.dailyHeader}>
      <Text style={styles.dailyDate}>{date}</Text>
      <View style={styles.dailyBadge}>
        <Text style={styles.dailyBadgeText}>{orders} orders</Text>
      </View>
    </View>
    <View style={styles.dailyStats}>
      <View style={styles.dailyStat}>
        <Ionicons name="time-outline" size={16} color="#1565C0" />
        <Text style={styles.dailyStatValue}>{totalMinutes} min</Text>
        <Text style={styles.dailyStatLabel}>Total Time</Text>
      </View>
      <View style={styles.dailyStat}>
        <Ionicons name="speedometer-outline" size={16} color="#4CAF50" />
        <Text style={styles.dailyStatValue}>{avgTime.toFixed(1)} min</Text>
        <Text style={styles.dailyStatLabel}>Avg/Order</Text>
      </View>
      <View style={styles.dailyStat}>
        <Ionicons name="list-outline" size={16} color="#FF9800" />
        <Text style={styles.dailyStatValue}>{totalLines}</Text>
        <Text style={styles.dailyStatLabel}>Lines</Text>
      </View>
    </View>
  </View>
);

// Order Card Component
const OrderCard = ({ order }) => {
  const getEfficiencyColor = (minutes) => {
    if (minutes <= 2) return '#4CAF50';
    if (minutes <= 5) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>{order.source_order}</Text>
        <View style={[styles.timeBadge, { backgroundColor: `${getEfficiencyColor(order.total_minutes)}15` }]}>
          <Ionicons name="time" size={14} color={getEfficiencyColor(order.total_minutes)} />
          <Text style={[styles.timeBadgeText, { color: getEfficiencyColor(order.total_minutes) }]}>
            {order.total_minutes} min
          </Text>
        </View>
      </View>
      <View style={styles.orderDetails}>
        <View style={styles.orderDetailRow}>
          <Ionicons name="calendar-outline" size={14} color="#666" />
          <Text style={styles.orderDetailText}>
            {new Date(order.trip_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.orderDetailRow}>
          <Ionicons name="play-outline" size={14} color="#4CAF50" />
          <Text style={styles.orderDetailText}>Start: {order.first_pick_time}</Text>
        </View>
        <View style={styles.orderDetailRow}>
          <Ionicons name="stop-outline" size={14} color="#F44336" />
          <Text style={styles.orderDetailText}>End: {order.last_ship_time}</Text>
        </View>
      </View>
      <View style={styles.orderFooter}>
        <View style={styles.orderFooterItem}>
          <Ionicons name="car-outline" size={12} color="#666" />
          <Text style={styles.orderFooterText}>{order.trip_lorry}</Text>
        </View>
        <View style={styles.orderFooterItem}>
          <Ionicons name="grid-outline" size={12} color="#666" />
          <Text style={styles.orderFooterText}>{order.trip_loading_bay}</Text>
        </View>
        <View style={styles.orderFooterItem}>
          <Ionicons name="list-outline" size={12} color="#666" />
          <Text style={styles.orderFooterText}>{order.total_lines} lines</Text>
        </View>
      </View>
    </View>
  );
};

// Bottom Toolbar
const BottomToolbar = ({ onHome, onBack, onRefresh, isRefreshing }) => (
  <View style={styles.bottomToolbar}>
    <TouchableOpacity style={styles.toolbarButton} onPress={onHome}>
      <Ionicons name="home" size={24} color="#1565C0" />
      <Text style={styles.toolbarButtonText}>Home</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolbarButton} onPress={onBack}>
      <Ionicons name="arrow-back" size={24} color="#666" />
      <Text style={styles.toolbarButtonText}>Back</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolbarButton} onPress={onRefresh} disabled={isRefreshing}>
      {isRefreshing ? (
        <ActivityIndicator size="small" color="#1565C0" />
      ) : (
        <Ionicons name="refresh" size={24} color="#1565C0" />
      )}
      <Text style={styles.toolbarButtonText}>Refresh</Text>
    </TouchableOpacity>
  </View>
);

const WMSPickerStatsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [performanceData, setPerformanceData] = useState([]);
  const [stats, setStats] = useState(null);

  const pickerName = user?.PICKER_NAME || user?.picker_name || user?.username || '';

  const calculateStats = (data) => {
    if (!data || data.length === 0) {
      return {
        totalOrders: 0,
        totalLines: 0,
        totalMinutes: 0,
        avgTimePerOrder: 0,
        avgTimePerLine: 0,
        fastestOrder: 0,
        slowestOrder: 0,
        totalHours: 0,
        ordersPerHour: 0,
        dailyBreakdown: [],
        efficiencyScore: 0,
      };
    }

    const totalOrders = data.length;
    const totalLines = data.reduce((sum, d) => sum + (d.total_lines || 0), 0);
    const totalMinutes = data.reduce((sum, d) => sum + (d.total_minutes || 0), 0);
    const avgTimePerOrder = totalOrders > 0 ? totalMinutes / totalOrders : 0;
    const avgTimePerLine = totalLines > 0 ? totalMinutes / totalLines : 0;
    const fastestOrder = Math.min(...data.map(d => d.total_minutes || 999));
    const slowestOrder = Math.max(...data.map(d => d.total_minutes || 0));
    const totalHours = totalMinutes / 60;
    const ordersPerHour = totalHours > 0 ? totalOrders / totalHours : 0;

    // Calculate efficiency score (lower time = higher score)
    const targetTimePerOrder = 3; // Target 3 minutes per order
    const efficiencyScore = avgTimePerOrder > 0
      ? Math.min(100, Math.round((targetTimePerOrder / avgTimePerOrder) * 100))
      : 0;

    // Group by date
    const byDate = {};
    data.forEach(order => {
      const dateKey = new Date(order.trip_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!byDate[dateKey]) {
        byDate[dateKey] = {
          date: dateKey,
          orders: 0,
          totalMinutes: 0,
          totalLines: 0,
        };
      }
      byDate[dateKey].orders++;
      byDate[dateKey].totalMinutes += order.total_minutes || 0;
      byDate[dateKey].totalLines += order.total_lines || 0;
    });

    const dailyBreakdown = Object.values(byDate).map(day => ({
      ...day,
      avgTime: day.orders > 0 ? day.totalMinutes / day.orders : 0,
    })).sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      totalOrders,
      totalLines,
      totalMinutes,
      avgTimePerOrder,
      avgTimePerLine,
      fastestOrder,
      slowestOrder,
      totalHours,
      ordersPerHour,
      dailyBreakdown,
      efficiencyScore,
    };
  };

  const loadData = useCallback(async () => {
    try {
      // Use wider date range - 14 days back to today
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 14);

      console.log('[WMSPickerStats] Loading data for:', pickerName, 'from:', fromDate, 'to:', toDate);

      const result = await fetchPickerPerformance(pickerName, fromDate, toDate);

      console.log('[WMSPickerStats] API result:', result.success, 'items:', result.data?.items?.length);

      if (result.success && result.data?.items) {
        setPerformanceData(result.data.items);
        setStats(calculateStats(result.data.items));
      } else {
        setPerformanceData([]);
        setStats(calculateStats([]));
      }
    } catch (error) {
      console.error('[WMSPickerStats] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pickerName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderOverviewTab = () => (
    <ScrollView
      style={styles.tabContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1565C0']} />}
    >
      {/* Debug Info - remove in production */}
      {performanceData.length === 0 && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>Picker: {pickerName || 'Not set'}</Text>
          <Text style={styles.debugText}>Orders found: {performanceData.length}</Text>
          <Text style={styles.debugText}>Check console for API response</Text>
        </View>
      )}

      {/* Efficiency Score */}
      <View style={styles.efficiencyContainer}>
        <View style={styles.efficiencyCircle}>
          <Text style={styles.efficiencyScore}>{stats?.efficiencyScore || 0}</Text>
          <Text style={styles.efficiencyLabel}>Score</Text>
        </View>
        <View style={styles.efficiencyInfo}>
          <Text style={styles.efficiencyTitle}>Performance Score</Text>
          <Text style={styles.efficiencyDesc}>
            Based on average picking time vs target (3 min/order)
          </Text>
          <View style={styles.efficiencyRating}>
            {stats?.efficiencyScore >= 80 && (
              <><Ionicons name="star" size={16} color="#FFD700" /><Text style={styles.efficiencyRatingText}>Excellent!</Text></>
            )}
            {stats?.efficiencyScore >= 60 && stats?.efficiencyScore < 80 && (
              <><Ionicons name="thumbs-up" size={16} color="#4CAF50" /><Text style={styles.efficiencyRatingText}>Good</Text></>
            )}
            {stats?.efficiencyScore < 60 && stats?.efficiencyScore > 0 && (
              <><Ionicons name="trending-up" size={16} color="#FF9800" /><Text style={styles.efficiencyRatingText}>Room to Improve</Text></>
            )}
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="cube-outline"
          label="Total Orders"
          value={stats?.totalOrders || 0}
          color="#1565C0"
        />
        <StatCard
          icon="list-outline"
          label="Total Lines"
          value={stats?.totalLines || 0}
          color="#9C27B0"
        />
        <StatCard
          icon="time-outline"
          label="Total Time"
          value={`${stats?.totalMinutes || 0}m`}
          subValue={`${(stats?.totalHours || 0).toFixed(1)} hrs`}
          color="#FF9800"
        />
        <StatCard
          icon="speedometer-outline"
          label="Avg/Order"
          value={`${(stats?.avgTimePerOrder || 0).toFixed(1)}m`}
          color="#4CAF50"
        />
      </View>

      {/* Additional Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <View style={styles.metricsContainer}>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Ionicons name="flash" size={20} color="#4CAF50" />
              <View style={styles.metricInfo}>
                <Text style={styles.metricValue}>{stats?.fastestOrder || 0} min</Text>
                <Text style={styles.metricLabel}>Fastest Order</Text>
              </View>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="hourglass" size={20} color="#F44336" />
              <View style={styles.metricInfo}>
                <Text style={styles.metricValue}>{stats?.slowestOrder || 0} min</Text>
                <Text style={styles.metricLabel}>Slowest Order</Text>
              </View>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Ionicons name="trending-up" size={20} color="#1565C0" />
              <View style={styles.metricInfo}>
                <Text style={styles.metricValue}>{(stats?.ordersPerHour || 0).toFixed(1)}</Text>
                <Text style={styles.metricLabel}>Orders/Hour</Text>
              </View>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="timer" size={20} color="#9C27B0" />
              <View style={styles.metricInfo}>
                <Text style={styles.metricValue}>{(stats?.avgTimePerLine || 0).toFixed(1)} min</Text>
                <Text style={styles.metricLabel}>Avg/Line</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Progress Bars */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Progress</Text>
        <ProgressBar
          label="Orders Completed"
          value={stats?.dailyBreakdown[0]?.orders || 0}
          max={20}
          color="#4CAF50"
        />
        <ProgressBar
          label="Lines Picked"
          value={stats?.dailyBreakdown[0]?.totalLines || 0}
          max={100}
          color="#1565C0"
        />
      </View>
    </ScrollView>
  );

  const renderDailyTab = () => (
    <ScrollView
      style={styles.tabContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1565C0']} />}
    >
      <Text style={styles.sectionTitle}>Daily Breakdown</Text>
      {stats?.dailyBreakdown && stats.dailyBreakdown.length > 0 ? (
        stats.dailyBreakdown.map((day, index) => (
          <DailyCard
            key={`day-${index}`}
            date={day.date}
            orders={day.orders}
            totalMinutes={day.totalMinutes}
            totalLines={day.totalLines}
            avgTime={day.avgTime}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#CCC" />
          <Text style={styles.emptyStateText}>No daily data available</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderOrdersTab = () => (
    <ScrollView
      style={styles.tabContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1565C0']} />}
    >
      <Text style={styles.sectionTitle}>Recent Orders ({performanceData.length})</Text>
      {performanceData.length > 0 ? (
        performanceData.map((order, index) => (
          <OrderCard key={`order-${index}`} order={order} />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color="#CCC" />
          <Text style={styles.emptyStateText}>No orders found</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />

      {/* Header */}
      <LinearGradient colors={['#1565C0', '#0D47A1']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>My Performance</Text>
            <Text style={styles.headerSubtitle}>{pickerName}</Text>
          </View>
          <Ionicons name="trophy" size={28} color="#FFD700" />
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TabButton
          title="Overview"
          icon="stats-chart"
          isActive={activeTab === 'overview'}
          onPress={() => setActiveTab('overview')}
        />
        <TabButton
          title="Daily"
          icon="calendar"
          isActive={activeTab === 'daily'}
          onPress={() => setActiveTab('daily')}
        />
        <TabButton
          title="Orders"
          icon="list"
          isActive={activeTab === 'orders'}
          onPress={() => setActiveTab('orders')}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Loading performance data...</Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'daily' && renderDailyTab()}
          {activeTab === 'orders' && renderOrdersTab()}
        </View>
      )}

      {/* Bottom Toolbar */}
      <BottomToolbar
        onHome={() => navigation.navigate('MainTabs')}
        onBack={() => navigation.goBack()}
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
      />
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
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginLeft: 6,
  },
  tabButtonTextActive: {
    color: '#1565C0',
    fontWeight: '600',
  },
  // Content
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  // Efficiency Section
  efficiencyContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  efficiencyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#1565C0',
  },
  efficiencyScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1565C0',
  },
  efficiencyLabel: {
    fontSize: 10,
    color: '#666',
  },
  efficiencyInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  efficiencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  efficiencyDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  efficiencyRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  efficiencyRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 6,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statSubValue: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  // Section
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  // Metrics
  metricsContainer: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  metricInfo: {
    marginLeft: 10,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
  },
  // Progress Bar
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressBarLabel: {
    fontSize: 13,
    color: '#333',
  },
  progressBarValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Daily Card
  dailyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dailyDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  dailyBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dailyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
  },
  dailyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dailyStat: {
    alignItems: 'center',
  },
  dailyStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  dailyStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  // Order Card
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565C0',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderFooterText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  // Debug Info
  debugInfo: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  debugText: {
    fontSize: 12,
    color: '#E65100',
    marginBottom: 4,
  },
  // Bottom Toolbar
  bottomToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  toolbarButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  toolbarButtonText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
});

export default WMSPickerStatsScreen;
