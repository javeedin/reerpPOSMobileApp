import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { queryHistoricalOrders } from '../services/syncService';

const FILTER_CONFIG = {
  all: { title: 'All Customers', icon: 'people', color: '#2196F3' },
  top: { title: 'Top Customers', icon: 'trophy', color: '#FFC107' },
  active: { title: 'Active Customers', icon: 'checkmark-circle', color: '#4CAF50' },
  inactive: { title: 'Inactive Customers', icon: 'moon', color: '#9E9E9E' },
  receivables: { title: 'With Balance', icon: 'wallet', color: '#FF9800' },
  customers: { title: 'All Customers', icon: 'people', color: '#2196F3' },
  sales: { title: 'By Sales Volume', icon: 'trending-up', color: '#9C27B0' },
};

const CustomerListScreen = ({ route, navigation }) => {
  const { filter = 'all' } = route.params || {};
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const config = FILTER_CONFIG[filter] || FILTER_CONFIG.all;

  // Load and filter customers
  const loadCustomers = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 365); // Last year

      const result = await queryHistoricalOrders({
        fromDate,
        toDate: today,
        salesrepNumber: user?.username || '',
      });

      const orders = result.success ? (result.orders || []) : [];

      // Extract unique customers with aggregates
      const customerMap = {};
      orders.forEach(order => {
        const name = order.accountName || order.customerName || order.accountNumber || 'Unknown';
        const code = order.accountNumber || '';
        const key = code || name;

        if (!customerMap[key]) {
          customerMap[key] = {
            name,
            accountNumber: code,
            phone: order.phone || order.customerPhone || '',
            totalSpent: 0,
            orderCount: 0,
            lastOrder: null,
            balance: Math.floor(Math.random() * 50000), // Simulated
          };
        }
        customerMap[key].totalSpent += (order.calculatedTotalNet || 0);
        customerMap[key].orderCount += 1;
        const orderDate = new Date(order.orderDate);
        if (!customerMap[key].lastOrder || orderDate > customerMap[key].lastOrder) {
          customerMap[key].lastOrder = orderDate;
        }
      });

      let customerList = Object.values(customerMap);

      // Apply filter
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      switch (filter) {
        case 'top':
          customerList = customerList
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 20);
          break;
        case 'active':
          customerList = customerList
            .filter(c => c.lastOrder && c.lastOrder > thirtyDaysAgo)
            .sort((a, b) => b.lastOrder - a.lastOrder);
          break;
        case 'inactive':
          customerList = customerList
            .filter(c => !c.lastOrder || c.lastOrder < thirtyDaysAgo)
            .sort((a, b) => (b.lastOrder || 0) - (a.lastOrder || 0));
          break;
        case 'receivables':
          customerList = customerList
            .filter(c => c.balance > 0)
            .sort((a, b) => b.balance - a.balance);
          break;
        case 'sales':
          customerList = customerList.sort((a, b) => b.totalSpent - a.totalSpent);
          break;
        default:
          customerList = customerList.sort((a, b) => b.totalSpent - a.totalSpent);
      }

      setCustomers(customerList);
    } catch (error) {
      console.error('[CustomerList] Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const renderCustomer = ({ item, index }) => {
    const daysSinceOrder = item.lastOrder
      ? Math.floor((new Date() - item.lastOrder) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <TouchableOpacity
        style={styles.customerCard}
        onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
      >
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: ['#E3F2FD', '#FFF3E0', '#E8F5E9', '#FCE4EC'][index % 4] }]}>
          <Text style={styles.avatarText}>{(item.name || 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>{item.name}</Text>
          {item.accountNumber && (
            <Text style={styles.customerCode}>{item.accountNumber}</Text>
          )}
          <View style={styles.customerStats}>
            <View style={styles.statItem}>
              <Ionicons name="receipt-outline" size={12} color="#666666" />
              <Text style={styles.statText}>{item.orderCount} orders</Text>
            </View>
            {daysSinceOrder !== null && (
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={12} color="#666666" />
                <Text style={styles.statText}>{daysSinceOrder}d ago</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.rightColumn}>
          <Text style={styles.amountText}>₹{formatCurrency(item.totalSpent)}</Text>
          {filter === 'receivables' && (
            <Text style={styles.balanceText}>Bal: ₹{formatCurrency(item.balance)}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CCCCCC" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D47A1" />

      {/* Header */}
      <LinearGradient
        colors={['#0D47A1', '#1565C3']}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: config.color + '30' }]}>
            <Ionicons name={config.icon} size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>{config.title}</Text>
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('CustomerSearch')}
        >
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{customers.length}</Text>
          <Text style={styles.summaryLabel}>Customers</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            ₹{formatCurrency(customers.reduce((sum, c) => sum + c.totalSpent, 0))}
          </Text>
          <Text style={styles.summaryLabel}>Total Sales</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {customers.reduce((sum, c) => sum + c.orderCount, 0)}
          </Text>
          <Text style={styles.summaryLabel}>Orders</Text>
        </View>
      </View>

      {/* Customer List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D47A1" />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          renderItem={renderCustomer}
          keyExtractor={(item, index) => item.accountNumber || `customer-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D47A1',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD54F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D47A1',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  customerCode: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 4,
  },
  customerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 4,
  },
  rightColumn: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D47A1',
  },
  balanceText: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    marginTop: 12,
  },
});

export default CustomerListScreen;
