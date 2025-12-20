import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

// Sample orders data
const sampleOrders = [
  { id: '1', orderNumber: 'ORD-2024-001', customer: 'John Smith', amount: '$245.00', status: 'Completed', date: '2024-01-15' },
  { id: '2', orderNumber: 'ORD-2024-002', customer: 'Jane Doe', amount: '$180.50', status: 'Pending', date: '2024-01-15' },
  { id: '3', orderNumber: 'ORD-2024-003', customer: 'Bob Wilson', amount: '$520.00', status: 'Processing', date: '2024-01-14' },
  { id: '4', orderNumber: 'ORD-2024-004', customer: 'Alice Brown', amount: '$95.25', status: 'Completed', date: '2024-01-14' },
  { id: '5', orderNumber: 'ORD-2024-005', customer: 'Charlie Davis', amount: '$312.00', status: 'Completed', date: '2024-01-13' },
];

const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return colors.accentGreen;
    case 'pending':
      return colors.accentOrange;
    case 'processing':
      return colors.accent;
    default:
      return colors.textMuted;
  }
};

const OrderCard = ({ order }) => (
  <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
    <View style={styles.orderHeader}>
      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status}</Text>
      </View>
    </View>
    <View style={styles.orderBody}>
      <View style={styles.orderInfo}>
        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.customerName}>{order.customer}</Text>
      </View>
      <View style={styles.orderInfo}>
        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.orderDate}>{order.date}</Text>
      </View>
    </View>
    <View style={styles.orderFooter}>
      <Text style={styles.amountLabel}>Total</Text>
      <Text style={styles.amount}>{order.amount}</Text>
    </View>
  </TouchableOpacity>
);

const OrdersScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.primaryDark, colors.background]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('AccountDetails')} style={styles.menuButton}>
            <Ionicons name="person-circle" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Orders</Text>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add-circle" size={28} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {['All', 'Pending', 'Processing', 'Completed'].map((filter, index) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterTab, index === 0 && styles.filterTabActive]}
            >
              <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Orders List */}
        <FlatList
          data={sampleOrders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No orders found</Text>
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
  addButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
  },
  filterTabActive: {
    backgroundColor: colors.accent,
  },
  filterText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  orderBody: {
    marginBottom: 12,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  customerName: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  orderDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  amountLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
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

export default OrdersScreen;
