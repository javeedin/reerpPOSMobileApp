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

const LineItem = ({ item, index, currency }) => (
  <View style={styles.lineItem}>
    <View style={styles.lineNumber}>
      <Text style={styles.lineNumberText}>{index + 1}</Text>
    </View>
    <View style={styles.lineInfo}>
      <Text style={styles.lineName} numberOfLines={1}>{item.itemDesc || item.itemNumber}</Text>
      <Text style={styles.lineCode}>{item.itemNumber}</Text>
    </View>
    <View style={styles.lineQty}>
      <Text style={styles.lineQtyValue}>{item.quantity}</Text>
      <Text style={styles.lineQtyLabel}>{item.uom || 'EA'}</Text>
    </View>
    <View style={styles.linePrice}>
      <Text style={styles.linePriceValue}>{(item.unitPrice || 0).toFixed(2)}</Text>
    </View>
    <View style={styles.lineTotal}>
      <Text style={styles.lineTotalValue}>{(item.lineTotal || 0).toFixed(2)}</Text>
    </View>
  </View>
);

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

        {/* Grand Total Card */}
        <View style={styles.grandTotalCard}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Amount</Text>
            <Text style={styles.grandTotalValue}>
              {currency} {(totals.totalNet || 0).toFixed(2)}
            </Text>
          </View>
          {totals.totalDiscount > 0 && (
            <View style={styles.grandTotalSubRow}>
              <Text style={styles.subLabel}>Discount</Text>
              <Text style={styles.subValue}>-{totals.totalDiscount.toFixed(2)}</Text>
            </View>
          )}
          {totals.totalTax > 0 && (
            <View style={styles.grandTotalSubRow}>
              <Text style={styles.subLabel}>Tax (15%)</Text>
              <Text style={styles.subValue}>{totals.totalTax.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cube-outline" size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Order Items</Text>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.lineNumber}><Text style={styles.tableHeaderText}>#</Text></View>
            <View style={styles.lineInfo}><Text style={styles.tableHeaderText}>Item</Text></View>
            <View style={styles.lineQty}><Text style={styles.tableHeaderText}>Qty</Text></View>
            <View style={styles.linePrice}><Text style={styles.tableHeaderText}>Price</Text></View>
            <View style={styles.lineTotal}><Text style={styles.tableHeaderText}>Total</Text></View>
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

      {/* Actions for Draft Orders */}
      {order.status === ORDER_STATUS.DRAFT && (
        <View style={styles.actionBar}>
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
  grandTotalCard: {
    backgroundColor: colors.accent,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  grandTotalSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  subLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  subValue: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  lineItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    alignItems: 'center',
  },
  lineNumber: {
    width: 24,
  },
  lineNumberText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  lineInfo: {
    flex: 2,
    paddingRight: 8,
  },
  lineName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  lineCode: {
    fontSize: 10,
    color: colors.textMuted,
  },
  lineQty: {
    width: 40,
    alignItems: 'center',
  },
  lineQtyValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lineQtyLabel: {
    fontSize: 9,
    color: colors.textMuted,
  },
  linePrice: {
    width: 55,
    alignItems: 'flex-end',
  },
  linePriceValue: {
    fontSize: 12,
    color: colors.textMuted,
  },
  lineTotal: {
    width: 60,
    alignItems: 'flex-end',
  },
  lineTotalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
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
