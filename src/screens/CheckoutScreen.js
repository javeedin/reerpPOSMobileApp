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
import { getOnhand } from '../services/syncService';
import { getAllLocalAdjustments } from '../services/onhandService';

// Format number with commas (e.g., 1,250.00)
const formatNumber = (num) => {
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Totals Flow Component - Shows Gross → Discount → Tax as visual pipeline
const TotalsFlow = ({ totals, currency, menuConfig }) => {
  const flowItems = [
    {
      label: 'Gross',
      value: totals.totalGross,
      icon: 'cube',
      color: colors.accent,
      operator: null,
    },
    menuConfig?.allowDiscount && totals.totalDiscount > 0 && {
      label: 'Discount',
      value: totals.totalDiscount,
      icon: 'pricetag',
      color: colors.accentGreen || '#4CAF50',
      operator: '-',
    },
    menuConfig?.allowTax && totals.totalTax > 0 && {
      label: 'Tax',
      value: totals.totalTax,
      icon: 'receipt',
      color: colors.accentOrange || '#FF9800',
      operator: '+',
    },
  ].filter(Boolean);

  return (
    <View style={styles.totalsFlowContainer}>
      {/* Flow Steps */}
      <View style={styles.flowSteps}>
        {flowItems.map((item, index) => (
          <React.Fragment key={item.label}>
            {item.operator && (
              <View style={styles.flowOperator}>
                <Text style={[styles.operatorText, { color: item.color }]}>{item.operator}</Text>
              </View>
            )}
            <View style={[styles.flowStep, { borderColor: item.color }]}>
              <View style={[styles.flowStepIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={14} color={item.color} />
              </View>
              <Text style={styles.flowStepLabel}>{item.label}</Text>
              <Text style={[styles.flowStepValue, { color: item.color }]}>
                {formatNumber(item.value)}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Items Count Badge */}
      <View style={styles.itemsCountBadge}>
        <Ionicons name="cart" size={12} color={colors.accent} />
        <Text style={styles.itemsCountText}>{totals.totalItems} items</Text>
      </View>
    </View>
  );
};

const OrderLineCard = ({ item, index, menuConfig, onIncrease, onDecrease, onRemove, onDiscountChange, currency, onhandQty }) => {
  const [editDiscount, setEditDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState(item.discount?.toString() || '0');
  const lineTotals = calculateLineTotal(item, menuConfig);
  const discountPercent = item.discount || 0;

  // Check if quantity exceeds available stock
  const exceedsStock = onhandQty !== undefined && item.quantity > onhandQty;
  const canIncrease = onhandQty === undefined || item.quantity < onhandQty;

  const handleSaveDiscount = () => {
    const discount = parseFloat(discountValue) || 0;
    onDiscountChange(index, discount, 'percent'); // Save as percent
    setEditDiscount(false);
  };

  // Get stock status color
  const getStockColor = (qty) => {
    if (qty <= 0) return colors.accentRed || '#E53935';
    if (qty < 10) return colors.accentOrange || '#FF9800';
    return colors.accentGreen || '#4CAF50';
  };

  return (
    <View style={[styles.orderLineCard, exceedsStock && styles.orderLineCardWarning]}>
      {/* Header Row - Item Name and Delete */}
      <View style={styles.lineHeader}>
        <View style={[styles.lineNumberBadge, exceedsStock && styles.lineNumberBadgeWarning]}>
          <Text style={styles.lineNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.lineHeaderInfo}>
          <Text style={styles.lineName} numberOfLines={2}>{item.itemDesc || item.itemNumber}</Text>
          <View style={styles.lineCodeRow}>
            <Text style={styles.lineCode}>{item.itemNumber}</Text>
            {onhandQty !== undefined && (
              <View style={[styles.qohBadge, { backgroundColor: getStockColor(onhandQty) + '20' }]}>
                <Ionicons name="cube-outline" size={10} color={getStockColor(onhandQty)} />
                <Text style={[styles.qohText, { color: getStockColor(onhandQty) }]}>
                  QOH: {onhandQty}
                </Text>
              </View>
            )}
          </View>
          {/* Tax & Discount Badges */}
          <View style={styles.lineBadgesRow}>
            <View style={[styles.lineTaxBadge, lineTotals.taxRate > 0 ? styles.lineTaxBadgeActive : styles.lineTaxBadgeZero]}>
              <Ionicons name="receipt-outline" size={10} color={lineTotals.taxRate > 0 ? colors.accentOrange || '#FF9800' : colors.textMuted} />
              <Text style={[styles.lineTaxBadgeText, lineTotals.taxRate > 0 ? styles.lineTaxBadgeTextActive : styles.lineTaxBadgeTextZero]}>
                {lineTotals.taxRate > 0 ? `${lineTotals.taxRate}%` : '0% Tax'}
              </Text>
            </View>
            <View style={[styles.lineDiscBadge, lineTotals.canApplyDiscount ? styles.lineDiscBadgeYes : styles.lineDiscBadgeNo]}>
              <Ionicons
                name={lineTotals.canApplyDiscount ? "pricetag-outline" : "close-circle-outline"}
                size={10}
                color={lineTotals.canApplyDiscount ? colors.accentGreen || '#4CAF50' : colors.textMuted}
              />
              <Text style={[styles.lineDiscBadgeText, lineTotals.canApplyDiscount ? styles.lineDiscBadgeTextYes : styles.lineDiscBadgeTextNo]}>
                {lineTotals.canApplyDiscount ? 'Disc' : 'No Disc'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onRemove(index)}>
          <Ionicons name="trash-outline" size={18} color={colors.accentRed || '#E53935'} />
        </TouchableOpacity>
      </View>

      {/* Stock Warning */}
      {exceedsStock && (
        <View style={styles.stockWarning}>
          <Ionicons name="warning" size={14} color={colors.accentRed || '#E53935'} />
          <Text style={styles.stockWarningText}>
            Quantity ({item.quantity}) exceeds available stock ({onhandQty})
          </Text>
        </View>
      )}

      {/* Details Row */}
      <View style={styles.lineDetails}>
        {/* Qty Control */}
        <View style={styles.qtySection}>
          <Text style={styles.detailLabel}>Qty</Text>
          <View style={styles.qtyControls}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onDecrease(index)}>
              <Ionicons name="remove" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.qtyValue, exceedsStock && styles.qtyValueWarning]}>{item.quantity}</Text>
            <TouchableOpacity
              style={[styles.qtyBtn, styles.qtyBtnAdd, !canIncrease && styles.qtyBtnDisabled]}
              onPress={() => canIncrease && onIncrease(index)}
              disabled={!canIncrease}
            >
              <Ionicons name="add" size={16} color={canIncrease ? "#FFFFFF" : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Unit Price */}
        <View style={styles.priceSection}>
          <Text style={styles.detailLabel}>Unit Price</Text>
          <Text style={styles.priceValue}>{formatNumber(lineTotals.unitPrice)}</Text>
        </View>

        {/* Gross */}
        <View style={styles.grossSection}>
          <Text style={styles.detailLabel}>Gross</Text>
          <Text style={styles.grossValue}>{formatNumber(lineTotals.gross)}</Text>
        </View>
      </View>

      {/* Discount & Tax Row */}
      {(menuConfig?.allowDiscount || menuConfig?.allowTax) && (
        <View style={styles.lineExtras}>
          {menuConfig?.allowDiscount && (
            <View style={styles.discountSection}>
              <View style={styles.discountLabelRow}>
                <Text style={styles.detailLabel}>Discount %</Text>
                {!lineTotals.canApplyDiscount && (
                  <View style={styles.noDiscountBadge}>
                    <Ionicons name="close-circle" size={10} color={colors.textMuted} />
                    <Text style={styles.noDiscountText}>N/A</Text>
                  </View>
                )}
              </View>
              {lineTotals.canApplyDiscount ? (
                editDiscount ? (
                  <View style={styles.discountEdit}>
                    <TextInput
                      style={styles.discountInput}
                      value={discountValue}
                      onChangeText={setDiscountValue}
                      keyboardType="numeric"
                      placeholder="%"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.discountSaveBtn} onPress={handleSaveDiscount}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.discountTap} onPress={() => setEditDiscount(true)}>
                    <Text style={[styles.discountPercent, discountPercent > 0 && styles.discountPercentActive]}>
                      {discountPercent}%
                    </Text>
                    <Text style={[styles.discountAmount, lineTotals.discountAmount > 0 && styles.discountAmountActive]}>
                      (-{formatNumber(lineTotals.discountAmount)})
                    </Text>
                    <Ionicons name="pencil" size={12} color={colors.textMuted} />
                  </TouchableOpacity>
                )
              ) : (
                <Text style={styles.discountDisabled}>—</Text>
              )}
            </View>
          )}
          {menuConfig?.allowTax && (
            <View style={styles.taxSection}>
              <Text style={styles.detailLabel}>
                Tax {lineTotals.taxRate > 0 ? `(${lineTotals.taxRate}%)` : '(0%)'}
              </Text>
              <Text style={[styles.taxValue, lineTotals.taxRate === 0 && styles.taxValueZero]}>
                {lineTotals.taxRate > 0 ? formatNumber(lineTotals.taxAmount) : '—'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Net Total */}
      <View style={styles.lineTotal}>
        <Text style={styles.lineTotalLabel}>Line Total</Text>
        <Text style={styles.lineTotalValue}>{currency} {formatNumber(lineTotals.net)}</Text>
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
  const [onhandMap, setOnhandMap] = useState({});

  const totals = calculateOrderTotals(cart, menuConfig);
  const currency = cart[0]?.currency || 'MUR';

  // Load onhand data on mount
  useEffect(() => {
    loadOnhandData();
  }, []);

  const loadOnhandData = async () => {
    try {
      const onhandData = await getOnhand() || [];
      const adjustments = await getAllLocalAdjustments() || {};

      // Build a map of itemNumber -> available qty
      const map = {};
      onhandData.forEach(item => {
        const itemNum = item.itemNumber;
        if (itemNum) {
          map[itemNum] = (map[itemNum] || 0) + (item.primaryQuantity || 0);
        }
      });

      // Apply local adjustments
      Object.keys(adjustments).forEach(itemNum => {
        if (map[itemNum] !== undefined) {
          map[itemNum] += adjustments[itemNum];
        } else {
          map[itemNum] = adjustments[itemNum];
        }
      });

      setOnhandMap(map);
    } catch (error) {
      console.error('Load onhand error:', error);
    }
  };

  // Get onhand qty for an item
  const getOnhandQty = (item) => {
    const itemNum = item.itemNumber || item.item_number;
    const qty = onhandMap[itemNum];
    return qty !== undefined ? Math.max(0, qty) : undefined;
  };

  // Check if any item exceeds stock
  const hasStockIssues = cart.some(item => {
    const onhandQty = getOnhandQty(item);
    return onhandQty !== undefined && item.quantity > onhandQty;
  });

  const handleDiscountChange = (index, discount, discountType = 'percent') => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], discount, discountType };
    setCart(newCart);
  };

  const handleIncreaseQty = (index) => {
    const item = cart[index];
    const onhandQty = getOnhandQty(item);

    // Check stock limit
    if (onhandQty !== undefined && item.quantity >= onhandQty) {
      Alert.alert('Stock Limit', `Only ${onhandQty} units available for ${item.itemDesc || item.itemNumber}.`);
      return;
    }

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

    // Check for stock issues
    if (hasStockIssues) {
      const itemsWithIssues = cart.filter(item => {
        const onhandQty = getOnhandQty(item);
        return onhandQty !== undefined && item.quantity > onhandQty;
      });

      const itemsList = itemsWithIssues.map(item => {
        const onhandQty = getOnhandQty(item);
        return `• ${item.itemDesc || item.itemNumber}: ${item.quantity} ordered, ${onhandQty} available`;
      }).join('\n');

      Alert.alert(
        'Stock Issues',
        `The following items exceed available stock:\n\n${itemsList}\n\nPlease adjust quantities before proceeding.`,
        [{ text: 'OK' }]
      );
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
        {/* Innovative Totals Flow */}
        <TotalsFlow totals={totals} currency={currency} menuConfig={menuConfig} />

        {/* Grand Total Card */}
        <View style={styles.grandTotalCard}>
          <View style={styles.grandTotalRow}>
            <View>
              <Text style={styles.grandTotalLabel}>Total Amount</Text>
              <Text style={styles.grandTotalHint}>Ready for payment</Text>
            </View>
            <Text style={styles.grandTotalValue}>
              {currency} {formatNumber(totals.totalNet)}
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
            onhandQty={getOnhandQty(item)}
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
          style={[
            styles.paymentBtn,
            cart.length === 0 && styles.paymentBtnDisabled,
            hasStockIssues && styles.paymentBtnWarning
          ]}
          onPress={handleProceedToPayment}
          disabled={saving || cart.length === 0}
        >
          {hasStockIssues && <Ionicons name="warning" size={18} color="#FFFFFF" />}
          <Text style={styles.paymentBtnText}>
            {hasStockIssues ? 'Stock Issues' : 'Proceed to Payment'}
          </Text>
          <Ionicons name={hasStockIssues ? "alert-circle" : "card-outline"} size={20} color="#FFFFFF" />
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
  // Totals Flow Styles
  totalsFlowContainer: {
    padding: 12,
    paddingBottom: 8,
  },
  flowSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  flowOperator: {
    paddingHorizontal: 4,
  },
  operatorText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  flowStep: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  flowStepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  flowStepLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  flowStepValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  itemsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
    gap: 5,
  },
  itemsCountText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
  },
  grandTotalCard: {
    backgroundColor: colors.accent,
    marginHorizontal: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  grandTotalHint: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  grandTotalValue: {
    fontSize: 20,
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  orderLineCardWarning: {
    borderColor: colors.accentRed || '#E53935',
    backgroundColor: (colors.accentRed || '#E53935') + '05',
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
  lineNumberBadgeWarning: {
    backgroundColor: colors.accentRed || '#E53935',
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
  lineCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  lineTaxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  lineTaxBadgeActive: {
    backgroundColor: (colors.accentOrange || '#FF9800') + '15',
  },
  lineTaxBadgeZero: {
    backgroundColor: colors.surface,
  },
  lineTaxBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  lineTaxBadgeTextActive: {
    color: colors.accentOrange || '#FF9800',
  },
  lineTaxBadgeTextZero: {
    color: colors.textMuted,
  },
  lineDiscBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  lineDiscBadgeYes: {
    backgroundColor: (colors.accentGreen || '#4CAF50') + '15',
  },
  lineDiscBadgeNo: {
    backgroundColor: colors.surface,
  },
  lineDiscBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  lineDiscBadgeTextYes: {
    color: colors.accentGreen || '#4CAF50',
  },
  lineDiscBadgeTextNo: {
    color: colors.textMuted,
  },
  qohBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  qohText: {
    fontSize: 10,
    fontWeight: '600',
  },
  stockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: (colors.accentRed || '#E53935') + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
    gap: 6,
  },
  stockWarningText: {
    fontSize: 11,
    color: colors.accentRed || '#E53935',
    fontWeight: '500',
    flex: 1,
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
  qtyValueWarning: {
    color: colors.accentRed || '#E53935',
  },
  qtyBtnDisabled: {
    backgroundColor: colors.surface,
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
  discountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  noDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  noDiscountText: {
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '500',
  },
  discountDisabled: {
    fontSize: 13,
    color: colors.textMuted,
  },
  taxSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  taxValueZero: {
    color: colors.textMuted,
  },
  discountTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  discountPercentActive: {
    color: colors.accentGreen || '#4CAF50',
  },
  discountAmount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  discountAmountActive: {
    color: colors.accentGreen || '#4CAF50',
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
  paymentBtnWarning: {
    backgroundColor: colors.accentRed || '#E53935',
  },
  paymentBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CheckoutScreen;
