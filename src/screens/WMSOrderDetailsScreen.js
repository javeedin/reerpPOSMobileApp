import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { fetchShipmentLines, confirmPick } from '../services/wmsService';

const { width } = Dimensions.get('window');

// Line Item Card Component
const LineItemCard = ({ item, onConfirmPick, isConfirming }) => {
  const isPicked = item.pick_confirm_status === 'YES';
  const isShipped = item.shipped_status === 'YES';
  const pickedQty = parseInt(item.picked_qty) || 0;
  const requestedQty = parseInt(item.qty) || 0;
  const needsPick = pickedQty === 0 && !isPicked;

  let statusColor = '#FF9800'; // Pending
  let statusIcon = 'time-outline';
  let statusText = 'Pending';

  if (isShipped) {
    statusColor = '#9C27B0';
    statusIcon = 'checkmark-done-circle';
    statusText = 'Shipped';
  } else if (isPicked) {
    statusColor = '#4CAF50';
    statusIcon = 'checkmark-circle';
    statusText = 'Picked';
  }

  return (
    <View style={styles.lineItemCard}>
      {/* Header with Item Number and Status */}
      <View style={styles.lineItemHeader}>
        <View style={styles.lineItemHeaderLeft}>
          <Text style={styles.lineItemNumber}>{item.item_number || 'N/A'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        <Text style={styles.lineNumber}>Line #{item.line_number || '1'}</Text>
      </View>

      {/* Description */}
      <Text style={styles.lineItemDescription}>{item.description || 'No Description'}</Text>

      {/* Details Grid */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Requested</Text>
          <Text style={styles.detailValue}>{requestedQty}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Picked</Text>
          <Text style={[styles.detailValue, { color: isPicked ? '#4CAF50' : '#FF9800' }]}>
            {pickedQty}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Lot Number</Text>
          <Text style={styles.detailValue} numberOfLines={1}>{item.lot_number || 'N/A'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Lot Expiry</Text>
          <Text style={styles.detailValue}>
            {item.lot_expiry_date ? new Date(item.lot_expiry_date).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Additional Info */}
      <View style={styles.additionalInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="barcode-outline" size={14} color="#666" />
          <Text style={styles.infoText}>Barcode: {item.barcode || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="folder-outline" size={14} color="#666" />
          <Text style={styles.infoText}>Category: {item.category || item.groupcode || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={14} color="#666" />
          <Text style={styles.infoText}>Brand: {item.brand || 'N/A'}</Text>
        </View>
        {item.lorry_number && (
          <View style={styles.infoRow}>
            <Ionicons name="car-outline" size={14} color="#666" />
            <Text style={styles.infoText}>Lorry: {item.lorry_number}</Text>
          </View>
        )}
        {item.loading_bay && (
          <View style={styles.infoRow}>
            <Ionicons name="grid-outline" size={14} color="#666" />
            <Text style={styles.infoText}>Loading Bay: {item.loading_bay}</Text>
          </View>
        )}
      </View>

      {/* Confirm Pick Button */}
      {needsPick && (
        <TouchableOpacity
          style={styles.confirmPickButton}
          onPress={() => onConfirmPick(item)}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.confirmPickButtonText}>Confirm Pick</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Already Picked/Shipped Info */}
      {isPicked && !isShipped && (
        <View style={styles.pickedInfo}>
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          <Text style={styles.pickedInfoText}>
            Picked by {item.pick_confirm_by || item.picker_name || 'Unknown'} on{' '}
            {item.pick_confirm_date ? new Date(item.pick_confirm_date).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
      )}

      {isShipped && (
        <View style={styles.shippedInfo}>
          <Ionicons name="checkmark-done-circle" size={16} color="#9C27B0" />
          <Text style={styles.shippedInfoText}>
            Shipped on {item.shipped_date ? new Date(item.shipped_date).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
      )}
    </View>
  );
};

// Bottom Toolbar Component
const BottomToolbar = ({ onHome, onBack, onRefresh, isRefreshing }) => (
  <View style={styles.bottomToolbar}>
    <TouchableOpacity style={styles.toolbarButton} onPress={onHome}>
      <Ionicons name="home" size={24} color="#1565C0" />
      <Text style={styles.toolbarButtonText}>Home</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolbarButton} onPress={onBack}>
      <Ionicons name="arrow-back" size={24} color="#666" />
      <Text style={styles.toolbarButtonText}>Back</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolbarButton} onPress={onRefresh} disabled={isRefreshing}>
      {isRefreshing ? (
        <ActivityIndicator size="small" color="#1565C0" />
      ) : (
        <Ionicons name="refresh" size={24} color="#1565C0" />
      )}
      <Text style={styles.toolbarButtonText}>Refresh</Text>
    </TouchableOpacity>
  </View>
);

const WMSOrderDetailsScreen = ({ navigation, route }) => {
  const { order } = route.params || {};
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lines, setLines] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  const orderNumber = order?.order_number || order?.source_order_number || '';
  const pickerName = user?.PICKER_NAME || user?.picker_name || user?.username || '';

  const loadOrderLines = useCallback(async () => {
    if (!orderNumber) {
      setLoading(false);
      return;
    }

    try {
      const result = await fetchShipmentLines(orderNumber);
      if (result.success && result.data?.items) {
        setLines(result.data.items);
      } else {
        setLines([]);
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error loading lines:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    loadOrderLines();
  }, [loadOrderLines]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrderLines();
  };

  const handleConfirmPick = async (item) => {
    Alert.alert(
      'Confirm Pick',
      `Are you sure you want to confirm pick for ${item.item_number}?\n\nQuantity: ${item.qty}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setConfirmingId(item.delivery_detail_id);
            try {
              const result = await confirmPick(
                item.delivery_detail_id,
                item.qty,
                pickerName
              );

              if (result.success) {
                Alert.alert('Success', 'Pick confirmed successfully');
                // Update local state
                setLines(prev =>
                  prev.map(line =>
                    line.delivery_detail_id === item.delivery_detail_id
                      ? {
                          ...line,
                          picked_qty: item.qty,
                          pick_confirm_status: 'YES',
                          pick_confirm_date: new Date().toISOString(),
                          pick_confirm_by: pickerName,
                        }
                      : line
                  )
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to confirm pick');
              }
            } catch (error) {
              console.error('[WMSOrderDetails] Error confirming pick:', error);
              Alert.alert('Error', 'Failed to confirm pick');
            } finally {
              setConfirmingId(null);
            }
          },
        },
      ]
    );
  };

  // Calculate summary
  const summary = {
    totalLines: lines.length,
    totalQty: lines.reduce((sum, l) => sum + (parseInt(l.qty) || 0), 0),
    pickedQty: lines.reduce((sum, l) => sum + (parseInt(l.picked_qty) || 0), 0),
    pendingLines: lines.filter(l => l.pick_confirm_status !== 'YES').length,
    pickedLines: lines.filter(l => l.pick_confirm_status === 'YES' && l.shipped_status !== 'YES').length,
    shippedLines: lines.filter(l => l.shipped_status === 'YES').length,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />

      {/* Header */}
      <LinearGradient colors={['#1565C0', '#0D47A1']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{orderNumber || 'Order Details'}</Text>
            <Text style={styles.headerSubtitle}>
              {order?.account_name || order?.customer_name || 'Customer'} | {order?.transaction_type || 'Order'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Order Info Card */}
      <View style={styles.orderInfoCard}>
        <View style={styles.orderInfoRow}>
          <View style={styles.orderInfoItem}>
            <Text style={styles.orderInfoLabel}>Lorry</Text>
            <Text style={styles.orderInfoValue}>{order?.lorry_number || 'N/A'}</Text>
          </View>
          <View style={styles.orderInfoItem}>
            <Text style={styles.orderInfoLabel}>Bay</Text>
            <Text style={styles.orderInfoValue}>{order?.loading_bay || 'N/A'}</Text>
          </View>
          <View style={styles.orderInfoItem}>
            <Text style={styles.orderInfoLabel}>Priority</Text>
            <Text style={styles.orderInfoValue}>{order?.order_priority || 'N/A'}</Text>
          </View>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryItem, { borderColor: '#1565C0' }]}>
          <Text style={[styles.summaryValue, { color: '#1565C0' }]}>{summary.totalLines}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryItem, { borderColor: '#FF9800' }]}>
          <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{summary.pendingLines}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={[styles.summaryItem, { borderColor: '#4CAF50' }]}>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{summary.pickedLines}</Text>
          <Text style={styles.summaryLabel}>Picked</Text>
        </View>
        <View style={[styles.summaryItem, { borderColor: '#9C27B0' }]}>
          <Text style={[styles.summaryValue, { color: '#9C27B0' }]}>{summary.shippedLines}</Text>
          <Text style={styles.summaryLabel}>Shipped</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      ) : lines.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={60} color="#CCC" />
          <Text style={styles.emptyStateText}>No line items found</Text>
          <Text style={styles.emptyStateSubtext}>This order has no items to display</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1565C0']} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Line Items ({lines.length})</Text>
          {lines.map((item, index) => (
            <LineItemCard
              key={`line-${item.delivery_detail_id || item.line_number || index}-${index}`}
              item={item}
              onConfirmPick={handleConfirmPick}
              isConfirming={confirmingId === item.delivery_detail_id}
            />
          ))}
        </ScrollView>
      )}

      {/* Bottom Toolbar */}
      <BottomToolbar
        onHome={() => navigation.navigate('Home')}
        onBack={() => navigation.goBack()}
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Order Info Card
  orderInfoCard: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  orderInfoItem: {
    alignItems: 'center',
  },
  orderInfoLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  orderInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // Summary Container
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#FAFAFA',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  // Line Item Card
  lineItemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  lineItemHeaderLeft: {
    flex: 1,
  },
  lineItemNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
    marginBottom: 4,
  },
  lineNumber: {
    fontSize: 11,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  lineItemDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  // Details Grid
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  detailItem: {
    width: '50%',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // Additional Info
  additionalInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  // Confirm Pick Button
  confirmPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 12,
  },
  confirmPickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  // Picked/Shipped Info
  pickedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  pickedInfoText: {
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 8,
  },
  shippedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  shippedInfoText: {
    fontSize: 12,
    color: '#7B1FA2',
    marginLeft: 8,
  },
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  // Bottom Toolbar
  bottomToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  toolbarButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  toolbarButtonText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
});

export default WMSOrderDetailsScreen;
