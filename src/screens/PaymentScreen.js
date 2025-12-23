import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { createOrder, ORDER_STATUS } from '../services/orderService';
import { useAuth } from '../context/AuthContext';
import { getPaymentMethods } from '../services/syncService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti colors
const CONFETTI_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

// Single confetti piece component
const ConfettiPiece = ({ delay, startX }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  const size = 8 + Math.random() * 8;
  const isCircle = Math.random() > 0.5;

  useEffect(() => {
    const horizontalMovement = (Math.random() - 0.5) * 100;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + 100,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: horizontalMovement,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 5 + Math.random() * 5,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 3000,
          delay: 1500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: -20,
        left: startX,
        width: size,
        height: isCircle ? size : size * 0.6,
        backgroundColor: color,
        borderRadius: isCircle ? size / 2 : 2,
        opacity,
        transform: [
          { translateY },
          { translateX },
          { rotate: rotateInterpolate },
        ],
      }}
    />
  );
};

// Confetti burst component
const ConfettiBurst = ({ active }) => {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (active) {
      const newPieces = [];
      for (let i = 0; i < 50; i++) {
        newPieces.push({
          id: i,
          delay: Math.random() * 500,
          startX: Math.random() * SCREEN_WIDTH,
        });
      }
      setPieces(newPieces);
    } else {
      setPieces([]);
    }
  }, [active]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => (
        <ConfettiPiece key={piece.id} delay={piece.delay} startX={piece.startX} />
      ))}
    </View>
  );
};

// Map payment mode to icon
const getPaymentIcon = (paymentMode) => {
  const modeUpper = (paymentMode || '').toUpperCase();
  if (modeUpper.includes('CASH')) return 'cash-outline';
  if (modeUpper.includes('CARD') || modeUpper.includes('CREDIT')) return 'card-outline';
  if (modeUpper.includes('VOUCHER') || modeUpper.includes('GIFT')) return 'ticket-outline';
  if (modeUpper.includes('BANK') || modeUpper.includes('TRANSFER')) return 'swap-horizontal-outline';
  if (modeUpper.includes('CHEQUE') || modeUpper.includes('CHECK')) return 'document-text-outline';
  if (modeUpper.includes('MOBILE') || modeUpper.includes('WALLET')) return 'phone-portrait-outline';
  return 'wallet-outline';
};

// Payment Method Card with inline editing
const PaymentMethodCard = ({
  method,
  icon,
  label,
  referenceRequired,
  receiptMethodId,
  isEnabled,
  amount,
  reference,
  onToggle,
  onAmountChange,
  onReferenceChange,
  suggestedAmount,
  currency,
}) => {
  return (
    <View style={[styles.methodCard, isEnabled && styles.methodCardEnabled]}>
      <TouchableOpacity
        style={styles.methodCardHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={[styles.methodIconSmall, isEnabled && styles.methodIconEnabled]}>
          <Ionicons name={icon} size={18} color={isEnabled ? '#FFFFFF' : colors.accent} />
        </View>
        <Text style={[styles.methodCardLabel, isEnabled && styles.methodCardLabelEnabled]}>
          {label}
        </Text>
        <View style={[styles.checkbox, isEnabled && styles.checkboxEnabled]}>
          {isEnabled && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>

      {isEnabled && (
        <View style={styles.methodCardBody}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{currency}</Text>
            <TextInput
              style={styles.amountInputInline}
              value={amount}
              onChangeText={onAmountChange}
              keyboardType="numeric"
              placeholder={suggestedAmount.toFixed(2)}
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />
            {suggestedAmount > 0 && (
              <TouchableOpacity
                style={styles.fillBtn}
                onPress={() => onAmountChange(suggestedAmount.toFixed(2))}
              >
                <Text style={styles.fillBtnText}>Fill {suggestedAmount.toFixed(2)}</Text>
              </TouchableOpacity>
            )}
          </View>

          {(referenceRequired || reference) && (
            <View style={styles.referenceRow}>
              <TextInput
                style={[styles.referenceInputInline, referenceRequired && styles.referenceRequired]}
                value={reference}
                onChangeText={onReferenceChange}
                placeholder={referenceRequired ? "Reference (Required)" : "Reference (Optional)"}
                placeholderTextColor={colors.textMuted}
              />
              {referenceRequired && <Text style={styles.requiredStar}>*</Text>}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Payment Entry Display (for confirmed payments)
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
  const insets = useSafeAreaInsets();

  const [payments, setPayments] = useState([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(true);

  // Modal state - track enabled methods with their amounts/references
  const [modalPayments, setModalPayments] = useState({});

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = Math.max(0, totals.totalNet - totalPaid);
  const change = totalPaid > totals.totalNet ? totalPaid - totals.totalNet : 0;

  // Calculate modal totals
  const modalTotalPaid = Object.values(modalPayments).reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0), 0
  );
  const modalRemaining = Math.max(0, totals.totalNet - totalPaid - modalTotalPaid);

  // Load payment methods on mount
  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    setLoadingMethods(true);
    try {
      const methods = await getPaymentMethods();
      if (methods && methods.length > 0) {
        const mappedMethods = methods.map(m => ({
          method: m.paymentMode,
          icon: getPaymentIcon(m.paymentMode),
          label: m.paymentMode,
          referenceRequired: m.referenceRequired,
          receiptMethodId: m.receiptMethodId,
        }));
        setPaymentMethods(mappedMethods);
      } else {
        setPaymentMethods([
          { method: 'Cash', icon: 'cash-outline', label: 'Cash', referenceRequired: false },
          { method: 'Card', icon: 'card-outline', label: 'Card', referenceRequired: true },
        ]);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setPaymentMethods([
        { method: 'Cash', icon: 'cash-outline', label: 'Cash', referenceRequired: false },
        { method: 'Card', icon: 'card-outline', label: 'Card', referenceRequired: true },
      ]);
    } finally {
      setLoadingMethods(false);
    }
  };

  const handleOpenModal = () => {
    setModalPayments({});
    setShowAddPayment(true);
  };

  const handleToggleMethod = (method) => {
    setModalPayments(prev => {
      if (prev[method]) {
        // Remove this method
        const { [method]: removed, ...rest } = prev;
        return rest;
      } else {
        // Add this method with suggested amount
        const currentModalTotal = Object.values(prev).reduce(
          (sum, p) => sum + (parseFloat(p.amount) || 0), 0
        );
        const suggestedAmount = Math.max(0, totals.totalNet - totalPaid - currentModalTotal);
        const methodDetails = paymentMethods.find(m => m.method === method);
        return {
          ...prev,
          [method]: {
            amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : '',
            reference: '',
            receiptMethodId: methodDetails?.receiptMethodId || null,
            referenceRequired: methodDetails?.referenceRequired || false,
          }
        };
      }
    });
  };

  const handleModalAmountChange = (method, amount) => {
    setModalPayments(prev => ({
      ...prev,
      [method]: { ...prev[method], amount }
    }));
  };

  const handleModalReferenceChange = (method, reference) => {
    setModalPayments(prev => ({
      ...prev,
      [method]: { ...prev[method], reference }
    }));
  };

  const handleConfirmModalPayments = () => {
    // Validate all enabled methods
    const enabledMethods = Object.entries(modalPayments);

    if (enabledMethods.length === 0) {
      Alert.alert('No Payment', 'Please select at least one payment method');
      return;
    }

    // Validate each payment
    for (const [method, data] of enabledMethods) {
      const amount = parseFloat(data.amount) || 0;
      if (amount <= 0) {
        Alert.alert('Invalid Amount', `Please enter a valid amount for ${method}`);
        return;
      }
      if (data.referenceRequired && !data.reference.trim()) {
        Alert.alert('Reference Required', `Please enter a reference for ${method}`);
        return;
      }
    }

    // Add all payments
    const newPayments = enabledMethods.map(([method, data]) => ({
      method,
      amount: Math.round((parseFloat(data.amount) || 0) * 100) / 100,
      reference: data.reference,
      receiptMethodId: data.receiptMethodId,
      timestamp: new Date().toISOString(),
    }));

    setPayments([...payments, ...newPayments]);
    setModalPayments({});
    setShowAddPayment(false);
  };

  const handleRemovePayment = (index) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleAmountChange = (index, amount) => {
    const newPayments = [...payments];
    newPayments[index].amount = Math.round(amount * 100) / 100;
    setPayments(newPayments);
  };

  const handleQuickCash = () => {
    const cashMethod = paymentMethods.find(m =>
      m.method.toUpperCase().includes('CASH')
    );

    setPayments([{
      method: cashMethod?.method || 'Cash',
      amount: totals.totalNet,
      reference: '',
      receiptMethodId: cashMethod?.receiptMethodId || null,
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
    navigation.navigate('MainTabs');
  };

  const handleNewOrder = () => {
    navigation.navigate('MainTabs');
  };

  // Calculate suggested amount for each method in modal
  const getSuggestedAmount = (method) => {
    const otherPayments = Object.entries(modalPayments)
      .filter(([m]) => m !== method)
      .reduce((sum, [, data]) => sum + (parseFloat(data.amount) || 0), 0);
    return Math.max(0, totals.totalNet - totalPaid - otherPayments);
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
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

        {/* Add Payment Button - Moved Up */}
        <TouchableOpacity style={styles.addPaymentBtn} onPress={handleOpenModal}>
          <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
          <Text style={styles.addPaymentText}>Add Payment Method</Text>
        </TouchableOpacity>

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
      </ScrollView>

      {/* Confirm Button - with safe area padding */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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

      {/* Add Payment Modal - Full Screen Style */}
      <Modal
        visible={showAddPayment}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPayment(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddPayment(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Payment Methods</Text>
              <View style={styles.modalHeaderRight}>
                <Text style={styles.modalRemaining}>
                  {modalRemaining > 0 ? `${currency} ${modalRemaining.toFixed(2)} left` : 'Fully Paid'}
                </Text>
              </View>
            </View>

            {/* Order Total Mini Card */}
            <View style={styles.modalTotalCard}>
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>Order Total</Text>
                <Text style={styles.modalTotalValue}>{currency} {totals.totalNet.toFixed(2)}</Text>
              </View>
              {totalPaid > 0 && (
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalPaidLabel}>Already Paid</Text>
                  <Text style={styles.modalPaidValue}>- {currency} {totalPaid.toFixed(2)}</Text>
                </View>
              )}
              {modalTotalPaid > 0 && (
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalNewPaidLabel}>New Payments</Text>
                  <Text style={styles.modalNewPaidValue}>{currency} {modalTotalPaid.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.modalTotalRow, styles.modalTotalRowFinal]}>
                <Text style={styles.modalRemainingLabel}>
                  {modalRemaining > 0 ? 'Remaining' : 'Change'}
                </Text>
                <Text style={[
                  styles.modalRemainingValue,
                  modalRemaining === 0 && styles.modalFullyPaid,
                  modalTotalPaid + totalPaid > totals.totalNet && styles.modalChangeValue
                ]}>
                  {currency} {modalRemaining > 0 ? modalRemaining.toFixed(2) :
                    (modalTotalPaid + totalPaid - totals.totalNet).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Payment Methods List */}
            <ScrollView
              style={styles.modalMethodsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {loadingMethods ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.loadingText}>Loading payment methods...</Text>
                </View>
              ) : (
                paymentMethods.map((pm) => (
                  <PaymentMethodCard
                    key={pm.method}
                    method={pm.method}
                    icon={pm.icon}
                    label={pm.label}
                    referenceRequired={pm.referenceRequired}
                    receiptMethodId={pm.receiptMethodId}
                    isEnabled={!!modalPayments[pm.method]}
                    amount={modalPayments[pm.method]?.amount || ''}
                    reference={modalPayments[pm.method]?.reference || ''}
                    onToggle={() => handleToggleMethod(pm.method)}
                    onAmountChange={(val) => handleModalAmountChange(pm.method, val)}
                    onReferenceChange={(val) => handleModalReferenceChange(pm.method, val)}
                    suggestedAmount={getSuggestedAmount(pm.method)}
                    currency={currency}
                  />
                ))
              )}
            </ScrollView>

            {/* Modal Action Button */}
            <TouchableOpacity
              style={[
                styles.modalConfirmBtn,
                Object.keys(modalPayments).length === 0 && styles.modalConfirmBtnDisabled
              ]}
              onPress={handleConfirmModalPayments}
              disabled={Object.keys(modalPayments).length === 0}
            >
              <Text style={styles.modalConfirmBtnText}>
                {Object.keys(modalPayments).length === 0
                  ? 'Select Payment Method'
                  : `Add ${Object.keys(modalPayments).length} Payment${Object.keys(modalPayments).length > 1 ? 's' : ''}`}
              </Text>
              {Object.keys(modalPayments).length > 0 && (
                <Text style={styles.modalConfirmBtnAmount}>
                  {currency} {modalTotalPaid.toFixed(2)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success Modal with Confetti */}
      <Modal
        visible={showSuccess}
        animationType="fade"
        transparent={true}
        onRequestClose={handleDone}
      >
        <View style={styles.successOverlay}>
          <ConfettiBurst active={showSuccess} />

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
    marginBottom: 12,
  },
  quickCashText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '600',
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
    marginBottom: 16,
  },
  addPaymentText: {
    color: colors.accent,
    fontSize: 14,
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
  actionBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  modalHeaderRight: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  modalRemaining: {
    fontSize: 12,
    color: colors.accentGreen,
    fontWeight: '600',
  },
  modalTotalCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTotalRowFinal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },
  modalTotalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalTotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalPaidLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  modalPaidValue: {
    fontSize: 12,
    color: colors.textMuted,
  },
  modalNewPaidLabel: {
    fontSize: 12,
    color: colors.accentGreen,
  },
  modalNewPaidValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentGreen,
  },
  modalRemainingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalRemainingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentRed || '#E53935',
  },
  modalFullyPaid: {
    color: colors.accentGreen,
  },
  modalChangeValue: {
    color: colors.accentGreen,
  },
  modalMethodsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  // Payment Method Card Styles
  methodCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  methodCardEnabled: {
    backgroundColor: colors.accent + '10',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  methodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  methodIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodIconEnabled: {
    backgroundColor: colors.accent,
  },
  methodCardLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  methodCardLabelEnabled: {
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxEnabled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  methodCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginRight: 8,
  },
  amountInputInline: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingVertical: 8,
  },
  fillBtn: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fillBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referenceInputInline: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  referenceRequired: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  requiredStar: {
    fontSize: 18,
    color: colors.accentRed || '#E53935',
    marginLeft: 6,
  },
  modalConfirmBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modalConfirmBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmBtnAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
  },
  // Success Modal
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
