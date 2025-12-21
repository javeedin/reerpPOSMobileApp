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

const LineItem = ({ item, index, menuConfig, onDiscountChange }) => {
  const [editDiscount, setEditDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState(item.discount?.toString() || '0');
  const lineTotals = calculateLineTotal(item, menuConfig);

  const handleSaveDiscount = () => {
    const discount = parseFloat(discountValue) || 0;
    onDiscountChange(index, discount);
    setEditDiscount(false);
  };

  return (
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
        <Text style={styles.linePriceValue}>{lineTotals.unitPrice.toFixed(2)}</Text>
      </View>
      <View style={styles.lineGross}>
        <Text style={styles.lineGrossValue}>{lineTotals.gross.toFixed(2)}</Text>
      </View>
      {menuConfig?.allowDiscount && (
        <View style={styles.lineDiscount}>
          {editDiscount ? (
            <View style={styles.discountEdit}>
              <TextInput
                style={styles.discountInput}
                value={discountValue}
                onChangeText={setDiscountValue}
                keyboardType="numeric"
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveDiscount}>
                <Ionicons name="checkmark" size={16} color={colors.accentGreen} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditDiscount(true)}>
              <Text style={[styles.lineDiscountValue, lineTotals.discountAmount > 0 && { color: colors.accentGreen }]}>
                -{lineTotals.discountAmount.toFixed(2)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {menuConfig?.allowTax && (
        <View style={styles.lineTax}>
          <Text style={styles.lineTaxValue}>{lineTotals.taxAmount.toFixed(2)}</Text>
        </View>
      )}
      <View style={styles.lineNet}>
        <Text style={styles.lineNetValue}>{lineTotals.net.toFixed(2)}</Text>
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

  const handleSaveAsDraft = async () => {
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
            value={totals.totalGross.toFixed(2)}
            color={colors.accentOrange}
            icon="calculator-outline"
          />
          {menuConfig?.allowDiscount && (
            <TotalCard
              label="Discount"
              value={`-${totals.totalDiscount.toFixed(2)}`}
              color={colors.accentGreen}
              icon="pricetag-outline"
            />
          )}
          {menuConfig?.allowTax && (
            <TotalCard
              label="Tax (15%)"
              value={totals.totalTax.toFixed(2)}
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

        {/* Line Items Header */}
        <View style={styles.tableHeader}>
          <View style={styles.lineNumber}><Text style={styles.tableHeaderText}>#</Text></View>
          <View style={styles.lineInfo}><Text style={styles.tableHeaderText}>Item</Text></View>
          <View style={styles.lineQty}><Text style={styles.tableHeaderText}>Qty</Text></View>
          <View style={styles.linePrice}><Text style={styles.tableHeaderText}>Price</Text></View>
          <View style={styles.lineGross}><Text style={styles.tableHeaderText}>Gross</Text></View>
          {menuConfig?.allowDiscount && (
            <View style={styles.lineDiscount}><Text style={styles.tableHeaderText}>Disc</Text></View>
          )}
          {menuConfig?.allowTax && (
            <View style={styles.lineTax}><Text style={styles.tableHeaderText}>Tax</Text></View>
          )}
          <View style={styles.lineNet}><Text style={styles.tableHeaderText}>Net</Text></View>
        </View>

        {/* Line Items */}
        {cart.map((item, index) => (
          <LineItem
            key={`line-${item.id || item.itemNumber}-${index}`}
            item={item}
            index={index}
            menuConfig={menuConfig}
            onDiscountChange={handleDiscountChange}
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
          disabled={saving}
        >
          <Ionicons name="save-outline" size={20} color={colors.accent} />
          <Text style={styles.draftBtnText}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.paymentBtn}
          onPress={handleProceedToPayment}
          disabled={saving}
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
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    borderRadius: 8,
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
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
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
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  lineCode: {
    fontSize: 9,
    color: colors.textMuted,
  },
  lineQty: {
    width: 40,
    alignItems: 'center',
  },
  lineQtyValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lineQtyLabel: {
    fontSize: 8,
    color: colors.textMuted,
  },
  linePrice: {
    width: 50,
    alignItems: 'flex-end',
  },
  linePriceValue: {
    fontSize: 11,
    color: colors.textMuted,
  },
  lineGross: {
    width: 55,
    alignItems: 'flex-end',
  },
  lineGrossValue: {
    fontSize: 11,
    color: colors.textPrimary,
  },
  lineDiscount: {
    width: 50,
    alignItems: 'flex-end',
  },
  lineDiscountValue: {
    fontSize: 11,
    color: colors.textMuted,
  },
  discountEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountInput: {
    width: 40,
    fontSize: 11,
    padding: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    textAlign: 'right',
  },
  lineTax: {
    width: 45,
    alignItems: 'flex-end',
  },
  lineTaxValue: {
    fontSize: 11,
    color: colors.textMuted,
  },
  lineNet: {
    width: 60,
    alignItems: 'flex-end',
  },
  lineNetValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  notesContainer: {
    marginHorizontal: 12,
    marginTop: 12,
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
  paymentBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CheckoutScreen;
