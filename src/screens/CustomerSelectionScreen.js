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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getCustomers } from '../services/syncService';

const CustomerCard = ({ customer, onSelect, isSelected }) => (
  <TouchableOpacity
    style={[styles.customerCard, isSelected && styles.customerCardSelected]}
    onPress={() => onSelect(customer)}
  >
    <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
      <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
        {(customer.name || 'W').charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={styles.customerInfo}>
      <Text style={[styles.customerName, isSelected && styles.customerNameSelected]} numberOfLines={2}>
        {customer.name || 'Unknown Customer'}
      </Text>
      <Text style={styles.customerAccount} numberOfLines={1}>
        {customer.accountNumber || 'N/A'}
      </Text>
      {customer.priceList && (
        <View style={styles.priceListBadge}>
          <Ionicons name="pricetag" size={10} color={colors.accent} />
          <Text style={styles.priceListText}>{customer.priceList}</Text>
        </View>
      )}
    </View>
    {isSelected && (
      <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
    )}
  </TouchableOpacity>
);

const CustomerSelectionScreen = ({ navigation, route }) => {
  const { menuConfig } = route.params || {};
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data || []);
      setFilteredCustomers(data || []);
    } catch (error) {
      console.error('Load customers error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = customers.filter(c =>
        (c.name || '').toLowerCase().includes(query) ||
        (c.accountNumber || '').toLowerCase().includes(query)
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchQuery, customers]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
  };

  const handleSkipCustomer = () => {
    // Continue with walk-in customer
    navigation.navigate('ItemSelection', {
      menuConfig,
      customer: null,
    });
  };

  const handleContinue = () => {
    navigation.navigate('ItemSelection', {
      menuConfig,
      customer: selectedCustomer,
    });
  };

  // Handle home navigation with warning
  const handleGoHome = () => {
    Alert.alert(
      'Leave Order?',
      'Order is not confirmed and will be cleared. Do you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Go Home',
          style: 'destructive',
          onPress: () => navigation.navigate('MainTabs'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Select Customer</Text>
          <Text style={styles.headerSubtitle}>{menuConfig?.name || 'New Order'}</Text>
        </View>
        <View style={styles.headerRightButtons}>
          <TouchableOpacity onPress={handleGoHome} style={styles.homeButton}>
            <Ionicons name="home-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipCustomer} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
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

        {/* Customer Count */}
        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {filteredCustomers.length.toLocaleString()} customers
          </Text>
        </View>

        {/* Customer List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading customers...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCustomers}
            keyExtractor={(item, index) => `customer-${item.id || item.accountNumber || index}`}
            renderItem={({ item }) => (
              <CustomerCard
                customer={item}
                onSelect={handleSelectCustomer}
                isSelected={selectedCustomer?.id === item.id || selectedCustomer?.accountNumber === item.accountNumber}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>No customers found</Text>
                <Text style={styles.emptySubtext}>Try a different search or sync customer data</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Continue Button */}
      {selectedCustomer && (
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <LinearGradient
            colors={[colors.secondary, colors.secondaryDark]}
            style={styles.continueGradient}
          >
            <Text style={styles.continueText} numberOfLines={1}>
              Continue with {selectedCustomer.name}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
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
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  homeButton: {
    padding: 6,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
  countBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  countText: {
    fontSize: 11,
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
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  customerCardSelected: {
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.secondary + '08',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSelected: {
    backgroundColor: colors.secondary + '20',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
  },
  avatarTextSelected: {
    color: colors.secondary,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    lineHeight: 18,
  },
  customerNameSelected: {
    color: colors.secondary,
  },
  customerAccount: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  priceListBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  priceListText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '500',
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
  continueButton: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
});

export default CustomerSelectionScreen;
