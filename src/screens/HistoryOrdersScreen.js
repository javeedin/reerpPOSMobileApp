import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { queryHistoricalOrders } from '../services/syncService';
import { useAuth } from '../context/AuthContext';
import BottomToolbar from '../components/BottomToolbar';

// Conditionally import DateTimePicker only for native platforms
let DateTimePicker = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Web Date Picker Modal Component
const WebDatePickerModal = ({ visible, value, onClose, onSelect, title }) => {
  const [selectedDate, setSelectedDate] = useState(value);
  const insets = useSafeAreaInsets();

  // Format date to YYYY-MM-DD for input
  const formatForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleConfirm = () => {
    onSelect(selectedDate);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={webPickerStyles.overlay}>
        <View style={[webPickerStyles.container, { marginTop: insets.top + 100 }]}>
          <View style={webPickerStyles.header}>
            <Text style={webPickerStyles.title}>{title || 'Select Date'}</Text>
            <TouchableOpacity onPress={onClose} style={webPickerStyles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={webPickerStyles.inputContainer}>
            <input
              type="date"
              value={formatForInput(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              style={{
                width: '100%',
                padding: 16,
                fontSize: 18,
                border: `2px solid ${colors.accent}`,
                borderRadius: 8,
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                cursor: 'pointer',
              }}
            />
          </View>

          <View style={webPickerStyles.buttonRow}>
            <TouchableOpacity style={webPickerStyles.cancelBtn} onPress={onClose}>
              <Text style={webPickerStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={webPickerStyles.confirmBtn} onPress={handleConfirm}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={webPickerStyles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const webPickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// Format number safely
const formatNumber = (num) => {
  const value = parseFloat(num) || 0;
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format date for display
const formatDisplayDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Order Card Component
const OrderCard = ({ order, onPress, currency = 'MUR' }) => {
  const statusColor = order.orderStatus === 'CONFIRM'
    ? (colors.accentGreen || '#4CAF50')
    : (colors.accentOrange || '#FF9800');

  // Check if interfaced successfully (hide error messages)
  const isInterfaced = order.fusionInterfaceStatus === 'INTERFACED';

  return (
    <TouchableOpacity style={styles.orderCard} onPress={() => onPress(order)} activeOpacity={0.7}>
      {/* Header Row */}
      <View style={styles.orderHeader}>
        <View style={styles.orderNumberContainer}>
          <Ionicons name="receipt-outline" size={16} color={colors.accent} />
          <Text style={styles.orderNumber}>{order.sourceOrderNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{order.orderStatus}</Text>
        </View>
      </View>

      {/* Customer Row */}
      <View style={styles.customerRow}>
        <View style={styles.customerAvatar}>
          <Text style={styles.customerAvatarText}>
            {(order.accountName || 'W').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>{order.accountName}</Text>
          <Text style={styles.customerAccount}>{order.accountNumber}</Text>
        </View>
      </View>

      {/* Details Row */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.detailText}>{formatDisplayDate(order.orderDate)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.detailText}>{order.orderTime?.substring(0, 5)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
          <Text style={styles.detailText}>{order.orderType}</Text>
        </View>
      </View>

      {/* Bottom Row - Totals */}
      <View style={styles.totalsRow}>
        <View style={styles.totalItemsContainer}>
          <Ionicons name="cube-outline" size={14} color={colors.textMuted} />
          <Text style={styles.totalItemsText}>{order.lineCount} items</Text>
        </View>
        <View style={styles.totalAmountContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{currency} {formatNumber(order.calculatedTotalNet)}</Text>
        </View>
      </View>

      {/* Interface Status - Only show if interfaced successfully */}
      {isInterfaced && (
        <View style={styles.interfaceRow}>
          <Ionicons name="cloud-done-outline" size={12} color={colors.accentGreen} />
          <Text style={[styles.interfaceText, { color: colors.accentGreen }]}>INTERFACED</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Order Detail Modal Component
const OrderDetailModal = ({ visible, order, onClose, currency = 'MUR' }) => {
  const [activeTab, setActiveTab] = useState('details');
  const insets = useSafeAreaInsets();

  if (!order) return null;

  const totalGross = (order.lines || []).reduce((sum, l) => sum + (parseFloat(l.totalGross) || 0), 0);
  const totalDiscount = (order.lines || []).reduce((sum, l) => sum + (parseFloat(l.totalDiscount) || 0), 0);
  const totalTax = (order.lines || []).reduce((sum, l) => sum + (parseFloat(l.totalTax) || 0), 0);
  const totalNet = order.calculatedTotalNet || 0;
  const totalPaid = order.calculatedTotalPaid || 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        {/* Modal Header */}
        <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <Text style={styles.modalSubtitle}>{order.sourceOrderNumber}</Text>
          </View>
          <View style={styles.modalHeaderRight} />
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'details' && styles.tabActive]}
            onPress={() => setActiveTab('details')}
          >
            <Ionicons name="document-text-outline" size={18} color={activeTab === 'details' ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>Invoice</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
            onPress={() => setActiveTab('payments')}
          >
            <Ionicons name="card-outline" size={18} color={activeTab === 'payments' ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>Payments</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'details' ? (
            <>
              {/* Invoice Header Card */}
              <View style={styles.invoiceCard}>
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceCompanyInfo}>
                    <Text style={styles.invoiceCompanyName}>GRAYS INC</Text>
                    <Text style={styles.invoiceLabel}>{order.requestingLegalUnit}</Text>
                  </View>
                  <View style={styles.invoiceTypeContainer}>
                    <Text style={styles.invoiceTypeLabel}>ORDER TYPE</Text>
                    <Text style={styles.invoiceType}>{order.orderType}</Text>
                  </View>
                </View>

                <View style={styles.invoiceDivider} />

                {/* Customer Section */}
                <View style={styles.invoiceSection}>
                  <Text style={styles.invoiceSectionTitle}>BILL TO</Text>
                  <Text style={styles.invoiceCustomerName}>{order.accountName}</Text>
                  <Text style={styles.invoiceCustomerDetail}>Account: {order.accountNumber}</Text>
                </View>

                {/* Order Info Grid */}
                <View style={styles.invoiceGrid}>
                  <View style={styles.invoiceGridItem}>
                    <Text style={styles.invoiceGridLabel}>Order Date</Text>
                    <Text style={styles.invoiceGridValue}>{formatDisplayDate(order.orderDate)}</Text>
                  </View>
                  <View style={styles.invoiceGridItem}>
                    <Text style={styles.invoiceGridLabel}>Order Time</Text>
                    <Text style={styles.invoiceGridValue}>{order.orderTime}</Text>
                  </View>
                  <View style={styles.invoiceGridItem}>
                    <Text style={styles.invoiceGridLabel}>Sales Rep</Text>
                    <Text style={styles.invoiceGridValue}>{order.agentName || order.salesrepNumber}</Text>
                  </View>
                  <View style={styles.invoiceGridItem}>
                    <Text style={styles.invoiceGridLabel}>Location</Text>
                    <Text style={styles.invoiceGridValue}>{order.location}</Text>
                  </View>
                </View>
              </View>

              {/* Line Items */}
              <View style={styles.linesCard}>
                <View style={styles.linesSectionHeader}>
                  <Ionicons name="list-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.linesSectionTitle}>Line Items ({order.lineCount})</Text>
                </View>

                {/* Table Header */}
                <View style={styles.lineTableHeader}>
                  <Text style={[styles.lineTableHeaderText, { flex: 2 }]}>Item</Text>
                  <Text style={[styles.lineTableHeaderText, { flex: 0.5, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.lineTableHeaderText, { flex: 1, textAlign: 'right' }]}>Price</Text>
                  <Text style={[styles.lineTableHeaderText, { flex: 1, textAlign: 'right' }]}>Net</Text>
                </View>

                {(order.lines || []).map((line, index) => (
                  <View key={line.cartDetailsId || index} style={styles.lineRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.lineItemDesc} numberOfLines={2}>{line.itemDesc}</Text>
                      <Text style={styles.lineItemCode}>{line.itemCode}</Text>
                      {line.discountPer > 0 && (
                        <View style={styles.lineDiscountBadge}>
                          <Ionicons name="pricetag" size={10} color={colors.accentGreen} />
                          <Text style={styles.lineDiscountText}>-{line.discountPer}%</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.lineQty, { flex: 0.5 }]}>{line.qty}</Text>
                    <Text style={[styles.linePrice, { flex: 1 }]}>{formatNumber(line.sellingPrice)}</Text>
                    <Text style={[styles.lineNet, { flex: 1 }]}>{formatNumber(line.totalNet || line.net)}</Text>
                  </View>
                ))}

                {/* Totals Section */}
                <View style={styles.invoiceTotalsContainer}>
                  <View style={styles.invoiceTotalRow}>
                    <Text style={styles.invoiceTotalLabel}>Gross Total</Text>
                    <Text style={styles.invoiceTotalValue}>{currency} {formatNumber(totalGross)}</Text>
                  </View>
                  {totalDiscount > 0 && (
                    <View style={styles.invoiceTotalRow}>
                      <Text style={styles.invoiceTotalLabel}>Discount</Text>
                      <Text style={[styles.invoiceTotalValue, { color: colors.accentGreen }]}>
                        -{currency} {formatNumber(totalDiscount)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.invoiceTotalRow}>
                    <Text style={styles.invoiceTotalLabel}>Tax</Text>
                    <Text style={styles.invoiceTotalValue}>{currency} {formatNumber(totalTax)}</Text>
                  </View>
                  <View style={[styles.invoiceTotalRow, styles.invoiceGrandTotalRow]}>
                    <Text style={styles.invoiceGrandTotalLabel}>TOTAL</Text>
                    <Text style={styles.invoiceGrandTotalValue}>{currency} {formatNumber(totalNet)}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            /* Payments Tab */
            <View style={styles.paymentsCard}>
              <View style={styles.linesSectionHeader}>
                <Ionicons name="card-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.linesSectionTitle}>Payment Details</Text>
              </View>

              {(order.payments || []).length === 0 ? (
                <View style={styles.noPaymentsContainer}>
                  <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.noPaymentsText}>No payment records</Text>
                </View>
              ) : (
                <>
                  {(order.payments || []).map((payment, index) => (
                    <View key={index} style={styles.paymentCard}>
                      <View style={styles.paymentIconContainer}>
                        <Ionicons
                          name={payment.paymentMode === 'CASH' ? 'cash-outline' : 'card-outline'}
                          size={24}
                          color={colors.accent}
                        />
                      </View>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentMode}>{payment.paymentMode}</Text>
                        <Text style={styles.paymentLocation}>{payment.locationName}</Text>
                      </View>
                      <View style={styles.paymentAmountContainer}>
                        <Text style={styles.paymentAmountLabel}>Amount</Text>
                        <Text style={styles.paymentAmount}>{currency} {formatNumber(payment.amountPay)}</Text>
                      </View>
                    </View>
                  ))}

                  {/* Payment Summary */}
                  <View style={styles.paymentSummary}>
                    <View style={styles.paymentSummaryRow}>
                      <Text style={styles.paymentSummaryLabel}>Order Total</Text>
                      <Text style={styles.paymentSummaryValue}>{currency} {formatNumber(totalNet)}</Text>
                    </View>
                    <View style={styles.paymentSummaryRow}>
                      <Text style={styles.paymentSummaryLabel}>Total Paid</Text>
                      <Text style={[styles.paymentSummaryValue, { color: colors.accentGreen }]}>
                        {currency} {formatNumber(totalPaid)}
                      </Text>
                    </View>
                    <View style={[styles.paymentSummaryRow, styles.paymentBalanceRow]}>
                      <Text style={styles.paymentBalanceLabel}>Balance</Text>
                      <Text style={[
                        styles.paymentBalanceValue,
                        { color: (totalNet - totalPaid) > 0.01 ? colors.accentRed : colors.accentGreen }
                      ]}>
                        {currency} {formatNumber(Math.abs(totalNet - totalPaid))}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={styles.modalBottomSpacer} />
        </ScrollView>
      </View>
    </Modal>
  );
};

// Analytics Component
const AnalyticsView = ({ orders, currency = 'MUR' }) => {
  // Calculate analytics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.calculatedTotalNet || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalItems = orders.reduce((sum, o) => sum + (o.lineCount || 0), 0);

  // Group by customer
  const customerStats = {};
  orders.forEach(order => {
    const key = order.accountNumber || 'Unknown';
    if (!customerStats[key]) {
      customerStats[key] = { name: order.accountName, count: 0, revenue: 0 };
    }
    customerStats[key].count++;
    customerStats[key].revenue += order.calculatedTotalNet || 0;
  });
  const topCustomers = Object.entries(customerStats)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top Grays Staff (customers with "Grays" in name)
  const graysStaff = Object.entries(customerStats)
    .map(([id, data]) => ({ id, ...data }))
    .filter(c => (c.name || '').toLowerCase().includes('grays'))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Group by order type
  const typeStats = {};
  orders.forEach(order => {
    const type = order.orderType || 'Unknown';
    if (!typeStats[type]) {
      typeStats[type] = { count: 0, revenue: 0 };
    }
    typeStats[type].count++;
    typeStats[type].revenue += order.calculatedTotalNet || 0;
  });

  // Top 20 Products
  const productStats = {};
  orders.forEach(order => {
    (order.lines || []).forEach(line => {
      const key = line.itemCode || 'Unknown';
      if (!productStats[key]) {
        productStats[key] = {
          itemCode: key,
          itemDesc: line.itemDesc,
          qty: 0,
          revenue: 0,
        };
      }
      productStats[key].qty += parseFloat(line.qty) || 0;
      productStats[key].revenue += parseFloat(line.totalNet || line.net) || 0;
    });
  });
  const topProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  // Total by Date
  const dateStats = {};
  orders.forEach(order => {
    const date = order.orderDate || 'Unknown';
    if (!dateStats[date]) {
      dateStats[date] = { count: 0, revenue: 0, items: 0 };
    }
    dateStats[date].count++;
    dateStats[date].revenue += order.calculatedTotalNet || 0;
    dateStats[date].items += order.lineCount || 0;
  });
  const dateStatsArray = Object.entries(dateStats)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending

  return (
    <ScrollView style={styles.analyticsContainer} showsVerticalScrollIndicator={false}>
      {/* Summary Cards */}
      <View style={styles.summaryCardsRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name="receipt" size={24} color={colors.accent} />
          <Text style={styles.summaryCardValue}>{totalOrders}</Text>
          <Text style={styles.summaryCardLabel}>Orders</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: (colors.accentGreen || '#4CAF50') + '15' }]}>
          <Ionicons name="cash" size={24} color={colors.accentGreen || '#4CAF50'} />
          <Text style={styles.summaryCardValue}>{formatNumber(totalRevenue)}</Text>
          <Text style={styles.summaryCardLabel}>Revenue</Text>
        </View>
      </View>
      <View style={styles.summaryCardsRow}>
        <View style={[styles.summaryCard, { backgroundColor: (colors.accentOrange || '#FF9800') + '15' }]}>
          <Ionicons name="trending-up" size={24} color={colors.accentOrange || '#FF9800'} />
          <Text style={styles.summaryCardValue}>{formatNumber(avgOrderValue)}</Text>
          <Text style={styles.summaryCardLabel}>Avg Order</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: (colors.secondary || '#FF6B6B') + '15' }]}>
          <Ionicons name="cube" size={24} color={colors.secondary || '#FF6B6B'} />
          <Text style={styles.summaryCardValue}>{totalItems}</Text>
          <Text style={styles.summaryCardLabel}>Items Sold</Text>
        </View>
      </View>

      {/* Total by Date */}
      {dateStatsArray.length > 0 && (
        <View style={styles.analyticsSection}>
          <View style={styles.analyticsSectionHeader}>
            <Ionicons name="calendar" size={18} color={colors.accent} />
            <Text style={styles.analyticsSectionTitle}>Total by Date</Text>
          </View>
          {dateStatsArray.map((dateItem) => (
            <View key={dateItem.date} style={styles.dateStatRow}>
              <View style={styles.dateStatDate}>
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                <Text style={styles.dateStatDateText}>{formatDisplayDate(dateItem.date)}</Text>
              </View>
              <View style={styles.dateStatDetails}>
                <View style={styles.dateStatItem}>
                  <Text style={styles.dateStatLabel}>Orders</Text>
                  <Text style={styles.dateStatValue}>{dateItem.count}</Text>
                </View>
                <View style={styles.dateStatItem}>
                  <Text style={styles.dateStatLabel}>Items</Text>
                  <Text style={styles.dateStatValue}>{dateItem.items}</Text>
                </View>
                <View style={styles.dateStatItem}>
                  <Text style={styles.dateStatLabel}>Revenue</Text>
                  <Text style={[styles.dateStatValue, styles.dateStatRevenue]}>
                    {currency} {formatNumber(dateItem.revenue)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Top Customers */}
      <View style={styles.analyticsSection}>
        <View style={styles.analyticsSectionHeader}>
          <Ionicons name="people" size={18} color={colors.textPrimary} />
          <Text style={styles.analyticsSectionTitle}>Top Customers</Text>
        </View>
        {topCustomers.map((customer, index) => (
          <View key={customer.id} style={styles.topCustomerRow}>
            <View style={styles.topCustomerRank}>
              <Text style={styles.topCustomerRankText}>{index + 1}</Text>
            </View>
            <View style={styles.topCustomerInfo}>
              <Text style={styles.topCustomerName} numberOfLines={1}>{customer.name}</Text>
              <Text style={styles.topCustomerOrders}>{customer.count} orders</Text>
            </View>
            <Text style={styles.topCustomerRevenue}>{currency} {formatNumber(customer.revenue)}</Text>
          </View>
        ))}
      </View>

      {/* Top Grays Staff */}
      {graysStaff.length > 0 && (
        <View style={styles.analyticsSection}>
          <View style={styles.analyticsSectionHeader}>
            <Ionicons name="business" size={18} color={colors.secondary || '#FF6B6B'} />
            <Text style={styles.analyticsSectionTitle}>Top Grays Staff</Text>
          </View>
          {graysStaff.map((staff, index) => (
            <View key={staff.id} style={styles.topCustomerRow}>
              <View style={[styles.topCustomerRank, { backgroundColor: (colors.secondary || '#FF6B6B') + '20' }]}>
                <Text style={[styles.topCustomerRankText, { color: colors.secondary || '#FF6B6B' }]}>{index + 1}</Text>
              </View>
              <View style={styles.topCustomerInfo}>
                <Text style={styles.topCustomerName} numberOfLines={1}>{staff.name}</Text>
                <Text style={styles.topCustomerOrders}>{staff.count} orders</Text>
              </View>
              <Text style={[styles.topCustomerRevenue, { color: colors.secondary || '#FF6B6B' }]}>
                {currency} {formatNumber(staff.revenue)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Top 20 Products */}
      <View style={styles.analyticsSection}>
        <View style={styles.analyticsSectionHeader}>
          <Ionicons name="cube" size={18} color={colors.accentOrange || '#FF9800'} />
          <Text style={styles.analyticsSectionTitle}>Top 20 Products</Text>
        </View>
        {topProducts.map((product, index) => (
          <View key={product.itemCode} style={styles.productRow}>
            <View style={[styles.topCustomerRank, { backgroundColor: (colors.accentOrange || '#FF9800') + '20' }]}>
              <Text style={[styles.topCustomerRankText, { color: colors.accentOrange || '#FF9800' }]}>{index + 1}</Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{product.itemDesc}</Text>
              <Text style={styles.productCode}>{product.itemCode}</Text>
            </View>
            <View style={styles.productStats}>
              <Text style={styles.productQty}>{product.qty} sold</Text>
              <Text style={styles.productRevenue}>{currency} {formatNumber(product.revenue)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Order Types */}
      <View style={styles.analyticsSection}>
        <View style={styles.analyticsSectionHeader}>
          <Ionicons name="pricetags" size={18} color={colors.textPrimary} />
          <Text style={styles.analyticsSectionTitle}>By Order Type</Text>
        </View>
        {Object.entries(typeStats).map(([type, data]) => (
          <View key={type} style={styles.typeStatRow}>
            <View style={styles.typeStatInfo}>
              <Text style={styles.typeStatName}>{type}</Text>
              <View style={styles.typeStatBar}>
                <View
                  style={[
                    styles.typeStatBarFill,
                    { width: `${(data.revenue / totalRevenue) * 100}%` }
                  ]}
                />
              </View>
            </View>
            <View style={styles.typeStatValues}>
              <Text style={styles.typeStatCount}>{data.count}</Text>
              <Text style={styles.typeStatRevenue}>{currency} {formatNumber(data.revenue)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

// Main Screen Component
const HistoryOrdersScreen = ({ navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('orders');
  const [hasSearched, setHasSearched] = useState(false);

  // Animated values for loading
  const spinValue = useRef(new Animated.Value(0)).current;

  const salesrepNumber = user?.username || user?.salesrepNumber || '';

  // Spinning animation for loading
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [loading]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const result = await queryHistoricalOrders({
        fromDate,
        toDate,
        salesrepNumber,
      });

      if (result.success) {
        setOrders(result.orders);
        setHasSearched(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to fetch orders');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleSearch = () => {
    fetchOrders();
  };

  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const handleFromDateChange = (event, selectedDate) => {
    setShowFromPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFromDate(selectedDate);
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    setShowToPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setToDate(selectedDate);
    }
  };

  // Navigate to Story screen with order data
  const handleStory = () => {
    if (orders.length === 0) {
      Alert.alert('No Data', 'Please search for orders first to view the story.');
      return;
    }

    // Group orders by date and sort by time
    const ordersByDate = {};
    orders.forEach(order => {
      const date = order.orderDate || 'Unknown';
      if (!ordersByDate[date]) {
        ordersByDate[date] = [];
      }
      ordersByDate[date].push(order);
    });

    // Sort each date's orders by time
    Object.keys(ordersByDate).forEach(date => {
      ordersByDate[date].sort((a, b) => {
        const timeA = a.orderTime || '00:00:00';
        const timeB = b.orderTime || '00:00:00';
        return timeA.localeCompare(timeB);
      });
    });

    // Prepare story data
    const storyData = {
      title: 'Order History Story',
      subtitle: `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`,
      ordersByDate,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + (o.calculatedTotalNet || 0), 0),
      salesrepNumber,
    };

    navigation.navigate('Story', { storyData, storyType: 'orders' });
  };

  // Filter orders locally based on filter query
  const filteredOrders = orders.filter(order => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    return (
      (order.sourceOrderNumber || '').toLowerCase().includes(query) ||
      (order.accountName || '').toLowerCase().includes(query) ||
      (order.accountNumber || '').toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order History</Text>
          <Text style={styles.headerSubtitle}>{salesrepNumber}</Text>
        </View>
        <TouchableOpacity onPress={handleStory} style={styles.storyButton}>
          <Ionicons name="play-circle-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Main Tabs */}
      <View style={styles.mainTabsContainer}>
        <TouchableOpacity
          style={[styles.mainTab, activeMainTab === 'orders' && styles.mainTabActive]}
          onPress={() => setActiveMainTab('orders')}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={activeMainTab === 'orders' ? colors.accent : colors.textMuted}
          />
          <Text style={[styles.mainTabText, activeMainTab === 'orders' && styles.mainTabTextActive]}>
            All Orders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, activeMainTab === 'analytics' && styles.mainTabActive]}
          onPress={() => setActiveMainTab('analytics')}
        >
          <Ionicons
            name="analytics-outline"
            size={18}
            color={activeMainTab === 'analytics' ? colors.accent : colors.textMuted}
          />
          <Text style={[styles.mainTabText, activeMainTab === 'analytics' && styles.mainTabTextActive]}>
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {activeMainTab === 'orders' ? (
        <>
          {/* Search Section - Date and Search Button */}
          <View style={styles.searchSection}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFromPicker(true)}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={styles.dateButtonText}>{formatDisplayDate(fromDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.dateSeparator}>to</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowToPicker(true)}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={styles.dateButtonText}>{formatDisplayDate(toDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="sync" size={20} color="#FFFFFF" />
                </Animated.View>
              ) : (
                <Ionicons name="search" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Filter Section */}
          <View style={styles.filterSection}>
            <View style={styles.filterInputContainer}>
              <Ionicons name="filter-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.filterInput}
                placeholder="Filter by order #, customer..."
                placeholderTextColor={colors.textMuted}
                value={filterQuery}
                onChangeText={setFilterQuery}
              />
              {filterQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFilterQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Results Info */}
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsText}>
              {loading ? 'Searching...' : `${filteredOrders.length} orders found`}
            </Text>
          </View>

          {/* Orders List or Loading */}
          {loading && orders.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="sync" size={48} color={colors.accent} />
              </Animated.View>
              <Text style={styles.loadingText}>Fetching orders...</Text>
              <Text style={styles.loadingSubtext}>Please wait</Text>
            </View>
          ) : !hasSearched ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Search Orders</Text>
              <Text style={styles.emptyText}>
                Select date range and tap search to fetch orders
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.sourceOrderNumber || String(Math.random())}
              renderItem={({ item }) => (
                <OrderCard order={item} onPress={handleOrderPress} />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Orders Found</Text>
                  <Text style={styles.emptyText}>
                    Try adjusting your date range or filter
                  </Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        /* Analytics Tab */
        <AnalyticsView orders={orders} />
      )}

      {/* Date Pickers - Platform specific */}
      {Platform.OS === 'web' ? (
        <>
          <WebDatePickerModal
            visible={showFromPicker}
            value={fromDate}
            title="Select From Date"
            onClose={() => setShowFromPicker(false)}
            onSelect={(date) => setFromDate(date)}
          />
          <WebDatePickerModal
            visible={showToPicker}
            value={toDate}
            title="Select To Date"
            onClose={() => setShowToPicker(false)}
            onSelect={(date) => setToDate(date)}
          />
        </>
      ) : (
        <>
          {showFromPicker && DateTimePicker && (
            <DateTimePicker
              value={fromDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleFromDateChange}
            />
          )}
          {showToPicker && DateTimePicker && (
            <DateTimePicker
              value={toDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleToDateChange}
            />
          )}
        </>
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal
        visible={showDetailModal}
        order={selectedOrder}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedOrder(null);
        }}
      />

      {/* Bottom Toolbar */}
      <BottomToolbar activeTab="Orders" />
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  storyButton: {
    padding: 8,
  },
  // Main Tabs
  mainTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  mainTabActive: {
    backgroundColor: colors.accent + '15',
  },
  mainTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  mainTabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  // Search Section
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  dateButtonText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dateSeparator: {
    color: colors.textMuted,
    fontSize: 12,
  },
  searchButton: {
    backgroundColor: colors.accent,
    padding: 12,
    borderRadius: 8,
  },
  // Filter Section
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  filterInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  resultsInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  resultsText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Order Card
  orderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  customerAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.accent,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  customerAccount: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalItemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalItemsText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  totalAmountContainer: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
  },
  interfaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  interfaceText: {
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  // List
  listContent: {
    paddingVertical: 6,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  modalHeaderRight: {
    width: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.accent + '15',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalBottomSpacer: {
    height: 40,
  },
  // Invoice Card
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceCompanyInfo: {},
  invoiceCompanyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  invoiceLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  invoiceTypeContainer: {
    alignItems: 'flex-end',
  },
  invoiceTypeLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  invoiceType: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 2,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  invoiceSection: {
    marginBottom: 12,
  },
  invoiceSectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  invoiceCustomerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  invoiceCustomerDetail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  invoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  invoiceGridItem: {
    width: '50%',
    paddingVertical: 8,
  },
  invoiceGridLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  invoiceGridValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 2,
  },
  // Lines Card
  linesCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  linesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  linesSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lineTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineTableHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  lineItemDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  lineItemCode: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  lineDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  lineDiscountText: {
    fontSize: 10,
    color: colors.accentGreen,
    fontWeight: '500',
  },
  lineQty: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  linePrice: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  lineNet: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  // Invoice Totals
  invoiceTotalsContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  invoiceTotalLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  invoiceTotalValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  invoiceGrandTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  invoiceGrandTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  invoiceGrandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
  },
  // Payments Card
  paymentsCard: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  noPaymentsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPaymentsText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  paymentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMode: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  paymentLocation: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentAmountContainer: {
    alignItems: 'flex-end',
  },
  paymentAmountLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.accent,
  },
  paymentSummary: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  paymentSummaryLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  paymentSummaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  paymentBalanceRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentBalanceLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  paymentBalanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Analytics Styles
  analyticsContainer: {
    flex: 1,
    padding: 12,
  },
  summaryCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 8,
  },
  summaryCardLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  analyticsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  analyticsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  analyticsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  topCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  topCustomerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topCustomerRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.accent,
  },
  topCustomerInfo: {
    flex: 1,
  },
  topCustomerName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  topCustomerOrders: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  topCustomerRevenue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  // Product rows
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  productInfo: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  productCode: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  productStats: {
    alignItems: 'flex-end',
  },
  productQty: {
    fontSize: 11,
    color: colors.textMuted,
  },
  productRevenue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentOrange || '#FF9800',
  },
  typeStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  typeStatInfo: {
    flex: 1,
    marginRight: 12,
  },
  typeStatName: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  typeStatBar: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  typeStatBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  typeStatValues: {
    alignItems: 'flex-end',
  },
  typeStatCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  typeStatRevenue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 2,
  },
  // Date Stats styles
  dateStatRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  dateStatDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  dateStatDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateStatDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  dateStatLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateStatRevenue: {
    color: colors.accent,
  },
});

export default HistoryOrdersScreen;
