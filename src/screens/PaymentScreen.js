import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { createOrder, confirmOrder, ORDER_STATUS, PAYMENT_METHODS } from '../services/orderService';
import { useAuth } from '../context/AuthContext';

const PaymentMethodButton = ({ method, icon, label, isSelected, onSelect }) => (
  <TouchableOpacity
    style={[styles.methodBtn, isSelected && styles.methodBtnSelected]}
    onPress={() => onSelect(method)}
  >
    <View style={[styles.methodIcon, isSelected && styles.methodIconSelected]}>
      <Ionicons name={icon} size={24} color={isSelected ? '#FFFFFF' : colors.accent} />
    </View>
    <Text style={[styles.methodLabel, isSelected && styles.methodLabelSelected]}>{label}</Text>
    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />}
  </TouchableOpacity>
);

const PaymentEntry = ({ payment, index, onRemove, onAmountChange, currency }) => (
  <View style={styles.paymentEntry}>
    <View style={styles.paymentEntryInfo}>
      <Text style={styles.paymentEntryMethod}>{payment.method}</Text>
      {payment.reference && (
        <Text style={styles.paymentEntryRef}>Ref: {payment.reference}</Text>
      )}
    </View>
    <TextInput
      style={styles.paymentAmountInput}
      value={payment.amount?.toFixed(2) || ''}
      onChangeText={(val) => onAmountChange(index, Math.round((parseFloat(val) || 0) * 100) / 100)}
      keyboardType="numeric"
      placeholder="0.00"
    />
    <TouchableOpacity style={styles.removePaymentBtn} onPress={() => onRemove(index)}>
      <Ionicons name="close-circle" size={22} color={colors.accentRed || '#E53935'} />
    </TouchableOpacity>
  </View>
);

const PaymentScreen = ({ navigation, route }) => {
  const { menuConfig, customer, cart, totals, notes, currency } = route.params || {};
  const { user } = useAuth();

  const [payments, setPayments] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = totals.totalNet - totalPaid;
  const change = totalPaid > totals.totalNet ? totalPaid - totals.totalNet : 0;

  const paymentMethods = [
    { method: PAYMENT_METHODS.CASH, icon: 'cash-outline', label: 'Cash' },
    { method: PAYMENT_METHODS.CARD, icon: 'card-outline', label: 'Card' },
    { method: PAYMENT_METHODS.VOUCHER, icon: 'ticket-outline', label: 'Voucher' },
    { method: PAYMENT_METHODS.BANK_TRANSFER, icon: 'swap-horizontal-outline', label: 'Bank Transfer' },
  ];

  if (menuConfig?.creditSales) {
    paymentMethods.push({ method: PAYMENT_METHODS.CREDIT, icon: 'time-outline', label: 'Credit' });
  }

  const handleAddPayment = () => {
    if (!selectedMethod) {
      Alert.alert('Select Method', 'Please select a payment method');
      return;
    }

    // Round amount to 2 decimal places
    const amount = Math.round((parseFloat(paymentAmount) || remaining) * 100) / 100;
    if (amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    const newPayment = {
      method: selectedMethod,
      amount,
      reference: paymentReference,
      timestamp: new Date().toISOString(),
    };

    setPayments([...payments, newPayment]);
    setSelectedMethod(null);
    setPaymentAmount('');
    setPaymentReference('');
    setShowAddPayment(false);
  };

  const handleRemovePayment = (index) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleAmountChange = (index, amount) => {
    const newPayments = [...payments];
    // Round to 2 decimal places
    newPayments[index].amount = Math.round(amount * 100) / 100;
    setPayments(newPayments);
  };

  const handleQuickCash = () => {
    // Quick add exact cash payment
    setPayments([{
      method: PAYMENT_METHODS.CASH,
      amount: totals.totalNet,
      reference: '',
      timestamp: new Date().toISOString(),
    }]);
  };

  const handleConfirmOrder = async () => {
    if (totalPaid < totals.totalNet) {
      Alert.alert(
        'Insufficient Payment',
        `Total paid (${currency} ${totalPaid.toFixed(2)}) is less than order total (${currency} ${totals.totalNet.toFixed(2)})`
      );
      return;
    }

    setProcessing(true);
    try {
      const userPrefix = user?.username?.substring(0, 3) || user?.name?.substring(0, 3) || 'USR';

      // Create and confirm order
      const result = await createOrder({
        customer,
        menuConfig,
        lines: cart,
        status: ORDER_STATUS.CONFIRMED,
        payments,
        notes,
      }, userPrefix);

      if (result.success) {
        setConfirmedOrder(result.order);
        setShowSuccess(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm order');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDone = () => {
    navigation.navigate('Home');
  };

  const handleNewOrder = () => {
    navigation.navigate('Home');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Payment</Text>
          <Text style={styles.headerSubtitle}>{customer?.name || 'Walk-in Customer'}</Text>
        </View>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Total Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Order Total</Text>
          <Text style={styles.totalValue}>{currency} {totals.totalNet.toFixed(2)}</Text>
          <View style={styles.totalDetails}>
            <Text style={styles.totalDetailText}>{totals.totalItems} items</Text>
            {totals.totalTax > 0 && (
              <Text style={styles.totalDetailText}>Tax: {totals.totalTax.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* Quick Cash Button */}
        {payments.length === 0 && (
          <TouchableOpacity style={styles.quickCashBtn} onPress={handleQuickCash}>
            <Ionicons name="flash" size={20} color={colors.secondary} />
            <Text style={styles.quickCashText}>Quick Cash - Exact Amount</Text>
          </TouchableOpacity>
        )}

        {/* Added Payments */}
        {payments.length > 0 && (
          <View style={styles.paymentsSection}>
            <Text style={styles.sectionTitle}>Payments Added</Text>
            {payments.map((payment, index) => (
              <PaymentEntry
                key={`payment-${index}`}
                payment={payment}
                index={index}
                onRemove={handleRemovePayment}
                onAmountChange={handleAmountChange}
                currency={currency}
              />
            ))}
          </View>
        )}

        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>{currency} {totalPaid.toFixed(2)}</Text>
          </View>
          {remaining > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.accentRed || '#E53935' }]}>Remaining</Text>
              <Text style={[styles.summaryValue, { color: colors.accentRed || '#E53935' }]}>
                {currency} {remaining.toFixed(2)}
              </Text>
            </View>
          )}
          {change > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.accentGreen }]}>Change</Text>
              <Text style={[styles.summaryValue, { color: colors.accentGreen }]}>
                {currency} {change.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Add Payment Button */}
        <TouchableOpacity style={styles.addPaymentBtn} onPress={() => setShowAddPayment(true)}>
          <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
          <Text style={styles.addPaymentText}>Add Payment Method</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.confirmBtn, (processing || totalPaid < totals.totalNet) && styles.confirmBtnDisabled]}
          onPress={handleConfirmOrder}
          disabled={processing || totalPaid < totals.totalNet}
        >
          <Text style={styles.confirmBtnText}>
            {processing ? 'Processing...' : 'Confirm Order'}
          </Text>
          <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Add Payment Modal */}
      <Modal
        visible={showAddPayment}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPayment(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <TouchableOpacity onPress={() => setShowAddPayment(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionLabel}>Payment Method</Text>
            <View style={styles.methodsGrid}>
              {paymentMethods.map((pm) => (
                <PaymentMethodButton
                  key={pm.method}
                  method={pm.method}
                  icon={pm.icon}
                  label={pm.label}
                  isSelected={selectedMethod === pm.method}
                  onSelect={setSelectedMethod}
                />
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencyLabel}>{currency}</Text>
              <TextInput
                style={styles.amountInput}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="numeric"
                placeholder={remaining.toFixed(2)}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {(selectedMethod === PAYMENT_METHODS.CARD || selectedMethod === PAYMENT_METHODS.VOUCHER || selectedMethod === PAYMENT_METHODS.BANK_TRANSFER) && (
              <>
                <Text style={styles.modalSectionLabel}>Reference (Optional)</Text>
                <TextInput
                  style={styles.referenceInput}
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  placeholder="Transaction reference..."
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}

            <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddPayment}>
              <Text style={styles.modalAddBtnText}>Add Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccess}
        animationType="fade"
        transparent={true}
        onRequestClose={handleDone}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color={colors.accentGreen} />
            </View>
            <Text style={styles.successTitle}>Order Confirmed!</Text>
            <Text style={styles.successOrderNumber}>{confirmedOrder?.orderNumber}</Text>
            <Text style={styles.successAmount}>
              {currency} {confirmedOrder?.totals?.totalNet?.toFixed(2)}
            </Text>
            {change > 0 && (
              <View style={styles.changeBox}>
                <Text style={styles.changeLabel}>Change Due</Text>
                <Text style={styles.changeValue}>{currency} {change.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.successActions}>
              <TouchableOpacity style={styles.newOrderBtn} onPress={handleNewOrder}>
                <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                <Text style={styles.newOrderBtnText}>New Order</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  totalCard: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  totalValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  totalDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  totalDetailText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  quickCashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary + '20',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  quickCashText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  paymentsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  paymentEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  paymentEntryInfo: {
    flex: 1,
  },
  paymentEntryMethod: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  paymentEntryRef: {
    fontSize: 11,
    color: colors.textMuted,
  },
  paymentAmountInput: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    width: 80,
    textAlign: 'right',
    paddingVertical: 4,
  },
  removePaymentBtn: {
    marginLeft: 10,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  addPaymentText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 100,
  },
  actionBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGreen,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 10,
    marginTop: 12,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    minWidth: '45%',
    flex: 1,
  },
  methodBtnSelected: {
    backgroundColor: colors.accent + '15',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodIconSelected: {
    backgroundColor: colors.accent,
  },
  methodLabel: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  methodLabelSelected: {
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
  },
  currencyLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  referenceInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalAddBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  modalAddBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  successOrderNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 4,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  changeBox: {
    backgroundColor: colors.accentGreen + '15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  changeLabel: {
    fontSize: 12,
    color: colors.accentGreen,
  },
  changeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.accentGreen,
  },
  successActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  newOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  newOrderBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PaymentScreen;
