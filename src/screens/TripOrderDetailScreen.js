import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchOrderLineDetails } from '../services/tripService';

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

// Tab options
const TABS = [
  { id: 'lines', label: 'Lines', icon: 'list-outline' },
  { id: 'info', label: 'Order Info', icon: 'information-circle-outline' },
];

// Line Item Card Component
const LineItemCard = ({ line, index, onVerify }) => {
  const isVerified = line.verified_qty > 0;
  const isPicked = line.pick_confirm_st === 'YES' || line.picked_qty > 0;

  const getStatusColor = () => {
    if (isVerified) return THEME.success;
    if (isPicked) return THEME.info;
    return THEME.warning;
  };

  const getStatusText = () => {
    if (isVerified) return 'Verified';
    if (isPicked) return 'Picked';
    return 'Pending';
  };

  return (
    <View style={styles.lineCard}>
      <View style={styles.lineHeader}>
        <View style={styles.lineIndexBadge}>
          <Text style={styles.lineIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.lineInfo}>
          <Text style={styles.lineItemCode}>{line.item}</Text>
          <Text style={styles.lineItemDesc} numberOfLines={2}>{line.description}</Text>
        </View>
        <View style={[styles.lineStatusBadge, { backgroundColor: getStatusColor() + '15' }]}>
          <Text style={[styles.lineStatusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
        </View>
      </View>

      <View style={styles.lineQuantities}>
        <View style={styles.qtyItem}>
          <Text style={styles.qtyLabel}>Requested</Text>
          <Text style={styles.qtyValue}>{line.requested_quantity || 0}</Text>
        </View>
        <View style={styles.qtyDivider} />
        <View style={styles.qtyItem}>
          <Text style={styles.qtyLabel}>Picked</Text>
          <Text style={[styles.qtyValue, { color: THEME.info }]}>{line.picked_qty || 0}</Text>
        </View>
        <View style={styles.qtyDivider} />
        <View style={styles.qtyItem}>
          <Text style={styles.qtyLabel}>Verified</Text>
          <Text style={[styles.qtyValue, { color: isVerified ? THEME.success : THEME.textLight }]}>
            {line.verified_qty || 0}
          </Text>
        </View>
      </View>

      {line.lot && (
        <View style={styles.lineLotInfo}>
          <Ionicons name="cube-outline" size={14} color={THEME.textLight} />
          <Text style={styles.lineLotText}>Lot: {line.lot}</Text>
        </View>
      )}

      {/* Verify Button - only show if not verified */}
      {!isVerified && (
        <TouchableOpacity
          style={styles.verifyLineButton}
          onPress={() => onVerify(line)}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.verifyLineButtonText}>Verify</Text>
        </TouchableOpacity>
      )}

      {/* Already Verified indicator */}
      {isVerified && (
        <View style={styles.verifiedIndicator}>
          <Ionicons name="checkmark-circle" size={18} color={THEME.success} />
          <Text style={styles.verifiedIndicatorText}>Verified</Text>
        </View>
      )}
    </View>
  );
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

const TripOrderDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { order, tripId } = route.params;
  const [activeTab, setActiveTab] = useState('lines');
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyingLineId, setVerifyingLineId] = useState(null);

  // Calculate verification status from actual line data
  const totalLines = lines.length;
  const verifiedLines = lines.filter(l => l.verified_qty > 0).length;
  const isFullyVerified = totalLines > 0 && verifiedLines === totalLines;
  const isPartiallyVerified = verifiedLines > 0 && verifiedLines < totalLines;

  // Delivery status - for now we don't have this from API
  const isDelivered = false;

  useEffect(() => {
    loadOrderLines();
  }, []);

  const loadOrderLines = async () => {
    try {
      const result = await fetchOrderLineDetails(order.orderNumber);
      if (result.success && result.data?.items) {
        setLines(result.data.items);
      }
    } catch (error) {
      console.error('[TripOrderDetail] Error loading lines:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // Handle line verification
  const handleVerifyLine = (line) => {
    const qtyToVerify = line.requested_quantity || line.picked_qty || 0;

    Alert.alert(
      'Verify Line Item',
      `Confirm verification of:\n\n${line.item}\n${line.description}\n\nQuantity: ${qtyToVerify}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            // Update the line's verified_qty in state
            setLines(prevLines =>
              prevLines.map(l =>
                l.transaction_id === line.transaction_id || l.item === line.item
                  ? { ...l, verified_qty: qtyToVerify }
                  : l
              )
            );
            Alert.alert('Success', `Item ${line.item} verified with qty ${qtyToVerify}`);
          },
        },
      ]
    );
  };

  // Render Lines Tab
  const renderLinesTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Loading lines...</Text>
        </View>
      );
    }

    if (lines.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={48} color={THEME.textLight} />
          <Text style={styles.emptyText}>No lines found</Text>
        </View>
      );
    }

    return (
      <View style={styles.linesContainer}>
        <View style={styles.linesSummary}>
          <Text style={styles.linesSummaryText}>
            {lines.length} items • {lines.filter(l => l.verified_qty > 0).length} verified
          </Text>
        </View>
        {lines.map((line, index) => (
          <LineItemCard
            key={line.transaction_id || index}
            line={line}
            index={index}
            onVerify={handleVerifyLine}
          />
        ))}
      </View>
    );
  };

  // Render Order Info Tab
  const renderOrderInfoTab = () => (
    <View style={styles.infoContainer}>
      {/* Customer Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="person" size={24} color={THEME.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Customer</Text>
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
          <Text style={styles.cardTitle}>Order Details</Text>
        </View>

        <DetailRow label="Order Number" value={order.orderNumber} icon="receipt-outline" />
        <DetailRow label="Order Date" value={order.orderDate} icon="calendar-outline" />
        <DetailRow label="Order Type" value={order.orderType} icon="pricetag-outline" />
        <DetailRow label="Customer PO" value={order.customerPo} icon="document-outline" />
        <DetailRow label="Release Date" value={order.releaseDate} icon="time-outline" />
      </View>

      {/* Delivery Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="truck-delivery" size={24} color={THEME.primary} />
          </View>
          <Text style={styles.cardTitle}>Delivery</Text>
        </View>

        <DetailRow label="Salesman/Driver" value={order.salesman} icon="person-circle-outline" />
        <DetailRow label="Lorry" value={order.lorry} icon="car-outline" />
        <DetailRow label="Loading Bay" value={order.loadingByNum} icon="location-outline" />
        <DetailRow label="Picker" value={order.picker} icon="hand-left-outline" />
        <DetailRow label="Pick Slip No" value={order.pickSlipNo} icon="barcode-outline" />
      </View>

      {/* Order Summary Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="stats-chart" size={24} color={THEME.primary} />
          </View>
          <Text style={styles.cardTitle}>Summary</Text>
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
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />

      {/* Header with Status Icons */}
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
            <Text style={styles.headerTitle}>{order.orderNumber}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {order.accountName || 'Unknown Customer'}
            </Text>
          </View>
        </View>

        {/* Status Icons Row */}
        <View style={styles.statusIconsRow}>
          {/* Pick Status - based on picked_qty in lines */}
          <View style={styles.statusIconItem}>
            <View style={[
              styles.statusIconCircle,
              { backgroundColor: lines.some(l => l.picked_qty > 0) ? THEME.success : 'rgba(255,255,255,0.2)' }
            ]}>
              <Ionicons
                name={lines.some(l => l.picked_qty > 0) ? 'checkmark' : 'ellipse-outline'}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.statusIconLabel}>Pick</Text>
          </View>

          <View style={styles.statusIconConnector} />

          {/* Verify Status - based on verified_qty > 0 */}
          <View style={styles.statusIconItem}>
            <View style={[
              styles.statusIconCircle,
              { backgroundColor: isFullyVerified ? THEME.success : isPartiallyVerified ? THEME.warning : 'rgba(255,255,255,0.2)' }
            ]}>
              <Ionicons
                name={isFullyVerified ? 'checkmark' : isPartiallyVerified ? 'ellipsis-horizontal' : 'ellipse-outline'}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.statusIconLabel}>Verify</Text>
          </View>

          <View style={styles.statusIconConnector} />

          {/* Ship Status */}
          <View style={styles.statusIconItem}>
            <View style={[
              styles.statusIconCircle,
              { backgroundColor: isDelivered ? THEME.success : 'rgba(255,255,255,0.2)' }
            ]}>
              <Ionicons
                name={isDelivered ? 'checkmark' : 'ellipse-outline'}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.statusIconLabel}>Ship</Text>
          </View>

          <View style={styles.statusIconConnector} />

          {/* Deliver Status */}
          <View style={styles.statusIconItem}>
            <View style={[
              styles.statusIconCircle,
              { backgroundColor: isDelivered ? THEME.success : 'rgba(255,255,255,0.2)' }
            ]}>
              <Ionicons
                name={isDelivered ? 'checkmark' : 'ellipse-outline'}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.statusIconLabel}>Deliver</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? THEME.primary : THEME.textLight}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'lines' ? renderLinesTab() : renderOrderInfoTab()}

        {/* Action Buttons */}
        {!isDelivered && (
          <View style={styles.actionButtons}>
            {!isFullyVerified ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('OrderVerification', { order, tripId })}
              >
                <LinearGradient
                  colors={[THEME.success, THEME.accentLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.buttonText}>
                    {isPartiallyVerified ? `Verify Remaining (${totalLines - verifiedLines})` : 'Verify All Lines'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  Alert.alert('Confirm Delivery', 'Mark this order as delivered?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: () => navigation.goBack() },
                  ]);
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
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.accentLight,
    marginTop: 2,
  },

  // Status Icons Row
  statusIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  statusIconItem: {
    alignItems: 'center',
  },
  statusIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statusIconConnector: {
    width: 30,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
    marginBottom: 14,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 12,
    padding: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: THEME.primary + '15',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textLight,
    marginLeft: 6,
  },
  tabTextActive: {
    color: THEME.primary,
    fontWeight: '600',
  },

  scrollView: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textLight,
  },

  // Empty
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textLight,
  },

  // Lines Tab
  linesContainer: {
    padding: 16,
  },
  linesSummary: {
    marginBottom: 12,
  },
  linesSummaryText: {
    fontSize: 13,
    color: THEME.textLight,
  },
  lineCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lineIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  lineIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lineInfo: {
    flex: 1,
  },
  lineItemCode: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
  },
  lineItemDesc: {
    fontSize: 14,
    color: THEME.text,
    marginTop: 2,
  },
  lineStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lineStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  lineQuantities: {
    flexDirection: 'row',
    backgroundColor: THEME.background,
    borderRadius: 8,
    padding: 10,
  },
  qtyItem: {
    flex: 1,
    alignItems: 'center',
  },
  qtyLabel: {
    fontSize: 10,
    color: THEME.textLight,
    marginBottom: 4,
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
  },
  qtyDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  lineLotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  lineLotText: {
    fontSize: 12,
    color: THEME.textLight,
    marginLeft: 6,
  },
  verifyLineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  verifyLineButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  verifiedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.success + '15',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  verifiedIndicatorText: {
    color: THEME.success,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Info Tab
  infoContainer: {
    padding: 16,
    paddingTop: 8,
  },

  // Card
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },

  // Customer Info
  customerInfo: {
    marginBottom: 14,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  accountNumber: {
    fontSize: 12,
    color: THEME.textLight,
    marginTop: 2,
  },
  customerActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 14,
  },
  customerAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  customerActionText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: THEME.text,
  },

  // Detail Row
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: THEME.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: THEME.textLight,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.text,
    marginTop: 1,
  },

  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: THEME.background,
    marginHorizontal: 3,
    borderRadius: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
  summaryLabel: {
    fontSize: 10,
    color: THEME.textLight,
    marginTop: 2,
  },
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  amountLabel: {
    fontSize: 13,
    color: THEME.textLight,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
  },

  // Action Buttons
  actionButtons: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
