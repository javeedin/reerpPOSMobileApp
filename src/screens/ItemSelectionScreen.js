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

// Helper to get item number (supports both SQLite snake_case and legacy camelCase)
const getItemNumber = (item) => item.item_number || item.itemNumber || '';
const getItemDesc = (item) => item.item_desc || item.itemDesc || getItemNumber(item);
const getBasePrice = (item) => parseFloat(item.base_price || item.basePrice || 0);
const getCurrency = (item) => item.currency_code || item.currency || 'MUR';

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

  // Support SQLite snake_case and legacy camelCase formats
  const itemNumber = item.item_number || item.itemNumber || '';
  const itemDesc = item.item_desc || item.itemDesc || itemNumber;
  const basePrice = parseFloat(item.base_price || item.basePrice || 0);
  const currencyCode = item.currency_code || item.currency || 'MUR';
  const uom = item.pricing_uom_code || item.uom || '';

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
        <Text style={styles.itemName} numberOfLines={2}>{itemDesc}</Text>
        <View style={styles.itemCodeRow}>
          <Text style={styles.itemCode}>{itemNumber}</Text>
          <View style={[styles.onhandBadge, { backgroundColor: stockColor + '20' }]}>
            <Ionicons name="cube-outline" size={12} color={stockColor} />
            <Text style={[styles.onhandText, { color: stockColor }]}>
              {onhandQty > 0 ? onhandQty : 'Out'}
            </Text>
          </View>
        </View>
        <View style={styles.itemMeta}>
          <Text style={styles.itemPrice}>
            {currencyCode} {basePrice.toFixed(2)}
          </Text>
          {uom && <Text style={styles.itemUom}>/{uom}</Text>}
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

  // Support SQLite snake_case and legacy camelCase formats
  const itemNumber = item.item_number || item.itemNumber || '';
  const itemDesc = item.item_desc || item.itemDesc || itemNumber;
  const currencyCode = item.currency_code || item.currency || 'MUR';

  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{itemDesc}</Text>
        <Text style={styles.cartItemCode}>{itemNumber}</Text>
        <Text style={styles.cartItemPrice}>
          {currencyCode} {lineTotals.unitPrice.toFixed(2)} x {lineTotals.quantity}
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
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [priceListWarning, setPriceListWarning] = useState(null);

  // Debug: Log customer object to check price list field name
  console.log('=== ItemSelectionScreen Debug ===');
  console.log('Customer object:', JSON.stringify(customer, null, 2));
  console.log('Customer priceList field:', customer?.priceList);
  console.log('Customer price_list field:', customer?.price_list);
  console.log('menuConfig priceList:', menuConfig?.priceList);

  // Support both camelCase and snake_case field names for customer price list
  const priceListName = customer?.priceList || customer?.price_list || menuConfig?.priceList || '';
  console.log('Resolved priceListName:', priceListName);

  useEffect(() => {
    loadItems();
    loadOnhandData();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    setPriceListWarning(null);
    try {
      let data = [];
      console.log('=== loadItems Debug ===');
      console.log('priceListName to filter by:', priceListName);

      if (priceListName) {
        console.log('Calling getItemsForPriceList with:', priceListName);
        data = await getItemsForPriceList(priceListName);
        console.log('getItemsForPriceList returned:', data?.length || 0, 'items');

        // Log first 3 items to check their list_name
        if (data && data.length > 0) {
          console.log('Sample items list_name values:');
          data.slice(0, 3).forEach((item, idx) => {
            console.log(`  Item ${idx}: list_name="${item.list_name}", listName="${item.listName}"`);
          });
        }
      }

      // If customer has a specific price list but no items found
      if (priceListName && (!data || data.length === 0)) {
        console.log(`WARNING: Customer price list "${priceListName}" not synced or has no items!`);
        console.log('Falling back to getPriceListItems()');

        // Load all items as fallback
        const allData = await getPriceListItems();
        console.log('getPriceListItems returned:', allData?.length || 0, 'items');

        if (allData && allData.length > 0) {
          // Show warning that we're showing items from a different price list
          const firstItemList = allData[0]?.list_name || 'Unknown';
          setPriceListWarning(`Price list "${priceListName}" not synced. Showing items from "${firstItemList}".`);
          console.log(`WARNING: Showing items from "${firstItemList}" instead of "${priceListName}"`);

          // Log the actual price lists in the fallback data
          const uniqueLists = [...new Set(allData.map(item => item.list_name))];
          console.log('Price lists in fallback data:', uniqueLists.join(', '));
        }

        data = allData;
      } else if (!priceListName) {
        // No price list specified - load all items
        console.log('No priceListName specified, loading all items');
        data = await getPriceListItems();
        console.log('getPriceListItems returned:', data?.length || 0, 'items');
      }

      setItems(data || []);
      setFilteredItems(data || []);
      console.log('Final items count:', data?.length || 0);
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
    const itemNum = getItemNumber(item);
    const qty = onhandMap[itemNum];
    return qty !== undefined ? Math.max(0, qty) : 0;
  };

  useEffect(() => {
    let result = [...items];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => {
        const itemNum = getItemNumber(item);
        const itemDesc = getItemDesc(item);
        return itemNum.toLowerCase().includes(query) ||
          itemDesc.toLowerCase().includes(query) ||
          (item.barcode || '').toLowerCase().includes(query);
      });
    }

    // Filter by availability
    if (showOnlyAvailable) {
      result = result.filter(item => {
        const itemNum = getItemNumber(item);
        const qty = onhandMap[itemNum];
        return qty !== undefined && qty > 0;
      });
    }

    setFilteredItems(result);
  }, [searchQuery, items, showOnlyAvailable, onhandMap]);

  const getCartQty = (item) => {
    const itemNum = getItemNumber(item);
    const cartItem = cart.find(c => getItemNumber(c) === itemNum);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleAddItem = (item, qty = 1) => {
    const onhandQty = getOnhandQty(item);
    const cartQty = getCartQty(item);
    const availableQty = onhandQty - cartQty;
    const itemNum = getItemNumber(item);
    const itemDesc = getItemDesc(item);

    if (availableQty <= 0) {
      Vibration.vibrate([0, 50, 50, 50]);
      Alert.alert('Out of Stock', `${itemDesc} is out of stock.`);
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

    const existingIndex = cart.findIndex(c => getItemNumber(c) === itemNum);

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += qtyToAdd;
      setCart(newCart);
    } else {
      // Normalize the item to use consistent field names for cart
      setCart([...cart, {
        ...item,
        // Ensure consistent field names for cart operations
        itemNumber: itemNum,
        itemDesc: itemDesc,
        quantity: qtyToAdd,
        discount: 0,
        discountType: 'percent',
        unitPrice: getBasePrice(item),
        currency: getCurrency(item),
      }]);
    }
  };

  const handleLongPressItem = (item) => {
    const onhandQty = getOnhandQty(item);
    const cartQty = getCartQty(item);
    const availableQty = onhandQty - cartQty;
    const itemDesc = getItemDesc(item);

    if (availableQty <= 0) {
      Vibration.vibrate([0, 50, 50, 50]);
      Alert.alert('Out of Stock', `${itemDesc} is out of stock.`);
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
    const itemNum = getItemNumber(item);
    const itemDesc = getItemDesc(item);

    if (availableQty <= 0) {
      Vibration.vibrate([0, 50, 50, 50]);
      Alert.alert('Stock Limit', `No more stock available for ${itemDesc}.`);
      return;
    }

    Vibration.vibrate(10);
    const newCart = cart.map(c => {
      if (getItemNumber(c) === itemNum) {
        return { ...c, quantity: c.quantity + 1 };
      }
      return c;
    });
    setCart(newCart);
  };

  const handleDecreaseQty = (item) => {
    Vibration.vibrate(10);
    const itemNum = getItemNumber(item);
    const newCart = cart.map(c => {
      if (getItemNumber(c) === itemNum) {
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
    const itemNum = getItemNumber(item);
    setCart(cart.filter(c => getItemNumber(c) !== itemNum));
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
          <View style={[styles.priceListBar, priceListWarning && styles.priceListBarWarning]}>
            <Ionicons name="pricetag" size={14} color={priceListWarning ? colors.accentOrange || '#FF9800' : colors.accent} />
            <Text style={[styles.priceListBarText, priceListWarning && styles.priceListBarTextWarning]}>
              Price List: {priceListName}
            </Text>
          </View>
        )}
        {priceListWarning && (
          <View style={styles.warningBar}>
            <Ionicons name="warning" size={14} color={colors.accentOrange || '#FF9800'} />
            <Text style={styles.warningBarText}>{priceListWarning}</Text>
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
          <TouchableOpacity
            style={[styles.availableFilter, showOnlyAvailable && styles.availableFilterActive]}
            onPress={() => setShowOnlyAvailable(!showOnlyAvailable)}
          >
            <Ionicons
              name={showOnlyAvailable ? "checkmark-circle" : "ellipse-outline"}
              size={14}
              color={showOnlyAvailable ? colors.accentGreen || '#4CAF50' : colors.textMuted}
            />
            <Text style={[styles.availableFilterText, showOnlyAvailable && styles.availableFilterTextActive]}>
              In Stock Only
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading items...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item, index) => `item-${index}-${getItemNumber(item)}`}
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
        itemName={selectedItem ? getItemDesc(selectedItem) : ''}
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
              keyExtractor={(item, index) => `cart-${index}-${getItemNumber(item)}`}
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
  priceListBarWarning: {
    backgroundColor: (colors.accentOrange || '#FF9800') + '15',
  },
  priceListBarTextWarning: {
    color: colors.accentOrange || '#FF9800',
  },
  warningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: (colors.accentOrange || '#FF9800') + '10',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: (colors.accentOrange || '#FF9800') + '30',
  },
  warningBarText: {
    fontSize: 11,
    color: colors.accentOrange || '#FF9800',
    fontWeight: '500',
    flex: 1,
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
  availableFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availableFilterActive: {
    backgroundColor: (colors.accentGreen || '#4CAF50') + '15',
    borderColor: (colors.accentGreen || '#4CAF50') + '50',
  },
  availableFilterText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  availableFilterTextActive: {
    color: colors.accentGreen || '#4CAF50',
    fontWeight: '600',
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
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  onhandText: {
    fontSize: 11,
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
