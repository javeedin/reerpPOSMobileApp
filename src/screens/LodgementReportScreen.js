import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { appendInstanceParam } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_URL = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';

// Format date as DD-MON-YYYY
const formatDateForAPI = (date) => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Format date for display
const formatDateForDisplay = (date) => {
  const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

// Short date format
const formatShortDate = (date) => {
  const options = { day: '2-digit', month: 'short' };
  return date.toLocaleDateString('en-US', options);
};

// Helper functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const getPaymentColor = (mode) => {
  const modeUpper = (mode || '').toUpperCase();
  if (modeUpper.includes('CASH')) return colors.accentGreen;
  if (modeUpper.includes('CHEQUE')) return colors.accent;
  if (modeUpper.includes('CARD')) return colors.accentPurple;
  if (modeUpper.includes('ADV')) return colors.accentOrange;
  if (modeUpper.includes('JUICE')) return '#E91E63';
  return colors.textSecondary;
};

const getPaymentIcon = (mode) => {
  const modeUpper = (mode || '').toUpperCase();
  if (modeUpper.includes('CASH')) return 'cash-outline';
  if (modeUpper.includes('CHEQUE')) return 'document-text-outline';
  if (modeUpper.includes('CARD')) return 'card-outline';
  if (modeUpper.includes('ADV')) return 'arrow-forward-outline';
  return 'wallet-outline';
};

// ============== TAB BAR ==============
const TabBar = ({ activeTab, onTabChange }) => (
  <View style={styles.tabBar}>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'daily' && styles.tabActive]}
      onPress={() => onTabChange('daily')}
    >
      <Ionicons
        name="today-outline"
        size={20}
        color={activeTab === 'daily' ? colors.accent : colors.textMuted}
      />
      <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>Daily</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'summary' && styles.tabActive]}
      onPress={() => onTabChange('summary')}
    >
      <Ionicons
        name="analytics-outline"
        size={20}
        color={activeTab === 'summary' ? colors.accent : colors.textMuted}
      />
      <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>Summary</Text>
    </TouchableOpacity>
  </View>
);

// ============== SECTION HEADER ==============
const SectionHeader = ({ title, icon, color }) => (
  <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// ============== CASH SUMMARY CARD ==============
const CashSummaryCard = ({ data }) => {
  const total = data.reduce((sum, item) => sum + (item.AMOUNT || 0), 0);

  return (
    <View style={styles.card}>
      <SectionHeader title="Cash Summary" icon="cash-outline" color={colors.accentGreen} />
      <View style={styles.summaryGrid}>
        {data.map((item, index) => (
          <View key={index} style={styles.summaryItem}>
            <View style={[styles.paymentBadge, { backgroundColor: getPaymentColor(item.PAYMENTMODE) + '20' }]}>
              <Ionicons name={getPaymentIcon(item.PAYMENTMODE)} size={16} color={getPaymentColor(item.PAYMENTMODE)} />
            </View>
            <Text style={styles.paymentMode}>{item.PAYMENTMODE}</Text>
            <Text style={styles.paymentAmount}>{formatCurrency(item.AMOUNT)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Collections</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>
    </View>
  );
};

// ============== CASH DETAILS CARD ==============
const CashDetailsCard = ({ data }) => (
  <View style={styles.card}>
    <SectionHeader title="Cash Summary Details" icon="list-outline" color={colors.accent} />
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderText, { flex: 2 }]}>Order #</Text>
      <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Mode</Text>
      <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Amount</Text>
    </View>
    {data.map((item, index) => (
      <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
        <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{item['ORDER NUMBER']}</Text>
        <View style={[styles.modeBadge, { backgroundColor: getPaymentColor(item.PAYMENTMODE) + '15' }]}>
          <Text style={[styles.modeBadgeText, { color: getPaymentColor(item.PAYMENTMODE) }]}>
            {item.PAYMENTMODE}
          </Text>
        </View>
        <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right', fontWeight: '600' }]}>
          {formatCurrency(item.AMOUNT)}
        </Text>
      </View>
    ))}
  </View>
);

// ============== CUSTOMER DETAILS CARD ==============
const CustomerDetailsCard = ({ data }) => (
  <View style={styles.card}>
    <SectionHeader title="Customer Details" icon="people-outline" color={colors.accentPurple} />
    {data.map((item, index) => (
      <View key={index} style={[styles.customerRow, index !== data.length - 1 && styles.customerRowBorder]}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>{item.ACCOUNT_NAME}</Text>
          <View style={styles.customerMeta}>
            <Text style={styles.orderNumber}>{item['ORDER NUMBER']}</Text>
            <Text style={styles.orderDate}>{item['ORDER DATE']}</Text>
          </View>
        </View>
        <Text style={styles.customerTotal}>{formatCurrency(item.TOTAL)}</Text>
      </View>
    ))}
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>Total Orders</Text>
      <Text style={styles.totalValue}>
        {formatCurrency(data.reduce((sum, item) => sum + (item.TOTAL || 0), 0))}
      </Text>
    </View>
  </View>
);

// ============== DATE PICKER MODAL ==============
const DatePickerModal = ({ visible, onClose, selectedDate, onSelectDate }) => {
  const [tempDate, setTempDate] = useState(selectedDate);

  useEffect(() => {
    setTempDate(selectedDate);
  }, [selectedDate, visible]);

  const changeDate = (days) => {
    const newDate = new Date(tempDate);
    newDate.setDate(newDate.getDate() + days);
    setTempDate(newDate);
  };

  const setToday = () => setTempDate(new Date());
  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setTempDate(d);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.datePickerModal}>
          <Text style={styles.datePickerTitle}>Select Date</Text>

          <View style={styles.quickDateButtons}>
            <TouchableOpacity style={styles.quickDateBtn} onPress={setToday}>
              <Text style={styles.quickDateText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickDateBtn} onPress={setYesterday}>
              <Text style={styles.quickDateText}>Yesterday</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateNavigator}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.accent} />
            </TouchableOpacity>
            <View style={styles.selectedDateDisplay}>
              <Text style={styles.selectedDateText}>{formatDateForDisplay(tempDate)}</Text>
              <Text style={styles.selectedDateAPI}>{formatDateForAPI(tempDate)}</Text>
            </View>
            <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateNavBtn}>
              <Ionicons name="chevron-forward" size={24} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.datePickerActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => { onSelectDate(tempDate); onClose(); }}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============== MINI BAR CHART ==============
const MiniBarChart = ({ data, maxValue, color, label }) => {
  const barWidth = (data / maxValue) * 100;
  return (
    <View style={styles.miniBarContainer}>
      <Text style={styles.miniBarLabel}>{label}</Text>
      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFill, { width: `${Math.min(barWidth, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.miniBarValue}>{formatCurrency(data)}</Text>
    </View>
  );
};

// ============== TREND CHART ==============
const TrendChart = ({ data, onDayPress }) => {
  if (!data || data.length === 0) return null;

  const maxTotal = Math.max(...data.map(d => d.total || 0), 1);
  const chartHeight = 120;

  return (
    <View style={styles.trendChartCard}>
      <SectionHeader title="Daily Trend" icon="trending-up" color={colors.accent} />
      <View style={styles.trendChart}>
        {data.map((day, index) => {
          const barHeight = ((day.total || 0) / maxTotal) * chartHeight;
          return (
            <TouchableOpacity
              key={index}
              style={styles.trendBarContainer}
              onPress={() => onDayPress(day.date)}
              activeOpacity={0.7}
            >
              <Text style={styles.trendBarValue}>{formatCurrency(day.total)}</Text>
              <View style={styles.trendBarTrack}>
                <LinearGradient
                  colors={[colors.accent, colors.primary]}
                  style={[styles.trendBar, { height: Math.max(barHeight, 4) }]}
                />
              </View>
              <Text style={styles.trendBarLabel}>{formatShortDate(day.date)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.chartHint}>Tap a bar to view details</Text>
    </View>
  );
};

// ============== PAYMENT PIE CHART ==============
const PaymentPieChart = ({ data }) => {
  if (!data || Object.keys(data).length === 0) return null;

  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  const sortedPayments = Object.entries(data).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.pieChartCard}>
      <SectionHeader title="Payment Distribution" icon="pie-chart-outline" color={colors.accentPurple} />
      <View style={styles.pieChartContent}>
        <View style={styles.pieVisual}>
          {sortedPayments.map(([mode, amount], index) => {
            const percentage = (amount / total) * 100;
            const rotation = sortedPayments.slice(0, index).reduce((sum, [, val]) => sum + (val / total) * 360, 0);
            return (
              <View
                key={mode}
                style={[
                  styles.pieSlice,
                  {
                    backgroundColor: getPaymentColor(mode),
                    transform: [{ rotate: `${rotation}deg` }],
                    width: `${Math.min(percentage, 100)}%`,
                  },
                ]}
              />
            );
          })}
          <View style={styles.pieCenter}>
            <Text style={styles.pieTotalLabel}>Total</Text>
            <Text style={styles.pieTotalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>
        <View style={styles.pieLegend}>
          {sortedPayments.map(([mode, amount]) => (
            <View key={mode} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getPaymentColor(mode) }]} />
              <Text style={styles.legendLabel}>{mode}</Text>
              <Text style={styles.legendValue}>{formatCurrency(amount)}</Text>
              <Text style={styles.legendPercent}>{((amount / total) * 100).toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// ============== SUMMARY KPI CARD ==============
const SummaryKPICard = ({ icon, label, value, subValue, color, onPress }) => (
  <TouchableOpacity
    style={styles.summaryKpiCard}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={[styles.summaryKpiIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.summaryKpiValue}>{value}</Text>
    <Text style={styles.summaryKpiLabel}>{label}</Text>
    {subValue && <Text style={styles.summaryKpiSub}>{subValue}</Text>}
  </TouchableOpacity>
);

// ============== TOP CUSTOMERS ==============
const TopCustomersCard = ({ data }) => {
  if (!data || data.length === 0) return null;

  const maxAmount = Math.max(...data.map(c => c.total || 0), 1);

  return (
    <View style={styles.card}>
      <SectionHeader title="Top Customers" icon="trophy-outline" color={colors.accentOrange} />
      {data.slice(0, 5).map((customer, index) => (
        <View key={index} style={styles.topCustomerRow}>
          <View style={[styles.rankBadge, index === 0 && styles.rankBadgeGold]}>
            <Text style={[styles.rankText, index === 0 && styles.rankTextGold]}>{index + 1}</Text>
          </View>
          <View style={styles.topCustomerInfo}>
            <Text style={styles.topCustomerName} numberOfLines={1}>{customer.name}</Text>
            <MiniBarChart
              data={customer.total}
              maxValue={maxAmount}
              color={index === 0 ? colors.accentOrange : colors.accent}
              label=""
            />
          </View>
          <Text style={styles.topCustomerTotal}>{formatCurrency(customer.total)}</Text>
        </View>
      ))}
    </View>
  );
};

// ============== DAILY VIEW ==============
const DailyView = ({ selectedDate, setSelectedDate, loading, reportData, error, onRefresh }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const cashSummary = reportData?.find(item => item['Cash Summary'])?.['Cash Summary'] || [];
  const cashDetails = reportData?.find(item => item['Cash Summary Details'])?.['Cash Summary Details'] || [];
  const customerDetails = reportData?.find(item => item['Customer Details'])?.['Customer Details'] || [];

  return (
    <>
      <TouchableOpacity
        style={styles.dateSelector}
        onPress={() => setShowDatePicker(true)}
      >
        <View style={styles.dateSelectorLeft}>
          <Ionicons name="calendar-outline" size={22} color={colors.accent} />
          <View style={styles.dateSelectorText}>
            <Text style={styles.dateSelectorLabel}>Report Date</Text>
            <Text style={styles.dateSelectorValue}>{formatDateForDisplay(selectedDate)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading report...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.accentRed} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : reportData ? (
          <>
            {cashSummary.length > 0 && <CashSummaryCard data={cashSummary} />}
            {cashDetails.length > 0 && <CashDetailsCard data={cashDetails} />}
            {customerDetails.length > 0 && <CustomerDetailsCard data={customerDetails} />}
            {cashSummary.length === 0 && cashDetails.length === 0 && customerDetails.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No lodgement data for this date</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Select a date to view report</Text>
          </View>
        )}
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
    </>
  );
};

// ============== SUMMARY VIEW ==============
const SummaryView = ({ salesrepNumber, onDrillDown }) => {
  const [period, setPeriod] = useState(3);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const periods = [
    { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 },
    { label: '5 Days', value: 5 },
    { label: '1 Week', value: 7 },
  ];

  const fetchSummaryData = useCallback(async () => {
    setLoading(true);
    try {
      const dates = [];
      for (let i = 0; i < period; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d);
      }

      const results = await Promise.all(
        dates.map(async (date) => {
          try {
            const dateParam = formatDateForAPI(date);
            const url = await appendInstanceParam(`${BASE_URL}/ARMODULE/DAILYLODGMENT?ORDER_DATE=${dateParam}&SALESREP_NUMBER=${salesrepNumber}`);
            const response = await axios.get(url, { timeout: 30000 });
            return { date, data: response.data?.['lodgment report'] || null };
          } catch {
            return { date, data: null };
          }
        })
      );

      // Process data
      let totalCollections = 0;
      let totalOrders = 0;
      const paymentModes = {};
      const dailyTotals = [];
      const customerTotals = {};

      results.forEach(({ date, data }) => {
        if (!data) {
          dailyTotals.push({ date, total: 0 });
          return;
        }

        const cashSummary = data.find(item => item['Cash Summary'])?.['Cash Summary'] || [];
        const customerDetails = data.find(item => item['Customer Details'])?.['Customer Details'] || [];

        let dayTotal = 0;
        cashSummary.forEach(item => {
          const amount = item.AMOUNT || 0;
          dayTotal += amount;
          totalCollections += amount;
          const mode = item.PAYMENTMODE || 'OTHER';
          paymentModes[mode] = (paymentModes[mode] || 0) + amount;
        });

        totalOrders += customerDetails.length;

        customerDetails.forEach(cust => {
          const name = cust.ACCOUNT_NAME || 'Unknown';
          customerTotals[name] = (customerTotals[name] || 0) + (cust.TOTAL || 0);
        });

        dailyTotals.push({ date, total: dayTotal });
      });

      // Sort customers by total
      const topCustomers = Object.entries(customerTotals)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

      setSummaryData({
        totalCollections,
        totalOrders,
        avgDaily: totalCollections / period,
        paymentModes,
        dailyTotals: dailyTotals.reverse(),
        topCustomers,
        daysWithData: results.filter(r => r.data).length,
      });
    } catch (err) {
      console.error('Summary fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period, salesrepNumber]);

  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData]);

  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Period Selection */}
      <View style={styles.periodSelector}>
        <Text style={styles.periodLabel}>Select Period</Text>
        <View style={styles.periodButtons}>
          {periods.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
              onPress={() => setPeriod(p.value)}
            >
              <Text style={[styles.periodBtnText, period === p.value && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Analyzing {period} days of data...</Text>
        </View>
      ) : summaryData ? (
        <>
          {/* KPI Cards */}
          <View style={styles.summaryKpiGrid}>
            <SummaryKPICard
              icon="wallet-outline"
              label="Total Collections"
              value={formatCurrency(summaryData.totalCollections)}
              subValue={`${summaryData.daysWithData} days`}
              color={colors.accentGreen}
            />
            <SummaryKPICard
              icon="receipt-outline"
              label="Total Orders"
              value={summaryData.totalOrders.toString()}
              subValue={`${(summaryData.totalOrders / period).toFixed(1)}/day`}
              color={colors.accent}
            />
            <SummaryKPICard
              icon="trending-up"
              label="Daily Average"
              value={formatCurrency(summaryData.avgDaily)}
              color={colors.accentOrange}
            />
            <SummaryKPICard
              icon="card-outline"
              label="Payment Types"
              value={Object.keys(summaryData.paymentModes).length.toString()}
              color={colors.accentPurple}
            />
          </View>

          {/* Trend Chart */}
          <TrendChart data={summaryData.dailyTotals} onDayPress={onDrillDown} />

          {/* Payment Distribution */}
          <PaymentPieChart data={summaryData.paymentModes} />

          {/* Top Customers */}
          <TopCustomersCard data={summaryData.topCustomers} />

          {/* Daily Breakdown */}
          <View style={styles.card}>
            <SectionHeader title="Daily Breakdown" icon="calendar-outline" color={colors.accent} />
            {summaryData.dailyTotals.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.dayBreakdownRow, index !== summaryData.dailyTotals.length - 1 && styles.dayBreakdownBorder]}
                onPress={() => onDrillDown(day.date)}
              >
                <View style={styles.dayBreakdownInfo}>
                  <Text style={styles.dayBreakdownDate}>{formatDateForDisplay(day.date)}</Text>
                  <Text style={styles.dayBreakdownApi}>{formatDateForAPI(day.date)}</Text>
                </View>
                <View style={styles.dayBreakdownRight}>
                  <Text style={styles.dayBreakdownTotal}>{formatCurrency(day.total)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Unable to load summary data</Text>
        </View>
      )}
    </ScrollView>
  );
};

// ============== MAIN COMPONENT ==============
const LodgementReportScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const salesrepNumber = user?.salesrep_number || user?.username || '';

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      const dateParam = formatDateForAPI(selectedDate);
      const url = await appendInstanceParam(`${BASE_URL}/ARMODULE/DAILYLODGMENT?ORDER_DATE=${dateParam}&SALESREP_NUMBER=${salesrepNumber}`);

      const response = await axios.get(url, { timeout: 30000 });

      if (response.data && response.data['lodgment report']) {
        setReportData(response.data['lodgment report']);
      } else {
        setError('No data found for the selected date');
      }
    } catch (err) {
      console.error('Lodgement fetch error:', err);
      setError(err.message || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, salesrepNumber]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchReport();
    }
  }, [selectedDate, activeTab, fetchReport]);

  const handleDrillDown = (date) => {
    setSelectedDate(date);
    setActiveTab('daily');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Lodgement Report</Text>
          <Text style={styles.headerSubtitle}>Salesrep: {salesrepNumber}</Text>
        </View>
        <TouchableOpacity onPress={activeTab === 'daily' ? fetchReport : undefined} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {activeTab === 'daily' ? (
        <DailyView
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          loading={loading}
          reportData={reportData}
          error={error}
          onRefresh={fetchReport}
        />
      ) : (
        <SummaryView salesrepNumber={salesrepNumber} onDrillDown={handleDrillDown} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.accent + '15',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
  },
  // Date Selector
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSelectorText: {
    marginLeft: 12,
  },
  dateSelectorLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dateSelectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  // Period Selector
  periodSelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: colors.accent,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  // Summary KPI Grid
  summaryKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  summaryKpiCard: {
    width: '50%',
    padding: 6,
  },
  summaryKpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryKpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  summaryKpiLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryKpiSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Trend Chart
  trendChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  trendChart: {
    flexDirection: 'row',
    height: 180,
    alignItems: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  trendBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  trendBarValue: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  trendBarTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  trendBar: {
    width: '80%',
    borderRadius: 6,
  },
  trendBarLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 8,
  },
  chartHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  // Pie Chart
  pieChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pieChartContent: {
    marginTop: 16,
  },
  pieVisual: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pieCenter: {
    alignItems: 'center',
  },
  pieTotalLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pieTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  pieLegend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 8,
  },
  legendPercent: {
    fontSize: 12,
    color: colors.textMuted,
    width: 36,
    textAlign: 'right',
  },
  // Mini Bar
  miniBarContainer: {
    flex: 1,
    marginRight: 8,
  },
  miniBarLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
  },
  miniBarTrack: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  miniBarValue: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Top Customers
  topCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankBadgeGold: {
    backgroundColor: colors.accentOrange + '20',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  rankTextGold: {
    color: colors.accentOrange,
  },
  topCustomerInfo: {
    flex: 1,
  },
  topCustomerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  topCustomerTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  // Day Breakdown
  dayBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  dayBreakdownBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayBreakdownInfo: {
    flex: 1,
  },
  dayBreakdownDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayBreakdownApi: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  dayBreakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayBreakdownTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
    marginRight: 8,
  },
  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  summaryItem: {
    width: '50%',
    padding: 8,
    alignItems: 'center',
  },
  paymentBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentMode: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  tableRowEven: {
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  tableCell: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  modeBadge: {
    flex: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'center',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  customerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  customerInfo: {
    flex: 1,
    marginRight: 12,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 12,
    color: colors.accent,
    marginRight: 12,
  },
  orderDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  customerTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  // Date Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  quickDateButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  quickDateBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickDateText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dateNavBtn: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  selectedDateDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  selectedDateAPI: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default LodgementReportScreen;
