import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { calculateLineTotal, calculateOrderTotals, createOrder, ORDER_STATUS } from '../services/orderService';
import { useAuth } from '../context/AuthContext';

const TotalCard = ({ label, value, color, icon }) => (
  <View style={[styles.totalCard, { borderLeftColor: color }]}>
    <Ionicons name={icon} size={18} color={color} />
    <Text style={styles.totalCardLabel}>{label}</Text>
    <Text style={[styles.totalCardValue, { color }]}>{value}</Text>
  </View>
);

const OrderLineCard = ({ item, index, menuConfig, onIncrease, onDecrease, onRemove, onDiscountChange, currency }) => {
  const [editDiscount, setEditDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState(item.discount?.toString() || '0');
  const lineTotals = calculateLineTotal(item, menuConfig);

  const handleSaveDiscount = () => {
    const discount = parseFloat(discountValue) || 0;
    onDiscountChange(index, discount);
    setEditDiscount(false);
  };

  return (
    <View style={styles.orderLineCard}>
      {/* Header Row - Item Name and Delete */}
      <View style={styles.lineHeader}>
        <View style={styles.lineNumberBadge}>
          <Text style={styles.lineNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.lineHeaderInfo}>
          <Text style={styles.lineName} numberOfLines={2}>{item.itemDesc || item.itemNumber}</Text>
          <Text style={styles.lineCode}>{item.itemNumber}</Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onRemove(index)}>
          <Ionicons name="trash-outline" size={18} color={colors.accentRed || '#E53935'} />
        </TouchableOpacity>
      </View>

      {/* Details Row */}
      <View style={styles.lineDetails}>
        {/* Qty Control */}
        <View style={styles.qtySection}>
          <Text style={styles.detailLabel}>Qty</Text>
          <View style={styles.qtyControls}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onDecrease(index)}>
              <Ionicons name="remove" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{item.quantity}</Text>
            <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={() => onIncrease(index)}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Unit Price */}
        <View style={styles.priceSection}>
          <Text style={styles.detailLabel}>Unit Price</Text>
          <Text style={styles.priceValue}>{lineTotals.unitPrice.toFixed(2)}</Text>
        </View>

        {/* Gross */}
        <View style={styles.grossSection}>
          <Text style={styles.detailLabel}>Gross</Text>
          <Text style={styles.grossValue}>{lineTotals.gross.toFixed(2)}</Text>
        </View>
      </View>

      {/* Discount & Tax Row */}
      {(menuConfig?.allowDiscount || menuConfig?.allowTax) && (
        <View style={styles.lineExtras}>
          {menuConfig?.allowDiscount && (
            <View style={styles.discountSection}>
              <Text style={styles.detailLabel}>Discount</Text>
              {editDiscount ? (
                <View style={styles.discountEdit}>
                  <TextInput
                    style={styles.discountInput}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    keyboardType="numeric"
                    autoFocus
                  />
                  <TouchableOpacity style={styles.discountSaveBtn} onPress={handleSaveDiscount}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.discountTap} onPress={() => setEditDiscount(true)}>
                  <Text style={[styles.discountValue, lineTotals.discountAmount > 0 && styles.discountValueActive]}>
                    -{lineTotals.discountAmount.toFixed(2)}
                  </Text>
                  <Ionicons name="pencil" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {menuConfig?.allowTax && (
            <View style={styles.taxSection}>
              <Text style={styles.detailLabel}>Tax (15%)</Text>
              <Text style={styles.taxValue}>{lineTotals.taxAmount.toFixed(2)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Net Total */}
      <View style={styles.lineTotal}>
        <Text style={styles.lineTotalLabel}>Line Total</Text>
        <Text style={styles.lineTotalValue}>{currency} {lineTotals.net.toFixed(2)}</Text>
      </View>
    </View>
  );
};

const CheckoutScreen = ({ navigation, route }) => {
  const { menuConfig, customer, cart: initialCart, saveAsDraft } = route.params || {};
  const { user } = useAuth();
  const [cart, setCart] = useState(initialCart || []);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const totals = calculateOrderTotals(cart, menuConfig);
  const currency = cart[0]?.currency || 'MUR';

  const handleDiscountChange = (index, discount) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], discount };
    setCart(newCart);
  };

  const handleIncreaseQty = (index) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + 1 };
    setCart(newCart);
  };

  const handleDecreaseQty = (index) => {
    const newCart = [...cart];
    if (newCart[index].quantity > 1) {
      newCart[index] = { ...newCart[index], quantity: newCart[index].quantity - 1 };
      setCart(newCart);
    } else {
      handleRemoveItem(index);
    }
  };

  const handleRemoveItem = (index) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newCart = cart.filter((_, i) => i !== index);
            setCart(newCart);
            if (newCart.length === 0) {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleSaveAsDraft = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'No items to save.');
      return;
    }

    setSaving(true);
    try {
      const userPrefix = user?.username?.substring(0, 3) || user?.name?.substring(0, 3) || 'USR';
      const result = await createOrder({
        customer,
        menuConfig,
        lines: cart,
        status: ORDER_STATUS.DRAFT,
        notes,
      }, userPrefix);

      if (result.success) {
        Alert.alert(
          'Draft Saved',
          `Order ${result.order.orderNumber} saved as draft.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to save draft');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleProceedToPayment = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'No items to checkout.');
      return;
    }

    navigation.navigate('Payment', {
      menuConfig,
      customer,
      cart,
      totals,
      notes,
      currency,
    });
  };

  useEffect(() => {
    if (saveAsDraft) {
      handleSaveAsDraft();
    }
  }, [saveAsDraft]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order Preview</Text>
          <Text style={styles.headerSubtitle}>{customer?.name || 'Walk-in Customer'}</Text>
        </View>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Total Cards */}
        <View style={styles.totalCardsContainer}>
          <TotalCard
            label="Items"
            value={totals.totalItems.toString()}
            color={colors.accent}
            icon="cube-outline"
          />
          <TotalCard
            label="Subtotal"
            value={`${currency} ${totals.totalGross.toFixed(2)}`}
            color={colors.accentOrange}
            icon="calculator-outline"
          />
          {menuConfig?.allowDiscount && totals.totalDiscount > 0 && (
            <TotalCard
              label="Discount"
              value={`-${currency} ${totals.totalDiscount.toFixed(2)}`}
              color={colors.accentGreen}
              icon="pricetag-outline"
            />
          )}
          {menuConfig?.allowTax && totals.totalTax > 0 && (
            <TotalCard
              label="Tax (15%)"
              value={`${currency} ${totals.totalTax.toFixed(2)}`}
              color={colors.textMuted}
              icon="receipt-outline"
            />
          )}
        </View>

        {/* Grand Total */}
        <View style={styles.grandTotalCard}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Amount</Text>
            <Text style={styles.grandTotalValue}>
              {currency} {totals.totalNet.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Order Lines Header */}
        <View style={styles.sectionHeader}>
          <Ionicons name="list-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.sectionTitle}>Order Lines ({cart.length})</Text>
        </View>

        {/* Order Lines */}
        {cart.map((item, index) => (
          <OrderLineCard
            key={`line-${index}-${item.itemNumber || ''}`}
            item={item}
            index={index}
            menuConfig={menuConfig}
            onIncrease={handleIncreaseQty}
            onDecrease={handleDecreaseQty}
            onRemove={handleRemoveItem}
            onDiscountChange={handleDiscountChange}
            currency={currency}
          />
        ))}

        {/* Notes */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Order Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add notes for this order..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.draftBtn}
          onPress={handleSaveAsDraft}
          disabled={saving || cart.length === 0}
        >
          <Ionicons name="save-outline" size={20} color={colors.accent} />
          <Text style={styles.draftBtnText}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.paymentBtn, cart.length === 0 && styles.paymentBtnDisabled]}
          onPress={handleProceedToPayment}
          disabled={saving || cart.length === 0}
        >
          <Text style={styles.paymentBtnText}>Proceed to Payment</Text>
          <Ionicons name="card-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
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
  },
  totalCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  totalCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  totalCardLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  totalCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  grandTotalCard: {
    backgroundColor: colors.accent,
    marginHorizontal: 12,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  orderLineCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lineNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  lineNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  lineHeaderInfo: {
    flex: 1,
  },
  lineName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: 2,
  },
  lineCode: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: (colors.accentRed || '#E53935') + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  lineDetails: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginBottom: 8,
  },
  qtySection: {
    flex: 1,
  },
  priceSection: {
    flex: 1,
    alignItems: 'center',
  },
  grossSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  detailLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnAdd: {
    backgroundColor: colors.secondary,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  priceValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  grossValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  lineExtras: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  discountSection: {
    flex: 1,
  },
  taxSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  discountTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountValue: {
    fontSize: 14,
    color: colors.textMuted,
  },
  discountValueActive: {
    color: colors.accentGreen,
    fontWeight: '600',
  },
  discountEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountInput: {
    width: 60,
    height: 28,
    fontSize: 14,
    padding: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  discountSaveBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taxValue: {
    fontSize: 14,
    color: colors.textMuted,
  },
  lineTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lineTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
  },
  notesContainer: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  notesInput: {
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bottomSpacer: {
    height: 100,
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  draftBtn: {
    flex: 0.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  draftBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  paymentBtn: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  paymentBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  paymentBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CheckoutScreen;
