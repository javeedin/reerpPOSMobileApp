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
  FlatList,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  fetchShipmentsSummary,
  calculateWMSKPIs,
  groupOrdersByLorry,
  filterByTransactionType,
  filterPendingOrders,
  getWMSDateRange,
} from '../services/wmsService';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');

// Transaction type filter options
const FILTER_OPTIONS = [
  { id: 'All', label: 'All', icon: 'apps-outline' },
  { id: 'Sales Orders', label: 'Sales', icon: 'cart-outline' },
  { id: 'Store Transactions', label: 'Store', icon: 'swap-horizontal-outline' },
  { id: 'Order Returns', label: 'Returns', icon: 'return-down-back-outline' },
];

// Status filter options
const STATUS_OPTIONS = [
  { id: 'all', label: 'All', color: '#2196F3' },
  { id: 'pending', label: 'Pending', color: '#FF9800' },
  { id: 'picked', label: 'Picked', color: '#4CAF50' },
  { id: 'shipped', label: 'Shipped', color: '#9C27B0' },
];

// KPI Card Component
const KPICard = ({ title, value, icon, color, subtitle }) => (
  <View style={[styles.kpiCard, { borderLeftColor: color }]}>
    <View style={[styles.kpiIconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <View style={styles.kpiContent}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
      {subtitle && <Text style={styles.kpiSubtitle}>{subtitle}</Text>}
    </View>
  </View>
);

// Status Badge Component
const StatusBadge = ({ label, count, color, isActive, onPress }) => (
  <TouchableOpacity
    style={[
      styles.statusBadge,
      isActive && { backgroundColor: color, borderColor: color },
    ]}
    onPress={onPress}
  >
    <Text style={[styles.statusBadgeCount, isActive && { color: '#FFF' }]}>
      {count}
    </Text>
    <Text style={[styles.statusBadgeLabel, isActive && { color: '#FFF' }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// Order Card Component
const OrderCard = ({ order, onPress }) => {
  const isPicked = order.pick_confirm_status === 'YES';
  const isShipped = order.shipped_status === 'YES';

  let statusColor = '#FF9800'; // Pending
  let statusText = 'Pending';
  let statusIcon = 'time-outline';

  if (isShipped) {
    statusColor = '#9C27B0';
    statusText = 'Shipped';
    statusIcon = 'checkmark-done-circle-outline';
  } else if (isPicked) {
    statusColor = '#4CAF50';
    statusText = 'Picked';
    statusIcon = 'checkmark-circle-outline';
  }

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderHeader}>
        <View style={styles.orderNumberContainer}>
          <Text style={styles.orderNumber}>{order.source_order_number}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
            <Ionicons name={statusIcon} size={12} color={statusColor} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityText}>P{order.order_priority || '-'}</Text>
        </View>
      </View>

      <Text style={styles.accountName} numberOfLines={1}>
        {order.account_name || 'Unknown Customer'}
      </Text>

      <View style={styles.orderMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={14} color="#666" />
          <Text style={styles.metaText}>{order.picker_name || '-'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="layers-outline" size={14} color="#666" />
          <Text style={styles.metaText}>{order.no_of_lines || 0} lines</Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.tagContainer}>
          {order.lorry_number && (
            <View style={styles.tag}>
              <Ionicons name="car-outline" size={12} color="#1976D2" />
              <Text style={styles.tagText}>{order.lorry_number}</Text>
            </View>
          )}
          {order.loading_bay && (
            <View style={styles.tag}>
              <Ionicons name="location-outline" size={12} color="#388E3C" />
              <Text style={styles.tagText}>{order.loading_bay}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </View>
    </TouchableOpacity>
  );
};

// Lorry Group Component
const LorryGroup = ({ lorryData, onOrderPress, expandedLorries, toggleLorry }) => {
  const isExpanded = expandedLorries.includes(lorryData.lorry_number);

  return (
    <View style={styles.lorryGroup}>
      <TouchableOpacity
        style={styles.lorryHeader}
        onPress={() => toggleLorry(lorryData.lorry_number)}
      >
        <View style={styles.lorryInfo}>
          <View style={styles.lorryIconContainer}>
            <Ionicons name="car-sport" size={24} color="#1976D2" />
          </View>
          <View>
            <Text style={styles.lorryNumber}>{lorryData.lorry_number}</Text>
            <Text style={styles.lorryStats}>
              {lorryData.orderCount} orders | {lorryData.totalLines} lines
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#666"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.lorryContent}>
          {lorryData.loading_bays.map((bayData, bayIndex) => (
            <View key={bayIndex} style={styles.bayGroup}>
              <View style={styles.bayHeader}>
                <Ionicons name="location" size={16} color="#388E3C" />
                <Text style={styles.bayName}>{bayData.loading_bay}</Text>
                <Text style={styles.bayCount}>{bayData.orderCount} orders</Text>
              </View>

              {bayData.priorities.map((priorityData, priorityIndex) => (
                <View key={priorityIndex} style={styles.priorityGroup}>
                  {priorityData.orders.map((order, orderIndex) => (
                    <OrderCard
                      key={orderIndex}
                      order={order}
                      onPress={() => onOrderPress(order)}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const WMSHomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [kpis, setKpis] = useState({});
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedLorries, setExpandedLorries] = useState([]);
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'list'

  // Get picker name from user data
  const pickerName = user?.PICKER_NAME || user?.picker_name || user?.username || '';

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const { fromDate, toDate } = getWMSDateRange();
      const result = await fetchShipmentsSummary(pickerName, fromDate, toDate, null);

      if (result.success && result.data?.items) {
        setShipments(result.data.items);
        setKpis(calculateWMSKPIs(result.data.items));

        // Auto-expand first lorry if any
        const grouped = groupOrdersByLorry(result.data.items);
        if (grouped.length > 0 && expandedLorries.length === 0) {
          setExpandedLorries([grouped[0].lorry_number]);
        }
      } else {
        setShipments([]);
        setKpis({});
      }
    } catch (error) {
      console.error('[WMSHome] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pickerName]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const toggleLorry = (lorryNumber) => {
    setExpandedLorries(prev =>
      prev.includes(lorryNumber)
        ? prev.filter(l => l !== lorryNumber)
        : [...prev, lorryNumber]
    );
  };

  const handleOrderPress = (order) => {
    // Navigate to order detail (to be implemented)
    console.log('Order pressed:', order.source_order_number);
    // navigation.navigate('WMSOrderDetail', { order });
  };

  // Filter shipments
  const getFilteredShipments = () => {
    let filtered = [...shipments];

    // Filter by transaction type
    if (selectedFilter !== 'All') {
      filtered = filterByTransactionType(filtered, selectedFilter);
    }

    // Filter by status
    if (selectedStatus === 'pending') {
      filtered = filtered.filter(s => s.pick_confirm_status !== 'YES');
    } else if (selectedStatus === 'picked') {
      filtered = filtered.filter(s => s.pick_confirm_status === 'YES' && s.shipped_status !== 'YES');
    } else if (selectedStatus === 'shipped') {
      filtered = filtered.filter(s => s.shipped_status === 'YES');
    }

    return filtered;
  };

  const filteredShipments = getFilteredShipments();
  const groupedShipments = groupOrdersByLorry(filteredShipments);

  // Get pending count for today and yesterday
  const pendingToday = filterPendingOrders(shipments);

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
            <Text style={styles.headerTitle}>Warehouse Management</Text>
            <Text style={styles.headerSubtitle}>
              Picker: {pickerName || 'Not Set'}
            </Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Loading shipments...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1565C0']} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* KPI Cards */}
          <View style={styles.kpiSection}>
            <Text style={styles.sectionTitle}>Overview (Last 4 Days)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.kpiRow}>
                <KPICard
                  title="Sales Orders"
                  value={kpis.salesOrders || 0}
                  icon="cart"
                  color="#2196F3"
                  subtitle={`${kpis.byPickStatus?.['YES'] || 0} picked`}
                />
                <KPICard
                  title="Store Trans"
                  value={kpis.storeTransactions || 0}
                  icon="swap-horizontal"
                  color="#FF9800"
                />
                <KPICard
                  title="Returns"
                  value={kpis.orderReturns || 0}
                  icon="return-down-back"
                  color="#F44336"
                />
                <KPICard
                  title="Total Lines"
                  value={kpis.totalLines || 0}
                  icon="layers"
                  color="#9C27B0"
                />
              </View>
            </ScrollView>
          </View>

          {/* Pending Alert */}
          {pendingToday.length > 0 && (
            <View style={styles.alertBanner}>
              <Ionicons name="warning" size={20} color="#FF9800" />
              <Text style={styles.alertText}>
                {pendingToday.length} pending order{pendingToday.length > 1 ? 's' : ''} for today/yesterday
              </Text>
            </View>
          )}

          {/* Status Filter */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map(status => (
                  <StatusBadge
                    key={status.id}
                    label={status.label}
                    count={
                      status.id === 'all' ? kpis.totalOrders || 0 :
                      status.id === 'pending' ? kpis.pendingPick || 0 :
                      status.id === 'picked' ? (kpis.pickedOrders - kpis.shippedOrders) || 0 :
                      kpis.shippedOrders || 0
                    }
                    color={status.color}
                    isActive={selectedStatus === status.id}
                    onPress={() => setSelectedStatus(status.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Transaction Type Filter */}
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {FILTER_OPTIONS.map(filter => (
                  <TouchableOpacity
                    key={filter.id}
                    style={[
                      styles.filterChip,
                      selectedFilter === filter.id && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedFilter(filter.id)}
                  >
                    <Ionicons
                      name={filter.icon}
                      size={18}
                      color={selectedFilter === filter.id ? '#FFF' : '#666'}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedFilter === filter.id && styles.filterChipTextActive,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* View Mode Toggle */}
          <View style={styles.viewModeSection}>
            <Text style={styles.resultCount}>
              {filteredShipments.length} orders
            </Text>
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                style={[styles.viewModeButton, viewMode === 'grouped' && styles.viewModeButtonActive]}
                onPress={() => setViewMode('grouped')}
              >
                <Ionicons
                  name="layers-outline"
                  size={18}
                  color={viewMode === 'grouped' ? '#FFF' : '#666'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
                onPress={() => setViewMode('list')}
              >
                <Ionicons
                  name="list-outline"
                  size={18}
                  color={viewMode === 'list' ? '#FFF' : '#666'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Orders List */}
          {filteredShipments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={60} color="#CCC" />
              <Text style={styles.emptyStateText}>No orders found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try adjusting your filters
              </Text>
            </View>
          ) : viewMode === 'grouped' ? (
            <View style={styles.ordersSection}>
              {groupedShipments.map((lorryData, index) => (
                <LorryGroup
                  key={index}
                  lorryData={lorryData}
                  onOrderPress={handleOrderPress}
                  expandedLorries={expandedLorries}
                  toggleLorry={toggleLorry}
                />
              ))}
            </View>
          ) : (
            <View style={styles.ordersSection}>
              {filteredShipments.map((order, index) => (
                <OrderCard
                  key={index}
                  order={order}
                  onPress={() => handleOrderPress(order)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
  refreshButton: {
    padding: 8,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  // KPI Section
  kpiSection: {
    marginTop: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  kpiCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    width: 140,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiContent: {},
  kpiValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  kpiTitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  kpiSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
  },
  // Status Section
  statusSection: {
    marginTop: 20,
  },
  statusRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusBadgeCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 6,
  },
  statusBadgeLabel: {
    fontSize: 12,
    color: '#666',
  },
  // Filter Section
  filterSection: {
    marginTop: 16,
    paddingHorizontal: 12,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#1565C0',
    borderColor: '#1565C0',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  // View Mode
  viewModeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  resultCount: {
    fontSize: 13,
    color: '#666',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#1565C0',
  },
  // Orders Section
  ordersSection: {
    paddingHorizontal: 16,
  },
  // Lorry Group
  lorryGroup: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  lorryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#E3F2FD',
  },
  lorryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lorryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lorryNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
  },
  lorryStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  lorryContent: {
    padding: 12,
  },
  // Bay Group
  bayGroup: {
    marginBottom: 12,
  },
  bayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 8,
  },
  bayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#388E3C',
    marginLeft: 8,
    flex: 1,
  },
  bayCount: {
    fontSize: 12,
    color: '#999',
  },
  priorityGroup: {},
  // Order Card
  orderCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNumberContainer: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  priorityBadge: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9800',
  },
  accountName: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
  },
  orderMeta: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 8,
  },
  tagContainer: {
    flexDirection: 'row',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
});

export default WMSHomeScreen;
