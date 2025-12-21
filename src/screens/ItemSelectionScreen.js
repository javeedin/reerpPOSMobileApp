import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getItemsForPriceList, getPriceListItems } from '../services/syncService';
import { calculateLineTotal, calculateOrderTotals } from '../services/orderService';

const ItemCard = ({ item, onAdd, cartItem }) => {
  const inCart = cartItem && cartItem.quantity > 0;

  return (
    <TouchableOpacity
      style={[styles.itemCard, inCart && styles.itemCardInCart]}
      onPress={() => onAdd(item)}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.itemDesc || item.itemNumber}</Text>
        <Text style={styles.itemNumber}>{item.itemNumber}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemPrice}>
            {item.currency || 'MUR'} {(item.basePrice || 0).toFixed(2)}
          </Text>
          {item.uom && (
            <Text style={styles.itemUom}>/{item.uom}</Text>
          )}
        </View>
      </View>
      {inCart ? (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{cartItem.quantity}</Text>
        </View>
      ) : (
        <View style={styles.addButton}>
          <Ionicons name="add" size={20} color={colors.accent} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const CartItemRow = ({ item, onIncrease, onDecrease, onRemove, onDiscount, menuConfig }) => {
  const lineTotals = calculateLineTotal(item, menuConfig);

  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.itemDesc || item.itemNumber}</Text>
        <Text style={styles.cartItemPrice}>
          {item.currency || 'MUR'} {lineTotals.unitPrice.toFixed(2)} x {lineTotals.quantity}
        </Text>
        {lineTotals.discountAmount > 0 && (
          <Text style={styles.cartItemDiscount}>
            Discount: -{lineTotals.discountAmount.toFixed(2)}
          </Text>
        )}
      </View>
      <View style={styles.cartItemActions}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onDecrease(item)}>
          <Ionicons name="remove" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onIncrease(item)}>
          <Ionicons name="add" size={16} color={colors.textPrimary} />
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

  // Determine which price list to use
  const priceListName = customer?.priceList || menuConfig?.priceList || '';

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      let data = [];
      if (priceListName) {
        data = await getItemsForPriceList(priceListName);
      }
      // If no price list items, get all items
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

  const getCartItem = (item) => {
    return cart.find(c => c.id === item.id || c.itemNumber === item.itemNumber);
  };

  const handleAddItem = (item) => {
    const existingIndex = cart.findIndex(c => c.id === item.id || c.itemNumber === item.itemNumber);

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, {
        ...item,
        quantity: 1,
        discount: 0,
        discountType: 'amount',
        unitPrice: item.basePrice || 0,
      }]);
    }
  };

  const handleIncreaseQty = (item) => {
    const newCart = cart.map(c => {
      if (c.id === item.id || c.itemNumber === item.itemNumber) {
        return { ...c, quantity: c.quantity + 1 };
      }
      return c;
    });
    setCart(newCart);
  };

  const handleDecreaseQty = (item) => {
    const newCart = cart.map(c => {
      if (c.id === item.id || c.itemNumber === item.itemNumber) {
        if (c.quantity > 1) {
          return { ...c, quantity: c.quantity - 1 };
        }
        return null; // Will be filtered out
      }
      return c;
    }).filter(Boolean);
    setCart(newCart);
  };

  const handleRemoveItem = (item) => {
    setCart(cart.filter(c => c.id !== item.id && c.itemNumber !== item.itemNumber));
  };

  const handleProceedToCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to proceed.');
      return;
    }

    navigation.navigate('Checkout', {
      menuConfig,
      customer,
      cart,
    });
  };

  const handleSaveAsDraft = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to save as draft.');
      return;
    }

    // Navigate to checkout with draft flag
    navigation.navigate('Checkout', {
      menuConfig,
      customer,
      cart,
      saveAsDraft: true,
    });
  };

  const totals = calculateOrderTotals(cart, menuConfig);

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
        {/* Price List Info */}
        {priceListName && (
          <View style={styles.priceListBar}>
            <Ionicons name="pricetag" size={14} color={colors.accent} />
            <Text style={styles.priceListBarText}>Price List: {priceListName}</Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items or scan barcode..."
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

        {/* Item Count */}
        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {filteredItems.length.toLocaleString()} items
          </Text>
        </View>

        {/* Item List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading items...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item, index) => `item-${item.id || item.itemNumber || index}`}
            numColumns={2}
            renderItem={({ item }) => (
              <ItemCard
                item={item}
                onAdd={handleAddItem}
                cartItem={getCartItem(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>No items found</Text>
                <Text style={styles.emptySubtext}>Try a different search or sync price list data</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Bottom Bar with Totals */}
      {cart.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>{totals.totalItems} items</Text>
            <Text style={styles.totalAmount}>
              {(cart[0]?.currency || 'MUR')} {totals.totalNet.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleProceedToCheckout}>
            <Text style={styles.checkoutBtnText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

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
              <Text style={styles.cartModalTitle}>Cart ({cart.length} items)</Text>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={cart}
              keyExtractor={(item, index) => `cart-${item.id || item.itemNumber || index}`}
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
                  <Text style={styles.cartTotalValue}>{totals.totalGross.toFixed(2)}</Text>
                </View>
                {totals.totalDiscount > 0 && (
                  <View style={styles.cartTotalRow}>
                    <Text style={styles.cartTotalLabel}>Discount</Text>
                    <Text style={[styles.cartTotalValue, { color: colors.accentGreen }]}>
                      -{totals.totalDiscount.toFixed(2)}
                    </Text>
                  </View>
                )}
                {totals.totalTax > 0 && (
                  <View style={styles.cartTotalRow}>
                    <Text style={styles.cartTotalLabel}>Tax (15%)</Text>
                    <Text style={styles.cartTotalValue}>{totals.totalTax.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.cartTotalRow, styles.cartGrandTotal]}>
                  <Text style={styles.cartGrandTotalLabel}>Total</Text>
                  <Text style={styles.cartGrandTotalValue}>{totals.totalNet.toFixed(2)}</Text>
                </View>

                <View style={styles.cartActions}>
                  <TouchableOpacity style={styles.draftBtn} onPress={handleSaveAsDraft}>
                    <Ionicons name="save-outline" size={18} color={colors.accent} />
                    <Text style={styles.draftBtnText}>Save Draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.proceedBtn} onPress={handleProceedToCheckout}>
                    <Text style={styles.proceedBtnText}>Proceed</Text>
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
    borderRadius: 10,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.textPrimary,
    fontSize: 14,
  },
  scanButton: {
    padding: 6,
    marginLeft: 6,
  },
  countBar: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  countText: {
    fontSize: 12,
    color: colors.textMuted,
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
    paddingHorizontal: 8,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  itemCard: {
    flex: 0.48,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemCardInCart: {
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 18,
  },
  itemNumber: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 6,
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
    fontSize: 10,
    color: colors.textMuted,
  },
  addButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
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
  cartItemPrice: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cartItemDiscount: {
    fontSize: 11,
    color: colors.accentGreen,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
  },
  cartActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  draftBtn: {
    flex: 1,
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
  proceedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ItemSelectionScreen;
