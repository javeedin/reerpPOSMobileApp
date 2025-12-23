import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

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

// Section Header Component
const SectionHeader = ({ title, icon, color }) => (
  <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// Cash Summary Card
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

// Cash Summary Details Card
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

// Customer Details Card
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

// Helper functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

const getPaymentColor = (mode) => {
  const modeUpper = (mode || '').toUpperCase();
  if (modeUpper.includes('CASH')) return colors.accentGreen;
  if (modeUpper.includes('CHEQUE')) return colors.accent;
  if (modeUpper.includes('CARD')) return colors.accentPurple;
  if (modeUpper.includes('ADV')) return colors.accentOrange;
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

// Date Picker Modal
const DatePickerModal = ({ visible, onClose, selectedDate, onSelectDate }) => {
  const [tempDate, setTempDate] = useState(selectedDate);

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

const LodgementReportScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const salesrepNumber = user?.salesrep_number || user?.username || '';

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      const dateParam = formatDateForAPI(selectedDate);
      const url = `${BASE_URL}/ARMODULE/DAILYLODGMENT?ORDER_DATE=${dateParam}&SALESREP_NUMBER=${salesrepNumber}`;

      console.log('Fetching lodgement report:', url);

      const response = await axios.get(url, {
        timeout: 30000,
      });

      console.log('Lodgement response:', JSON.stringify(response.data, null, 2));

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
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDate]);

  // Extract data sections
  const cashSummary = reportData?.find(item => item['Cash Summary'])?.['Cash Summary'] || [];
  const cashDetails = reportData?.find(item => item['Cash Summary Details'])?.['Cash Summary Details'] || [];
  const customerDetails = reportData?.find(item => item['Customer Details'])?.['Customer Details'] || [];

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
        <TouchableOpacity onPress={fetchReport} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Date Selector */}
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

      {/* Content */}
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
            <TouchableOpacity style={styles.retryButton} onPress={fetchReport}>
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

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
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
