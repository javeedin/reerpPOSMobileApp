import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateSingleTripStats, getLorryCapacity } from '../services/tripService';

// Dark green theme colors
const THEME = {
  primary: '#1B5E20',
  primaryLight: '#2E7D32',
  primaryDark: '#0D3311',
  accent: '#4CAF50',
  accentLight: '#81C784',
  background: '#E8F5E9',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

// Capacity Bar Component
const CapacityBar = ({ percentage, showLabel = true }) => {
  const getColor = () => {
    if (percentage >= 90) return THEME.error;
    if (percentage >= 70) return THEME.warning;
    return THEME.success;
  };

  return (
    <View style={styles.capacityContainer}>
      {showLabel && (
        <Text style={styles.capacityLabel}>Lorry Capacity</Text>
      )}
      <View style={styles.capacityBarOuter}>
        <View
          style={[
            styles.capacityBarInner,
            { width: `${Math.min(percentage, 100)}%`, backgroundColor: getColor() },
          ]}
        />
      </View>
      <View style={styles.capacityInfo}>
        <Text style={[styles.capacityPercent, { color: getColor() }]}>
          {percentage.toFixed(0)}% Full
        </Text>
        <Text style={styles.capacityStatus}>
          {percentage >= 90 ? 'Nearly Full' : percentage >= 70 ? 'Filling Up' : 'Available Space'}
        </Text>
      </View>
    </View>
  );
};

// Order Card Component
const OrderCard = ({ order, onVerify, onDeliver, onViewDetails }) => {
  const isVerified = order.pickConfirmSt === 'YES';
  const isDelivered = order.shipConfirmSt === 'YES';

  const getStatusColor = () => {
    if (isDelivered) return THEME.info;
    if (isVerified) return THEME.success;
    return THEME.warning;
  };

  const getStatusText = () => {
    if (isDelivered) return 'Delivered';
    if (isVerified) return 'Verified';
    return 'Pending';
  };

  return (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={onViewDetails}
      activeOpacity={0.8}
    >
      <View style={styles.orderCardHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.accountName || 'Unknown Customer'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.orderDetailRow}>
          <Ionicons name="person-outline" size={14} color={THEME.textLight} />
          <Text style={styles.orderDetailText}>{order.salesman || 'N/A'}</Text>
        </View>
        <View style={styles.orderDetailRow}>
          <Ionicons name="cube-outline" size={14} color={THEME.textLight} />
          <Text style={styles.orderDetailText}>{order.orderLines || 0} Items</Text>
        </View>
        <View style={styles.orderDetailRow}>
          <Ionicons name="calendar-outline" size={14} color={THEME.textLight} />
          <Text style={styles.orderDetailText}>{order.orderDate || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.orderDivider} />

      <View style={styles.orderFooter}>
        <View style={styles.orderAmount}>
          <Text style={styles.orderAmountLabel}>Amount</Text>
          <Text style={styles.orderAmountValue}>
            ₹{(order.orderAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
        </View>

        <View style={styles.orderActions}>
          {!isVerified && !isDelivered && (
            <TouchableOpacity
              style={[styles.actionButton, styles.verifyButton]}
              onPress={(e) => {
                e.stopPropagation();
                onVerify();
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Verify</Text>
            </TouchableOpacity>
          )}

          {isVerified && !isDelivered && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deliverButton]}
              onPress={(e) => {
                e.stopPropagation();
                onDeliver();
              }}
            >
              <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Deliver</Text>
            </TouchableOpacity>
          )}

          {isDelivered && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-done-circle" size={20} color={THEME.info} />
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Stats Card Component
const StatsCard = ({ icon, label, value, color }) => (
  <View style={styles.statsCard}>
    <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={[styles.statsValue, { color }]}>{value}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
  </View>
);

const TripDetailsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { trip } = route.params;
  const [orders, setOrders] = useState(trip.details || []);
  const stats = calculateSingleTripStats({ ...trip, details: orders });

  const handleVerifyOrder = (order) => {
    navigation.navigate('OrderVerification', {
      order,
      tripId: trip.tripId,
      onComplete: (verified) => {
        if (verified) {
          setOrders(prev =>
            prev.map(o =>
              o.orderNumber === order.orderNumber
                ? { ...o, pickConfirmSt: 'YES' }
                : o
            )
          );
        }
      },
    });
  };

  const handleDeliverOrder = (order) => {
    Alert.alert(
      'Confirm Delivery',
      `Mark order ${order.orderNumber} as delivered to ${order.accountName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Delivery',
          onPress: () => {
            setOrders(prev =>
              prev.map(o =>
                o.orderNumber === order.orderNumber
                  ? { ...o, shipConfirmSt: 'YES' }
                  : o
              )
            );
            Alert.alert('Success', 'Order marked as delivered!');
          },
        },
      ]
    );
  };

  const handleViewOrderDetails = (order) => {
    navigation.navigate('TripOrderDetail', { order, tripId: trip.tripId });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />

      {/* Header */}
      <LinearGradient
        colors={[THEME.primaryDark, THEME.primary, THEME.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Trip #{trip.tripId}</Text>
            <Text style={styles.headerSubtitle}>{trip.tripDate} • {trip.tripLorry}</Text>
          </View>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="truck-delivery" size={24} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Capacity Bar */}
        <View style={styles.capacitySection}>
          <CapacityBar percentage={stats.capacityUsed} />
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <StatsCard
            icon="cube-outline"
            label="Total Orders"
            value={stats.totalOrders}
            color={THEME.primary}
          />
          <StatsCard
            icon="checkmark-circle-outline"
            label="Verified"
            value={stats.verifiedOrders}
            color={THEME.success}
          />
          <StatsCard
            icon="checkmark-done-outline"
            label="Delivered"
            value={stats.deliveredOrders}
            color={THEME.info}
          />
          <StatsCard
            icon="time-outline"
            label="Pending"
            value={stats.pendingOrders}
            color={THEME.warning}
          />
        </View>

        {/* Trip Info Card */}
        <View style={styles.tripInfoCard}>
          <Text style={styles.tripInfoTitle}>Trip Information</Text>
          <View style={styles.tripInfoRow}>
            <View style={styles.tripInfoItem}>
              <Ionicons name="location-outline" size={18} color={THEME.primary} />
              <Text style={styles.tripInfoLabel}>Loading Bay</Text>
              <Text style={styles.tripInfoValue}>{trip.tripLoadingBay || 'N/A'}</Text>
            </View>
            <View style={styles.tripInfoItem}>
              <Ionicons name="calendar-outline" size={18} color={THEME.primary} />
              <Text style={styles.tripInfoLabel}>Trip Day</Text>
              <Text style={styles.tripInfoValue}>{trip.tripDay?.trim() || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.tripInfoRow}>
            <View style={styles.tripInfoItem}>
              <MaterialCommunityIcons name="truck" size={18} color={THEME.primary} />
              <Text style={styles.tripInfoLabel}>Lorry Type</Text>
              <Text style={styles.tripInfoValue}>{trip.tripLorry}</Text>
            </View>
            <View style={styles.tripInfoItem}>
              <Ionicons name="speedometer-outline" size={18} color={THEME.primary} />
              <Text style={styles.tripInfoLabel}>Capacity</Text>
              <Text style={styles.tripInfoValue}>{getLorryCapacity(trip.tripLorry)} Units</Text>
            </View>
          </View>
        </View>

        {/* Orders List */}
        <View style={styles.ordersSection}>
          <Text style={styles.sectionTitle}>Orders ({orders.length})</Text>
          {orders.map((order, index) => (
            <OrderCard
              key={order.orderNumber || index}
              order={order}
              onVerify={() => handleVerifyOrder(order)}
              onDeliver={() => handleDeliverOrder(order)}
              onViewDetails={() => handleViewOrderDetails(order)}
            />
          ))}
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: THEME.accentLight,
    marginTop: 2,
  },
  headerBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },

  // Capacity Section
  capacitySection: {
    backgroundColor: THEME.surface,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  capacityContainer: {},
  capacityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 10,
  },
  capacityBarOuter: {
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  capacityBarInner: {
    height: '100%',
    borderRadius: 8,
  },
  capacityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  capacityPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  capacityStatus: {
    fontSize: 12,
    color: THEME.textLight,
  },

  // Stats Section
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statsCard: {
    flex: 1,
    backgroundColor: THEME.surface,
    margin: 4,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 10,
    color: THEME.textLight,
    marginTop: 2,
    textAlign: 'center',
  },

  // Trip Info Card
  tripInfoCard: {
    backgroundColor: THEME.surface,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tripInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 16,
  },
  tripInfoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tripInfoItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  tripInfoLabel: {
    fontSize: 11,
    color: THEME.textLight,
    marginTop: 4,
  },
  tripInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    marginTop: 2,
  },

  // Orders Section
  ordersSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 16,
  },

  // Order Card
  orderCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  customerName: {
    fontSize: 13,
    color: THEME.textLight,
    marginTop: 2,
    maxWidth: '90%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 6,
  },
  orderDetailText: {
    fontSize: 12,
    color: THEME.textLight,
    marginLeft: 6,
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderAmount: {},
  orderAmountLabel: {
    fontSize: 11,
    color: THEME.textLight,
  },
  orderAmountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifyButton: {
    backgroundColor: THEME.success,
  },
  deliverButton: {
    backgroundColor: THEME.info,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.info + '15',
    borderRadius: 8,
  },
  completedText: {
    color: THEME.info,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default TripDetailsScreen;
