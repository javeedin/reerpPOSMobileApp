import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Modal,
  Animated,
  Vibration,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getItemsForPriceList, getPriceListItems, getOnhand } from '../services/syncService';
import { calculateLineTotal, calculateOrderTotals } from '../services/orderService';
import { getAllLocalAdjustments } from '../services/onhandService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QUICK_QUANTITIES = [1, 5, 10, 15, 20, 25];

// Radial Quantity Picker Component
const QuantityPicker = ({ visible, onClose, onSelect, itemName }) => {
  const [customQty, setCustomQty] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
      setShowCustom(false);
      setCustomQty('');
    }
  }, [visible]);

  const handleSelect = (qty) => {
    Vibration.vibrate(10);
    onSelect(qty);
    onClose();
  };

  const handleCustomSubmit = () => {
    const qty = parseInt(customQty, 10);
    if (qty > 0) {
      handleSelect(qty);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.pickerOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.pickerContainer,
                { transform: [{ scale: scaleAnim }] }
              ]}
            >
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Add Quantity</Text>
                <Text style={styles.pickerSubtitle} numberOfLines={1}>{itemName}</Text>
              </View>

              {showCustom ? (
                <View style={styles.customQtyContainer}>
                  <TextInput
                    style={styles.customQtyInput}
                    value={customQty}
                    onChangeText={setCustomQty}
                    keyboardType="number-pad"
                    placeholder="Enter quantity"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                  <View style={styles.customQtyActions}>
                    <TouchableOpacity
                      style={styles.customBackBtn}
                      onPress={() => setShowCustom(false)}
                    >
                      <Text style={styles.customBackText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.customAddBtn}
                      onPress={handleCustomSubmit}
                    >
                      <Text style={styles.customAddText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.qtyGrid}>
                    {QUICK_QUANTITIES.map((qty) => (
                      <TouchableOpacity
                        key={`qty-${qty}`}
                        style={styles.qtyOption}
                        onPress={() => handleSelect(qty)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={[colors.accent, colors.accentDark || colors.accent]}
                          style={styles.qtyOptionGradient}
                        >
                          <Text style={styles.qtyOptionText}>{qty}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.customBtn}
                    onPress={() => setShowCustom(true)}
                  >
                    <Ionicons name="keypad-outline" size={18} color={colors.accent} />
                    <Text style={styles.customBtnText}>Custom Quantity</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// Get stock status color
const getStockColor = (qty) => {
  if (qty <= 0) return colors.accentRed || '#E53935';
  if (qty < 10) return colors.accentOrange || '#FF9800';
  return colors.accentGreen || '#4CAF50';
};

// Item Row Component
const ItemRow = ({ item, cartQty, onhandQty, onAdd, onIncrease, onDecrease, onLongPress }) => {
  const inCart = cartQty > 0;
  const availableQty = onhandQty - cartQty; // Available after cart
  const stockColor = getStockColor(onhandQty);
  const canAdd = availableQty > 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.itemRow, inCart && styles.itemRowInCart, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.itemDesc || item.itemNumber}</Text>
        <View style={styles.itemCodeRow}>
          <Text style={styles.itemCode}>{item.itemNumber}</Text>
          <View style={[styles.onhandBadge, { backgroundColor: stockColor + '20' }]}>
            <Ionicons name="cube-outline" size={10} color={stockColor} />
            <Text style={[styles.onhandText, { color: stockColor }]}>
              {onhandQty > 0 ? onhandQty : 'Out'}
            </Text>
          </View>
        </View>
        <View style={styles.itemMeta}>
          <Text style={styles.itemPrice}>
            {item.currency || 'MUR'} {(item.basePrice || 0).toFixed(2)}
          </Text>
          {item.uom && <Text style={styles.itemUom}>/{item.uom}</Text>}
        </View>
      </View>

      <View style={styles.itemActions}>
        {inCart ? (
          <View style={styles.qtyControlsContainer}>
            <TouchableOpacity
              style={styles.qtyControlBtn}
              onPress={() => onDecrease(item)}
            >
              <Ionicons name="remove" size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.qtyDisplay}
              onLongPress={() => canAdd && onLongPress(item)}
              delayLongPress={300}
            >
              <Text style={styles.qtyDisplayText}>{cartQty}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.qtyControlBtn, styles.qtyControlBtnAdd, !canAdd && styles.qtyControlBtnDisabled]}
              onPress={() => canAdd && onIncrease(item)}
              onLongPress={() => canAdd && onLongPress(item)}
              delayLongPress={300}
              disabled={!canAdd}
            >
              <Ionicons name="add" size={18} color={canAdd ? "#FFFFFF" : colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
            onPress={() => canAdd && onAdd(item, 1)}
            onLongPress={() => canAdd && onLongPress(item)}
            onPressIn={canAdd ? handlePressIn : undefined}
            onPressOut={canAdd ? handlePressOut : undefined}
            delayLongPress={300}
            activeOpacity={canAdd ? 0.8 : 1}
            disabled={!canAdd}
          >
            <LinearGradient
              colors={canAdd
                ? [colors.secondary, colors.secondaryDark || colors.secondary]
                : [colors.textMuted, colors.textMuted]
              }
              style={styles.addBtnGradient}
            >
              <Ionicons name={canAdd ? "add" : "ban"} size={22} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// Cart Item Row for Modal
const CartItemRow = ({ item, onIncrease, onDecrease, onRemove, menuConfig }) => {
  const lineTotals = calculateLineTotal(item, menuConfig);

  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.itemDesc || item.itemNumber}</Text>
        <Text style={styles.cartItemCode}>{item.itemNumber}</Text>
        <Text style={styles.cartItemPrice}>
          {item.currency || 'MUR'} {lineTotals.unitPrice.toFixed(2)} x {lineTotals.quantity}
        </Text>
      </View>
      <View style={styles.cartItemActions}>
        <TouchableOpacity style={styles.cartQtyBtn} onPress={() => onDecrease(item)}>
          <Ionicons name="remove" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.cartQtyText}>{item.quantity}</Text>
        <TouchableOpacity style={styles.cartQtyBtn} onPress={() => onIncrease(item)}>
          <Ionicons name="add" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartRemoveBtn} onPress={() => onRemove(item)}>
          <Ionicons name="trash-outline" size={16} color={colors.accentRed || '#E53935'} />
        </TouchableOpacity>
      </View>
      <Text style={styles.cartItemTotal}>{lineTotals.net.toFixed(2)}</Text>
    </View>
  );
};

const ItemSelectionScreen = ({ navigation, route }) => {
  const { menuConfig, customer } = route.params || {};
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showQtyPicker, setShowQtyPicker] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [onhandMap, setOnhandMap] = useState({});

  const priceListName = customer?.priceList || menuConfig?.priceList || '';

  useEffect(() => {
    loadItems();
    loadOnhandData();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      let data = [];
      if (priceListName) {
        data = await getItemsForPriceList(priceListName);
      }
      if (!data || data.length === 0) {
        data = await getPriceListItems();
      }
      setItems(data || []);
      setFilteredItems(data || []);
    } catch (error) {
      console.error('Load items error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOnhandData = async () => {
    try {
      // Load synced on-hand data
      const onhandData = await getOnhand() || [];
      // Load local adjustments (sales, etc.)
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
          // Item has adjustments but wasn't in onhand - track it anyway
          map[itemNum] = adjustments[itemNum];
        }
      });

      setOnhandMap(map);
    } catch (error) {
      console.error('Load onhand error:', error);
    }
  };

  // Get on-hand qty - returns 0 if not found in on-hand table
  const getOnhandQty = (item) => {
    const qty = onhandMap[item.itemNumber];
    return qty !== undefined ? Math.max(0, qty) : 0;
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = items.filter(item =>
        (item.itemNumber || '').toLowerCase().includes(query) ||
        (item.itemDesc || '').toLowerCase().includes(query) ||
        (item.barcode || '').toLowerCase().includes(query)
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  }, [searchQuery, items]);

  const getCartQty = (item) => {
    const cartItem = cart.find(c => c.itemNumber === item.itemNumber);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleAddItem = (item, qty = 1) => {
    const onhandQty = getOnhandQty(item);
    const cartQty = getCartQty(item);
    const availableQty = onhandQty - cartQty;

    if (availableQty <= 0) {
      Vibration.vibrate([0, 50, 50, 50]);
      Alert.alert('Out of Stock', `${item.itemDesc || item.itemNumber} is out of stock.`);
      return;
    }

    const qtyToAdd = Math.min(qty, availableQty);
    if (qtyToAdd < qty) {
      Vibration.vibrate([0, 50, 50, 50]);
      Alert.alert(
        'Limited Stock',
        `Only ${availableQty} units available. Adding ${qtyToAdd} to cart.`
      );
    } else {
      Vibration.vibrate(10);
    }

    const existingIndex = cart.findIndex(c => c.itemNumber === item.itemNumber);

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += qtyToAdd;
      setCart(newCart);
    } else {
      setCart([...cart, {
        ...item,
        quantity: qtyToAdd,
        discount: 0,
        discountType: 'percent',
        unitPrice: item.basePrice || 0,
      }]);
    }
  };

  const handleLongPressItem = (item) => {
    const onhandQty = getOnhandQty(item);
    const cartQty = getCartQty(item);
    const availableQty = onhandQty - cartQty;

    if (availableQty <= 0) {
      Vibration.vibrate([0, 50, 50, 50]);
      Alert.alert('Out of Stock', `${item.itemDesc || item.itemNumber} is out of stock.`);
      return;
    }

    Vibration.vibrate(50);
    setSelectedItem(item);
    setShowQtyPicker(true);
  };

  const handleQtySelect = (qty) => {
    if (selectedItem) {
      handleAddItem(selectedItem, qty);
    }
  };

  const handleIncreaseQty = (item) => {
    const onhandQty = getOnhandQty(item);
    const cartQty = getCartQty(item);
    const availableQty = onhandQty - cartQty;

    if (availableQty <= 0) {
      Vibration.vibrate([0, 50, 50, 50]);
      Alert.alert('Stock Limit', `No more stock available for ${item.itemDesc || item.itemNumber}.`);
      return;
    }

    Vibration.vibrate(10);
    const newCart = cart.map(c => {
      if (c.itemNumber === item.itemNumber) {
        return { ...c, quantity: c.quantity + 1 };
      }
      return c;
    });
    setCart(newCart);
  };

  const handleDecreaseQty = (item) => {
    Vibration.vibrate(10);
    const newCart = cart.map(c => {
      if (c.itemNumber === item.itemNumber) {
        if (c.quantity > 1) {
          return { ...c, quantity: c.quantity - 1 };
        }
        return null;
      }
      return c;
    }).filter(Boolean);
    setCart(newCart);
  };

  const handleRemoveItem = (item) => {
    setCart(cart.filter(c => c.itemNumber !== item.itemNumber));
  };

  const handleProceedToCheckout = () => {
    if (cart.length === 0) return;
    setShowCart(false);
    navigation.navigate('Checkout', {
      menuConfig,
      customer,
      cart,
    });
  };

  const handleSaveAsDraft = () => {
    if (cart.length === 0) return;
    setShowCart(false);
    navigation.navigate('Checkout', {
      menuConfig,
      customer,
      cart,
      saveAsDraft: true,
    });
  };

  const totals = calculateOrderTotals(cart, menuConfig);
  const currency = cart[0]?.currency || 'MUR';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Add Items</Text>
          <Text style={styles.headerSubtitle}>
            {customer?.name || 'Walk-in Customer'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowCart(true)} style={styles.cartButton}>
          <Ionicons name="cart" size={24} color="#FFFFFF" />
          {cart.length > 0 && (
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.content}>
        {priceListName && (
          <View style={styles.priceListBar}>
            <Ionicons name="pricetag" size={14} color={colors.accent} />
            <Text style={styles.priceListBarText}>Price List: {priceListName}</Text>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.scanButton}>
            <Ionicons name="barcode-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBar}>
          <Text style={styles.countText}>{filteredItems.length.toLocaleString()} items</Text>
          <View style={styles.tipContainer}>
            <Ionicons name="finger-print" size={12} color={colors.secondary} />
            <Text style={styles.tipText}>Long press for bulk add</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading items...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item, index) => `item-${index}-${item.itemNumber || ''}`}
            renderItem={({ item }) => (
              <ItemRow
                item={item}
                cartQty={getCartQty(item)}
                onhandQty={getOnhandQty(item)}
                onAdd={handleAddItem}
                onIncrease={handleIncreaseQty}
                onDecrease={handleDecreaseQty}
                onLongPress={handleLongPressItem}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>No items found</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Bottom Bar */}
      {cart.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>{totals.totalItems} items</Text>
            <Text style={styles.totalAmount}>
              {currency} {totals.totalNet.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleProceedToCheckout}>
            <Text style={styles.checkoutBtnText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Quantity Picker */}
      <QuantityPicker
        visible={showQtyPicker}
        onClose={() => {
          setShowQtyPicker(false);
          setSelectedItem(null);
        }}
        onSelect={handleQtySelect}
        itemName={selectedItem?.itemDesc || selectedItem?.itemNumber || ''}
      />

      {/* Cart Modal */}
      <Modal
        visible={showCart}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCart(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cartModal}>
            <View style={styles.cartModalHeader}>
              <Text style={styles.cartModalTitle}>Cart ({cart.length})</Text>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={cart}
              keyExtractor={(item, index) => `cart-${index}-${item.itemNumber || ''}`}
              renderItem={({ item }) => (
                <CartItemRow
                  item={item}
                  onIncrease={handleIncreaseQty}
                  onDecrease={handleDecreaseQty}
                  onRemove={handleRemoveItem}
                  menuConfig={menuConfig}
                />
              )}
              contentContainerStyle={styles.cartListContent}
              ListEmptyComponent={
                <View style={styles.emptyCart}>
                  <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyCartText}>Your cart is empty</Text>
                </View>
              }
            />

            {cart.length > 0 && (
              <View style={styles.cartTotals}>
                <View style={styles.cartTotalRow}>
                  <Text style={styles.cartTotalLabel}>Subtotal</Text>
                  <Text style={styles.cartTotalValue}>{currency} {totals.totalGross.toFixed(2)}</Text>
                </View>
                {totals.totalTax > 0 && (
                  <View style={styles.cartTotalRow}>
                    <Text style={styles.cartTotalLabel}>Tax (15%)</Text>
                    <Text style={styles.cartTotalValue}>{currency} {totals.totalTax.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.cartTotalRow, styles.cartGrandTotal]}>
                  <Text style={styles.cartGrandTotalLabel}>Total</Text>
                  <Text style={styles.cartGrandTotalValue}>{currency} {totals.totalNet.toFixed(2)}</Text>
                </View>

                <View style={styles.cartActions}>
                  <TouchableOpacity style={styles.draftBtn} onPress={handleSaveAsDraft}>
                    <Ionicons name="save-outline" size={18} color={colors.accent} />
                    <Text style={styles.draftBtnText}>Draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.proceedBtn} onPress={handleProceedToCheckout}>
                    <Text style={styles.proceedBtnText}>Checkout</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  cartButton: {
    padding: 8,
    position: 'relative',
  },
  cartCount: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.secondary,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  priceListBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  priceListBarText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.textPrimary,
    fontSize: 13,
  },
  scanButton: {
    padding: 6,
    marginLeft: 6,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  countText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tipText: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemRowInCart: {
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.secondary + '05',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
    lineHeight: 17,
  },
  itemCode: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  itemCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 6,
  },
  onhandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  onhandText: {
    fontSize: 9,
    fontWeight: '600',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.accent,
  },
  itemUom: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 2,
  },
  itemActions: {
    justifyContent: 'center',
  },
  addBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  qtyControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  qtyControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  qtyControlBtnAdd: {
    backgroundColor: colors.secondary,
  },
  qtyControlBtnDisabled: {
    backgroundColor: colors.surface,
  },
  qtyDisplay: {
    minWidth: 40,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyDisplayText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // Quantity Picker Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  pickerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pickerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  qtyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  qtyOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  qtyOptionGradient: {
    width: 72,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  qtyOptionText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  customBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  customQtyContainer: {
    marginBottom: 12,
  },
  customQtyInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  customQtyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  customBackBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  customBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  customAddBtn: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  customAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  // Bottom bar & other styles
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 6,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
  // Cart Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  cartModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  cartModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cartListContent: {
    paddingHorizontal: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cartItemCode: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  cartItemPrice: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 4,
  },
  cartQtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartQtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  cartRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: (colors.accentRed || '#E53935') + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    minWidth: 70,
    textAlign: 'right',
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCartText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
  },
  cartTotals: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cartTotalLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  cartTotalValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  cartGrandTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cartGrandTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cartGrandTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
  },
  cartActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  draftBtn: {
    flex: 0.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  draftBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  proceedBtn: {
    flex: 0.65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ItemSelectionScreen;
