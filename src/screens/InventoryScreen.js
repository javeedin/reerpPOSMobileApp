import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

// Sample inventory data
const sampleInventory = [
  { id: '1', name: 'Product A', sku: 'SKU-001', quantity: 150, minStock: 20, price: '$25.00' },
  { id: '2', name: 'Product B', sku: 'SKU-002', quantity: 8, minStock: 15, price: '$45.00' },
  { id: '3', name: 'Product C', sku: 'SKU-003', quantity: 230, minStock: 50, price: '$12.50' },
  { id: '4', name: 'Product D', sku: 'SKU-004', quantity: 5, minStock: 10, price: '$89.00' },
  { id: '5', name: 'Product E', sku: 'SKU-005', quantity: 75, minStock: 25, price: '$34.99' },
  { id: '6', name: 'Product F', sku: 'SKU-006', quantity: 0, minStock: 30, price: '$67.50' },
];

const getStockStatus = (quantity, minStock) => {
  if (quantity === 0) return { label: 'Out of Stock', color: colors.accentRed };
  if (quantity < minStock) return { label: 'Low Stock', color: colors.accentOrange };
  return { label: 'In Stock', color: colors.accentGreen };
};

const InventoryCard = ({ item }) => {
  const stockStatus = getStockStatus(item.quantity, item.minStock);

  return (
    <TouchableOpacity style={styles.inventoryCard} activeOpacity={0.7}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconContainer, { backgroundColor: stockStatus.color + '20' }]}>
          <Ionicons name="cube" size={24} color={stockStatus.color} />
        </View>
      </View>
      <View style={styles.cardCenter}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.sku}>{item.sku}</Text>
        <View style={[styles.statusBadge, { backgroundColor: stockStatus.color + '20' }]}>
          <Text style={[styles.statusText, { color: stockStatus.color }]}>{stockStatus.label}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <Text style={styles.quantityLabel}>units</Text>
        <Text style={styles.price}>{item.price}</Text>
      </View>
    </TouchableOpacity>
  );
};

const InventoryScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInventory = sampleInventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.primaryDark, colors.background]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inventory</Text>
          <TouchableOpacity style={styles.scanButton}>
            <Ionicons name="barcode-outline" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { borderLeftColor: colors.accent }]}>
            <Text style={styles.summaryValue}>468</Text>
            <Text style={styles.summaryLabel}>Total Items</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: colors.accentOrange }]}>
            <Text style={styles.summaryValue}>12</Text>
            <Text style={styles.summaryLabel}>Low Stock</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: colors.accentRed }]}>
            <Text style={styles.summaryValue}>3</Text>
            <Text style={styles.summaryLabel}>Out of Stock</Text>
          </View>
        </View>

        {/* Inventory List */}
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InventoryCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scanButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.textPrimary,
    fontSize: 15,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  inventoryCard: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardLeft: {
    marginRight: 14,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCenter: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  sku: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  quantityLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  price: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
});

export default InventoryScreen;
