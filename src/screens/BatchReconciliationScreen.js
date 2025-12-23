import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { getAllOrders } from '../services/orderService';

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, icon, color, isHighlight }) => (
  <View style={[styles.summaryCard, isHighlight && { borderColor: color, borderWidth: 2 }]}>
    <View style={[styles.summaryIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryTitle}>{title}</Text>
    {subtitle && <Text style={styles.summarySubtitle}>{subtitle}</Text>}
  </View>
);

// Order Row Component
const OrderRow = ({ order, isMatched }) => {
  const cardPayments = order.payments?.filter(p =>
    p.method?.toUpperCase().includes('CARD') ||
    p.method?.toUpperCase().includes('CREDIT') ||
    p.method?.toUpperCase().includes('MCB') ||
    p.method?.toUpperCase().includes('VISA') ||
    p.method?.toUpperCase().includes('MASTER')
  ) || [];

  const cardTotal = cardPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  if (cardTotal === 0) return null;

  return (
    <View style={[styles.orderRow, isMatched && styles.orderRowMatched]}>
      <View style={styles.orderInfo}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.orderCustomer}>{order.customer?.name || 'Walk-in'}</Text>
        <Text style={styles.orderDate}>
          {new Date(order.createdAt).toLocaleString()}
        </Text>
      </View>
      <View style={styles.orderAmount}>
        <Text style={styles.orderAmountValue}>MUR {cardTotal.toFixed(2)}</Text>
        {cardPayments.map((p, i) => (
          <Text key={i} style={styles.orderPaymentMethod}>
            {p.method} {p.reference ? `(${p.reference})` : ''}
          </Text>
        ))}
      </View>
      {isMatched && (
        <View style={styles.matchedBadge}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accentGreen} />
        </View>
      )}
    </View>
  );
};

const BatchReconciliationScreen = ({ navigation, route }) => {
  const { batchReport } = route.params || {};
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [reconciliationResult, setReconciliationResult] = useState(null);

  useEffect(() => {
    loadOrdersAndReconcile();
  }, []);

  const loadOrdersAndReconcile = async () => {
    setLoading(true);
    try {
      // Get all orders
      const allOrders = await getAllOrders();

      // Filter orders by date (if batch report has a date)
      let filteredOrders = allOrders;
      if (batchReport?.date) {
        // Parse batch date (DD/MM/YY format)
        const [day, month, year] = batchReport.date.split('/').map(n => parseInt(n));
        const batchDate = new Date(2000 + year, month - 1, day);

        filteredOrders = allOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return (
            orderDate.getDate() === batchDate.getDate() &&
            orderDate.getMonth() === batchDate.getMonth() &&
            orderDate.getFullYear() === batchDate.getFullYear()
          );
        });
      }

      // Calculate card payments from orders
      let totalCardPayments = 0;
      let cardPaymentCount = 0;
      const ordersWithCardPayments = [];

      filteredOrders.forEach(order => {
        if (order.status !== 'confirmed') return;

        const cardPayments = order.payments?.filter(p =>
          p.method?.toUpperCase().includes('CARD') ||
          p.method?.toUpperCase().includes('CREDIT') ||
          p.method?.toUpperCase().includes('MCB') ||
          p.method?.toUpperCase().includes('VISA') ||
          p.method?.toUpperCase().includes('MASTER') ||
          p.method?.toUpperCase().includes('AMEX')
        ) || [];

        if (cardPayments.length > 0) {
          const orderCardTotal = cardPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          totalCardPayments += orderCardTotal;
          cardPaymentCount += cardPayments.length;
          ordersWithCardPayments.push(order);
        }
      });

      // Calculate differences
      const batchTotal = batchReport?.netAmount || batchReport?.totalDebit || 0;
      const difference = batchTotal - totalCardPayments;
      const isMatched = Math.abs(difference) < 0.01; // Allow for rounding

      setOrders(ordersWithCardPayments);
      setReconciliationResult({
        batchTotal,
        systemTotal: totalCardPayments,
        difference,
        isMatched,
        batchCount: batchReport?.totalCount || 0,
        systemCount: cardPaymentCount,
        ordersCount: ordersWithCardPayments.length,
      });
    } catch (error) {
      console.error('Reconciliation error:', error);
      Alert.alert('Error', 'Failed to load orders for reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!reconciliationResult) return colors.textMuted;
    if (reconciliationResult.isMatched) return colors.accentGreen;
    if (Math.abs(reconciliationResult.difference) < 100) return colors.secondary;
    return colors.accentRed || '#E53935';
  };

  const getStatusText = () => {
    if (!reconciliationResult) return 'Processing...';
    if (reconciliationResult.isMatched) return 'Matched';
    if (reconciliationResult.difference > 0) return 'Batch Excess';
    return 'System Excess';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reconciliation</Text>
          <Text style={styles.headerSubtitle}>
            Batch #{batchReport?.batch || 'N/A'} • {batchReport?.date || 'No Date'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Reconciling...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: getStatusColor() + '15' }]}>
            <Ionicons
              name={reconciliationResult?.isMatched ? 'checkmark-circle' : 'alert-circle'}
              size={28}
              color={getStatusColor()}
            />
            <View style={styles.statusTextContainer}>
              <Text style={[styles.statusTitle, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
              {!reconciliationResult?.isMatched && (
                <Text style={styles.statusSubtitle}>
                  Difference: MUR {Math.abs(reconciliationResult?.difference || 0).toFixed(2)}
                </Text>
              )}
            </View>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <SummaryCard
              title="Batch Total"
              value={`MUR ${(reconciliationResult?.batchTotal || 0).toFixed(2)}`}
              subtitle={`${reconciliationResult?.batchCount || 0} transactions`}
              icon="receipt"
              color={colors.accent}
            />
            <SummaryCard
              title="System Total"
              value={`MUR ${(reconciliationResult?.systemTotal || 0).toFixed(2)}`}
              subtitle={`${reconciliationResult?.systemCount || 0} payments`}
              icon="card"
              color={colors.accentPurple || '#9C27B0'}
            />
          </View>

          {/* Difference Card */}
          <View style={[
            styles.differenceCard,
            { borderLeftColor: getStatusColor() }
          ]}>
            <View style={styles.differenceHeader}>
              <Text style={styles.differenceLabel}>Difference</Text>
              <Text style={[styles.differenceValue, { color: getStatusColor() }]}>
                {reconciliationResult?.difference > 0 ? '+' : ''}
                MUR {(reconciliationResult?.difference || 0).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.differenceHint}>
              {reconciliationResult?.isMatched
                ? 'Batch settlement matches system records'
                : reconciliationResult?.difference > 0
                  ? 'Batch report shows more than system records'
                  : 'System records show more than batch report'}
            </Text>
          </View>

          {/* Batch Report Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Batch Report Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Terminal ID (TID)</Text>
              <Text style={styles.detailValue}>{batchReport?.tid || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Merchant ID (MID)</Text>
              <Text style={styles.detailValue}>{batchReport?.mid || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Card Type</Text>
              <Text style={styles.detailValue}>{batchReport?.cardType || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Settlement Time</Text>
              <Text style={styles.detailValue}>{batchReport?.time || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[styles.detailValue, { color: batchReport?.settled ? colors.accentGreen : colors.textMuted }]}>
                {batchReport?.settled ? 'Settled' : 'Pending'}
              </Text>
            </View>
          </View>

          {/* Orders List */}
          <View style={styles.ordersSection}>
            <Text style={styles.ordersTitle}>
              Card Payments ({reconciliationResult?.ordersCount || 0} orders)
            </Text>
            {orders.length === 0 ? (
              <View style={styles.noOrders}>
                <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                <Text style={styles.noOrdersText}>No card payments found for this date</Text>
              </View>
            ) : (
              orders.map((order) => (
                <OrderRow
                  key={order.id || order.orderNumber}
                  order={order}
                  isMatched={reconciliationResult?.isMatched}
                />
              ))
            )}
          </View>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summarySubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Difference Card
  differenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  differenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  differenceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  differenceValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  differenceHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  // Details Card
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  // Orders Section
  ordersSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  ordersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  noOrders: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noOrdersText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderRowMatched: {
    backgroundColor: colors.accentGreen + '08',
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  orderCustomer: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  orderDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  orderAmount: {
    alignItems: 'flex-end',
  },
  orderAmountValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  orderPaymentMethod: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  matchedBadge: {
    marginLeft: 8,
  },
});

export default BatchReconciliationScreen;
