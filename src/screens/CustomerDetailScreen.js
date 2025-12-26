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
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { queryHistoricalOrders } from '../services/syncService';
import CRMBottomNav from '../components/CRMBottomNav';

const { width } = Dimensions.get('window');

// Interaction Types
const INTERACTION_TYPES = [
  { id: 'call', label: 'Phone Call', icon: 'call', color: '#4CAF50' },
  { id: 'visit', label: 'Store Visit', icon: 'storefront', color: '#2196F3' },
  { id: 'email', label: 'Email', icon: 'mail', color: '#FF9800' },
  { id: 'complaint', label: 'Complaint', icon: 'warning', color: '#F44336' },
  { id: 'feedback', label: 'Feedback', icon: 'chatbubble-ellipses', color: '#9C27B0' },
  { id: 'followup', label: 'Follow Up', icon: 'time', color: '#00BCD4' },
];

// Customer Header Card
const CustomerHeader = ({ customer, stats, onCall, onStatement, onFeedback }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <LinearGradient
      colors={['#0D47A1', '#1565C3', '#1976D2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.customerHeader}
    >
      {/* Customer Avatar and Info */}
      <View style={styles.customerInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(customer.name || 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.customerDetails}>
          <Text style={styles.customerName}>{customer.name || 'Unknown Customer'}</Text>
          <Text style={styles.customerCode}>{customer.accountNumber || customer.code || 'N/A'}</Text>
          {customer.phone && (
            <TouchableOpacity style={styles.phoneRow} onPress={onCall}>
              <Ionicons name="call" size={14} color="#4CAF50" />
              <Text style={styles.phoneText}>{customer.phone}</Text>
            </TouchableOpacity>
          )}
        </View>
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
          <Ionicons name="call" size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onStatement}>
          <Ionicons name="document-text" size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Statement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onFeedback}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-social" size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Share</Text>
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
      <Ionicons name="receipt" size={18} color={activeTab === 'orders' ? '#0D47A1' : '#666666'} />
      <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>Orders</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'interactions' && styles.tabButtonActive]}
      onPress={() => setActiveTab('interactions')}
    >
      <Ionicons name="chatbubbles" size={18} color={activeTab === 'interactions' ? '#0D47A1' : '#666666'} />
      <Text style={[styles.tabText, activeTab === 'interactions' && styles.tabTextActive]}>Interactions</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
      onPress={() => setActiveTab('analytics')}
    >
      <Ionicons name="analytics" size={18} color={activeTab === 'analytics' ? '#0D47A1' : '#666666'} />
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

  const statusColors = {
    'BOOKED': '#4CAF50',
    'PENDING': '#FF9800',
    'CANCELLED': '#F44336',
    'DELIVERED': '#2196F3',
  };

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber || order.seqNo || 'N/A'}</Text>
          <Text style={styles.orderDate}>{formatDate(order.orderDate)}</Text>
        </View>
        <View style={[styles.orderStatus, { backgroundColor: (statusColors[order.status] || '#9E9E9E') + '20' }]}>
          <Text style={[styles.orderStatusText, { color: statusColors[order.status] || '#9E9E9E' }]}>
            {order.status || 'N/A'}
          </Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        {(order.lines || []).slice(0, 3).map((line, index) => (
          <Text key={index} style={styles.orderItemText} numberOfLines={1}>
            • {line.itemDesc || line.itemDescription || line.itemCode || 'Item'} x{line.qty || line.orderedQuantity || 1}
          </Text>
        ))}
        {(order.lines || []).length > 3 && (
          <Text style={styles.orderMoreItems}>+{order.lines.length - 3} more items</Text>
        )}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.orderItemsCount}>{(order.lines || []).length} items</Text>
        <Text style={styles.orderTotal}>₹{formatCurrency(order.calculatedTotalNet || order.totalNet)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Interaction Card
const InteractionCard = ({ interaction, onPress }) => {
  const type = INTERACTION_TYPES.find(t => t.id === interaction.type) || INTERACTION_TYPES[0];
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TouchableOpacity style={styles.interactionCard} onPress={onPress}>
      <View style={[styles.interactionIcon, { backgroundColor: type.color + '15' }]}>
        <Ionicons name={type.icon} size={24} color={type.color} />
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
    </TouchableOpacity>
  );
};

// Analytics Section
const AnalyticsSection = ({ stats, orders }) => {
  const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  // Calculate monthly spending
  const monthlyData = {};
  orders.forEach(order => {
    const month = new Date(order.orderDate).toLocaleDateString('en-US', { month: 'short' });
    monthlyData[month] = (monthlyData[month] || 0) + (order.calculatedTotalNet || 0);
  });

  const months = Object.keys(monthlyData);
  const maxMonthly = Math.max(...Object.values(monthlyData), 1);

  return (
    <View style={styles.analyticsContainer}>
      {/* Summary Cards */}
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

      {/* Monthly Spending Chart */}
      {months.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Monthly Spending</Text>
          <View style={styles.chartBars}>
            {months.slice(-6).map((month, index) => {
              const value = monthlyData[month];
              const height = (value / maxMonthly) * 80;
              return (
                <View key={index} style={styles.chartBarContainer}>
                  <View style={[styles.chartBar, { height: Math.max(height, 4) }]} />
                  <Text style={styles.chartBarLabel}>{month}</Text>
                  <Text style={styles.chartBarValue}>₹{formatCurrency(value)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Top Items */}
      <View style={styles.topItemsContainer}>
        <Text style={styles.chartTitle}>Frequently Bought Items</Text>
        {stats.topItems?.slice(0, 5).map((item, index) => (
          <View key={index} style={styles.topItemRow}>
            <Text style={styles.topItemRank}>{index + 1}</Text>
            <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.topItemQty}>x{item.qty}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

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
            {/* Interaction Type */}
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
                  <Ionicons
                    name={type.icon}
                    size={20}
                    color={selectedType === type.id ? type.color : '#666666'}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      selectedType === type.id && { color: type.color },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
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

            {/* Outcome */}
            <Text style={styles.modalLabel}>Outcome</Text>
            <TextInput
              style={styles.outcomeInput}
              placeholder="Enter outcome (optional)"
              value={outcome}
              onChangeText={setOutcome}
            />

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <LinearGradient
                colors={['#0D47A1', '#1565C3']}
                style={styles.submitButtonGradient}
              >
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
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [stats, setStats] = useState({
    totalSpent: 0,
    orderCount: 0,
    balance: 0,
    avgOrderValue: 0,
    lastOrderDate: null,
    customerSince: null,
    orderFrequency: null,
    topItems: [],
  });

  // Load customer orders
  const loadCustomerData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDate = new Date(today);
      fromDate.setFullYear(today.getFullYear() - 1); // Last 1 year

      const result = await queryHistoricalOrders({
        fromDate,
        toDate: today,
        salesrepNumber: user?.username || '',
      });

      const allOrders = result.success ? (result.orders || []) : [];

      // Filter orders for this customer
      const customerOrders = allOrders.filter(order => {
        const orderCustomer = order.accountName || order.customerName || order.accountNumber || '';
        return orderCustomer.toLowerCase().includes((customer.name || '').toLowerCase()) ||
               (order.accountNumber && order.accountNumber === customer.accountNumber);
      });

      setOrders(customerOrders);

      // Calculate stats
      const totalSpent = customerOrders.reduce((sum, o) => sum + (o.calculatedTotalNet || 0), 0);
      const orderCount = customerOrders.length;

      // Get top items
      const itemTotals = {};
      customerOrders.forEach(order => {
        (order.lines || []).forEach(line => {
          const name = line.itemDesc || line.itemDescription || line.itemCode || 'Unknown';
          itemTotals[name] = (itemTotals[name] || 0) + (parseFloat(line.qty) || 1);
        });
      });
      const topItems = Object.entries(itemTotals)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);

      // Calculate dates
      let lastOrderDate = null;
      let customerSince = null;
      if (customerOrders.length > 0) {
        const sortedByDate = [...customerOrders].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        lastOrderDate = new Date(sortedByDate[0].orderDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        customerSince = new Date(sortedByDate[sortedByDate.length - 1].orderDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      // Order frequency
      let orderFrequency = 'N/A';
      if (customerOrders.length > 1) {
        const daysDiff = Math.floor((new Date() - new Date(customerOrders[customerOrders.length - 1].orderDate)) / (1000 * 60 * 60 * 24));
        const avgDays = Math.floor(daysDiff / customerOrders.length);
        if (avgDays <= 7) orderFrequency = 'Weekly';
        else if (avgDays <= 14) orderFrequency = 'Bi-weekly';
        else if (avgDays <= 30) orderFrequency = 'Monthly';
        else orderFrequency = `Every ${avgDays} days`;
      }

      setStats({
        totalSpent,
        orderCount,
        balance: Math.floor(totalSpent * 0.2), // Simulated balance
        avgOrderValue: orderCount > 0 ? Math.floor(totalSpent / orderCount) : 0,
        lastOrderDate,
        customerSince,
        orderFrequency,
        topItems,
      });

      // Generate sample interactions (would come from database in real app)
      const sampleInteractions = [
        { type: 'call', date: new Date().toISOString(), notes: 'Follow up call regarding recent order', outcome: 'Satisfied' },
        { type: 'visit', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Customer visited store for product inquiry', outcome: 'Placed order' },
        { type: 'feedback', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Positive feedback on delivery service', outcome: 'Happy customer' },
      ];
      setInteractions(sampleInteractions);

    } catch (error) {
      console.error('[CustomerDetail] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [customer, user]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomerData();
    setRefreshing(false);
  };

  const handleCall = () => {
    if (customer.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    } else {
      Alert.alert('No Phone', 'No phone number available for this customer');
    }
  };

  const handleStatement = () => {
    Alert.alert('Statement', 'Statement feature coming soon');
    // navigation.navigate('CustomerStatement', { customer });
  };

  const handleFeedback = () => {
    setShowFeedbackModal(true);
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

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

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
          onStatement={handleStatement}
          onFeedback={handleFeedback}
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
                  <OrderCard
                    key={index}
                    order={order}
                    onPress={() => navigation.navigate('OrderDetail', { order })}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'interactions' && (
            <>
              <View style={styles.tabHeader}>
                <Text style={styles.tabTitle}>Interactions</Text>
                <TouchableOpacity
                  style={styles.addInteractionButton}
                  onPress={handleFeedback}
                >
                  <Ionicons name="add-circle" size={24} color="#0D47A1" />
                </TouchableOpacity>
              </View>
              {interactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#CCCCCC" />
                  <Text style={styles.emptyText}>No interactions recorded</Text>
                  <TouchableOpacity
                    style={styles.addFirstButton}
                    onPress={handleFeedback}
                  >
                    <Text style={styles.addFirstText}>Add First Interaction</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                interactions.map((interaction, index) => (
                  <InteractionCard
                    key={index}
                    interaction={interaction}
                    onPress={() => {}}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsSection stats={stats} orders={orders} />
          )}
        </View>

        {/* Bottom Padding for nav bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Feedback Modal */}
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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Customer Header
  customerHeader: {
    paddingTop: 100,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0D47A1',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  customerCode: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  actionText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 4,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 16,
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
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  tabText: {
    fontSize: 13,
    color: '#666666',
    marginLeft: 6,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0D47A1',
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  tabCount: {
    fontSize: 12,
    color: '#666666',
  },

  // Order Card
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#666666',
  },
  orderStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderItems: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderItemText: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  orderMoreItems: {
    fontSize: 12,
    color: '#0D47A1',
    fontWeight: '500',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemsCount: {
    fontSize: 12,
    color: '#666666',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D47A1',
  },

  // Interaction Card
  interactionCard: {
    flexDirection: 'row',
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
  interactionIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
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
    alignItems: 'center',
    marginBottom: 6,
  },
  interactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  interactionDate: {
    fontSize: 11,
    color: '#666666',
  },
  interactionNotes: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  interactionOutcome: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  outcomeText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },

  // Add Interaction Button
  addInteractionButton: {
    padding: 4,
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
  addFirstButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
  },
  addFirstText: {
    fontSize: 13,
    color: '#0D47A1',
    fontWeight: '600',
  },

  // Analytics
  analyticsContainer: {
    paddingBottom: 20,
  },
  analyticsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 6,
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D47A1',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  chartBar: {
    width: '80%',
    backgroundColor: '#0D47A1',
    borderRadius: 4,
    marginBottom: 8,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 2,
  },
  chartBarValue: {
    fontSize: 9,
    color: '#0D47A1',
    fontWeight: '600',
  },
  topItemsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  topItemRank: {
    width: 24,
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
  },
  topItemName: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
  },
  topItemQty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D47A1',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalScroll: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  typeButton: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: '3%',
    marginBottom: 10,
  },
  typeButtonText: {
    fontSize: 10,
    color: '#666666',
    marginTop: 6,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
  },
  outcomeInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    marginBottom: 20,
  },
  submitButton: {
    marginBottom: 40,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CustomerDetailScreen;
