import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  fetchShipmentsSummary,
  calculateWMSKPIs,
  groupOrdersByDate,
} from '../services/wmsService';

const { width } = Dimensions.get('window');

// Format date for API
const formatDateForAPI = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get default date range (last 7 days)
const getDefaultDateRange = () => {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 7);
  return {
    fromDate: formatDateForAPI(fromDate),
    toDate: formatDateForAPI(today),
  };
};

// Tab options
const TABS = [
  { id: 'byDate', label: 'By Date', icon: 'calendar-outline' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics-outline' },
];

// Stat Card Component
const StatCard = ({ title, value, icon, color, subtitle }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

// Progress Bar Component
const ProgressBar = ({ label, value, total, color }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value} / {total}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.progressPercent, { color }]}>{percentage.toFixed(1)}%</Text>
    </View>
  );
};

// Date Row Component for By Date tab
const DateRow = ({ dateData, isExpanded, onToggle }) => {
  const isToday = dateData.date === formatDateForAPI(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = dateData.date === formatDateForAPI(yesterday);

  let dateLabel = dateData.displayDate;
  if (isToday) dateLabel = `Today (${dateData.displayDate})`;
  if (isYesterday) dateLabel = `Yesterday (${dateData.displayDate})`;

  const total = dateData.orders.length;
  const pickedPercent = total > 0 ? ((dateData.pickedCount + dateData.shippedCount) / total * 100).toFixed(0) : 0;

  return (
    <View style={[styles.dateRow, isToday && styles.dateRowToday]}>
      <TouchableOpacity style={styles.dateRowHeader} onPress={onToggle}>
        <View style={styles.dateRowLeft}>
          <View style={[styles.dateIconBox, isToday && styles.dateIconBoxToday]}>
            <Ionicons name="calendar" size={20} color={isToday ? '#FFF' : '#1565C0'} />
          </View>
          <View>
            <Text style={[styles.dateRowLabel, isToday && styles.dateRowLabelToday]}>{dateLabel}</Text>
            <Text style={styles.dateRowSublabel}>{total} orders | {dateData.totalLines} lines</Text>
          </View>
        </View>
        <View style={styles.dateRowRight}>
          <View style={styles.dateRowStats}>
            <View style={[styles.miniStat, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.miniStatValue, { color: '#FF9800' }]}>{dateData.pendingCount}</Text>
              <Text style={styles.miniStatLabel}>Pending</Text>
            </View>
            <View style={[styles.miniStat, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.miniStatValue, { color: '#4CAF50' }]}>{dateData.pickedCount}</Text>
              <Text style={styles.miniStatLabel}>Picked</Text>
            </View>
            <View style={[styles.miniStat, { backgroundColor: '#F3E5F5' }]}>
              <Text style={[styles.miniStatValue, { color: '#9C27B0' }]}>{dateData.shippedCount}</Text>
              <Text style={styles.miniStatLabel}>Shipped</Text>
            </View>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#999" />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.dateRowDetails}>
          <View style={styles.detailProgressBar}>
            <View style={styles.detailProgressLabel}>
              <Text style={styles.detailProgressText}>Completion</Text>
              <Text style={styles.detailProgressPercent}>{pickedPercent}%</Text>
            </View>
            <View style={styles.detailProgressBg}>
              <View style={[styles.detailProgressShipped, { width: `${total > 0 ? (dateData.shippedCount / total * 100) : 0}%` }]} />
              <View style={[styles.detailProgressPicked, { width: `${total > 0 ? (dateData.pickedCount / total * 100) : 0}%`, left: `${total > 0 ? (dateData.shippedCount / total * 100) : 0}%` }]} />
            </View>
          </View>

          {/* Order breakdown by transaction type */}
          <View style={styles.detailBreakdown}>
            {Object.entries(
              dateData.orders.reduce((acc, order) => {
                const type = order.transaction_type || 'Unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count], index) => (
              <View key={index} style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{type}</Text>
                <Text style={styles.breakdownValue}>{count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// Analytics Chart Component (simple bar chart)
const BarChart = ({ data, title }) => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.chartBars}>
        {data.map((item, index) => (
          <View key={index} style={styles.chartBarItem}>
            <View style={styles.chartBarWrapper}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : 0,
                    backgroundColor: item.color || '#1565C0',
                  },
                ]}
              />
            </View>
            <Text style={styles.chartBarLabel}>{item.label}</Text>
            <Text style={styles.chartBarValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Donut/Pie Summary Component
const StatusDonut = ({ pending, picked, shipped }) => {
  const total = pending + picked + shipped;
  if (total === 0) return null;

  const pendingPct = (pending / total * 100).toFixed(1);
  const pickedPct = (picked / total * 100).toFixed(1);
  const shippedPct = (shipped / total * 100).toFixed(1);

  return (
    <View style={styles.donutContainer}>
      <Text style={styles.donutTitle}>Status Distribution</Text>
      <View style={styles.donutContent}>
        <View style={styles.donutVisual}>
          <View style={styles.donutCircle}>
            <Text style={styles.donutTotal}>{total}</Text>
            <Text style={styles.donutTotalLabel}>Total</Text>
          </View>
        </View>
        <View style={styles.donutLegend}>
          <View style={styles.donutLegendItem}>
            <View style={[styles.donutLegendDot, { backgroundColor: '#FF9800' }]} />
            <View style={styles.donutLegendText}>
              <Text style={styles.donutLegendLabel}>Pending</Text>
              <Text style={styles.donutLegendValue}>{pending} ({pendingPct}%)</Text>
            </View>
          </View>
          <View style={styles.donutLegendItem}>
            <View style={[styles.donutLegendDot, { backgroundColor: '#4CAF50' }]} />
            <View style={styles.donutLegendText}>
              <Text style={styles.donutLegendLabel}>Picked</Text>
              <Text style={styles.donutLegendValue}>{picked} ({pickedPct}%)</Text>
            </View>
          </View>
          <View style={styles.donutLegendItem}>
            <View style={[styles.donutLegendDot, { backgroundColor: '#9C27B0' }]} />
            <View style={styles.donutLegendText}>
              <Text style={styles.donutLegendLabel}>Shipped</Text>
              <Text style={styles.donutLegendValue}>{shipped} ({shippedPct}%)</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const WMSReportsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const defaultDates = getDefaultDateRange();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  const [activeTab, setActiveTab] = useState('byDate');
  const [shipments, setShipments] = useState([]);
  const [kpis, setKpis] = useState({});
  const [dateGroups, setDateGroups] = useState([]);
  const [expandedDates, setExpandedDates] = useState([]);
  const [hasQueried, setHasQueried] = useState(false);

  const pickerName = user?.PICKER_NAME || user?.picker_name || user?.username || '';

  const handleQuery = useCallback(async () => {
    setLoading(true);
    setHasQueried(true);

    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const result = await fetchShipmentsSummary(pickerName, from, to, null);

      if (result.success && result.data?.items) {
        setShipments(result.data.items);
        setKpis(calculateWMSKPIs(result.data.items));
        const groups = groupOrdersByDate(result.data.items);
        setDateGroups(groups);
        // Auto-expand first date
        if (groups.length > 0) {
          setExpandedDates([groups[0].date]);
        }
      } else {
        setShipments([]);
        setKpis({});
        setDateGroups([]);
      }
    } catch (error) {
      console.error('[WMSReports] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate, pickerName]);

  const toggleDate = (date) => {
    setExpandedDates(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  // Prepare analytics data
  const getTransactionTypeData = () => {
    if (!kpis.byTransactionType) return [];
    return Object.entries(kpis.byTransactionType).map(([type, count]) => ({
      label: type.replace('Orders', '').replace('Transfers', '').trim(),
      value: count,
      color: type.includes('Sales') ? '#2196F3' : type.includes('Store') ? '#FF9800' : '#F44336',
    }));
  };

  const getDailyTrendData = () => {
    return dateGroups.slice(0, 7).reverse().map(d => ({
      label: d.displayDate.split(',')[0].substring(0, 3),
      value: d.orders.length,
      color: '#1565C0',
    }));
  };

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
            <Text style={styles.headerTitle}>WMS Reports</Text>
            <Text style={styles.headerSubtitle}>{pickerName || 'All Pickers'}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Query Parameters */}
      <View style={styles.querySection}>
        <View style={styles.queryRow}>
          <View style={styles.queryField}>
            <Text style={styles.queryLabel}>From Date</Text>
            <TextInput
              style={styles.queryInput}
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.queryField}>
            <Text style={styles.queryLabel}>To Date</Text>
            <TextInput
              style={styles.queryInput}
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </View>
          <TouchableOpacity
            style={styles.queryButton}
            onPress={handleQuery}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="search" size={24} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? '#1565C0' : '#666'}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {!hasQueried ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={60} color="#CCC" />
          <Text style={styles.emptyStateText}>Enter date range and tap Search</Text>
          <Text style={styles.emptyStateSubtext}>View reports by date or analytics</Text>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleQuery} colors={['#1565C0']} />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'byDate' ? (
            /* By Date Tab */
            <View style={styles.tabContent}>
              {/* Summary Cards */}
              <View style={styles.summaryCards}>
                <StatCard
                  title="Total Orders"
                  value={kpis.totalOrders || 0}
                  icon="cube"
                  color="#1565C0"
                />
                <StatCard
                  title="Total Lines"
                  value={kpis.totalLines || 0}
                  icon="layers"
                  color="#9C27B0"
                />
              </View>

              {/* Date List */}
              <Text style={styles.sectionTitle}>Results by Date</Text>
              {dateGroups.length === 0 ? (
                <View style={styles.noResults}>
                  <Ionicons name="calendar-outline" size={40} color="#CCC" />
                  <Text style={styles.noResultsText}>No data for selected date range</Text>
                </View>
              ) : (
                dateGroups.map((dateData, index) => (
                  <DateRow
                    key={index}
                    dateData={dateData}
                    isExpanded={expandedDates.includes(dateData.date)}
                    onToggle={() => toggleDate(dateData.date)}
                  />
                ))
              )}
            </View>
          ) : (
            /* Analytics Tab */
            <View style={styles.tabContent}>
              {/* KPI Summary */}
              <View style={styles.kpiGrid}>
                <StatCard title="Sales Orders" value={kpis.salesOrders || 0} icon="cart" color="#2196F3" />
                <StatCard title="Store Transfers" value={kpis.storeTransactions || 0} icon="swap-horizontal" color="#FF9800" />
                <StatCard title="Returns" value={kpis.orderReturns || 0} icon="return-down-back" color="#F44336" />
                <StatCard title="Total Lines" value={kpis.totalLines || 0} icon="layers" color="#9C27B0" />
              </View>

              {/* Status Distribution */}
              <StatusDonut
                pending={kpis.pendingPick || 0}
                picked={(kpis.pickedOrders || 0) - (kpis.shippedOrders || 0)}
                shipped={kpis.shippedOrders || 0}
              />

              {/* Progress Bars */}
              <View style={styles.progressSection}>
                <Text style={styles.sectionTitle}>Completion Metrics</Text>
                <ProgressBar
                  label="Pick Completion"
                  value={kpis.pickedOrders || 0}
                  total={kpis.totalOrders || 0}
                  color="#4CAF50"
                />
                <ProgressBar
                  label="Ship Completion"
                  value={kpis.shippedOrders || 0}
                  total={kpis.totalOrders || 0}
                  color="#9C27B0"
                />
              </View>

              {/* Charts */}
              <BarChart data={getTransactionTypeData()} title="By Transaction Type" />
              <BarChart data={getDailyTrendData()} title="Daily Order Trend" />

              {/* Transaction Type Breakdown */}
              <View style={styles.breakdownSection}>
                <Text style={styles.sectionTitle}>Transaction Breakdown</Text>
                {Object.entries(kpis.byTransactionType || {}).map(([type, count], index) => (
                  <View key={index} style={styles.breakdownRow}>
                    <View style={styles.breakdownRowLeft}>
                      <View style={[styles.breakdownDot, {
                        backgroundColor: type.includes('Sales') ? '#2196F3' :
                          type.includes('Store') ? '#FF9800' : '#F44336'
                      }]} />
                      <Text style={styles.breakdownRowLabel}>{type}</Text>
                    </View>
                    <Text style={styles.breakdownRowValue}>{count}</Text>
                  </View>
                ))}
              </View>
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
  // Query Section
  querySection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  queryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  queryField: {
    flex: 1,
    marginRight: 8,
  },
  queryLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  queryInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  queryButton: {
    backgroundColor: '#1565C0',
    width: 48,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1565C0',
  },
  tabLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#1565C0',
    fontWeight: '600',
  },
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  // Loading & Empty
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  // Summary Cards
  summaryCards: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  // Stat Card
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  statTitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: 9,
    color: '#999',
    marginTop: 2,
  },
  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  // Date Row
  dateRow: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  dateRowToday: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  dateRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  dateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateIconBoxToday: {
    backgroundColor: '#4CAF50',
  },
  dateRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dateRowLabelToday: {
    color: '#2E7D32',
  },
  dateRowSublabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  dateRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateRowStats: {
    flexDirection: 'row',
    marginRight: 8,
  },
  miniStat: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 4,
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  miniStatLabel: {
    fontSize: 8,
    color: '#666',
  },
  dateRowDetails: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailProgressBar: {
    marginBottom: 12,
  },
  detailProgressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailProgressText: {
    fontSize: 12,
    color: '#666',
  },
  detailProgressPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  detailProgressBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  detailProgressShipped: {
    height: '100%',
    backgroundColor: '#9C27B0',
    position: 'absolute',
    left: 0,
  },
  detailProgressPicked: {
    height: '100%',
    backgroundColor: '#4CAF50',
    position: 'absolute',
  },
  detailBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#666',
    marginRight: 6,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  // Progress Section
  progressSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  progressItem: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 12,
    color: '#666',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },
  // Donut
  donutContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  donutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  donutContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donutVisual: {
    flex: 1,
    alignItems: 'center',
  },
  donutCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 12,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutTotal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  donutTotalLabel: {
    fontSize: 10,
    color: '#666',
  },
  donutLegend: {
    flex: 1,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  donutLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  donutLegendText: {},
  donutLegendLabel: {
    fontSize: 12,
    color: '#666',
  },
  donutLegendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // Chart
  chartContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBarItem: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarWrapper: {
    width: 30,
    height: 80,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  chartBarValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  // Breakdown Section
  breakdownSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  breakdownRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  breakdownRowLabel: {
    fontSize: 13,
    color: '#333',
  },
  breakdownRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565C0',
  },
});

export default WMSReportsScreen;
