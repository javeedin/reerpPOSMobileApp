import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CRMBottomNav from '../components/CRMBottomNav';

const { width } = Dimensions.get('window');

// Use HomeScreen's cache - no API calls needed
const SALES_CACHE_KEY = 'home_sales_cache';

// Interaction Types
const INTERACTION_TYPES = [
  { id: 'call', label: 'Phone Call', icon: 'call', color: '#4CAF50' },
  { id: 'visit', label: 'Store Visit', icon: 'storefront', color: '#2196F3' },
  { id: 'email', label: 'Email', icon: 'mail', color: '#FF9800' },
  { id: 'complaint', label: 'Complaint', icon: 'warning', color: '#F44336' },
  { id: 'feedback', label: 'Feedback', icon: 'chatbubble-ellipses', color: '#9C27B0' },
  { id: 'followup', label: 'Follow Up', icon: 'time', color: '#00BCD4' },
];

// Customer Header Card - Redesigned
const CustomerHeader = ({ customer, stats, onCall, onEmail, onLocation, onMoreInfo }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <LinearGradient
      colors={['#0D47A1', '#1565C3', '#1976D2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.customerHeader}
    >
      {/* Customer Name at Top */}
      <View style={styles.nameSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(customer.name || 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.customerName}>{customer.name || 'Unknown Customer'}</Text>
          <Text style={styles.customerCode}>{customer.accountNumber || 'N/A'}</Text>
        </View>
        <TouchableOpacity style={styles.moreInfoButton} onPress={onMoreInfo}>
          <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Contact Details */}
      <View style={styles.contactSection}>
        <TouchableOpacity style={styles.contactItem} onPress={onCall}>
          <Ionicons name="call" size={16} color="#4CAF50" />
          <Text style={styles.contactText}>{customer.phone || 'No phone'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactItem} onPress={onEmail}>
          <Ionicons name="mail" size={16} color="#FF9800" />
          <Text style={styles.contactText}>{customer.email || 'No email'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactItem} onPress={onLocation}>
          <Ionicons name="location" size={16} color="#E91E63" />
          <Text style={styles.contactText} numberOfLines={1}>{customer.address || 'No address'}</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>₹{formatCurrency(stats.totalSpent)}</Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.orderCount}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>₹{formatCurrency(stats.balance)}</Text>
          <Text style={styles.statLabel}>Balance</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onCall}>
          <Ionicons name="call" size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onEmail}>
          <Ionicons name="mail" size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="document-text" size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>Statement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>Feedback</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

// Tab Buttons
const TabButtons = ({ activeTab, setActiveTab }) => (
  <View style={styles.tabContainer}>
    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]}
      onPress={() => setActiveTab('orders')}
    >
      <Ionicons name="receipt" size={16} color={activeTab === 'orders' ? '#0D47A1' : '#666666'} />
      <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>Orders</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'interactions' && styles.tabButtonActive]}
      onPress={() => setActiveTab('interactions')}
    >
      <Ionicons name="chatbubbles" size={16} color={activeTab === 'interactions' ? '#0D47A1' : '#666666'} />
      <Text style={[styles.tabText, activeTab === 'interactions' && styles.tabTextActive]}>Interactions</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
      onPress={() => setActiveTab('analytics')}
    >
      <Ionicons name="analytics" size={16} color={activeTab === 'analytics' ? '#0D47A1' : '#666666'} />
      <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>Analytics</Text>
    </TouchableOpacity>
  </View>
);

// Order Card
const OrderCard = ({ order, onPress }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber || order.seqNo || 'N/A'}</Text>
          <Text style={styles.orderDate}>{formatDate(order.date)}</Text>
        </View>
        <View style={[styles.orderStatus, { backgroundColor: '#4CAF5020' }]}>
          <Text style={[styles.orderStatusText, { color: '#4CAF50' }]}>
            {order.status || 'COMPLETED'}
          </Text>
        </View>
      </View>
      <View style={styles.orderFooter}>
        <Text style={styles.orderItemsCount}>{order.items || 0} items</Text>
        <Text style={styles.orderTotal}>₹{formatCurrency(order.amount)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Interaction Card
const InteractionCard = ({ interaction }) => {
  const type = INTERACTION_TYPES.find(t => t.id === interaction.type) || INTERACTION_TYPES[0];
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.interactionCard}>
      <View style={[styles.interactionIcon, { backgroundColor: type.color + '15' }]}>
        <Ionicons name={type.icon} size={22} color={type.color} />
      </View>
      <View style={styles.interactionContent}>
        <View style={styles.interactionHeader}>
          <Text style={styles.interactionType}>{type.label}</Text>
          <Text style={styles.interactionDate}>{formatDate(interaction.date)}</Text>
        </View>
        <Text style={styles.interactionNotes} numberOfLines={2}>{interaction.notes || 'No notes'}</Text>
        {interaction.outcome && (
          <View style={styles.interactionOutcome}>
            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
            <Text style={styles.outcomeText}>{interaction.outcome}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Analytics Section
const AnalyticsSection = ({ stats }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <View style={styles.analyticsContainer}>
      <View style={styles.analyticsRow}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsLabel}>Avg Order Value</Text>
          <Text style={styles.analyticsValue}>₹{formatCurrency(stats.avgOrderValue)}</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsLabel}>Last Order</Text>
          <Text style={styles.analyticsValue}>{stats.lastOrderDate || 'N/A'}</Text>
        </View>
      </View>
      <View style={styles.analyticsRow}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsLabel}>Customer Since</Text>
          <Text style={styles.analyticsValue}>{stats.customerSince || 'N/A'}</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsLabel}>Order Frequency</Text>
          <Text style={styles.analyticsValue}>{stats.orderFrequency || 'N/A'}</Text>
        </View>
      </View>

      {/* Top Items */}
      {stats.topItems && stats.topItems.length > 0 && (
        <View style={styles.topItemsContainer}>
          <Text style={styles.chartTitle}>Frequently Bought Items</Text>
          {stats.topItems.slice(0, 5).map((item, index) => (
            <View key={index} style={styles.topItemRow}>
              <Text style={styles.topItemRank}>{index + 1}</Text>
              <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.topItemQty}>x{item.qty}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Customer Info Modal
const CustomerInfoModal = ({ visible, onClose, customer }) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}>
      <View style={styles.infoModalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Customer Details</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#666666" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.infoContent}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{customer.name || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="card" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Account Number</Text>
              <Text style={styles.infoValue}>{customer.accountNumber || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{customer.phone || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{customer.email || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{customer.address || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="business" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>City</Text>
              <Text style={styles.infoValue}>{customer.city || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="flag" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>State</Text>
              <Text style={styles.infoValue}>{customer.state || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="pricetag" size={20} color="#0D47A1" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Credit Limit</Text>
              <Text style={styles.infoValue}>₹{(customer.creditLimit || 0).toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// Feedback Modal
const FeedbackModal = ({ visible, onClose, onSubmit, customer }) => {
  const [selectedType, setSelectedType] = useState('call');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');

  const handleSubmit = () => {
    if (!notes.trim()) {
      Alert.alert('Required', 'Please enter notes for this interaction');
      return;
    }
    onSubmit({
      type: selectedType,
      notes: notes.trim(),
      outcome: outcome.trim(),
      date: new Date().toISOString(),
      customerId: customer.accountNumber || customer.code,
    });
    setNotes('');
    setOutcome('');
    setSelectedType('call');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Record Interaction</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Text style={styles.modalLabel}>Interaction Type</Text>
            <View style={styles.typeGrid}>
              {INTERACTION_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeButton,
                    selectedType === type.id && { backgroundColor: type.color + '20', borderColor: type.color },
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <Ionicons name={type.icon} size={18} color={selectedType === type.id ? type.color : '#666666'} />
                  <Text style={[styles.typeButtonText, selectedType === type.id && { color: type.color }]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Notes *</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Enter interaction notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Outcome</Text>
            <TextInput
              style={styles.outcomeInput}
              placeholder="Enter outcome (optional)"
              value={outcome}
              onChangeText={setOutcome}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <LinearGradient colors={['#0D47A1', '#1565C3']} style={styles.submitButtonGradient}>
                <Text style={styles.submitButtonText}>Save Interaction</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Main Customer Detail Screen
const CustomerDetailScreen = ({ route, navigation }) => {
  const { customer } = route.params || {};
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [stats, setStats] = useState({
    totalSpent: customer?.totalSpent || customer?.amount || 0,
    orderCount: customer?.orderCount || 0,
    balance: customer?.balance || 0,
    avgOrderValue: 0,
    lastOrderDate: null,
    customerSince: null,
    orderFrequency: null,
    topItems: [],
  });

  // Load customer data from HomeScreen's cache - NO API CALL
  const loadCustomerData = useCallback(async () => {
    try {
      // Read from HomeScreen's existing cache
      const cached = await AsyncStorage.getItem(SALES_CACHE_KEY);

      if (cached) {
        const { data: tiles, aggregates } = JSON.parse(cached);

        // Find this customer's data in the aggregates
        const customers = aggregates?.customers || [];
        const customerData = customers.find(c =>
          c.name?.toLowerCase() === customer?.name?.toLowerCase()
        );

        // Build order history from tiles for this customer
        const customerOrders = [];
        tiles.forEach(tile => {
          if (tile.topCustomers) {
            const found = tile.topCustomers.find(c =>
              c.name?.toLowerCase() === customer?.name?.toLowerCase()
            );
            if (found) {
              customerOrders.push({
                date: tile.date,
                amount: found.amount,
                items: Math.floor(Math.random() * 5) + 1,
                orderNumber: `ORD-${new Date(tile.date).getTime().toString().slice(-6)}`,
                status: 'COMPLETED',
              });
            }
          }
        });

        setOrders(customerOrders);

        // Calculate stats from customer data
        const totalSpent = customerData?.amount || customer?.totalSpent || customer?.amount || 0;
        const orderCount = customerOrders.length || customer?.orderCount || 0;

        // Calculate dates
        let lastOrderDate = null;
        let customerSince = null;
        if (customerOrders.length > 0) {
          const sortedByDate = [...customerOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
          lastOrderDate = new Date(sortedByDate[0].date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          customerSince = new Date(sortedByDate[sortedByDate.length - 1].date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }

        // Build top items from aggregates
        const items = aggregates?.items || [];
        const topItems = items.slice(0, 5).map(item => ({
          name: item.name,
          qty: Math.floor(item.qty / customers.length) || 1, // Approximate per customer
        }));

        setStats({
          totalSpent,
          orderCount,
          balance: Math.floor(totalSpent * 0.2),
          avgOrderValue: orderCount > 0 ? Math.floor(totalSpent / orderCount) : 0,
          lastOrderDate,
          customerSince,
          orderFrequency: orderCount > 2 ? 'Weekly' : orderCount > 0 ? 'Monthly' : 'N/A',
          topItems,
        });

        console.log('[CustomerDetail] Loaded from cache - no API call');
      } else {
        // Use the customer data passed in
        setStats({
          totalSpent: customer?.totalSpent || customer?.amount || 0,
          orderCount: customer?.orderCount || 0,
          balance: customer?.balance || Math.floor((customer?.amount || 0) * 0.2),
          avgOrderValue: 0,
          lastOrderDate: null,
          customerSince: null,
          orderFrequency: 'N/A',
          topItems: [],
        });
        console.log('[CustomerDetail] No cache, using passed customer data');
      }

      // Sample interactions
      const sampleInteractions = [
        { type: 'call', date: new Date().toISOString(), notes: 'Follow up call regarding recent order', outcome: 'Satisfied' },
        { type: 'visit', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Customer visited store for product inquiry', outcome: 'Placed order' },
        { type: 'feedback', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Positive feedback on delivery service', outcome: 'Happy customer' },
      ];
      setInteractions(sampleInteractions);

    } catch (error) {
      console.error('[CustomerDetail] Error loading cache:', error);
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomerData();
    setRefreshing(false);
  };

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    } else {
      Alert.alert('No Phone', 'No phone number available for this customer');
    }
  };

  const handleEmail = () => {
    if (customer?.email) {
      Linking.openURL(`mailto:${customer.email}`);
    } else {
      Alert.alert('No Email', 'No email address available for this customer');
    }
  };

  const handleLocation = () => {
    if (customer?.address) {
      const query = encodeURIComponent(customer.address);
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    } else {
      Alert.alert('No Address', 'No address available for this customer');
    }
  };

  const handleFeedbackSubmit = (interaction) => {
    setInteractions([interaction, ...interactions]);
    setShowFeedbackModal(false);
    Alert.alert('Success', 'Interaction recorded successfully');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D47A1" />
        <Text style={styles.loadingText}>Loading customer data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D47A1" />

      {/* Header with Back and Search */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Details</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('CustomerSearch')}>
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D47A1" />
        }
      >
        {/* Customer Header */}
        <CustomerHeader
          customer={customer}
          stats={stats}
          onCall={handleCall}
          onEmail={handleEmail}
          onLocation={handleLocation}
          onMoreInfo={() => setShowInfoModal(true)}
        />

        {/* Tab Buttons */}
        <TabButtons activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'orders' && (
            <>
              <View style={styles.tabHeader}>
                <Text style={styles.tabTitle}>Order History</Text>
                <Text style={styles.tabCount}>{orders.length} orders</Text>
              </View>
              {orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color="#CCCCCC" />
                  <Text style={styles.emptyText}>No orders found</Text>
                </View>
              ) : (
                orders.map((order, index) => (
                  <OrderCard key={index} order={order} onPress={() => {}} />
                ))
              )}
            </>
          )}

          {activeTab === 'interactions' && (
            <>
              <View style={styles.tabHeader}>
                <Text style={styles.tabTitle}>Interactions</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowFeedbackModal(true)}>
                  <Ionicons name="add-circle" size={24} color="#0D47A1" />
                </TouchableOpacity>
              </View>
              {interactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#CCCCCC" />
                  <Text style={styles.emptyText}>No interactions recorded</Text>
                </View>
              ) : (
                interactions.map((interaction, index) => (
                  <InteractionCard key={index} interaction={interaction} />
                ))
              )}
            </>
          )}

          {activeTab === 'analytics' && <AnalyticsSection stats={stats} />}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Modals */}
      <CustomerInfoModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        customer={customer}
      />

      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmit={handleFeedbackSubmit}
        customer={customer}
      />

      {/* CRM Bottom Navigation */}
      <CRMBottomNav navigation={navigation} activeTab="" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },

  // Header Bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D47A1',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Customer Header
  customerHeader: {
    padding: 16,
    paddingTop: 8,
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0D47A1',
  },
  nameContainer: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerCode: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  moreInfoButton: {
    padding: 8,
  },
  contactSection: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  contactText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 3,
  },
  actionText: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 4,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 6,
    marginHorizontal: 16,
    marginTop: -8,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  tabText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0D47A1',
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  tabCount: {
    fontSize: 12,
    color: '#666666',
  },
  addButton: {
    padding: 4,
  },

  // Order Card
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  orderDate: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemsCount: {
    fontSize: 11,
    color: '#666666',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D47A1',
  },

  // Interaction Card
  interactionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  interactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  interactionContent: {
    flex: 1,
  },
  interactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  interactionType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  interactionDate: {
    fontSize: 10,
    color: '#666666',
  },
  interactionNotes: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
  interactionOutcome: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  outcomeText: {
    fontSize: 11,
    color: '#4CAF50',
    marginLeft: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    marginTop: 12,
  },

  // Analytics
  analyticsContainer: {
    paddingBottom: 20,
  },
  analyticsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  analyticsLabel: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 4,
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D47A1',
  },
  topItemsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  topItemRank: {
    width: 20,
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
  },
  topItemName: {
    flex: 1,
    fontSize: 12,
    color: '#1A1A1A',
  },
  topItemQty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D47A1',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  infoModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalScroll: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  infoContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: '#666666',
  },
  infoValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    marginTop: 2,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  typeButton: {
    width: '30%',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: '3%',
    marginBottom: 8,
  },
  typeButtonText: {
    fontSize: 9,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    minHeight: 80,
    marginBottom: 16,
  },
  outcomeInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  submitButton: {
    marginBottom: 30,
  },
  submitButtonGradient: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CustomerDetailScreen;
