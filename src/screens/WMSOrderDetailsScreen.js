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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { fetchShipmentLines, confirmPick, fetchItemOnhand, fetchItemLots } from '../services/wmsService';

const { width } = Dimensions.get('window');

// Lots Modal Component
const LotsModal = ({ visible, onClose, item, lots, onhandItem, isLoading }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="layers-outline" size={24} color="#1565C0" />
              <Text style={styles.modalTitle}>Available Lots</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Item Info */}
          <View style={styles.modalItemInfo}>
            <Text style={styles.modalItemNumber}>{item?.item_number || 'N/A'}</Text>
            <Text style={styles.modalItemDesc} numberOfLines={2}>{item?.description || 'No Description'}</Text>
          </View>

          {/* Onhand Summary */}
          {onhandItem && (
            <View style={styles.onhandSummary}>
              <View style={styles.onhandRow}>
                <View style={styles.onhandItem}>
                  <Text style={styles.onhandLabel}>On Hand Qty</Text>
                  <Text style={styles.onhandValue}>{onhandItem.primaryQuantity || 0}</Text>
                </View>
                <View style={styles.onhandItem}>
                  <Text style={styles.onhandLabel}>UOM</Text>
                  <Text style={styles.onhandValue}>{onhandItem.primaryUomCode || 'EA'}</Text>
                </View>
                <View style={styles.onhandItem}>
                  <Text style={styles.onhandLabel}>Subinventory</Text>
                  <Text style={styles.onhandValue}>{onhandItem.subinventoryCode || 'N/A'}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Lots List */}
          <ScrollView style={styles.lotsScrollView}>
            {isLoading ? (
              <View style={styles.lotsLoading}>
                <ActivityIndicator size="large" color="#1565C0" />
                <Text style={styles.lotsLoadingText}>Loading lots...</Text>
              </View>
            ) : lots && lots.length > 0 ? (
              <>
                <Text style={styles.lotsSectionTitle}>Lot Details ({lots.length})</Text>
                {lots.map((lot, index) => (
                  <View key={`lot-${lot.lotNumber}-${index}`} style={styles.lotCard}>
                    <View style={styles.lotHeader}>
                      <Text style={styles.lotNumber}>{lot.lotNumber}</Text>
                      <View style={styles.lotQtyBadge}>
                        <Text style={styles.lotQtyText}>{lot.quantity || 0}</Text>
                      </View>
                    </View>
                    <View style={styles.lotDetails}>
                      <View style={styles.lotDetailItem}>
                        <Ionicons name="calendar-outline" size={14} color="#666" />
                        <Text style={styles.lotDetailText}>
                          Expiry: {lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                      {lot.gradeCode && (
                        <View style={styles.lotDetailItem}>
                          <Ionicons name="star-outline" size={14} color="#666" />
                          <Text style={styles.lotDetailText}>Grade: {lot.gradeCode}</Text>
                        </View>
                      )}
                      {lot.originationDate && (
                        <View style={styles.lotDetailItem}>
                          <Ionicons name="time-outline" size={14} color="#666" />
                          <Text style={styles.lotDetailText}>
                            Origin: {new Date(lot.originationDate).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </>
            ) : onhandItem ? (
              <View style={styles.noLotsContainer}>
                <Ionicons name="cube-outline" size={40} color="#CCC" />
                <Text style={styles.noLotsText}>No lot details available</Text>
                <Text style={styles.noLotsSubtext}>Item may not be lot controlled</Text>
              </View>
            ) : (
              <View style={styles.noLotsContainer}>
                <Ionicons name="alert-circle-outline" size={40} color="#FF9800" />
                <Text style={styles.noLotsText}>Item not found in inventory</Text>
                <Text style={styles.noLotsSubtext}>No onhand balance for this item</Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.modalDoneButton} onPress={onClose}>
            <Text style={styles.modalDoneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Line Item Card Component
const LineItemCard = ({ item, onConfirmPick, onCancelPick, onSearchLots, isConfirming, isCancelling }) => {
  const isPicked = item.pick_confirm_status === 'YES';
  const isShipped = item.shipped_status === 'YES';
  const pickedQty = parseInt(item.picked_qty) || 0;
  const requestedQty = parseInt(item.qty) || 0;
  const needsPick = pickedQty === 0 && !isPicked;
  const canCancel = isPicked && !isShipped;

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
          <View style={styles.itemNumberRow}>
            <Text style={styles.lineItemNumber}>{item.item_number || 'N/A'}</Text>
            {/* Search Lots Button */}
            <TouchableOpacity
              style={styles.searchLotsButton}
              onPress={() => onSearchLots(item)}
            >
              <Ionicons name="layers-outline" size={20} color="#1565C0" />
              <Text style={styles.searchLotsText}>Lots</Text>
            </TouchableOpacity>
          </View>
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

      {/* Action Buttons */}
      {needsPick && (
        <View style={styles.actionButtonsRow}>
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
        </View>
      )}

      {/* Cancel Pick Button - shown when picked but not shipped */}
      {canCancel && (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.cancelPickButton}
            onPress={() => onCancelPick(item)}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#FFF" />
                <Text style={styles.cancelPickButtonText}>Cancel Pick</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Already Picked Info - shows along with Cancel button */}
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
  const [cancellingId, setCancellingId] = useState(null);

  // Lots Modal state
  const [lotsModalVisible, setLotsModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lots, setLots] = useState([]);
  const [onhandItem, setOnhandItem] = useState(null);

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

  const handleCancelPick = async (item) => {
    Alert.alert(
      'Cancel Pick',
      `Are you sure you want to cancel pick for ${item.item_number}?\n\nThis will reset the picked quantity to 0.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(item.delivery_detail_id);
            try {
              // TODO: Replace with actual cancel pick API call
              // For now, just show a message
              Alert.alert('Info', 'Cancel Pick API not yet configured.\n\nPlease provide the API endpoint.');

              // When API is ready, uncomment and modify:
              // const result = await cancelPick(item.delivery_detail_id, pickerName);
              // if (result.success) {
              //   setLines(prev =>
              //     prev.map(line =>
              //       line.delivery_detail_id === item.delivery_detail_id
              //         ? { ...line, picked_qty: 0, pick_confirm_status: 'NO', pick_confirm_date: null }
              //         : line
              //     )
              //   );
              // }
            } catch (error) {
              console.error('[WMSOrderDetails] Error cancelling pick:', error);
              Alert.alert('Error', 'Failed to cancel pick');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSearchLots = async (item) => {
    setSelectedItem(item);
    setLotsModalVisible(true);
    setLotsLoading(true);
    setLots([]);
    setOnhandItem(null);

    try {
      // Get organization and subinventory from order or item data
      const organizationCode = item.organization_name || order?.organization_name || 'GIC';
      const subinventoryCode = item.subinventory_code || order?.subinventory_code || 'DUTY PAID';
      const itemNumber = item.item_number;

      console.log('[WMSOrderDetails] Searching lots for:', { organizationCode, subinventoryCode, itemNumber });

      // Fetch onhand from Fusion API
      const onhandResult = await fetchItemOnhand(organizationCode, subinventoryCode, itemNumber);

      if (onhandResult.success && onhandResult.items && onhandResult.items.length > 0) {
        // Use the first onhand item (or aggregate if needed)
        const firstOnhand = onhandResult.items[0];
        setOnhandItem(firstOnhand);

        // If item has lotsHref, fetch lot details
        if (firstOnhand.lotsHref) {
          const lotsResult = await fetchItemLots(firstOnhand.lotsHref);
          if (lotsResult.success && lotsResult.lots) {
            setLots(lotsResult.lots);
          }
        }
      } else {
        console.log('[WMSOrderDetails] No onhand found for item:', itemNumber);
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error searching lots:', error);
      Alert.alert('Error', 'Failed to load lot information');
    } finally {
      setLotsLoading(false);
    }
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

      {/* Lots Modal */}
      <LotsModal
        visible={lotsModalVisible}
        onClose={() => setLotsModalVisible(false)}
        item={selectedItem}
        lots={lots}
        onhandItem={onhandItem}
        isLoading={lotsLoading}
      />

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
              onCancelPick={handleCancelPick}
              onSearchLots={handleSearchLots}
              isConfirming={confirmingId === item.delivery_detail_id}
              isCancelling={cancellingId === item.delivery_detail_id}
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
  itemNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lineItemNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
  },
  searchLotsButton: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  searchLotsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1565C0',
    marginLeft: 4,
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
  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  confirmPickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  confirmPickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  cancelPickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 12,
  },
  cancelPickButtonText: {
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
    flex: 1,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalItemInfo: {
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  modalItemNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
    marginBottom: 4,
  },
  modalItemDesc: {
    fontSize: 14,
    color: '#666',
  },
  onhandSummary: {
    padding: 16,
    backgroundColor: '#E3F2FD',
  },
  onhandRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  onhandItem: {
    alignItems: 'center',
  },
  onhandLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  onhandValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
  },
  lotsScrollView: {
    maxHeight: 300,
    padding: 16,
  },
  lotsLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  lotsLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  lotsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  lotCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  lotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lotNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  lotQtyBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lotQtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  lotDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 8,
  },
  lotDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lotDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  noLotsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noLotsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  noLotsSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  modalDoneButton: {
    marginHorizontal: 16,
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default WMSOrderDetailsScreen;
