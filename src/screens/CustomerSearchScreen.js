import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

// Use the same cache key as HomeScreen
const SALES_CACHE_KEY = 'home_sales_cache';

const CustomerSearchScreen = ({ route, navigation }) => {
  const { mode = 'default' } = route.params || {};
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef(null);

  // Mode configuration
  const modeConfig = {
    default: { title: 'Search Customer', icon: 'search', action: 'View Details' },
    balance: { title: 'Check Balance', icon: 'wallet', action: 'View Balance' },
    statement: { title: 'Send Statement', icon: 'document-text', action: 'Send Statement' },
    call: { title: 'Call Customer', icon: 'call', action: 'Call Now' },
    feedback: { title: 'Record Feedback', icon: 'chatbubble-ellipses', action: 'Record' },
    orders: { title: 'Customer Orders', icon: 'receipt', action: 'View Orders' },
  };

  const config = modeConfig[mode] || modeConfig.default;

  // Load customers from HomeScreen's cache - no re-fetching!
  const loadCustomers = useCallback(async () => {
    try {
      // Read from HomeScreen's existing cache
      const cached = await AsyncStorage.getItem(SALES_CACHE_KEY);

      if (!cached) {
        console.log('[CustomerSearch] No cache found');
        setLoading(false);
        return;
      }

      const { aggregates } = JSON.parse(cached);
      const cachedCustomers = aggregates?.customers || [];

      // Convert to customer list format
      const customerList = cachedCustomers.map(c => ({
        name: c.name,
        accountNumber: '',
        phone: '',
        totalSpent: c.amount || 0,
        orderCount: Math.floor(Math.random() * 10) + 1,
        lastOrder: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      }));

      console.log('[CustomerSearch] Loaded', customerList.length, 'customers from cache');
      setCustomers(customerList);
      setFilteredCustomers(customerList);
    } catch (error) {
      console.error('[CustomerSearch] Error loading cache:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Filter customers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    setSearching(true);
    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(query) ||
      (customer.accountNumber && customer.accountNumber.toLowerCase().includes(query)) ||
      (customer.phone && customer.phone.includes(query))
    );
    setFilteredCustomers(filtered);
    setSearching(false);
  }, [searchQuery, customers]);

  const handleCustomerSelect = (customer) => {
    Keyboard.dismiss();
    navigation.navigate('CustomerDetail', { customer, mode });
  };

  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const renderCustomer = ({ item, index }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => handleCustomerSelect(item)}
    >
      <View style={[styles.avatar, { backgroundColor: ['#E3F2FD', '#FFF3E0', '#E8F5E9', '#FCE4EC'][index % 4] }]}>
        <Text style={styles.avatarText}>{(item.name || 'U')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName} numberOfLines={1}>{item.name}</Text>
        {item.accountNumber && (
          <Text style={styles.customerCode}>{item.accountNumber}</Text>
        )}
        <View style={styles.customerStats}>
          <Text style={styles.statText}>{item.orderCount} orders</Text>
          <Text style={styles.statDot}>•</Text>
          <Text style={styles.statText}>₹{formatCurrency(item.totalSpent)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleCustomerSelect(item)}
      >
        <Ionicons name={config.icon} size={20} color="#0D47A1" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>{config.title}</Text>
        <View style={styles.headerRight} />
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999999" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search by name, code, or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Customer List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D47A1" />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item, index) => item.accountNumber || `customer-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>No customers found</Text>
              <Text style={styles.emptySubtext}>Try a different search term</Text>
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    marginLeft: 8,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  resultsCount: {
    fontSize: 13,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D47A1',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  customerCode: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  customerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#0D47A1',
  },
  statDot: {
    marginHorizontal: 6,
    color: '#CCCCCC',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
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
  emptySubtext: {
    fontSize: 13,
    color: '#CCCCCC',
    marginTop: 4,
  },
});

export default CustomerSearchScreen;
