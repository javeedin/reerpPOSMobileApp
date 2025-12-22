import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { ORDER_STATUS, PAYMENT_METHODS, updateOrder, deleteOrder } from '../services/orderService';

const getStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case ORDER_STATUS.CONFIRMED:
    case 'PAID':
      return colors.accentGreen;
    case ORDER_STATUS.DRAFT:
      return colors.accentOrange;
    case ORDER_STATUS.CANCELLED:
      return colors.error || '#E74C3C';
    default:
      return colors.textMuted;
  }
};

const getPaymentIcon = (method) => {
  switch (method) {
    case PAYMENT_METHODS.CASH:
      return 'cash-outline';
    case PAYMENT_METHODS.CARD:
      return 'card-outline';
    case PAYMENT_METHODS.VOUCHER:
      return 'ticket-outline';
    case PAYMENT_METHODS.BANK_TRANSFER:
      return 'swap-horizontal-outline';
    case PAYMENT_METHODS.CREDIT:
      return 'time-outline';
    default:
      return 'wallet-outline';
  }
};

const InfoRow = ({ label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
  </View>
);

const LineItem = ({ item, index, currency }) => {
  // Calculate line values
  const qty = item.quantity || 1;
  const unitPrice = item.unitPrice || item.basePrice || 0;
  const gross = qty * unitPrice;
  const discountPercent = item.discountPercent || 0;
  const discountAmount = gross * (discountPercent / 100);
  const afterDiscount = gross - discountAmount;
  const taxRate = parseFloat(item.tax_rate) || 0;
  const taxAmount = afterDiscount * (taxRate / 100);
  const net = item.lineTotal || (afterDiscount + taxAmount);

  return (
    <View style={styles.lineItemContainer}>
      {/* Item Description Row */}
      <View style={styles.lineItemHeader}>
        <View style={styles.lineNumber}>
          <Text style={styles.lineNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.lineInfoFull}>
          <Text style={styles.lineName}>{item.itemDesc || item.itemNumber}</Text>
          <Text style={styles.lineCode}>{item.itemNumber} • Qty: {qty} × {unitPrice.toFixed(2)}</Text>
        </View>
      </View>

      {/* Values Row - Gross, Discount, Tax, Net */}
      <View style={styles.lineValuesRow}>
        <View style={styles.lineValueCol}>
          <Text style={styles.lineValueLabel}>Gross</Text>
          <Text style={styles.lineValueAmount}>{gross.toFixed(2)}</Text>
        </View>
        <View style={styles.lineValueCol}>
          <Text style={styles.lineValueLabel}>Disc</Text>
          <Text style={[styles.lineValueAmount, discountAmount > 0 && styles.discountText]}>
            {discountAmount > 0 ? `-${discountAmount.toFixed(2)}` : '0.00'}
          </Text>
        </View>
        <View style={styles.lineValueCol}>
          <Text style={styles.lineValueLabel}>Tax</Text>
          <Text style={styles.lineValueAmount}>{taxAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.lineValueColNet}>
          <Text style={styles.lineValueLabel}>Net</Text>
          <Text style={styles.lineNetValue}>{net.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
};

const PaymentRow = ({ payment, currency }) => (
  <View style={styles.paymentRow}>
    <View style={styles.paymentLeft}>
      <Ionicons name={getPaymentIcon(payment.method)} size={20} color={colors.accent} />
      <Text style={styles.paymentMethod}>{payment.method}</Text>
    </View>
    <Text style={styles.paymentAmount}>{currency} {(payment.amount || 0).toFixed(2)}</Text>
  </View>
);

const OrderDetailScreen = ({ navigation, route }) => {
  const { order } = route.params || {};
  const [showActions, setShowActions] = useState(false);
  const insets = useSafeAreaInsets();

  if (!order) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.placeholder} />
        </LinearGradient>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const currency = order.currency || 'MUR';
  const totals = order.totals || {};
  const formattedDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'N/A';

  const handleEditDraft = () => {
    if (order.status !== ORDER_STATUS.DRAFT) {
      Alert.alert('Cannot Edit', 'Only draft orders can be edited.');
      return;
    }
    // Navigate to ItemSelection with existing cart data
    navigation.navigate('ItemSelection', {
      menuConfig: order.menuConfig || {},
      customer: order.customer || { name: order.customerName, accountNumber: order.customerAccount },
      existingCart: order.lines || [],
      editingOrderId: order.id,
    });
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order ${order.orderNumber}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateOrder(order.id, { status: ORDER_STATUS.CANCELLED });
              Alert.alert('Order Cancelled', 'The order has been cancelled.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteOrder = () => {
    if (order.status !== ORDER_STATUS.DRAFT) {
      Alert.alert('Cannot Delete', 'Only draft orders can be deleted.');
      return;
    }
    Alert.alert(
      'Delete Order',
      `Are you sure you want to delete order ${order.orderNumber}? This cannot be undone.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrder(order.id);
              Alert.alert('Order Deleted', 'The order has been deleted.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>{order.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '30' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={() => setShowActions(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>
          <InfoRow label="Date" value={`${formattedDate} ${order.orderTime || ''}`} />
          <InfoRow label="Customer" value={order.customerName || 'Walk-in Customer'} />
          {order.customerAccount && (
            <InfoRow label="Account" value={order.customerAccount} />
          )}
          {order.menuConfig?.name && (
            <InfoRow label="Order Type" value={order.menuConfig.name} />
          )}
          <InfoRow label="Items" value={totals.totalItems?.toString() || '0'} />
        </View>

        {/* Invoice-Style Totals */}
        <View style={styles.invoiceTotalsCard}>
          <View style={styles.invoiceTotalsHeader}>
            <Ionicons name="calculator-outline" size={18} color={colors.accent} />
            <Text style={styles.invoiceTotalsTitle}>Order Totals</Text>
          </View>

          <View style={styles.invoiceTotalsBody}>
            {/* Gross */}
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Gross Amount</Text>
              <Text style={styles.invoiceValue}>{currency} {(totals.totalGross || 0).toFixed(2)}</Text>
            </View>

            {/* Discount */}
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Discount</Text>
              <Text style={[styles.invoiceValue, styles.discountValue]}>
                {(totals.totalDiscount || 0) > 0 ? '-' : ''}{currency} {(totals.totalDiscount || 0).toFixed(2)}
              </Text>
            </View>

            {/* Subtotal after discount */}
            <View style={styles.invoiceRowSubtotal}>
              <Text style={styles.invoiceLabelSubtotal}>Subtotal</Text>
              <Text style={styles.invoiceValueSubtotal}>
                {currency} {((totals.totalGross || 0) - (totals.totalDiscount || 0)).toFixed(2)}
              </Text>
            </View>

            {/* Tax */}
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Tax (VAT)</Text>
              <Text style={styles.invoiceValue}>{currency} {(totals.totalTax || 0).toFixed(2)}</Text>
            </View>

            {/* Divider */}
            <View style={styles.invoiceDivider} />

            {/* Net Total */}
            <View style={styles.invoiceRowNet}>
              <Text style={styles.invoiceLabelNet}>NET TOTAL</Text>
              <Text style={styles.invoiceValueNet}>{currency} {(totals.totalNet || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cube-outline" size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Order Items ({(order.lines || []).length})</Text>
          </View>

          {(order.lines || []).map((item, index) => (
            <LineItem key={`line-${index}`} item={item} index={index} currency={currency} />
          ))}
        </View>

        {/* Payments */}
        {order.payments && order.payments.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="wallet-outline" size={20} color={colors.accent} />
              <Text style={styles.cardTitle}>Payments</Text>
            </View>
            {order.payments.map((payment, index) => (
              <PaymentRow key={`payment-${index}`} payment={payment} currency={currency} />
            ))}
            <View style={styles.paymentTotalRow}>
              <Text style={styles.paymentTotalLabel}>Total Paid</Text>
              <Text style={styles.paymentTotalValue}>
                {currency} {order.payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {order.notes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={colors.accent} />
              <Text style={styles.cardTitle}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Actions for Draft Orders - with safe area padding */}
      {order.status === ORDER_STATUS.DRAFT && (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <TouchableOpacity style={styles.editBtn} onPress={handleEditDraft}>
            <Ionicons name="create-outline" size={20} color={colors.accent} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.continueBtn} onPress={handleEditDraft}>
            <Text style={styles.continueBtnText}>Continue Order</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Actions Modal */}
      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        >
          <View style={styles.actionsMenu}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setShowActions(false);
                // Print functionality placeholder
                Alert.alert('Print', 'Print functionality coming soon');
              }}
            >
              <Ionicons name="print-outline" size={22} color={colors.textPrimary} />
              <Text style={styles.actionText}>Print Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setShowActions(false);
                // Share functionality placeholder
                Alert.alert('Share', 'Share functionality coming soon');
              }}
            >
              <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>

            {order.status === ORDER_STATUS.DRAFT && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  setShowActions(false);
                  handleDeleteOrder();
                }}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error || '#E74C3C'} />
                <Text style={[styles.actionText, { color: colors.error || '#E74C3C' }]}>Delete</Text>
              </TouchableOpacity>
            )}

            {order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.DRAFT && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  setShowActions(false);
                  handleCancelOrder();
                }}
              >
                <Ionicons name="close-circle-outline" size={22} color={colors.error || '#E74C3C'} />
                <Text style={[styles.actionText, { color: colors.error || '#E74C3C' }]}>Cancel Order</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  // Invoice-Style Totals
  invoiceTotalsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  invoiceTotalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceTotalsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  invoiceTotalsBody: {
    padding: 14,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  invoiceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  invoiceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  discountValue: {
    color: colors.secondary || '#FF6B6B',
  },
  invoiceRowSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  invoiceLabelSubtotal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  invoiceValueSubtotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  invoiceDivider: {
    height: 2,
    backgroundColor: colors.accent,
    marginVertical: 12,
    borderRadius: 1,
  },
  invoiceRowNet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  invoiceLabelNet: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  invoiceValueNet: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
  },
  // Line Item Card Styles
  lineItemContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  lineItemHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  lineNumber: {
    width: 24,
    height: 24,
    backgroundColor: colors.accent + '20',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lineNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  lineInfoFull: {
    flex: 1,
  },
  lineName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  lineCode: {
    fontSize: 11,
    color: colors.textMuted,
  },
  lineValuesRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
  },
  lineValueCol: {
    flex: 1,
    alignItems: 'center',
  },
  lineValueColNet: {
    flex: 1,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 8,
  },
  lineValueLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  lineValueAmount: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  lineNetValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  discountText: {
    color: colors.secondary || '#FF6B6B',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentMethod: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  paymentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  paymentTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accentGreen,
  },
  notesText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 100,
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  editBtn: {
    flex: 0.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  editBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  continueBtn: {
    flex: 0.65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  actionsMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
});

export default OrderDetailScreen;
