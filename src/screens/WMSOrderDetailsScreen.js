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
  TextInput,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';
import { fetchShipmentLines, confirmPick, confirmPickPending, shipConfirm, processS2VShipment, fetchItemOnhand, fetchItemLots } from '../services/wmsService';

const { width } = Dimensions.get('window');

// Month abbreviations for API format
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Format date as DD-MON-YYYY HH:MI:SS AM/PM (e.g., "15-JAN-2026 02:30:45 PM")
const formatDateTimeForAPI = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const hoursStr = String(hours).padStart(2, '0');

  return `${day}-${month}-${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
};

// Format date as YYYY-MM-DD (for display only)
const formatDateForAPI = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Confirm Pick Modal Component - Shows JSON payload preview
const ConfirmPickModal = ({ visible, onClose, onConfirm, item, pickerName, instance, isProcessing }) => {
  if (!item) return null;

  // Build the JSON payload
  // Use the "id" field directly as-is
  const rawId = item.id || item.source_delivery_detail_id || item.delivery_detail_id || '';

  const payload = {
    id: String(rawId),
    line_number: String(item.line_number || '1'),
    lot: item.lot_number || '',
    pickedQty: String(item.qty || '0'),
    pickedBy: pickerName || '',
    pickConfirmDate: formatDateTimeForAPI(new Date()),
    pickConfirmStatus: 'YES',
    instance: instance || 'PROD',
  };

  const jsonString = JSON.stringify(payload, null, 2);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="code-slash-outline" size={24} color="#1565C0" />
              <Text style={styles.modalTitle}>Confirm Pick</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} disabled={isProcessing}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Item Info */}
          <View style={styles.modalItemInfo}>
            <Text style={styles.modalItemNumber}>{item.item_number || 'N/A'}</Text>
            <Text style={styles.modalItemDesc} numberOfLines={2}>{item.description || 'No Description'}</Text>
          </View>

          {/* API Endpoint Info */}
          <View style={styles.apiEndpointInfo}>
            <View style={styles.apiMethodBadge}>
              <Text style={styles.apiMethodText}>POST</Text>
            </View>
            <Text style={styles.apiEndpointText} numberOfLines={2}>
              /WAREHOUSEMANAGEMENT/PENDING_PICKING_DETAILS
            </Text>
          </View>

          {/* JSON Preview */}
          <View style={styles.jsonPreviewContainer}>
            <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
            <ScrollView style={styles.jsonScrollView}>
              <View style={styles.jsonCodeBlock}>
                <Text style={styles.jsonCodeText}>{jsonString}</Text>
              </View>
            </ScrollView>
          </View>

          {/* Field Details */}
          <ScrollView style={styles.fieldDetailsScroll}>
            <Text style={styles.fieldDetailsTitle}>Field Mapping:</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>id:</Text>
              <Text style={styles.fieldValue}>{payload.id || '(empty)'}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>line_number:</Text>
              <Text style={styles.fieldValue}>{payload.line_number}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>lot:</Text>
              <Text style={styles.fieldValue}>{payload.lot || '(empty)'}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>pickedQty:</Text>
              <Text style={styles.fieldValue}>{payload.pickedQty}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>pickedBy:</Text>
              <Text style={styles.fieldValue}>{payload.pickedBy || '(empty)'}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>pickConfirmDate:</Text>
              <Text style={styles.fieldValue}>{payload.pickConfirmDate}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>pickConfirmStatus:</Text>
              <Text style={styles.fieldValue}>{payload.pickConfirmStatus}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>instance:</Text>
              <Text style={styles.fieldValue}>{payload.instance}</Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.confirmModalActions}>
            <TouchableOpacity
              style={styles.confirmModalCancelBtn}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Text style={styles.confirmModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmModalConfirmBtn, isProcessing && styles.confirmModalConfirmBtnDisabled]}
              onPress={() => onConfirm(payload)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.confirmModalConfirmText}>Confirm Pick</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// API Response Modal Component - Shows JSON response/errors from API calls
const APIResponseModal = ({ visible, onClose, title, response, isSuccess, isLoading }) => {
  const jsonString = response ? JSON.stringify(response, null, 2) : '';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.apiModalOverlay}>
        <View style={styles.apiModalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons
                name={isLoading ? 'hourglass-outline' : isSuccess ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color={isLoading ? '#FF9800' : isSuccess ? '#4CAF50' : '#F44336'}
              />
              <Text style={styles.modalTitle}>{title || 'API Response'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} disabled={isLoading}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Status Banner */}
          <View style={[
            styles.apiStatusBanner,
            { backgroundColor: isLoading ? '#FFF3E0' : isSuccess ? '#E8F5E9' : '#FFEBEE' }
          ]}>
            {isLoading ? (
              <View style={styles.apiStatusContent}>
                <ActivityIndicator size="small" color="#FF9800" />
                <Text style={[styles.apiStatusText, { color: '#E65100', marginLeft: 8 }]}>Processing...</Text>
              </View>
            ) : (
              <View style={styles.apiStatusContent}>
                <Ionicons
                  name={isSuccess ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={isSuccess ? '#4CAF50' : '#F44336'}
                />
                <Text style={[styles.apiStatusText, { color: isSuccess ? '#2E7D32' : '#C62828', marginLeft: 8 }]}>
                  {isSuccess ? 'Success' : 'Error'}
                </Text>
              </View>
            )}
          </View>

          {/* JSON Response */}
          <ScrollView style={styles.apiResponseScroll} nestedScrollEnabled={true}>
            <View style={styles.jsonCodeBlock}>
              <Text style={styles.jsonCodeText}>{jsonString || 'No response data'}</Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.apiModalCloseButton, isLoading && { backgroundColor: '#999' }]}
            onPress={onClose}
            disabled={isLoading}
          >
            <Text style={styles.modalDoneButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Bulk Ship Confirm Modal Component - Shows picked items and processes them
const BulkShipConfirmModal = ({ visible, onClose, pickedItems, onProcess, processingStatus, finalStatus }) => {
  const isProcessing = Object.keys(processingStatus).some(k => processingStatus[k] === 'processing') || finalStatus === 'processing';
  const processedCount = Object.keys(processingStatus).filter(k => processingStatus[k] === 'success' || processingStatus[k] === 'error').length;
  const successCount = Object.keys(processingStatus).filter(k => processingStatus[k] === 'success').length;
  const errorCount = Object.keys(processingStatus).filter(k => processingStatus[k] === 'error').length;
  const allItemsProcessed = processedCount === pickedItems.length && pickedItems.length > 0;
  const allSuccess = successCount === pickedItems.length && pickedItems.length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.apiModalOverlay}>
        <View style={[styles.apiModalContainer, { maxHeight: '90%', flex: 0, height: 500 }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="airplane" size={24} color="#9C27B0" />
              <Text style={styles.modalTitle}>Ship Confirm All</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} disabled={isProcessing}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Summary Banner */}
          <View style={styles.bulkSummaryBanner}>
            <View style={styles.bulkSummaryItem}>
              <Text style={styles.bulkSummaryValue}>{pickedItems.length}</Text>
              <Text style={styles.bulkSummaryLabel}>Total</Text>
            </View>
            <View style={styles.bulkSummaryItem}>
              <Text style={[styles.bulkSummaryValue, { color: '#4CAF50' }]}>{successCount}</Text>
              <Text style={styles.bulkSummaryLabel}>Success</Text>
            </View>
            <View style={styles.bulkSummaryItem}>
              <Text style={[styles.bulkSummaryValue, { color: '#F44336' }]}>{errorCount}</Text>
              <Text style={styles.bulkSummaryLabel}>Failed</Text>
            </View>
            <View style={styles.bulkSummaryItem}>
              <Text style={[styles.bulkSummaryValue, { color: '#FF9800' }]}>{pickedItems.length - processedCount}</Text>
              <Text style={styles.bulkSummaryLabel}>Pending</Text>
            </View>
          </View>

          {/* Final Processing Status */}
          {finalStatus && (
            <View style={[
              styles.finalStatusBanner,
              { backgroundColor: finalStatus === 'processing' ? '#E3F2FD' : finalStatus === 'success' ? '#E8F5E9' : '#FFEBEE' }
            ]}>
              {finalStatus === 'processing' && (
                <>
                  <ActivityIndicator size="small" color="#1565C0" />
                  <Text style={[styles.finalStatusText, { color: '#1565C0' }]}>Processing S2V Shipment...</Text>
                </>
              )}
              {finalStatus === 'success' && (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={[styles.finalStatusText, { color: '#2E7D32' }]}>S2V Shipment Processed Successfully!</Text>
                </>
              )}
              {finalStatus === 'error' && (
                <>
                  <Ionicons name="alert-circle" size={20} color="#F44336" />
                  <Text style={[styles.finalStatusText, { color: '#C62828' }]}>S2V Shipment Processing Failed</Text>
                </>
              )}
            </View>
          )}

          {/* Items List Header */}
          <View style={styles.bulkListHeader}>
            <Text style={[styles.bulkListHeaderText, { flex: 0.8 }]}>Line</Text>
            <Text style={[styles.bulkListHeaderText, { flex: 2.5 }]}>Item / Description</Text>
            <Text style={[styles.bulkListHeaderText, { flex: 0.7, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.bulkListHeaderText, { flex: 1.2, textAlign: 'right' }]}>Status</Text>
          </View>

          {/* Items List */}
          <ScrollView style={styles.bulkItemsScroll} nestedScrollEnabled={true}>
            {pickedItems.length === 0 ? (
              <View style={styles.noItemsContainer}>
                <Ionicons name="checkmark-done-circle" size={48} color="#4CAF50" />
                <Text style={styles.noItemsText}>No items to ship</Text>
                <Text style={styles.noItemsSubtext}>All picked items have been shipped</Text>
              </View>
            ) : (
              pickedItems.map((item, index) => {
                const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';
                const status = processingStatus[linesId] || 'pending';
                const pickedQty = parseInt(item.picked_qty) || 0;

                return (
                  <View key={`bulk-${linesId}-${index}`} style={styles.bulkItemRow}>
                    <Text style={[styles.bulkLineNumber, { flex: 0.8 }]}>#{item.line_number || index + 1}</Text>
                    <View style={{ flex: 2.5 }}>
                      <Text style={styles.bulkItemNumber} numberOfLines={1}>{item.item_number || 'N/A'}</Text>
                      <Text style={styles.bulkItemDesc} numberOfLines={1}>{item.description || 'No description'}</Text>
                    </View>
                    <Text style={[styles.bulkQtyText, { flex: 0.7, textAlign: 'center' }]}>{pickedQty}</Text>
                    <View style={[styles.bulkItemStatus, { flex: 1.2 }]}>
                      {status === 'pending' && (
                        <View style={[styles.bulkStatusBadge, { backgroundColor: '#FFF3E0' }]}>
                          <Ionicons name="time-outline" size={16} color="#FF9800" />
                          <Text style={[styles.bulkStatusText, { color: '#E65100' }]}>Pending</Text>
                        </View>
                      )}
                      {status === 'processing' && (
                        <View style={[styles.bulkStatusBadge, { backgroundColor: '#E3F2FD' }]}>
                          <ActivityIndicator size="small" color="#1565C0" />
                        </View>
                      )}
                      {status === 'success' && (
                        <View style={[styles.bulkStatusBadge, { backgroundColor: '#E8F5E9' }]}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={[styles.bulkStatusText, { color: '#2E7D32' }]}>Done</Text>
                        </View>
                      )}
                      {status === 'error' && (
                        <View style={[styles.bulkStatusBadge, { backgroundColor: '#FFEBEE' }]}>
                          <Ionicons name="close-circle" size={16} color="#F44336" />
                          <Text style={[styles.bulkStatusText, { color: '#C62828' }]}>Failed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.bulkActionButtons}>
            {(allItemsProcessed && finalStatus === 'success') || finalStatus === 'error' ? (
              <TouchableOpacity style={styles.bulkDoneButton} onPress={onClose}>
                <Ionicons name="checkmark-done" size={20} color="#FFF" />
                <Text style={styles.bulkButtonText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.bulkCancelButton, isProcessing && { opacity: 0.5 }]}
                  onPress={onClose}
                  disabled={isProcessing}
                >
                  <Text style={styles.bulkCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkConfirmButton, (isProcessing || pickedItems.length === 0) && { opacity: 0.5 }]}
                  onPress={onProcess}
                  disabled={isProcessing || pickedItems.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.bulkButtonText}>Processing...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="airplane" size={20} color="#FFF" />
                      <Text style={styles.bulkButtonText}>Ship All ({pickedItems.length})</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

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

// QR Code Print Modal Component - Compact Version
const QRCodePrintModal = ({ visible, onClose, order, pickerName }) => {
  const orderNumber = order?.source_order_number || order?.order_number || 'N/A';
  const orderDate = order?.assignment_date
    ? new Date(order.assignment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';
  const accountName = order?.account_name || order?.customer_name || 'N/A';
  const loadingBay = order?.loading_bay || 'N/A';
  const lorryNumber = order?.lorry_number || 'N/A';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.qrModalOverlay}>
        <View style={styles.qrModalContainer}>
          {/* Header with close */}
          <View style={styles.qrModalHeader}>
            <Text style={styles.qrModalTitle}>Print QR Label</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* QR Code */}
          <View style={styles.qrCodeSection}>
            <QRCode value={orderNumber} size={120} backgroundColor="white" color="black" />
          </View>

          {/* Simple Labels */}
          <View style={styles.qrLabelsSimple}>
            <Text style={styles.qrLabelLine}><Text style={styles.qrLabelKey}>Order:</Text> {orderNumber}</Text>
            <Text style={styles.qrLabelLine}><Text style={styles.qrLabelKey}>Date:</Text> {orderDate}</Text>
            <Text style={styles.qrLabelLine} numberOfLines={1}><Text style={styles.qrLabelKey}>Customer:</Text> {accountName}</Text>
            <Text style={styles.qrLabelLine}><Text style={styles.qrLabelKey}>Picker:</Text> {pickerName || 'N/A'}</Text>
            <Text style={styles.qrLabelLine}><Text style={styles.qrLabelKey}>Bay:</Text> {loadingBay}  |  <Text style={styles.qrLabelKey}>Lorry:</Text> {lorryNumber}</Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.qrCloseButton} onPress={onClose}>
            <Text style={styles.qrCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Line Item Card Component
const LineItemCard = ({ item, transactionType, onConfirmPick, onCancelPick, onShipConfirm, onUndoPick, onSearchLots, isConfirming, isCancelling, isShipping, isUndoing }) => {
  const isPicked = item.pick_confirm_status === 'YES';
  const isShipped = item.shipped_status === 'YES';
  const pickedQty = parseInt(item.picked_qty) || 0;
  const requestedQty = parseInt(item.qty) || 0;
  const discPer = item.disc_per || '';
  const isSalesOrder = (transactionType || '').toLowerCase().includes('sales');

  // Show Confirm and Cancel buttons only when picked_qty = 0
  const showPickButtons = pickedQty === 0;
  // Show Ship Confirm and Undo Pick buttons when picked but not shipped
  const showShipButtons = pickedQty > 0 && !isShipped;

  // Use the "id" field directly as-is
  const rawId = item.id || item.source_delivery_detail_id || item.delivery_detail_id || '';
  const formattedId = String(rawId);

  // Get Lines_id for ship confirm API
  const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';

  // Status determination: picked_qty = 0 means pending, > 0 means picked
  let statusColor = '#FF9800'; // Pending
  let statusIcon = 'time-outline';
  let statusText = 'Pending';

  if (isShipped) {
    statusColor = '#9C27B0';
    statusIcon = 'checkmark-done-circle';
    statusText = 'Shipped';
  } else if (pickedQty > 0) {
    // picked_qty > 0 means picked (not based on pick_confirm_status)
    statusColor = '#4CAF50';
    statusIcon = 'checkmark-circle';
    statusText = 'Picked';
  }

  return (
    <View style={styles.lineItemCard}>
      {/* Compact Header Row - Item Number, IDs, Status, Line# */}
      <View style={styles.compactHeaderRow}>
        <View style={styles.itemInfoLeft}>
          <Text style={styles.lineItemNumber}>{item.item_number || 'N/A'}</Text>
          <View style={styles.idsInline}>
            <Text style={styles.itemIdSmall}>{formattedId}</Text>
            {linesId ? <Text style={styles.linesIdSmall}>L:{linesId}</Text> : null}
          </View>
        </View>
        <View style={styles.itemInfoRight}>
          <View style={[styles.statusBadgeSmall, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name={statusIcon} size={12} color={statusColor} />
            <Text style={[styles.statusBadgeTextSmall, { color: statusColor }]}>{statusText}</Text>
          </View>
          <Text style={styles.lineNumberSmall}>#{item.line_number || '1'}</Text>
        </View>
      </View>

      {/* Description - single line */}
      <Text style={styles.lineItemDescriptionCompact} numberOfLines={1}>{item.description || 'No Description'}</Text>

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
          <View style={styles.lotLabelRow}>
            <Text style={styles.detailLabel}>Lot Number</Text>
            <TouchableOpacity
              style={styles.searchLotsButton}
              onPress={() => onSearchLots(item)}
            >
              <Ionicons name="layers-outline" size={14} color="#1565C0" />
              <Text style={styles.searchLotsText}>Search</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailValue} numberOfLines={1}>{item.lot_number || 'N/A'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Lot Expiry</Text>
          <Text style={styles.detailValue}>
            {item.lot_expiry_date ? new Date(item.lot_expiry_date).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Barcode Info */}
      <View style={styles.barcodeRow}>
        <Ionicons name="barcode-outline" size={14} color="#666" />
        <Text style={styles.barcodeText}>Barcode: {item.barcode || 'N/A'}</Text>
        {!isSalesOrder && discPer && (
          <Text style={styles.discPerText}>Disc: {discPer}</Text>
        )}
      </View>

      {/* Pick Action Buttons - show when picked_qty = 0 */}
      {showPickButtons && (
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
                <Text style={styles.confirmPickButtonText}>Confirm</Text>
              </>
            )}
          </TouchableOpacity>

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
                <Text style={styles.cancelPickButtonText}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Ship Action Buttons - show when picked but not shipped */}
      {showShipButtons && (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.shipConfirmButton}
            onPress={() => onShipConfirm(item, linesId)}
            disabled={isShipping || !linesId}
          >
            {isShipping ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="airplane" size={20} color="#FFF" />
                <Text style={styles.shipConfirmButtonText}>Ship Confirm</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.undoPickButton}
            onPress={() => onUndoPick(item)}
            disabled={isUndoing}
          >
            {isUndoing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="arrow-undo" size={20} color="#FFF" />
                <Text style={styles.undoPickButtonText}>Undo Pick</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Already Picked Info - shows when picked_qty > 0 */}
      {pickedQty > 0 && (
        <View style={styles.pickedInfo}>
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          <Text style={styles.pickedInfoText}>
            Picked: {pickedQty} | By {item.pick_confirm_by || item.picker_name || 'Unknown'} on{' '}
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

  // Confirm Pick Modal state
  const [confirmPickModalVisible, setConfirmPickModalVisible] = useState(false);
  const [confirmPickItem, setConfirmPickItem] = useState(null);
  const [isConfirmingPick, setIsConfirmingPick] = useState(false);

  // Ship Confirm state
  const [shippingId, setShippingId] = useState(null);
  const [undoingId, setUndoingId] = useState(null);

  // API Response Modal state
  const [apiResponseModalVisible, setApiResponseModalVisible] = useState(false);
  const [apiResponseTitle, setApiResponseTitle] = useState('');
  const [apiResponse, setApiResponse] = useState(null);
  const [apiResponseSuccess, setApiResponseSuccess] = useState(false);
  const [apiResponseLoading, setApiResponseLoading] = useState(false);

  // Filter state
  const [filterText, setFilterText] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Bulk Ship Confirm state
  const [bulkShipModalVisible, setBulkShipModalVisible] = useState(false);
  const [bulkProcessingStatus, setBulkProcessingStatus] = useState({});
  const [bulkFinalStatus, setBulkFinalStatus] = useState(null); // null, 'processing', 'success', 'error'

  // QR Code Modal state
  const [qrModalVisible, setQrModalVisible] = useState(false);

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

  // Filter items based on search text
  const filteredLines = filterText.trim()
    ? lines.filter(item =>
        (item.item_number || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (item.delivery_detail_id || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (item.barcode || '').toLowerCase().includes(filterText.toLowerCase())
      )
    : lines;

  // Get unique item suggestions for autocomplete
  const getFilterSuggestions = () => {
    if (!filterText.trim()) return [];
    const suggestions = lines
      .filter(item =>
        (item.item_number || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(filterText.toLowerCase())
      )
      .slice(0, 5)
      .map(item => ({
        id: item.delivery_detail_id,
        label: item.item_number,
        description: item.description,
      }));
    return suggestions;
  };

  // Open confirm pick modal with item details
  const handleConfirmPick = (item) => {
    setConfirmPickItem(item);
    setConfirmPickModalVisible(true);
  };

  // Execute the confirm pick API call
  const executeConfirmPick = async (payload) => {
    setIsConfirmingPick(true);
    try {
      console.log('[WMSOrderDetails] Confirm Pick Payload:', JSON.stringify(payload, null, 2));

      // Call the PENDING_PICKING_DETAILS API
      const result = await confirmPickPending(payload);

      if (result.success) {
        Alert.alert('Success', 'Pick confirmed successfully', [
          {
            text: 'OK',
            onPress: () => {
              // Update local state to reflect the confirmed pick
              setLines(prev =>
                prev.map(line =>
                  line.delivery_detail_id === confirmPickItem.delivery_detail_id
                    ? {
                        ...line,
                        picked_qty: confirmPickItem.qty,
                        pick_confirm_status: 'YES',
                        pick_confirm_date: new Date().toISOString(),
                        pick_confirm_by: pickerName,
                      }
                    : line
                )
              );
              setConfirmPickModalVisible(false);
              setConfirmPickItem(null);
            }
          }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm pick');
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error confirming pick:', error);
      Alert.alert('Error', 'Failed to confirm pick: ' + (error.message || 'Unknown error'));
    } finally {
      setIsConfirmingPick(false);
    }
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

  // Handle Ship Confirm
  const handleShipConfirm = async (item, linesId) => {
    setShippingId(item.delivery_detail_id);
    setApiResponseTitle('Ship Confirm');
    setApiResponseLoading(true);
    setApiResponse(null);
    setApiResponseSuccess(false);
    setApiResponseModalVisible(true);

    try {
      // Debug: Log all item fields to find the correct Lines_id field
      console.log('[WMSOrderDetails] Ship Confirm - Item keys:', Object.keys(item));
      console.log('[WMSOrderDetails] Ship Confirm - Full item:', JSON.stringify(item, null, 2));
      console.log('[WMSOrderDetails] Ship Confirm - Extracted Lines_id:', linesId);

      const result = await shipConfirm(linesId);

      setApiResponseLoading(false);
      setApiResponse(result.data || { error: result.error });
      setApiResponseSuccess(result.success);

      if (result.success) {
        // Update local state to reflect shipped status
        setLines(prev =>
          prev.map(line =>
            line.delivery_detail_id === item.delivery_detail_id
              ? {
                  ...line,
                  shipped_status: 'YES',
                  shipped_date: new Date().toISOString(),
                }
              : line
          )
        );
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error ship confirm:', error);
      setApiResponseLoading(false);
      setApiResponse({ error: error.message || 'Unknown error' });
      setApiResponseSuccess(false);
    } finally {
      setShippingId(null);
    }
  };

  // Handle Undo Pick
  const handleUndoPick = async (item) => {
    Alert.alert(
      'Undo Pick',
      `Are you sure you want to undo pick for ${item.item_number}?\n\nID: ${item.delivery_detail_id}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Undo',
          style: 'destructive',
          onPress: async () => {
            setUndoingId(item.delivery_detail_id);
            try {
              // TODO: Replace with actual undo pick API call when provided
              Alert.alert('Info', 'Undo Pick API not yet configured.\n\nPlease provide the API endpoint.');
            } catch (error) {
              console.error('[WMSOrderDetails] Error undo pick:', error);
              Alert.alert('Error', 'Failed to undo pick');
            } finally {
              setUndoingId(null);
            }
          },
        },
      ]
    );
  };

  // Get picked items (picked but not shipped) for bulk ship confirm
  const getPickedItems = () => {
    return lines.filter(item => {
      const pickedQty = parseInt(item.picked_qty) || 0;
      const isShipped = item.shipped_status === 'YES';
      const hasLinesId = item.lines_id || item.Lines_id || item.LINES_ID;
      return pickedQty > 0 && !isShipped && hasLinesId;
    });
  };

  // Open bulk ship confirm modal
  const handleOpenBulkShipConfirm = () => {
    setBulkProcessingStatus({});
    setBulkFinalStatus(null);
    setBulkShipModalVisible(true);
  };

  // Process all picked items for ship confirm
  const handleBulkShipConfirm = async () => {
    const pickedItems = getPickedItems();
    if (pickedItems.length === 0) return;

    console.log('[WMSOrderDetails] Starting bulk ship confirm for', pickedItems.length, 'items');

    let allSuccess = true;

    // Process each item sequentially
    for (const item of pickedItems) {
      const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';

      // Set status to processing
      setBulkProcessingStatus(prev => ({ ...prev, [linesId]: 'processing' }));

      try {
        console.log('[WMSOrderDetails] Processing item:', linesId);
        const result = await shipConfirm(linesId);

        if (result.success) {
          // Update status to success
          setBulkProcessingStatus(prev => ({ ...prev, [linesId]: 'success' }));

          // Update local lines state
          setLines(prev =>
            prev.map(line =>
              (line.lines_id || line.Lines_id || line.LINES_ID) === linesId
                ? { ...line, shipped_status: 'YES', shipped_date: new Date().toISOString() }
                : line
            )
          );
        } else {
          // Update status to error
          allSuccess = false;
          setBulkProcessingStatus(prev => ({ ...prev, [linesId]: 'error' }));
          console.error('[WMSOrderDetails] Ship confirm failed for:', linesId, result.error);
        }
      } catch (error) {
        // Update status to error
        allSuccess = false;
        setBulkProcessingStatus(prev => ({ ...prev, [linesId]: 'error' }));
        console.error('[WMSOrderDetails] Error processing item:', linesId, error);
      }

      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('[WMSOrderDetails] Bulk ship confirm completed, allSuccess:', allSuccess);

    // After all items are ship confirmed, call processS2V API
    if (allSuccess) {
      setBulkFinalStatus('processing');
      try {
        console.log('[WMSOrderDetails] Processing S2V shipment for order:', orderNumber);
        const instanceName = user?.instance || 'PROD';
        const finalResult = await processS2VShipment(orderNumber, instanceName);

        if (finalResult.success) {
          setBulkFinalStatus('success');
          console.log('[WMSOrderDetails] S2V shipment processed successfully:', finalResult.data);
        } else {
          setBulkFinalStatus('error');
          console.error('[WMSOrderDetails] S2V shipment failed:', finalResult.error);
        }
      } catch (error) {
        setBulkFinalStatus('error');
        console.error('[WMSOrderDetails] Error processing S2V shipment:', error);
      }
    }
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
    // Pending: picked_qty = 0; Picked: picked_qty > 0 and not shipped
    pendingLines: lines.filter(l => (parseInt(l.picked_qty) || 0) === 0).length,
    pickedLines: lines.filter(l => (parseInt(l.picked_qty) || 0) > 0 && l.shipped_status !== 'YES').length,
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

      {/* Confirm Pick Modal */}
      <ConfirmPickModal
        visible={confirmPickModalVisible}
        onClose={() => {
          setConfirmPickModalVisible(false);
          setConfirmPickItem(null);
        }}
        onConfirm={executeConfirmPick}
        item={confirmPickItem}
        pickerName={pickerName}
        instance={user?.instance || 'PROD'}
        isProcessing={isConfirmingPick}
      />

      {/* API Response Modal */}
      <APIResponseModal
        visible={apiResponseModalVisible}
        onClose={() => setApiResponseModalVisible(false)}
        title={apiResponseTitle}
        response={apiResponse}
        isSuccess={apiResponseSuccess}
        isLoading={apiResponseLoading}
      />

      {/* Bulk Ship Confirm Modal */}
      <BulkShipConfirmModal
        visible={bulkShipModalVisible}
        onClose={() => setBulkShipModalVisible(false)}
        pickedItems={getPickedItems()}
        onProcess={handleBulkShipConfirm}
        finalStatus={bulkFinalStatus}
        processingStatus={bulkProcessingStatus}
      />

      {/* QR Code Print Modal */}
      <QRCodePrintModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        order={order}
        pickerName={pickerName}
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
          {/* Print QR Button */}
          <TouchableOpacity style={styles.printQRButton} onPress={() => setQrModalVisible(true)}>
            <Ionicons name="qr-code" size={18} color="#FFF" />
            <Text style={styles.printQRButtonText}>Print QR</Text>
          </TouchableOpacity>
          {/* Ship Confirm All Button */}
          {summary.pickedLines > 0 && (
            <TouchableOpacity style={styles.shipAllButton} onPress={handleOpenBulkShipConfirm}>
              <Ionicons name="airplane" size={18} color="#FFF" />
              <Text style={styles.shipAllButtonText}>Ship All</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Loading order details...</Text>
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

          {/* Filter Section */}
          <View style={styles.filterContainer}>
            <View style={styles.filterInputWrapper}>
              <Ionicons name="search" size={18} color="#666" style={styles.filterIcon} />
              <TextInput
                style={styles.filterInput}
                placeholder="Search items..."
                placeholderTextColor="#999"
                value={filterText}
                onChangeText={(text) => {
                  setFilterText(text);
                  setShowFilterDropdown(text.length > 0);
                }}
                onFocus={() => setShowFilterDropdown(filterText.length > 0)}
                onBlur={() => setTimeout(() => setShowFilterDropdown(false), 200)}
              />
              {filterText.length > 0 && (
                <TouchableOpacity onPress={() => { setFilterText(''); setShowFilterDropdown(false); }}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.filterCount}>
              {filteredLines.length}/{lines.length}
            </Text>
            {/* Autocomplete Dropdown */}
            {showFilterDropdown && getFilterSuggestions().length > 0 && (
              <View style={styles.filterDropdown}>
                {getFilterSuggestions().map((suggestion, idx) => (
                  <TouchableOpacity
                    key={`suggestion-${suggestion.id}-${idx}`}
                    style={styles.filterSuggestion}
                    onPress={() => {
                      setFilterText(suggestion.label);
                      setShowFilterDropdown(false);
                    }}
                  >
                    <Text style={styles.filterSuggestionLabel}>{suggestion.label}</Text>
                    <Text style={styles.filterSuggestionDesc} numberOfLines={1}>{suggestion.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Line Items */}
          {lines.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={60} color="#CCC" />
              <Text style={styles.emptyStateText}>No line items found</Text>
              <Text style={styles.emptyStateSubtext}>This order has no items to display</Text>
            </View>
          ) : filteredLines.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={60} color="#CCC" />
              <Text style={styles.emptyStateText}>No matching items</Text>
              <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
            </View>
          ) : (
            filteredLines.map((item, index) => (
              <LineItemCard
                key={`line-${item.delivery_detail_id || item.line_number || index}-${index}`}
                item={item}
                transactionType={order?.transaction_type}
                onConfirmPick={handleConfirmPick}
                onCancelPick={handleCancelPick}
                onShipConfirm={handleShipConfirm}
                onUndoPick={handleUndoPick}
                onSearchLots={handleSearchLots}
                isConfirming={confirmingId === item.delivery_detail_id}
                isCancelling={cancellingId === item.delivery_detail_id}
                isShipping={shippingId === item.delivery_detail_id}
                isUndoing={undoingId === item.delivery_detail_id}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Bottom Toolbar */}
      <BottomToolbar
        onHome={() => navigation.navigate('WMSHome')}
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
  // Filter Section
  filterContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  filterInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  filterIcon: {
    marginRight: 8,
  },
  filterInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
  },
  filterCount: {
    marginLeft: 10,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  filterDropdown: {
    position: 'absolute',
    top: '100%',
    left: 12,
    right: 60,
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 200,
    maxHeight: 200,
  },
  filterSuggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterSuggestionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  filterSuggestionDesc: {
    fontSize: 11,
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
  // Line Item Card - Compact
  lineItemCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  // Compact Header Row
  compactHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemInfoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  idsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemIdSmall: {
    fontSize: 10,
    color: '#888',
    fontFamily: 'monospace',
  },
  linesIdSmall: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9C27B0',
    fontFamily: 'monospace',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  statusBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  lineNumberSmall: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
  lineItemDescriptionCompact: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#1565C0',
  },
  lotLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchLotsButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  searchLotsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1565C0',
    marginLeft: 3,
  },
  lineNumber: {
    fontSize: 11,
    color: '#999',
  },
  idLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'monospace',
  },
  linesId: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9C27B0',
    fontFamily: 'monospace',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  // Barcode Row
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  barcodeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  discPerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
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
    marginLeft: 6,
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
    marginLeft: 6,
  },
  shipConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    borderRadius: 8,
    paddingVertical: 12,
  },
  shipConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
  },
  undoPickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 12,
  },
  undoPickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
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
  // Confirm Pick Modal Styles
  apiEndpointInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  apiMethodBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  apiMethodText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  apiEndpointText: {
    flex: 1,
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  jsonPreviewContainer: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  jsonPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  jsonScrollView: {
    maxHeight: 150,
  },
  jsonCodeBlock: {
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
  },
  jsonCodeText: {
    fontSize: 11,
    color: '#D4D4D4',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  fieldDetailsScroll: {
    maxHeight: 180,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldDetailsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fieldLabel: {
    width: 120,
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
  },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    color: '#333',
  },
  confirmModalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  confirmModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  confirmModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  confirmModalConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmModalConfirmBtnDisabled: {
    backgroundColor: '#A5D6A7',
  },
  confirmModalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // API Response Modal Styles - Centered
  apiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  apiModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  apiStatusBanner: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  apiStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  apiResponseScroll: {
    padding: 16,
    maxHeight: 300,
  },
  apiModalCloseButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  // Ship All Button in Header
  shipAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    marginLeft: 8,
  },
  shipAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  // Print QR Button in Header
  printQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  printQRButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  // Bulk Ship Confirm Modal Styles
  bulkSummaryBanner: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  bulkSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  bulkSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  bulkSummaryLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  finalStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  finalStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkListHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 2,
    borderBottomColor: '#1565C0',
  },
  bulkListHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1565C0',
    textTransform: 'uppercase',
  },
  bulkItemsScroll: {
    flex: 1,
    minHeight: 150,
    maxHeight: 250,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bulkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  bulkLineNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565C0',
  },
  bulkItemInfo: {
    flex: 1,
  },
  bulkItemNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  bulkItemDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  bulkQtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
  },
  bulkItemIds: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  bulkItemStatus: {
    alignItems: 'flex-end',
  },
  bulkStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  bulkStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bulkActionButtons: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  bulkCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  bulkCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  bulkConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#9C27B0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bulkDoneButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bulkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  noItemsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noItemsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  noItemsSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  // QR Code Modal Styles - Compact
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  qrModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    padding: 16,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  qrCodeSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  qrLabelsSimple: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  qrLabelLine: {
    fontSize: 13,
    color: '#333',
    marginVertical: 3,
  },
  qrLabelKey: {
    fontWeight: '700',
    color: '#1565C0',
  },
  qrCloseButton: {
    marginTop: 12,
    backgroundColor: '#1565C0',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  qrCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default WMSOrderDetailsScreen;
