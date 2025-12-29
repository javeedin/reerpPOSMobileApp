import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

// Detail Row Component
const DetailRow = ({ label, value, icon, valueColor }) => (
  <View style={styles.detailRow}>
    {icon && (
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={THEME.primary} />
      </View>
    )}
    <View style={styles.detailContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>
        {value || 'N/A'}
      </Text>
    </View>
  </View>
);

// Status Badge Component
const StatusBadge = ({ status, text }) => {
  const getColor = () => {
    switch (status) {
      case 'delivered':
        return THEME.info;
      case 'verified':
        return THEME.success;
      case 'pending':
      default:
        return THEME.warning;
    }
  };

  return (
    <View style={[styles.statusBadge, { backgroundColor: getColor() + '15' }]}>
      <View style={[styles.statusDot, { backgroundColor: getColor() }]} />
      <Text style={[styles.statusText, { color: getColor() }]}>{text}</Text>
    </View>
  );
};

const TripOrderDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { order, tripId } = route.params;

  const isVerified = order.pickConfirmSt === 'YES';
  const isDelivered = order.shipConfirmSt === 'YES';

  const getStatus = () => {
    if (isDelivered) return { status: 'delivered', text: 'Delivered' };
    if (isVerified) return { status: 'verified', text: 'Verified' };
    return { status: 'pending', text: 'Pending' };
  };

  const statusInfo = getStatus();

  const handleCallCustomer = () => {
    Alert.alert('Call Customer', 'Would you like to call the customer?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => console.log('Calling...') },
    ]);
  };

  const handleNavigate = () => {
    Alert.alert('Navigate', 'Open navigation to customer address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Navigate', onPress: () => console.log('Navigating...') },
    ]);
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
            <Text style={styles.headerTitle}>Order Details</Text>
            <Text style={styles.headerSubtitle}>{order.orderNumber}</Text>
          </View>
          <StatusBadge {...statusInfo} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="person" size={24} color={THEME.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Customer Information</Text>
            </View>
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{order.accountName || 'Unknown Customer'}</Text>
            <Text style={styles.accountNumber}>{order.accountNumber}</Text>
          </View>
          <View style={styles.customerActions}>
            <TouchableOpacity style={styles.customerAction} onPress={handleCallCustomer}>
              <Ionicons name="call" size={20} color={THEME.success} />
              <Text style={styles.customerActionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.customerAction} onPress={handleNavigate}>
              <Ionicons name="navigate" size={20} color={THEME.info} />
              <Text style={styles.customerActionText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="document-text" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.cardTitle}>Order Information</Text>
          </View>

          <DetailRow
            label="Order Number"
            value={order.orderNumber}
            icon="receipt-outline"
          />
          <DetailRow
            label="Order Date"
            value={order.orderDate}
            icon="calendar-outline"
          />
          <DetailRow
            label="Order Type"
            value={order.orderType}
            icon="pricetag-outline"
          />
          <DetailRow
            label="Customer PO"
            value={order.customerPo}
            icon="document-outline"
          />
          <DetailRow
            label="Release Date"
            value={order.releaseDate}
            icon="time-outline"
          />
        </View>

        {/* Delivery Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons name="truck-delivery" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.cardTitle}>Delivery Information</Text>
          </View>

          <DetailRow
            label="Salesman/Driver"
            value={order.salesman}
            icon="person-circle-outline"
          />
          <DetailRow
            label="Lorry"
            value={order.lorry}
            icon="car-outline"
          />
          <DetailRow
            label="Loading Bay"
            value={order.loadingByNum}
            icon="location-outline"
          />
          <DetailRow
            label="Picker"
            value={order.picker}
            icon="hand-left-outline"
          />
          <DetailRow
            label="Pick Slip No"
            value={order.pickSlipNo}
            icon="barcode-outline"
          />
        </View>

        {/* Order Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="stats-chart" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{order.orderLines || 0}</Text>
              <Text style={styles.summaryLabel}>Lines</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{order.picksCount || 0}</Text>
              <Text style={styles.summaryLabel}>Picks</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{order.lotCount || 0}</Text>
              <Text style={styles.summaryLabel}>Lots</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: THEME.error }]}>
                {order.notPicked || 0}
              </Text>
              <Text style={styles.summaryLabel}>Not Picked</Text>
            </View>
          </View>

          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Order Amount</Text>
            <Text style={styles.amountValue}>
              ₹{(order.orderAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="checkmark-circle" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.cardTitle}>Status</Text>
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Ionicons
                name={order.pickConfirmSt === 'YES' ? 'checkmark-circle' : 'ellipse-outline'}
                size={28}
                color={order.pickConfirmSt === 'YES' ? THEME.success : THEME.textLight}
              />
              <Text style={styles.statusItemLabel}>Pick Confirmed</Text>
              <Text style={[
                styles.statusItemValue,
                { color: order.pickConfirmSt === 'YES' ? THEME.success : THEME.textLight }
              ]}>
                {order.pickConfirmSt || 'NO'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons
                name={order.shipConfirmSt === 'YES' ? 'checkmark-circle' : 'ellipse-outline'}
                size={28}
                color={order.shipConfirmSt === 'YES' ? THEME.success : THEME.textLight}
              />
              <Text style={styles.statusItemLabel}>Ship Confirmed</Text>
              <Text style={[
                styles.statusItemValue,
                { color: order.shipConfirmSt === 'YES' ? THEME.success : THEME.textLight }
              ]}>
                {order.shipConfirmSt || 'NO'}
              </Text>
            </View>
          </View>

          <View style={styles.lineStatusSection}>
            <Text style={styles.lineStatusLabel}>Line Status</Text>
            <Text style={styles.lineStatusValue}>{order.lineStatus || 'N/A'}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!isDelivered && (
          <View style={styles.actionButtons}>
            {!isVerified ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('OrderVerification', {
                  order,
                  tripId,
                })}
              >
                <LinearGradient
                  colors={[THEME.success, THEME.accentLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Verify Order</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  Alert.alert(
                    'Confirm Delivery',
                    'Mark this order as delivered?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Confirm', onPress: () => navigation.goBack() },
                    ]
                  );
                }}
              >
                <LinearGradient
                  colors={[THEME.info, '#42A5F5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Mark as Delivered</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

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

  // Header
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 16,
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
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.accentLight,
    marginTop: 2,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  scrollView: {
    flex: 1,
  },

  // Card
  card: {
    backgroundColor: THEME.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
  },

  // Customer Info
  customerInfo: {
    marginBottom: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
  },
  accountNumber: {
    fontSize: 13,
    color: THEME.textLight,
    marginTop: 4,
  },
  customerActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
  },
  customerAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  customerActionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: THEME.text,
  },

  // Detail Row
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: THEME.textLight,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.text,
    marginTop: 2,
  },

  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: THEME.background,
    marginHorizontal: 4,
    borderRadius: 10,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.primary,
  },
  summaryLabel: {
    fontSize: 11,
    color: THEME.textLight,
    marginTop: 4,
  },
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  amountLabel: {
    fontSize: 14,
    color: THEME.textLight,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.primary,
  },

  // Status Grid
  statusGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: THEME.background,
    marginHorizontal: 4,
    borderRadius: 12,
  },
  statusItemLabel: {
    fontSize: 11,
    color: THEME.textLight,
    marginTop: 8,
  },
  statusItemValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  lineStatusSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  lineStatusLabel: {
    fontSize: 11,
    color: THEME.textLight,
  },
  lineStatusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.text,
    marginTop: 4,
  },

  // Action Buttons
  actionButtons: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TripOrderDetailScreen;
