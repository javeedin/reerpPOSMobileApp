import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Animated,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { fetchShipmentLines, confirmPick, confirmPickPending, fusionPickTransaction, updatePickConfirmStatus, shipConfirm, processS2VShipment, fetchItemOnhand, fetchItemLots, getShipmentNumber, fusionShipConfirmTransaction, updateShipConfirmationStatus, cancelOrderLine, getCancelOrderLineUrl, updateCancelStatus, updatePickedQty, cancelS2VLot, getInventoryStagedTransactions, deleteInventoryStagedTransaction, fetchFusionShipmentLines } from '../services/wmsService';
import { getInstance, getFusionBaseUrl } from '../services/api';
import { getAllBogo } from '../services/syncService';
import printerService from '../services/printerService';
import { sendPickNotification, sendShipNotification } from '../services/notificationService';

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

// Helper to get consistent item ID for comparisons
const getItemId = (item) => {
  if (!item) return '';
  return String(item.id || item.source_delivery_detail_id || item.delivery_detail_id || '');
};

// Helper: calculate days to expiry from a date
const getDaysToExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry - today;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

// Helper: get expiry badge color
const getExpiryColor = (days) => {
  if (days === null) return '#999';
  if (days < 0) return '#D32F2F';
  if (days < 30) return '#F44336';
  if (days < 90) return '#FF9800';
  return '#4CAF50';
};

// Confirm Pick Modal Component - Enhanced with Lot Based / Non Lot toggle
const ConfirmPickModal = ({ visible, onClose, onConfirm, onLotBasedConfirm, onShipConfirm, item, order, pickerName, instance, isProcessing, transactionType, bogoSetItems }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isLotBased, setIsLotBased] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [step1Completed, setStep1Completed] = useState(false);
  const [step2Completed, setStep2Completed] = useState(false);
  const [isRunningSequence, setIsRunningSequence] = useState(false);
  const [sequenceError, setSequenceError] = useState(null);
  const [allCompleted, setAllCompleted] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);
  const [retryStep, setRetryStep] = useState(0);

  // BOGO set state
  const [checkedBogoIds, setCheckedBogoIds] = useState(new Set());
  const [bogoResults, setBogoResults] = useState([]); // [{itemId, label, status, error}]

  useEffect(() => {
    if (bogoSetItems && bogoSetItems.length > 0) {
      setCheckedBogoIds(new Set(bogoSetItems.map(i => getItemId(i))));
    }
  }, [bogoSetItems]);

  if (!item) return null;

  const isStoreTransaction = (transactionType || '').toLowerCase().includes('store');

  // Build item data
  const rawId = item.id || item.source_delivery_detail_id || item.delivery_detail_id || '';
  const deliveryDetailId = item.delivery_detail_id || item.DELIVERY_DETAIL_ID || rawId;
  const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';
  const accountCode = item.account_code || item.ACCOUNT_CODE || order?.account_code || order?.ACCOUNT_CODE || '';
  const lotNumber = item.lot_number || '';
  const lotExpiryDate = item.lot_expiry_date || '';
  const daysToExpiry = getDaysToExpiry(lotExpiryDate);
  const expiryColor = getExpiryColor(daysToExpiry);
  const pickedQty = item.qty || '0';

  // Get Fusion URL for display (Sales Orders only)
  const instanceUpper = (instance || 'TEST').toUpperCase();
  const fusionHost = instanceUpper === 'PROD'
    ? 'https://efmh.fa.em3.oraclecloud.com'
    : 'https://efmh-test.fa.em3.oraclecloud.com';
  const fusionUrl = `${fusionHost}/fscmRestApi/resources/11.13.18.05/pickTransactions`;
  const apexUrl = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT/trip/updatepickconfirmstatus';

  // Store Transaction URLs
  const apexPickUrl = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/WAREHOUSEMANAGEMENT/PENDING_PICKING_DETAILS';
  const apexShipUrl = `https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/WAREHOUSEMANAGEMENT/trip/processs2vauto/${linesId}`;

  // Lot Based payload (Fusion) - Sales Orders only
  const lotPayload = {
    pickLines: [{
      PickSlip: String(deliveryDetailId),
      PickSlipLine: String(linesId),
      PickedQuantity: String(pickedQty),
      SubinventoryCode: 'DUTY PAID',
      lotItemLots: [{
        Lot: String(lotNumber),
        Quantity: String(pickedQty),
      }],
    }],
  };

  // Lot Based Step 2 payload (Apex)
  const updatePayload = {
    P_TRANSACTION_ID: rawId,
    p_instance_name: instanceUpper,
    p_pickedQty: parseInt(pickedQty) || 0,
  };

  // Non-Lot payload (used by both Store and Sales non-lot)
  const nonLotPayload = {
    id: String(rawId),
    line_number: String(item.line_number || '1'),
    lot: lotNumber,
    pickedQty: String(pickedQty),
    pickedBy: pickerName || '',
    pickConfirmDate: formatDateTimeForAPI(new Date()),
    pickConfirmStatus: 'YES',
    instance: instance || 'TEST',
    account_code: accountCode,
  };

  const lotJsonString = JSON.stringify(lotPayload, null, 2);
  const updateJsonString = JSON.stringify(updatePayload, null, 2);
  const nonLotJsonString = JSON.stringify(nonLotPayload, null, 2);

  // For Store: always Non-Lot. For Sales: user can toggle.
  const effectiveIsLotBased = isStoreTransaction ? false : isLotBased;

  // Modal title based on order type
  const getModalTitle = () => {
    if (isStoreTransaction) return 'Pick & Ship Confirm (S2V)';
    if (effectiveIsLotBased) return 'Confirm Pick - Lot Based (ORD)';
    return 'Confirm Pick (ORD)';
  };

  // Lot Based confirm (Sales only): Step 1 = Fusion pickTransactions, Step 2 = Apex updatePickConfirmStatus
  const handleLotBasedConfirm = async () => {
    setIsRunningSequence(true);
    setSequenceError(null);
    setAllCompleted(false);
    setStep1Completed(false);
    setStep2Completed(false);

    try {
      // Step 1: Fusion Pick Transaction
      setCurrentStep(1);
      const fusionResult = await onLotBasedConfirm({
        deliveryDetailId: deliveryDetailId,
        linesId: linesId,
        pickedQty: parseInt(pickedQty) || 0,
        subinventoryCode: 'DUTY PAID',
        lot: lotNumber,
        lotQty: parseInt(pickedQty) || 0,
      });

      if (fusionResult && fusionResult.success) {
        setStep1Completed(true);

        // Step 2: Apex Update Pick Confirm Status
        setCurrentStep(2);
        const updateResult = await fusionResult.updatePickStatus({
          transactionId: rawId,
          pickedQty: parseInt(pickedQty) || 0,
        });

        if (updateResult && updateResult.success) {
          setStep2Completed(true);
          setAllCompleted(true);
        } else {
          setSequenceError(updateResult?.error || 'Update pick confirm status failed');
        }
      } else {
        setSequenceError(fusionResult?.error || 'Fusion pick transaction failed');
      }
    } catch (error) {
      setSequenceError(error.message || 'Unknown error');
    } finally {
      setIsRunningSequence(false);
    }
  };

  // Store (S2V) confirm: Step 1 = updatePickedQty, Step 2 = Ship Confirm (processs2vauto/:P_LID)
  const handleStoreConfirm = async () => {
    setIsRunningSequence(true);
    setSequenceError(null);
    setAllCompleted(false);
    setStep1Completed(false);
    setStep2Completed(false);

    try {
      if (!linesId) {
        setSequenceError('No Lines ID (P_LID) available');
        return;
      }

      // Step 1: Update Picked Qty
      setCurrentStep(1);
      const updateResult = await updatePickedQty(linesId, instanceUpper, parseInt(pickedQty) || 0);
      if (!updateResult || !updateResult.success) {
        setSequenceError(updateResult?.error || 'Update picked qty failed');
        return;
      }
      setStep1Completed(true);

      // Step 2: Ship Confirm (processs2vauto)
      setCurrentStep(2);
      const shipResult = await onShipConfirm(item, linesId, true);
      if (shipResult && shipResult.success) {
        setStep2Completed(true);
        setAllCompleted(true);
      } else {
        setSequenceError(shipResult?.error || 'Ship confirm failed');
      }
    } catch (error) {
      setSequenceError(error.message || 'Unknown error');
    } finally {
      setIsRunningSequence(false);
    }
  };

  // Store Orders retry: cleanup Fusion staged transactions then re-run ship confirm
  const handleRetryStep2 = async () => {
    setIsRetrying(true);
    setRetryError(null);
    setRetryStep(1);

    try {
      // Step A: Fetch staged transactions from Fusion
      const stagedResult = await getInventoryStagedTransactions(instanceUpper);
      if (!stagedResult.success) {
        setRetryError(stagedResult.error || 'Failed to fetch staged transactions');
        return;
      }

      const transactions = stagedResult.data?.items || [];
      console.log('[Retry] Staged transactions to delete:', transactions.length);

      // Step B: Delete each staged transaction
      setRetryStep(2);
      for (const txn of transactions) {
        const deleteResult = await deleteInventoryStagedTransaction(txn.TransactionInterfaceId, instanceUpper);
        if (!deleteResult.success) {
          setRetryError(deleteResult.error || `Failed to delete transaction ${txn.TransactionInterfaceId}`);
          return;
        }
      }

      // Step C: Retry ship confirm (processs2vauto)
      setRetryStep(3);
      const shipResult = await onShipConfirm(item, linesId, true);
      if (shipResult && shipResult.success) {
        setStep2Completed(true);
        setAllCompleted(true);
        setSequenceError(null);
        setRetryError(null);
      } else {
        setRetryError(shipResult?.error || 'Ship confirm still failing');
      }
    } catch (error) {
      setRetryError(error.message || 'Unknown retry error');
    } finally {
      setIsRetrying(false);
      setRetryStep(0);
    }
  };

  // Non-Lot confirm (Sales only): Just run Pick Confirm
  const handleNonLotConfirm = async () => {
    await onConfirm(nonLotPayload);
  };

  // Build payloads for any item (used by BOGO multi-confirm)
  const buildPayloadsForItem = (anItem) => {
    const aRawId = anItem.id || anItem.source_delivery_detail_id || anItem.delivery_detail_id || '';
    const aDeliveryDetailId = anItem.delivery_detail_id || anItem.DELIVERY_DETAIL_ID || aRawId;
    const aLinesId = anItem.lines_id || anItem.Lines_id || anItem.LINES_ID || '';
    const aAccountCode = anItem.account_code || anItem.ACCOUNT_CODE || order?.account_code || order?.ACCOUNT_CODE || '';
    const aLotNumber = anItem.lot_number || '';
    const aPickedQty = anItem.qty || '0';
    return {
      rawId: aRawId,
      deliveryDetailId: aDeliveryDetailId,
      linesId: aLinesId,
      lotNumber: aLotNumber,
      pickedQty: aPickedQty,
      fusionPayload: {
        deliveryDetailId: aDeliveryDetailId,
        linesId: aLinesId,
        pickedQty: parseInt(aPickedQty) || 0,
        subinventoryCode: 'DUTY PAID',
        lot: aLotNumber,
        lotQty: parseInt(aPickedQty) || 0,
      },
      nonLotPayload: {
        id: String(aRawId),
        line_number: String(anItem.line_number || '1'),
        lot: aLotNumber,
        pickedQty: String(aPickedQty),
        pickedBy: pickerName || '',
        pickConfirmDate: formatDateTimeForAPI(new Date()),
        pickConfirmStatus: 'YES',
        instance: instance || 'TEST',
        account_code: aAccountCode,
      },
      updatePayload: {
        P_TRANSACTION_ID: aRawId,
        p_instance_name: instanceUpper,
        p_pickedQty: parseInt(aPickedQty) || 0,
      },
    };
  };

  // BOGO multi-item confirm: process each checked item sequentially
  const handleConfirmAll = async () => {
    const toProcess = (bogoSetItems || []).filter(i => checkedBogoIds.has(getItemId(i)));
    if (toProcess.length === 0) return;

    setIsRunningSequence(true);
    setSequenceError(null);
    setAllCompleted(false);
    setBogoResults(toProcess.map(i => ({ itemId: getItemId(i), label: i.item_number, desc: i.description, status: 'pending' })));

    let anyError = false;

    for (const anItem of toProcess) {
      const id = getItemId(anItem);
      setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'processing' } : r));
      const p = buildPayloadsForItem(anItem);

      try {
        if (isStoreTransaction) {
          const updateResult = await updatePickedQty(p.linesId, instanceUpper, parseInt(p.pickedQty) || 0);
          if (!updateResult?.success) {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'error', error: updateResult?.error || 'Update qty failed' } : r));
            anyError = true;
            continue;
          }
          const shipResult = await onShipConfirm(anItem, p.linesId, true);
          if (shipResult?.success) {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'success' } : r));
          } else {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'error', error: shipResult?.error || 'Ship confirm failed' } : r));
            anyError = true;
          }
        } else if (effectiveIsLotBased) {
          const fusionResult = await onLotBasedConfirm(p.fusionPayload, anItem);
          if (!fusionResult?.success) {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'error', error: fusionResult?.error || 'Fusion pick failed' } : r));
            anyError = true;
            continue;
          }
          const updateResult = await fusionResult.updatePickStatus({ transactionId: p.rawId, pickedQty: parseInt(p.pickedQty) || 0 });
          if (updateResult?.success) {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'success' } : r));
          } else {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'error', error: updateResult?.error || 'Update status failed' } : r));
            anyError = true;
          }
        } else {
          const result = await onConfirm(p.nonLotPayload, true, anItem);
          if (result?.success) {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'success' } : r));
          } else {
            setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'error', error: result?.error || 'Confirm failed' } : r));
            anyError = true;
          }
        }
      } catch (err) {
        setBogoResults(prev => prev.map(r => r.itemId === id ? { ...r, status: 'error', error: err.message } : r));
        anyError = true;
      }
    }

    setIsRunningSequence(false);
    if (!anyError) setAllCompleted(true);
    else setSequenceError('One or more items failed. Check results above.');
  };

  const handleConfirm = () => {
    if (bogoSetItems && bogoSetItems.length > 0) {
      handleConfirmAll();
    } else if (isStoreTransaction) {
      handleStoreConfirm();
    } else if (effectiveIsLotBased) {
      handleLotBasedConfirm();
    } else {
      handleNonLotConfirm();
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setStep1Completed(false);
    setStep2Completed(false);
    setIsRunningSequence(false);
    setSequenceError(null);
    setAllCompleted(false);
    setShowDetails(false);
    setBogoResults([]);
    if (bogoSetItems) setCheckedBogoIds(new Set(bogoSetItems.map(i => getItemId(i))));
    onClose();
  };

  // Render status row for each step
  const renderStatusRow = (stepNumber, label, sublabel, isCompleted, isCurrentlyProcessing) => (
    <View style={styles.sequenceStatusRow}>
      <View style={[
        styles.sequenceStatusCircle,
        isCompleted && styles.sequenceStatusCircleCompleted,
        isCurrentlyProcessing && styles.sequenceStatusCircleProcessing,
      ]}>
        {isCompleted ? (
          <Ionicons name="checkmark" size={20} color="#FFF" />
        ) : isCurrentlyProcessing ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.sequenceStatusNumber}>{stepNumber}</Text>
        )}
      </View>
      <View style={styles.sequenceStatusTextContainer}>
        <Text style={[
          styles.sequenceStatusLabel,
          isCompleted && styles.sequenceStatusLabelCompleted,
          isCurrentlyProcessing && styles.sequenceStatusLabelProcessing,
        ]}>
          {label}
        </Text>
        {sublabel && !isCompleted && !isCurrentlyProcessing && (
          <Text style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{sublabel}</Text>
        )}
        {isCompleted && <Text style={styles.sequenceStatusSuccess}>Completed</Text>}
        {isCurrentlyProcessing && <Text style={styles.sequenceStatusProcessing}>Processing...</Text>}
      </View>
    </View>
  );

  // Step labels based on order type
  const getStep1Label = () => {
    if (isStoreTransaction) return 'Update Picked Qty (S2V)';
    return effectiveIsLotBased ? 'Fusion Pick Transaction (ORD)' : 'Pick Confirm (ORD)';
  };
  const getStep1Sub = () => {
    if (isStoreTransaction) return 'POST /updatepickedqty';
    return effectiveIsLotBased ? 'POST /pickTransactions' : 'POST /PENDING_PICKING_DETAILS';
  };
  const getStep2Label = () => {
    if (isStoreTransaction) return 'Ship Confirm (S2V)';
    return effectiveIsLotBased ? 'Update Pick Confirm Status (ORD)' : '';
  };
  const getStep2Sub = () => {
    if (isStoreTransaction) return `POST /trip/processs2vauto/${linesId}`;
    return effectiveIsLotBased ? 'POST /trip/updatepickconfirmstatus' : '';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.cpModalOverlay}>
        <View style={styles.cpModalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#1565C0" />
              <Text style={styles.modalTitle}>{getModalTitle()}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn} disabled={isRunningSequence}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {/* Order Type Badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
              <View style={{
                backgroundColor: isStoreTransaction ? '#E3F2FD' : '#FFF3E0',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
                <Ionicons
                  name={isStoreTransaction ? 'swap-horizontal' : 'cart'}
                  size={14}
                  color={isStoreTransaction ? '#1565C0' : '#E65100'}
                />
                <Text style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: isStoreTransaction ? '#1565C0' : '#E65100',
                }}>
                  {isStoreTransaction ? 'S2V' : 'ORD'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#555', flex: 1 }}>
                {transactionType || 'Unknown'}
              </Text>
            </View>

            {/* BOGO Set: checkbox selection for each item */}
            {bogoSetItems && bogoSetItems.length > 0 && (
              <View style={styles.bogoPickSection}>
                <View style={styles.bogoPickHeader}>
                  <Ionicons name="gift-outline" size={14} color="#E65100" />
                  <Text style={styles.bogoPickHeaderText}>BOGO SET — select items to confirm</Text>
                </View>
                {bogoSetItems.map((bItem) => {
                  const bid = getItemId(bItem);
                  const isChecked = checkedBogoIds.has(bid);
                  const result = bogoResults.find(r => r.itemId === bid);
                  return (
                    <TouchableOpacity
                      key={bid}
                      style={[styles.bogoPickRow, isChecked && styles.bogoPickRowChecked]}
                      onPress={() => {
                        if (isRunningSequence) return;
                        setCheckedBogoIds(prev => {
                          const next = new Set(prev);
                          if (next.has(bid)) next.delete(bid); else next.add(bid);
                          return next;
                        });
                      }}
                      disabled={isRunningSequence}
                    >
                      <View style={[styles.bogoCheckbox, isChecked && styles.bogoCheckboxChecked]}>
                        {isChecked && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bogoPickItemCode}>{bItem.item_number}</Text>
                        <Text style={styles.bogoPickItemDesc} numberOfLines={1}>{bItem.description}</Text>
                        <Text style={styles.bogoPickItemQty}>Qty: {bItem.qty} {bItem.lot_number ? `| Lot: ${bItem.lot_number}` : ''}</Text>
                      </View>
                      {result && (
                        <Ionicons
                          name={result.status === 'success' ? 'checkmark-circle' : result.status === 'error' ? 'close-circle' : result.status === 'processing' ? 'hourglass-outline' : 'ellipse-outline'}
                          size={20}
                          color={result.status === 'success' ? '#4CAF50' : result.status === 'error' ? '#F44336' : result.status === 'processing' ? '#FF9800' : '#CCC'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {bogoResults.some(r => r.status === 'error') && (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                    {bogoResults.filter(r => r.status === 'error').map(r => (
                      <Text key={r.itemId} style={{ fontSize: 11, color: '#F44336' }}>{r.label}: {r.error}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Item Info */}
            <View style={styles.modalItemInfo}>
              <Text style={styles.modalItemNumber}>{item.item_number || 'N/A'}</Text>
              <Text style={styles.modalItemDesc} numberOfLines={2}>{item.description || 'No Description'}</Text>
              {(order?.account_name || order?.ACCOUNT_NAME || order?.customer_name) ? (
                <View style={styles.modalAccountRow}>
                  <Ionicons name="business-outline" size={13} color="#1565C0" />
                  <Text style={styles.modalAccountText}>
                    {order.account_code || order.ACCOUNT_CODE || ''}{(order.account_code || order.ACCOUNT_CODE) ? ' — ' : ''}
                    {order.account_name || order.ACCOUNT_NAME || order.customer_name}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Toggle: Lot Based / Non Lot Based - Only for Sales Orders (ORD) */}
            {isStoreTransaction ? (
              <View style={[styles.cpToggleContainer, { opacity: 0.6 }]}>
                <View style={[styles.cpToggleBtn, { backgroundColor: '#E0E0E0' }]}>
                  <Ionicons name="layers" size={16} color="#999" />
                  <Text style={[styles.cpToggleBtnText, { color: '#999' }]}>Lot Based</Text>
                </View>
                <View style={[styles.cpToggleBtn, styles.cpToggleBtnActive]}>
                  <Ionicons name="cube" size={16} color="#FFF" />
                  <Text style={[styles.cpToggleBtnText, styles.cpToggleBtnTextActive]}>Non Lot Based</Text>
                </View>
              </View>
            ) : (
              <View style={styles.cpToggleContainer}>
                <TouchableOpacity
                  style={[styles.cpToggleBtn, isLotBased && styles.cpToggleBtnActive]}
                  onPress={() => !isRunningSequence && !allCompleted && setIsLotBased(true)}
                  disabled={isRunningSequence || allCompleted}
                >
                  <Ionicons name="layers" size={16} color={isLotBased ? '#FFF' : '#666'} />
                  <Text style={[styles.cpToggleBtnText, isLotBased && styles.cpToggleBtnTextActive]}>Lot Based</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cpToggleBtn, !isLotBased && styles.cpToggleBtnActive]}
                  onPress={() => !isRunningSequence && !allCompleted && setIsLotBased(false)}
                  disabled={isRunningSequence || allCompleted}
                >
                  <Ionicons name="cube" size={16} color={!isLotBased ? '#FFF' : '#666'} />
                  <Text style={[styles.cpToggleBtnText, !isLotBased && styles.cpToggleBtnTextActive]}>Non Lot Based</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Qty, Lot, Expiry Info */}
            <View style={styles.cpInfoSection}>
              <View style={styles.cpInfoRow}>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Quantity</Text>
                  <Text style={styles.cpInfoValue}>{pickedQty}</Text>
                </View>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Lot Number</Text>
                  <Text style={[styles.cpInfoValue, !lotNumber && { color: '#999' }]}>{lotNumber || 'N/A'}</Text>
                </View>
              </View>
              <View style={styles.cpInfoRow}>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Lot Expiry</Text>
                  <Text style={styles.cpInfoValue}>
                    {lotExpiryDate ? new Date(lotExpiryDate).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Days to Expiry</Text>
                  {daysToExpiry !== null ? (
                    <View style={[styles.cpExpiryBadge, { backgroundColor: expiryColor + '20' }]}>
                      <Ionicons
                        name={daysToExpiry < 30 ? 'warning' : 'time-outline'}
                        size={14}
                        color={expiryColor}
                      />
                      <Text style={[styles.cpExpiryText, { color: expiryColor }]}>
                        {daysToExpiry < 0 ? `Expired (${Math.abs(daysToExpiry)}d ago)` : `${daysToExpiry} days`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.cpInfoValue, { color: '#999' }]}>N/A</Text>
                  )}
                </View>
              </View>
              {/* Instance Badge */}
              <View style={styles.cpInfoRow}>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Instance</Text>
                  <View style={[styles.cpInstanceBadge, { backgroundColor: instanceUpper === 'PROD' ? '#E8F5E9' : '#FFF3E0' }]}>
                    <Text style={[styles.cpInstanceText, { color: instanceUpper === 'PROD' ? '#2E7D32' : '#E65100' }]}>
                      {instanceUpper}
                    </Text>
                  </View>
                </View>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Picker</Text>
                  <Text style={styles.cpInfoValue}>{pickerName || 'Unknown'}</Text>
                </View>
              </View>
            </View>

            {/* Processing Status View */}
            {(isRunningSequence || step1Completed || step2Completed || sequenceError || isRetrying || bogoResults.length > 0) ? (
              <View style={styles.sequenceStatusContainer}>
                {/* BOGO multi-item results (shown instead of step rows when BOGO mode) */}
                {bogoResults.length > 0 && bogoResults.map((r) => (
                  <View key={r.itemId} style={styles.sequenceStatusRow}>
                    <View style={[
                      styles.sequenceStatusCircle,
                      r.status === 'success' && styles.sequenceStatusCircleCompleted,
                      r.status === 'processing' && styles.sequenceStatusCircleProcessing,
                      r.status === 'error' && { backgroundColor: '#F44336' },
                    ]}>
                      {r.status === 'success' ? <Ionicons name="checkmark" size={20} color="#FFF" /> :
                       r.status === 'processing' ? <ActivityIndicator size="small" color="#FFF" /> :
                       r.status === 'error' ? <Ionicons name="close" size={18} color="#FFF" /> :
                       <Text style={styles.sequenceStatusNumber}>•</Text>}
                    </View>
                    <View style={styles.sequenceStatusTextContainer}>
                      <Text style={[styles.sequenceStatusLabel, r.status === 'success' && styles.sequenceStatusLabelCompleted, r.status === 'processing' && styles.sequenceStatusLabelProcessing]}>
                        {r.label}
                      </Text>
                      {r.status === 'success' && <Text style={styles.sequenceStatusSuccess}>Picked ✓</Text>}
                      {r.status === 'processing' && <Text style={styles.sequenceStatusProcessing}>Processing...</Text>}
                      {r.status === 'error' && <Text style={{ fontSize: 11, color: '#F44336' }}>{r.error}</Text>}
                    </View>
                  </View>
                ))}

                {/* Single-item step rows (hidden in BOGO mode) */}
                {bogoResults.length === 0 && renderStatusRow(
                  1,
                  getStep1Label(),
                  getStep1Sub(),
                  step1Completed,
                  currentStep === 1 && !step1Completed && isRunningSequence
                )}

                {/* Step 2 (single-item only) */}
                {bogoResults.length === 0 && getStep2Label() ? (
                  <>
                    <View style={[styles.sequenceStatusLine, step1Completed && styles.sequenceStatusLineCompleted]} />
                    {renderStatusRow(
                      2,
                      getStep2Label(),
                      getStep2Sub(),
                      step2Completed,
                      currentStep === 2 && !step2Completed && isRunningSequence
                    )}
                  </>
                ) : null}

                {/* Error */}
                {sequenceError && (
                  <View style={styles.sequenceErrorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#F44336" />
                    <Text style={styles.sequenceErrorText}>{sequenceError}</Text>
                  </View>
                )}

                {/* Retry status rows (Store Orders only) */}
                {isStoreTransaction && isRetrying && (
                  <View style={[styles.sequenceStatusContainer, { marginTop: 8, backgroundColor: '#FFF8E1', borderRadius: 8, padding: 8 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF9800', marginBottom: 4 }}>Retry in progress...</Text>
                    {renderStatusRow('A', 'Fetch Staged Transactions', 'GET /inventoryStagedTransactions', retryStep > 1, retryStep === 1)}
                    {renderStatusRow('B', 'Delete Staged Transactions', 'DELETE /inventoryStagedTransactions/{id}', retryStep > 2, retryStep === 2)}
                    {renderStatusRow('C', 'Retry Ship Confirm', `POST /trip/processs2vauto/${linesId}`, false, retryStep === 3)}
                  </View>
                )}

                {/* Retry error */}
                {retryError && !isRetrying && (
                  <View style={[styles.sequenceErrorContainer, { backgroundColor: '#FFF3E0', marginTop: 8 }]}>
                    <Ionicons name="refresh-circle" size={20} color="#E65100" />
                    <Text style={[styles.sequenceErrorText, { color: '#E65100' }]}>Retry failed: {retryError}</Text>
                  </View>
                )}

                {/* Success */}
                {allCompleted && (
                  <View style={styles.sequenceSuccessContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    <Text style={styles.sequenceSuccessText}>
                      {isStoreTransaction ? 'Pick & Ship confirmed (S2V)!' : effectiveIsLotBased ? 'Lot-based pick confirmed (ORD)!' : 'Pick confirmed (ORD)!'}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* API Details Toggle */}
                <TouchableOpacity
                  style={styles.detailsToggleBtn}
                  onPress={() => setShowDetails(!showDetails)}
                >
                  <View style={styles.detailsToggleLeft}>
                    <Ionicons name="code-slash" size={16} color="#666" />
                    <Text style={styles.detailsToggleText}>API Details</Text>
                  </View>
                  <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                </TouchableOpacity>

                {showDetails && (
                  <ScrollView style={styles.technicalDetailsScroll} nestedScrollEnabled>
                    <View style={styles.technicalDetailsContainer}>
                      {isStoreTransaction ? (
                        <>
                          {/* Store (S2V): Step 1 - Update Picked Qty */}
                          <View style={styles.cpApiStepHeader}>
                            <Text style={styles.cpApiStepTitle}>Step 1: Update Picked Qty (S2V)</Text>
                          </View>
                          <View style={styles.apiEndpointInfo}>
                            <View style={[styles.apiMethodBadge, { backgroundColor: '#1565C0' }]}>
                              <Text style={styles.apiMethodText}>POST</Text>
                            </View>
                            <Text style={styles.apiEndpointText} numberOfLines={3}>
                              /WAREHOUSEMANAGEMENT/updatepickedqty
                            </Text>
                          </View>
                          <View style={styles.jsonPreviewContainer}>
                            <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
                            <View style={styles.jsonCodeBlock}>
                              <Text style={styles.jsonCodeText}>{JSON.stringify({ p_lid: linesId, p_instance_name: instanceUpper, p_pickedQty: parseInt(pickedQty) || 0 }, null, 2)}</Text>
                            </View>
                          </View>

                          {/* Store (S2V): Step 2 - Ship Confirm */}
                          <View style={[styles.cpApiStepHeader, { marginTop: 12 }]}>
                            <Text style={styles.cpApiStepTitle}>Step 2: Ship Confirm (S2V)</Text>
                          </View>
                          <View style={styles.apiEndpointInfo}>
                            <View style={[styles.apiMethodBadge, { backgroundColor: '#1565C0' }]}>
                              <Text style={styles.apiMethodText}>POST</Text>
                            </View>
                            <Text style={styles.apiEndpointText} numberOfLines={3}>{apexShipUrl}</Text>
                          </View>
                          <View style={styles.jsonPreviewContainer}>
                            <Text style={styles.jsonPreviewTitle}>No request body - P_LID in URL path</Text>
                          </View>

                          {/* Field mapping */}
                          <Text style={[styles.fieldDetailsTitle, { marginTop: 8 }]}>Field Mapping:</Text>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>p_lid (lines_id):</Text>
                            <Text style={styles.fieldValue}>{linesId || '(empty)'}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>p_instance_name:</Text>
                            <Text style={styles.fieldValue}>{instanceUpper}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>p_pickedQty:</Text>
                            <Text style={styles.fieldValue}>{pickedQty}</Text>
                          </View>
                        </>
                      ) : effectiveIsLotBased ? (
                        <>
                          {/* Sales (ORD) Lot Based: Step 1 - Fusion */}
                          <View style={styles.cpApiStepHeader}>
                            <Text style={styles.cpApiStepTitle}>Step 1: Fusion Pick Transaction (ORD)</Text>
                          </View>
                          <View style={styles.apiEndpointInfo}>
                            <View style={styles.apiMethodBadge}>
                              <Text style={styles.apiMethodText}>POST</Text>
                            </View>
                            <Text style={styles.apiEndpointText} numberOfLines={3}>{fusionUrl}</Text>
                          </View>
                          <View style={styles.jsonPreviewContainer}>
                            <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
                            <View style={styles.jsonCodeBlock}>
                              <Text style={styles.jsonCodeText}>{lotJsonString}</Text>
                            </View>
                          </View>

                          {/* Sales (ORD) Lot Based: Step 2 - Apex */}
                          <View style={[styles.cpApiStepHeader, { marginTop: 12 }]}>
                            <Text style={styles.cpApiStepTitle}>Step 2: Update Pick Confirm Status (ORD)</Text>
                          </View>
                          <View style={styles.apiEndpointInfo}>
                            <View style={[styles.apiMethodBadge, { backgroundColor: '#FF9800' }]}>
                              <Text style={styles.apiMethodText}>POST</Text>
                            </View>
                            <Text style={styles.apiEndpointText} numberOfLines={3}>{apexUrl}</Text>
                          </View>
                          <View style={styles.jsonPreviewContainer}>
                            <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
                            <View style={styles.jsonCodeBlock}>
                              <Text style={styles.jsonCodeText}>{updateJsonString}</Text>
                            </View>
                          </View>

                          {/* Field mapping */}
                          <Text style={[styles.fieldDetailsTitle, { marginTop: 8 }]}>Field Mapping:</Text>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>PickSlip:</Text>
                            <Text style={styles.fieldValue}>{deliveryDetailId} (DELIVERY_DETAIL_ID)</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>PickSlipLine:</Text>
                            <Text style={styles.fieldValue}>{linesId} (LINES_ID)</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Lot:</Text>
                            <Text style={styles.fieldValue}>{lotNumber || '(empty)'}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>P_TRANSACTION_ID:</Text>
                            <Text style={styles.fieldValue}>{String(rawId)} (ID)</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          {/* Sales (ORD) Non-Lot: Pick Confirm only */}
                          <View style={styles.cpApiStepHeader}>
                            <Text style={styles.cpApiStepTitle}>Pick Confirm (ORD)</Text>
                          </View>
                          <View style={styles.apiEndpointInfo}>
                            <View style={styles.apiMethodBadge}>
                              <Text style={styles.apiMethodText}>POST</Text>
                            </View>
                            <Text style={styles.apiEndpointText} numberOfLines={2}>
                              /WAREHOUSEMANAGEMENT/PENDING_PICKING_DETAILS
                            </Text>
                          </View>
                          <View style={styles.jsonPreviewContainer}>
                            <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
                            <View style={styles.jsonCodeBlock}>
                              <Text style={styles.jsonCodeText}>{nonLotJsonString}</Text>
                            </View>
                          </View>

                          <Text style={styles.fieldDetailsTitle}>Field Mapping:</Text>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>id:</Text>
                            <Text style={styles.fieldValue}>{String(rawId) || '(empty)'}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>line_number:</Text>
                            <Text style={styles.fieldValue}>{item.line_number || '1'}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>lot:</Text>
                            <Text style={styles.fieldValue}>{lotNumber || '(empty)'}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>pickedQty:</Text>
                            <Text style={styles.fieldValue}>{pickedQty}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>pickedBy:</Text>
                            <Text style={styles.fieldValue}>{pickerName || '(empty)'}</Text>
                          </View>
                          <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>instance:</Text>
                            <Text style={styles.fieldValue}>{instanceUpper}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          {(allCompleted || sequenceError) && !isRunningSequence && !isRetrying ? (
            <View style={styles.confirmModalActions}>
              {/* Retry button: only for Store Orders when step 1 passed but step 2 failed */}
              {isStoreTransaction && step1Completed && !step2Completed && sequenceError && (
                <TouchableOpacity
                  style={[styles.confirmModalConfirmBtn, { backgroundColor: isRetrying ? '#999' : '#FF9800', flex: 1, marginRight: 8 }]}
                  onPress={handleRetryStep2}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.confirmModalConfirmText}>
                        {retryStep === 1 ? 'Fetching...' : retryStep === 2 ? 'Cleaning...' : 'Retrying...'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="refresh" size={20} color="#FFF" />
                      <Text style={styles.confirmModalConfirmText}>Retry</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.confirmModalConfirmBtn, allCompleted && { backgroundColor: '#4CAF50' }, isRetrying && { opacity: 0.5 }]}
                onPress={handleClose}
                disabled={isRetrying}
              >
                <Ionicons name={allCompleted ? 'checkmark-done' : 'close'} size={20} color="#FFF" />
                <Text style={styles.confirmModalConfirmText}>
                  {allCompleted ? 'Done' : 'Close'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : !isRunningSequence && (
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.confirmModalCancelBtn}
                onPress={handleClose}
                disabled={isProcessing}
              >
                <Text style={styles.confirmModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalConfirmBtn, isProcessing && styles.confirmModalConfirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.confirmModalConfirmText}>
                      {isStoreTransaction ? 'Pick & Ship (S2V)' : effectiveIsLotBased ? 'Confirm Pick - Lot (ORD)' : 'Confirm Pick (ORD)'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Sales Ship Confirm Modal - 3-step process for Sales Orders
const SalesShipConfirmModal = ({ visible, onClose, order, instance, onProcess }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0=not started, 1=GetShipment, 2=FusionShip, 3=UpdateStatus
  const [step1Completed, setStep1Completed] = useState(false);
  const [step2Completed, setStep2Completed] = useState(false);
  const [step3Completed, setStep3Completed] = useState(false);
  const [isRunningSequence, setIsRunningSequence] = useState(false);
  const [sequenceError, setSequenceError] = useState(null);
  const [allCompleted, setAllCompleted] = useState(false);
  const [shipmentNumber, setShipmentNumber] = useState('');
  const [step1Response, setStep1Response] = useState(null);
  const [step2Response, setStep2Response] = useState(null);
  const [step3Response, setStep3Response] = useState(null);

  const sourceOrderNumber = order?.source_order_number || order?.order_number || '';
  const instanceUpper = (instance || 'TEST').toUpperCase();

  // URLs for display
  const apexBase = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';
  const fusionHost = instanceUpper === 'PROD'
    ? 'https://efmh.fa.em3.oraclecloud.com'
    : 'https://efmh-test.fa.em3.oraclecloud.com';
  const step1Url = `${apexBase}/WAREHOUSEMANAGEMENT/getshipmentnumber`;
  const step2Url = `${fusionHost}/fscmRestApi/resources/11.13.18.05/shippingTransactions`;
  const step3Url = `${apexBase}/TRIPMANAGEMENT/updateshipconfirmationstatus`;

  // Payloads for display
  const step1Payload = {
    source_order_number: sourceOrderNumber,
    p_instance_name: instanceUpper,
  };
  const step2Payload = {
    ShipmentName: shipmentNumber || '(from Step 1)',
    Action: 'CONFIRM',
    Organization: 'GIC',
  };
  const step3Payload = {
    P_SOURCE_ORDER: sourceOrderNumber,
    p_instance_name: instanceUpper,
  };

  const handleProcess = async () => {
    setIsRunningSequence(true);
    setSequenceError(null);
    setAllCompleted(false);
    setStep1Completed(false);
    setStep2Completed(false);
    setStep3Completed(false);
    setStep1Response(null);
    setStep2Response(null);
    setStep3Response(null);
    setShipmentNumber('');

    try {
      // Step 1: Get Shipment Number
      setCurrentStep(1);
      const step1Result = await getShipmentNumber(sourceOrderNumber);
      setStep1Response(step1Result.data || { error: step1Result.error });

      if (step1Result.success && step1Result.shipmentNumber) {
        setStep1Completed(true);
        setShipmentNumber(step1Result.shipmentNumber);

        // Step 2: Fusion Ship Confirm
        setCurrentStep(2);
        const step2Result = await fusionShipConfirmTransaction(step1Result.shipmentNumber, 'GIC');
        setStep2Response(step2Result.data || { error: step2Result.error });

        if (step2Result.success) {
          setStep2Completed(true);

          // Step 3: Update Ship Confirmation Status
          setCurrentStep(3);
          const step3Result = await updateShipConfirmationStatus(sourceOrderNumber);
          setStep3Response(step3Result.data || { error: step3Result.error });

          if (step3Result.success) {
            setStep3Completed(true);
            setAllCompleted(true);
            // Callback to parent
            if (onProcess) onProcess({ success: true });
          } else {
            setSequenceError(step3Result.error || 'Update ship confirmation status failed');
          }
        } else {
          setSequenceError(step2Result.error || 'Fusion ship confirm failed');
        }
      } else {
        setSequenceError(step1Result.error || 'Failed to get shipment number');
      }
    } catch (error) {
      setSequenceError(error.message || 'Unknown error');
    } finally {
      setIsRunningSequence(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setStep1Completed(false);
    setStep2Completed(false);
    setStep3Completed(false);
    setIsRunningSequence(false);
    setSequenceError(null);
    setAllCompleted(false);
    setShipmentNumber('');
    setStep1Response(null);
    setStep2Response(null);
    setStep3Response(null);
    setShowDetails(false);
    onClose();
  };

  // Render status row
  const renderStatusRow = (stepNum, label, sublabel, isCompleted, isCurrentlyProcessing, response) => (
    <View style={styles.sequenceStatusRow}>
      <View style={[
        styles.sequenceStatusCircle,
        isCompleted && styles.sequenceStatusCircleCompleted,
        isCurrentlyProcessing && styles.sequenceStatusCircleProcessing,
      ]}>
        {isCompleted ? (
          <Ionicons name="checkmark" size={20} color="#FFF" />
        ) : isCurrentlyProcessing ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.sequenceStatusNumber}>{stepNum}</Text>
        )}
      </View>
      <View style={styles.sequenceStatusTextContainer}>
        <Text style={[
          styles.sequenceStatusLabel,
          isCompleted && styles.sequenceStatusLabelCompleted,
          isCurrentlyProcessing && styles.sequenceStatusLabelProcessing,
        ]}>
          {label}
        </Text>
        {sublabel && !isCompleted && !isCurrentlyProcessing && (
          <Text style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{sublabel}</Text>
        )}
        {isCompleted && <Text style={styles.sequenceStatusSuccess}>Completed</Text>}
        {isCurrentlyProcessing && <Text style={styles.sequenceStatusProcessing}>Processing...</Text>}
        {isCompleted && response && (
          <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }} numberOfLines={1}>
            {typeof response === 'object' ? JSON.stringify(response).substring(0, 80) + '...' : String(response).substring(0, 80)}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.cpModalOverlay}>
        <View style={styles.cpModalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="airplane" size={24} color="#9C27B0" />
              <Text style={styles.modalTitle}>Sales Ship Confirm</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn} disabled={isRunningSequence}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {/* Order Info */}
            <View style={styles.modalItemInfo}>
              <Text style={styles.modalItemNumber}>Order: {sourceOrderNumber}</Text>
              <Text style={styles.modalItemDesc} numberOfLines={2}>
                {order?.account_name || order?.customer_name || 'Customer'} | {order?.transaction_type || 'Sales Order'}
              </Text>
            </View>

            {/* Instance & Shipment Info */}
            <View style={styles.cpInfoSection}>
              <View style={styles.cpInfoRow}>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Instance</Text>
                  <View style={[styles.cpInstanceBadge, { backgroundColor: instanceUpper === 'PROD' ? '#E8F5E9' : '#FFF3E0' }]}>
                    <Text style={[styles.cpInstanceText, { color: instanceUpper === 'PROD' ? '#2E7D32' : '#E65100' }]}>
                      {instanceUpper}
                    </Text>
                  </View>
                </View>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Source Order</Text>
                  <Text style={styles.cpInfoValue}>{sourceOrderNumber}</Text>
                </View>
              </View>
              <View style={styles.cpInfoRow}>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Shipment Number</Text>
                  <Text style={[styles.cpInfoValue, !shipmentNumber && { color: '#999' }]}>
                    {shipmentNumber || '(will be fetched in Step 1)'}
                  </Text>
                </View>
                <View style={styles.cpInfoItem}>
                  <Text style={styles.cpInfoLabel}>Organization</Text>
                  <Text style={styles.cpInfoValue}>GIC</Text>
                </View>
              </View>
            </View>

            {/* Processing Status View */}
            {(isRunningSequence || step1Completed || step2Completed || step3Completed || sequenceError) ? (
              <View style={styles.sequenceStatusContainer}>
                {/* Step 1 */}
                {renderStatusRow(
                  1,
                  'Get Shipment Number',
                  'GET /getshipmentnumber',
                  step1Completed,
                  currentStep === 1 && !step1Completed && isRunningSequence,
                  step1Response
                )}

                {/* Line 1-2 */}
                <View style={[styles.sequenceStatusLine, step1Completed && styles.sequenceStatusLineCompleted]} />

                {/* Step 2 */}
                {renderStatusRow(
                  2,
                  'Fusion Ship Confirm',
                  'POST /shippingTransactions',
                  step2Completed,
                  currentStep === 2 && !step2Completed && isRunningSequence,
                  step2Response
                )}

                {/* Line 2-3 */}
                <View style={[styles.sequenceStatusLine, step2Completed && styles.sequenceStatusLineCompleted]} />

                {/* Step 3 */}
                {renderStatusRow(
                  3,
                  'Update Ship Status',
                  'POST /updateshipconfirmationstatus',
                  step3Completed,
                  currentStep === 3 && !step3Completed && isRunningSequence,
                  step3Response
                )}

                {/* Error */}
                {sequenceError && (
                  <View style={styles.sequenceErrorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#F44336" />
                    <Text style={styles.sequenceErrorText}>{sequenceError}</Text>
                  </View>
                )}

                {/* Success */}
                {allCompleted && (
                  <View style={styles.sequenceSuccessContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    <Text style={styles.sequenceSuccessText}>Ship Confirm completed successfully!</Text>
                  </View>
                )}

                {/* Response Details after processing */}
                {(step1Response || step2Response || step3Response) && !isRunningSequence && (
                  <View style={{ marginTop: 12 }}>
                    <TouchableOpacity
                      style={styles.detailsToggleBtn}
                      onPress={() => setShowDetails(!showDetails)}
                    >
                      <View style={styles.detailsToggleLeft}>
                        <Ionicons name="document-text" size={16} color="#666" />
                        <Text style={styles.detailsToggleText}>Response Details</Text>
                      </View>
                      <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                    </TouchableOpacity>
                    {showDetails && (
                      <ScrollView style={styles.technicalDetailsScroll} nestedScrollEnabled>
                        <View style={styles.technicalDetailsContainer}>
                          {step1Response && (
                            <>
                              <View style={styles.cpApiStepHeader}>
                                <Text style={styles.cpApiStepTitle}>Step 1 Response: Get Shipment Number</Text>
                              </View>
                              <View style={styles.jsonCodeBlock}>
                                <Text style={styles.jsonCodeText}>{JSON.stringify(step1Response, null, 2)}</Text>
                              </View>
                            </>
                          )}
                          {step2Response && (
                            <>
                              <View style={[styles.cpApiStepHeader, { marginTop: 10 }]}>
                                <Text style={styles.cpApiStepTitle}>Step 2 Response: Fusion Ship Confirm</Text>
                              </View>
                              <View style={styles.jsonCodeBlock}>
                                <Text style={styles.jsonCodeText}>{JSON.stringify(step2Response, null, 2)}</Text>
                              </View>
                            </>
                          )}
                          {step3Response && (
                            <>
                              <View style={[styles.cpApiStepHeader, { marginTop: 10 }]}>
                                <Text style={styles.cpApiStepTitle}>Step 3 Response: Update Ship Status</Text>
                              </View>
                              <View style={styles.jsonCodeBlock}>
                                <Text style={styles.jsonCodeText}>{JSON.stringify(step3Response, null, 2)}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* API Details Toggle (before processing) */}
                <TouchableOpacity
                  style={styles.detailsToggleBtn}
                  onPress={() => setShowDetails(!showDetails)}
                >
                  <View style={styles.detailsToggleLeft}>
                    <Ionicons name="code-slash" size={16} color="#666" />
                    <Text style={styles.detailsToggleText}>API Details</Text>
                  </View>
                  <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                </TouchableOpacity>

                {showDetails && (
                  <ScrollView style={styles.technicalDetailsScroll} nestedScrollEnabled>
                    <View style={styles.technicalDetailsContainer}>
                      {/* Step 1: POST Get Shipment Number */}
                      <View style={styles.cpApiStepHeader}>
                        <Text style={styles.cpApiStepTitle}>Step 1: Get Shipment Number</Text>
                      </View>
                      <View style={styles.apiEndpointInfo}>
                        <View style={styles.apiMethodBadge}>
                          <Text style={styles.apiMethodText}>POST</Text>
                        </View>
                        <Text style={styles.apiEndpointText} numberOfLines={3}>{step1Url}</Text>
                      </View>
                      <View style={styles.jsonPreviewContainer}>
                        <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
                        <View style={styles.jsonCodeBlock}>
                          <Text style={styles.jsonCodeText}>{JSON.stringify(step1Payload, null, 2)}</Text>
                        </View>
                      </View>

                      {/* Step 2: Fusion Ship Confirm */}
                      <View style={[styles.cpApiStepHeader, { marginTop: 12 }]}>
                        <Text style={styles.cpApiStepTitle}>Step 2: Fusion Ship Confirm</Text>
                      </View>
                      <View style={styles.apiEndpointInfo}>
                        <View style={styles.apiMethodBadge}>
                          <Text style={styles.apiMethodText}>POST</Text>
                        </View>
                        <Text style={styles.apiEndpointText} numberOfLines={3}>{step2Url}</Text>
                      </View>
                      <View style={styles.jsonPreviewContainer}>
                        <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
                        <View style={styles.jsonCodeBlock}>
                          <Text style={styles.jsonCodeText}>{JSON.stringify(step2Payload, null, 2)}</Text>
                        </View>
                      </View>

                      {/* Step 3: Update Ship Status */}
                      <View style={[styles.cpApiStepHeader, { marginTop: 12 }]}>
                        <Text style={styles.cpApiStepTitle}>Step 3: Update Ship Confirmation Status</Text>
                      </View>
                      <View style={styles.apiEndpointInfo}>
                        <View style={[styles.apiMethodBadge, { backgroundColor: '#FF9800' }]}>
                          <Text style={styles.apiMethodText}>POST</Text>
                        </View>
                        <Text style={styles.apiEndpointText} numberOfLines={3}>{step3Url}</Text>
                      </View>
                      <View style={styles.jsonPreviewContainer}>
                        <Text style={styles.jsonPreviewTitle}>Request Payload:</Text>
                        <View style={styles.jsonCodeBlock}>
                          <Text style={styles.jsonCodeText}>{JSON.stringify(step3Payload, null, 2)}</Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          {(allCompleted || sequenceError) && !isRunningSequence ? (
            <View style={styles.confirmModalActions}>
              {sequenceError && (
                <TouchableOpacity
                  style={[styles.confirmModalCancelBtn, { backgroundColor: '#FF9800' }]}
                  onPress={handleProcess}
                >
                  <Ionicons name="refresh" size={18} color="#FFF" />
                  <Text style={[styles.confirmModalCancelText, { color: '#FFF' }]}>Retry</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.confirmModalConfirmBtn, allCompleted && { backgroundColor: '#4CAF50' }]}
                onPress={handleClose}
              >
                <Ionicons name={allCompleted ? 'checkmark-done' : 'close'} size={20} color="#FFF" />
                <Text style={styles.confirmModalConfirmText}>
                  {allCompleted ? 'Done' : 'Close'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : !isRunningSequence && (
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.confirmModalCancelBtn}
                onPress={handleClose}
              >
                <Text style={styles.confirmModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalConfirmBtn, { backgroundColor: '#9C27B0' }]}
                onPress={handleProcess}
              >
                <Ionicons name="airplane" size={20} color="#FFF" />
                <Text style={styles.confirmModalConfirmText}>Ship Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
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

// QR Code Print Modal Component - Compact Version with Scanner and Log
const QRCodePrintModal = ({ visible, onClose, order, pickerName }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [logs, setLogs] = useState([]);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const orderNumber = order?.source_order_number || order?.order_number || 'N/A';
  const orderDate = order?.assignment_date
    ? new Date(order.assignment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';
  const accountName = order?.account_name || order?.customer_name || 'N/A';
  const loadingBay = order?.loading_bay || 'N/A';
  const lorryNumber = order?.lorry_number || 'N/A';

  const orderData = {
    orderNumber: orderNumber,
    orderDate: orderDate,
    accountName: accountName,
    picker: pickerName || 'N/A',
    loadingBy: loadingBay,
    lorry: lorryNumber,
  };

  // Generate preview text
  const previewText = printerService.generatePreviewText(orderData);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan printer barcode');
        return;
      }
    }
    setScanned(false);
    setLogs([]);
    setPrintSuccess(false);
    setShowScanner(true);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setShowScanner(false);
    setShowLog(true);
    setIsPrinting(true);

    addLog(`Barcode scanned: ${data}`, 'info');

    const parsed = printerService.parseIPFromBarcode(data);

    if (parsed) {
      addLog(`IP Address: ${parsed.ipAddress}`, 'info');
      addLog(`Port: ${parsed.port}`, 'info');
      addLog('Connecting to printer...', 'info');

      try {
        const result = await printerService.printToIPWithLogs(parsed.ipAddress, parsed.port, orderData, addLog);

        if (result.success) {
          addLog('Print job completed successfully!', 'success');
          setPrintSuccess(true);
        } else {
          addLog(`Print failed: ${result.message}`, 'error');
        }
      } catch (error) {
        addLog(`Error: ${error.message || 'Unknown error'}`, 'error');
      } finally {
        setIsPrinting(false);
      }
    } else {
      addLog(`Invalid barcode format: "${data}"`, 'error');
      addLog('Expected format: IP address (e.g., 192.168.1.100)', 'error');
    }
  };

  const closeLog = () => {
    setShowLog(false);
    setLogs([]);
  };

  // Scanner view
  if (showScanner) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.scannerContainer} edges={['top']}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan Printer Barcode</Text>
            <TouchableOpacity
              style={styles.scannerCloseBtn}
              onPress={() => setShowScanner(false)}
            >
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.scannerCameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
            {/* Overlay positioned absolutely on top of camera */}
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame}>
                <View style={[styles.scannerCorner, styles.scannerCornerTL]} />
                <View style={[styles.scannerCorner, styles.scannerCornerTR]} />
                <View style={[styles.scannerCorner, styles.scannerCornerBL]} />
                <View style={[styles.scannerCorner, styles.scannerCornerBR]} />
              </View>
              <Text style={styles.scannerHint}>Point at printer's IP barcode</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.scannerCancelBtn}
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.scannerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  // Log view - shows after scanning
  if (showLog) {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.qrModalOverlay}>
          <View style={styles.logModalContainer}>
            {/* Header */}
            <View style={styles.logModalHeader}>
              <View style={styles.logHeaderLeft}>
                {isPrinting ? (
                  <ActivityIndicator size="small" color="#1565C0" />
                ) : printSuccess ? (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                ) : (
                  <Ionicons name="alert-circle" size={24} color="#FF5252" />
                )}
                <Text style={styles.logModalTitle}>
                  {isPrinting ? 'Printing...' : printSuccess ? 'Success' : 'Print Log'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeLog}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Log Content */}
            <ScrollView style={styles.logContent}>
              {logs.map((log, index) => (
                <View key={index} style={styles.logEntry}>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  <Text style={[
                    styles.logMessage,
                    log.type === 'error' && styles.logError,
                    log.type === 'success' && styles.logSuccess,
                  ]}>
                    {log.type === 'error' ? '❌ ' : log.type === 'success' ? '✅ ' : '• '}
                    {log.message}
                  </Text>
                </View>
              ))}
              {isPrinting && (
                <View style={styles.logEntry}>
                  <ActivityIndicator size="small" color="#1565C0" />
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.logActions}>
              {!isPrinting && !printSuccess && (
                <TouchableOpacity
                  style={styles.logRetryButton}
                  onPress={() => {
                    setShowLog(false);
                    handleOpenScanner();
                  }}
                >
                  <Ionicons name="refresh" size={18} color="#FFF" />
                  <Text style={styles.logRetryText}>Try Again</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.logCloseButton, !isPrinting && printSuccess && { flex: 1 }]}
                onPress={closeLog}
              >
                <Text style={styles.logCloseText}>{printSuccess ? 'Done' : 'Close'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

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

          {/* Print Preview Section */}
          <View style={styles.printPreviewSection}>
            <View style={styles.printPreviewHeader}>
              <Ionicons name="print-outline" size={16} color="#666" />
              <Text style={styles.printPreviewTitle}>Print Preview</Text>
            </View>
            <View style={styles.printPreviewContent}>
              {/* QR Code representation */}
              <View style={styles.previewQRBox}>
                <QRCode value={orderNumber} size={80} backgroundColor="white" color="black" />
              </View>
              {/* Preview text */}
              <Text style={styles.printPreviewText}>{previewText}</Text>
            </View>
          </View>

          {/* Print to Label Button - Opens Scanner */}
          <TouchableOpacity
            style={[styles.qrPrintButton, isPrinting && styles.qrPrintButtonDisabled]}
            onPress={handleOpenScanner}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="barcode-outline" size={18} color="#FFF" />
                <Text style={styles.qrPrintButtonText}>Scan Printer & Print</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Close Button */}
          <TouchableOpacity style={styles.qrCloseButton} onPress={onClose}>
            <Text style={styles.qrCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Cancel Order Line Modal Component - 2-step cancel flow (Sales) / 1-step (Store Orders)
const CancelOrderModal = ({ visible, onClose, onConfirm, item, order, isProcessing, instance, transactionType }) => {
  const [cancelReason, setCancelReason] = useState('OUT OF STOCK');
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [step1Result, setStep1Result] = useState(null);
  const [step2Result, setStep2Result] = useState(null);

  useEffect(() => {
    if (visible) {
      setCancelReason('OUT OF STOCK');
      setCurrentStep(null);
      setStep1Result(null);
      setStep2Result(null);
    }
  }, [visible, item?.id]);

  if (!item) return null;

  // Use transactionType prop first, fall back to order.transaction_type
  const txType = transactionType || order?.transaction_type || '';
  const isStoreTransaction = txType.toLowerCase().includes('store');

  const orderNumber = order?.order_number || order?.source_order_number || '';
  const fulfillLineId = item.fulfill_line_id || item.FULFILL_LINE_ID || '';
  const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';
  const instanceName = (instance || 'TEST').toUpperCase();

  const fusionBase = instanceName === 'PROD'
    ? 'https://efmh.fa.em3.oraclecloud.com/fscmRestApi/resources/11.13.18.05'
    : 'https://efmh-test.fa.em3.oraclecloud.com/fscmRestApi/resources/11.13.18.05';
  const fusionUrl = `${fusionBase}/salesOrdersForOrderHub/OPS:${orderNumber}`;

  const fusionPayload = {
    lines: [
      {
        FulfillLineId: fulfillLineId,
        OrderedQuantity: 0,
        CancelReason: cancelReason,
      },
    ],
  };

  const apexBaseUrl = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT/trip/updatecancelstatus';
  const cancelS2VUrl = `https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT/trip/cancels2vlot/${linesId}?p_instance_name=${instanceName}`;
  const transactionId = item.id || item.source_delivery_detail_id || item.delivery_detail_id || '';

  const handleConfirm = async () => {
    setStep1Result(null);
    setStep2Result(null);
    await onConfirm(item, cancelReason, setCurrentStep, setStep1Result, setStep2Result);
  };

  const allDone = currentStep === 'done';
  const hasFailed = (step1Result && !step1Result.success) || (step2Result && !step2Result.success);

  const getStepIcon = (step) => {
    const result = step === 'step1' ? step1Result : step2Result;
    const active = step === currentStep;
    if (!result) return active ? 'sync' : 'ellipse-outline';
    return result.success ? 'checkmark-circle' : 'close-circle';
  };
  const getStepColor = (step) => {
    const result = step === 'step1' ? step1Result : step2Result;
    const active = step === currentStep;
    if (!result) return active ? '#1565C0' : '#999';
    return result.success ? '#4CAF50' : '#D32F2F';
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={cancelModalStyles.overlay}>
        <View style={cancelModalStyles.container}>
          {/* Header */}
          <View style={cancelModalStyles.header}>
            <View style={[cancelModalStyles.headerLeft, { flex: 1 }]}>
              <Ionicons name="close-circle" size={24} color="#D32F2F" />
              <View style={{ flex: 1 }}>
                <Text style={cancelModalStyles.headerTitle} numberOfLines={2}>
                  {isStoreTransaction ? 'Cancel Order Line' : 'Cancel Order Line'}
                </Text>
                {isStoreTransaction && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <View style={{ backgroundColor: '#D32F2F', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>STORE ORDERS</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isProcessing} style={{ paddingLeft: 8 }}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={cancelModalStyles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Item Description Section */}
            <View style={cancelModalStyles.itemSection}>
              <View style={cancelModalStyles.itemBadge}>
                <Ionicons name="cube" size={16} color="#1565C0" />
                <Text style={cancelModalStyles.itemNumber}>{item.item_number || 'N/A'}</Text>
                <Text style={cancelModalStyles.lineNum}>Line #{item.line_number || '1'}</Text>
                {isStoreTransaction && (
                  <View style={{ backgroundColor: '#1565C0', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>S2V</Text>
                  </View>
                )}
              </View>
              <Text style={cancelModalStyles.itemDescription}>{item.description || 'No Description'}</Text>
              {/* OrderLine + LineStatus badges */}
              {(item.order_line || item.line_status) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                  {item.order_line && (
                    <View style={cancelModalStyles.cancelLineBadge}>
                      <Ionicons name="layers-outline" size={11} color="#1565C0" />
                      <Text style={cancelModalStyles.cancelLineBadgeText}>Order Line {item.order_line}</Text>
                    </View>
                  )}
                  {item.line_status && (
                    <View style={[cancelModalStyles.cancelStatusBadge, {
                      backgroundColor: item.line_status === 'Staged' ? '#E8F5E9' : item.line_status === 'Backordered' ? '#FFF3E0' : '#EDE7F6',
                    }]}>
                      <Ionicons
                        name={item.line_status === 'Staged' ? 'checkmark-circle-outline' : item.line_status === 'Backordered' ? 'time-outline' : 'ellipse-outline'}
                        size={11}
                        color={item.line_status === 'Staged' ? '#2E7D32' : item.line_status === 'Backordered' ? '#E65100' : '#6A1B9A'}
                      />
                      <Text style={[cancelModalStyles.cancelStatusBadgeText, {
                        color: item.line_status === 'Staged' ? '#2E7D32' : item.line_status === 'Backordered' ? '#E65100' : '#6A1B9A',
                      }]}>{item.line_status}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={cancelModalStyles.itemQtyRow}>
                <Text style={cancelModalStyles.itemQtyLabel}>Qty: {parseInt(item.qty) || 0}</Text>
                {isStoreTransaction ? (
                  <Text style={cancelModalStyles.itemIdLabel}>Lines ID: {linesId || '—'}</Text>
                ) : (
                  <Text style={cancelModalStyles.itemIdLabel}>FulfillLineId: {fulfillLineId}</Text>
                )}
              </View>
            </View>

            {/* Cancel Reason */}
            <View style={cancelModalStyles.reasonSection}>
              <Text style={cancelModalStyles.sectionTitle}>Cancel Reason</Text>
              <TextInput
                style={cancelModalStyles.reasonInput}
                placeholder="Enter cancel reason"
                placeholderTextColor="#999"
                value={cancelReason}
                onChangeText={setCancelReason}
                editable={!currentStep}
              />
            </View>

            {/* Steps Progress */}
            {currentStep && (
              <View style={cancelModalStyles.stepsSection}>
                {isStoreTransaction ? (
                  /* Store Orders: single step */
                  <View style={cancelModalStyles.stepRow}>
                    {currentStep === 'step1' && !step1Result ? (
                      <ActivityIndicator size="small" color="#1565C0" style={{ width: 20 }} />
                    ) : (
                      <Ionicons name={getStepIcon('step1')} size={20} color={getStepColor('step1')} />
                    )}
                    <View style={cancelModalStyles.stepTextContainer}>
                      <Text style={[cancelModalStyles.stepTitle, { color: getStepColor('step1') }]}>Cancelling Store Order (S2V)</Text>
                      {step1Result && (
                        <Text style={cancelModalStyles.stepStatus}>
                          {step1Result.success ? `Success (HTTP ${step1Result.status || 200})` : `Failed: ${step1Result.error || 'Unknown error'}`}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  /* Sales Orders: two steps */
                  <>
                    <View style={cancelModalStyles.stepRow}>
                      {currentStep === 'step1' && !step1Result ? (
                        <ActivityIndicator size="small" color="#1565C0" style={{ width: 20 }} />
                      ) : (
                        <Ionicons name={getStepIcon('step1')} size={20} color={getStepColor('step1')} />
                      )}
                      <View style={cancelModalStyles.stepTextContainer}>
                        <Text style={[cancelModalStyles.stepTitle, { color: getStepColor('step1') }]}>Step 1: Cancelling in Fusion</Text>
                        {step1Result && (
                          <Text style={cancelModalStyles.stepStatus}>
                            {step1Result.success ? `Success (HTTP ${step1Result.status || 200})` : `Failed: ${step1Result.error || 'Unknown error'}`}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={cancelModalStyles.stepRow}>
                      {currentStep === 'step2' && !step2Result ? (
                        <ActivityIndicator size="small" color="#1565C0" style={{ width: 20 }} />
                      ) : (
                        <Ionicons name={getStepIcon('step2')} size={20} color={getStepColor('step2')} />
                      )}
                      <View style={cancelModalStyles.stepTextContainer}>
                        <Text style={[cancelModalStyles.stepTitle, { color: getStepColor('step2') }]}>Step 2: Updating APEX Status</Text>
                        {step2Result && (
                          <Text style={cancelModalStyles.stepStatus}>
                            {step2Result.success ? `Success (HTTP ${step2Result.status || 200})` : `Failed: ${step2Result.error || 'Unknown error'}`}
                          </Text>
                        )}
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* API Details Section - collapsed by default */}
            <TouchableOpacity
              style={cancelModalStyles.apiToggle}
              onPress={() => setShowApiDetails(!showApiDetails)}
            >
              <View style={cancelModalStyles.apiToggleLeft}>
                <Ionicons name="code-slash" size={16} color="#1565C0" />
                <Text style={cancelModalStyles.apiToggleText}>API Details</Text>
              </View>
              <Ionicons name={showApiDetails ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
            </TouchableOpacity>

            {showApiDetails && (
              <View style={cancelModalStyles.apiSection}>
                {isStoreTransaction ? (
                  /* Store Orders: single APEX POST */
                  <>
                    <Text style={cancelModalStyles.apiStepLabel}>Cancel S2V Lot (APEX)</Text>
                    <View style={cancelModalStyles.apiMethodRow}>
                      <View style={[cancelModalStyles.methodBadge, { backgroundColor: '#FF9800' }]}>
                        <Text style={cancelModalStyles.methodText}>POST</Text>
                      </View>
                      <Text style={cancelModalStyles.instanceBadgeText}>{instanceName}</Text>
                    </View>
                    <Text style={cancelModalStyles.apiUrl} selectable numberOfLines={4}>{cancelS2VUrl}</Text>
                    {step1Result && (
                      <View style={[cancelModalStyles.apiResultInline, { borderLeftColor: step1Result.success ? '#4CAF50' : '#D32F2F' }]}>
                        <Text style={cancelModalStyles.apiResultLabel}>Response ({step1Result.status || '-'}):</Text>
                        <Text style={cancelModalStyles.jsonText} selectable>
                          {step1Result.data ? JSON.stringify(step1Result.data, null, 2) : step1Result.error || '-'}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  /* Sales Orders: Fusion PATCH + APEX POST */
                  <>
                    <Text style={cancelModalStyles.apiStepLabel}>Step 1: Fusion Cancel</Text>
                    <View style={cancelModalStyles.apiMethodRow}>
                      <View style={cancelModalStyles.methodBadge}>
                        <Text style={cancelModalStyles.methodText}>PATCH</Text>
                      </View>
                      <Text style={cancelModalStyles.instanceBadgeText}>{instanceName}</Text>
                    </View>
                    <Text style={cancelModalStyles.apiUrl} selectable numberOfLines={3}>{fusionUrl}</Text>
                    <Text style={cancelModalStyles.jsonLabel}>Request Body:</Text>
                    <View style={cancelModalStyles.jsonContainer}>
                      <Text style={cancelModalStyles.jsonText} selectable>
                        {JSON.stringify(fusionPayload, null, 2)}
                      </Text>
                    </View>
                    {step1Result && (
                      <View style={[cancelModalStyles.apiResultInline, { borderLeftColor: step1Result.success ? '#4CAF50' : '#D32F2F' }]}>
                        <Text style={cancelModalStyles.apiResultLabel}>Response ({step1Result.status || '-'}):</Text>
                        <Text style={cancelModalStyles.jsonText} selectable>
                          {step1Result.data ? JSON.stringify(step1Result.data, null, 2) : step1Result.error || '-'}
                        </Text>
                      </View>
                    )}

                    <View style={cancelModalStyles.apiDivider} />
                    <Text style={cancelModalStyles.apiStepLabel}>Step 2: APEX Update Cancel Status</Text>
                    <View style={cancelModalStyles.apiMethodRow}>
                      <View style={[cancelModalStyles.methodBadge, { backgroundColor: '#FF9800' }]}>
                        <Text style={cancelModalStyles.methodText}>POST</Text>
                      </View>
                      <Text style={cancelModalStyles.instanceBadgeText}>{instanceName}</Text>
                    </View>
                    <Text style={cancelModalStyles.apiUrl} selectable numberOfLines={3}>{apexBaseUrl}</Text>
                    <Text style={cancelModalStyles.jsonLabel}>Request Body:</Text>
                    <View style={cancelModalStyles.jsonContainer}>
                      <Text style={cancelModalStyles.jsonText} selectable>
                        {JSON.stringify({ P_TRANSACTION_ID: transactionId, p_instance_name: instanceName }, null, 2)}
                      </Text>
                    </View>
                    {step2Result && (
                      <View style={[cancelModalStyles.apiResultInline, { borderLeftColor: step2Result.success ? '#4CAF50' : '#D32F2F' }]}>
                        <Text style={cancelModalStyles.apiResultLabel}>Response ({step2Result.status || '-'}):</Text>
                        <Text style={cancelModalStyles.jsonText} selectable>
                          {step2Result.data ? JSON.stringify(step2Result.data, null, 2) : step2Result.error || '-'}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={cancelModalStyles.actions}>
            <TouchableOpacity
              style={cancelModalStyles.keepButton}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Text style={cancelModalStyles.keepButtonText}>
                {allDone ? 'Close' : 'Keep Line'}
              </Text>
            </TouchableOpacity>
            {!allDone && !hasFailed && (
              <TouchableOpacity
                style={[cancelModalStyles.cancelButton, isProcessing && cancelModalStyles.disabledButton]}
                onPress={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#FFF" />
                    <Text style={cancelModalStyles.cancelButtonText}>Cancel Line</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const cancelModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '100%',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D32F2F',
  },
  scrollContent: {
    maxHeight: 500,
  },
  // Item Section
  itemSection: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  itemNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565C0',
  },
  lineNum: {
    fontSize: 12,
    color: '#666',
    marginLeft: 'auto',
  },
  itemDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 6,
  },
  itemQtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQtyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
  },
  itemIdLabel: {
    fontSize: 11,
    color: '#999',
  },
  cancelLineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E3F2FD',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cancelLineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1565C0',
  },
  cancelStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cancelStatusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Cancel Reason
  reasonSection: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  reasonInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 10,
    fontSize: 14,
    color: '#333',
  },
  // API Details
  apiToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E0E0E0',
  },
  apiToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  apiToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  apiSection: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  apiMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  methodBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  methodText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  instanceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  apiUrl: {
    fontSize: 11,
    color: '#1565C0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
    marginBottom: 10,
  },
  jsonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  jsonContainer: {
    backgroundColor: '#263238',
    borderRadius: 6,
    padding: 10,
  },
  jsonText: {
    fontSize: 11,
    color: '#A5D6A7',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  // Result Section
  resultSection: {
    margin: 16,
    marginTop: 8,
    borderRadius: 8,
    padding: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultStatus: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  resultDataContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  resultDataText: {
    fontSize: 11,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  resultError: {
    fontSize: 13,
    color: '#C62828',
    marginTop: 4,
  },
  // Actions
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  keepButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  keepButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D32F2F',
    borderRadius: 8,
    paddingVertical: 14,
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Steps Progress
  stepsSection: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  // API Details additions
  apiStepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  apiDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  apiResultInline: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#263238',
    borderRadius: 6,
    borderLeftWidth: 3,
  },
  apiResultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#90CAF9',
    marginBottom: 4,
  },
});

// Bulk Cancel Modal - shows all marked lines, 2-step cancel flow (Sales) / 1-step (Store Orders)
const BulkCancelModal = ({ visible, onClose, markedItems, order, instance, onExecuteBulkCancel, isProcessing, transactionType }) => {
  const [cancelReason, setCancelReason] = useState('OUT OF STOCK');
  const [showApiDetails, setShowApiDetails] = useState(false);
  // Step tracking: null = not started, 'step1' = S2V/Fusion in progress, 'step2' = APEX in progress, 'done' = all done
  const [currentStep, setCurrentStep] = useState(null);
  const [step1Result, setStep1Result] = useState(null);
  const [step2Result, setStep2Result] = useState(null);

  useEffect(() => {
    if (visible) {
      setCancelReason('OUT OF STOCK');
      setCurrentStep(null);
      setStep1Result(null);
      setStep2Result(null);
    }
  }, [visible]);

  const txType = transactionType || order?.transaction_type || '';
  const isStoreTransaction = txType.toLowerCase().includes('store');

  const orderNumber = order?.order_number || order?.source_order_number || '';
  const instanceName = (instance || 'TEST').toUpperCase();
  const cancelS2VBaseUrl = `https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT/trip/cancels2vlot/{P_LID}?p_instance_name=${instanceName}`;

  const fusionBase = instanceName === 'PROD'
    ? 'https://efmh.fa.em3.oraclecloud.com/fscmRestApi/resources/11.13.18.05'
    : 'https://efmh-test.fa.em3.oraclecloud.com/fscmRestApi/resources/11.13.18.05';
  const fusionUrl = `${fusionBase}/salesOrdersForOrderHub/OPS:${orderNumber}`;

  const fusionPayload = {
    lines: markedItems.map(item => ({
      FulfillLineId: item.fulfill_line_id || item.FULFILL_LINE_ID || '',
      OrderedQuantity: 0,
      CancelReason: cancelReason,
    })),
  };

  const apexBaseUrl = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT/trip/updatecancelstatus';

  const handleConfirm = async () => {
    setStep1Result(null);
    setStep2Result(null);
    const result = await onExecuteBulkCancel(markedItems, cancelReason, setCurrentStep, setStep1Result, setStep2Result);
  };

  const allDone = currentStep === 'done';
  const hasFailed = (step1Result && !step1Result.success) || (step2Result && !step2Result.success);

  // Step status helper
  const getStepIcon = (step) => {
    if (step === 'step1') {
      if (!step1Result) return currentStep === 'step1' ? 'sync' : 'ellipse-outline';
      return step1Result.success ? 'checkmark-circle' : 'close-circle';
    }
    if (step === 'step2') {
      if (!step2Result) return currentStep === 'step2' ? 'sync' : 'ellipse-outline';
      return step2Result.success ? 'checkmark-circle' : 'close-circle';
    }
  };
  const getStepColor = (step) => {
    if (step === 'step1') {
      if (!step1Result) return currentStep === 'step1' ? '#1565C0' : '#999';
      return step1Result.success ? '#4CAF50' : '#D32F2F';
    }
    if (step === 'step2') {
      if (!step2Result) return currentStep === 'step2' ? '#1565C0' : '#999';
      return step2Result.success ? '#4CAF50' : '#D32F2F';
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={cancelModalStyles.overlay}>
        <View style={cancelModalStyles.container}>
          {/* Header */}
          <View style={cancelModalStyles.header}>
            <View style={[cancelModalStyles.headerLeft, { flex: 1 }]}>
              <Ionicons name="close-circle" size={24} color="#D32F2F" />
              <View style={{ flex: 1 }}>
                <Text style={cancelModalStyles.headerTitle}>Cancel Lines ({markedItems.length})</Text>
                {isStoreTransaction && (
                  <View style={{ flexDirection: 'row', marginTop: 2 }}>
                    <View style={{ backgroundColor: '#D32F2F', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>STORE ORDERS</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isProcessing} style={{ paddingLeft: 8 }}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={cancelModalStyles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Marked Lines List */}
            {markedItems.map((item, idx) => (
              <View key={`bulk-cancel-${idx}`} style={cancelModalStyles.itemSection}>
                <View style={cancelModalStyles.itemBadge}>
                  <Ionicons name="cube" size={16} color="#1565C0" />
                  <Text style={cancelModalStyles.itemNumber}>{item.item_number || 'N/A'}</Text>
                  <Text style={cancelModalStyles.lineNum}>Line #{item.line_number || '1'}</Text>
                  {isStoreTransaction && (
                    <View style={{ backgroundColor: '#1565C0', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>S2V</Text>
                    </View>
                  )}
                </View>
                <Text style={cancelModalStyles.itemDescription} numberOfLines={1}>{item.description || 'No Description'}</Text>
                {/* OrderLine + LineStatus badges */}
                {(item.order_line || item.line_status) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    {item.order_line && (
                      <View style={cancelModalStyles.cancelLineBadge}>
                        <Ionicons name="layers-outline" size={11} color="#1565C0" />
                        <Text style={cancelModalStyles.cancelLineBadgeText}>Order Line {item.order_line}</Text>
                      </View>
                    )}
                    {item.line_status && (
                      <View style={[cancelModalStyles.cancelStatusBadge, {
                        backgroundColor: item.line_status === 'Staged' ? '#E8F5E9' : item.line_status === 'Backordered' ? '#FFF3E0' : '#EDE7F6',
                      }]}>
                        <Ionicons
                          name={item.line_status === 'Staged' ? 'checkmark-circle-outline' : item.line_status === 'Backordered' ? 'time-outline' : 'ellipse-outline'}
                          size={11}
                          color={item.line_status === 'Staged' ? '#2E7D32' : item.line_status === 'Backordered' ? '#E65100' : '#6A1B9A'}
                        />
                        <Text style={[cancelModalStyles.cancelStatusBadgeText, {
                          color: item.line_status === 'Staged' ? '#2E7D32' : item.line_status === 'Backordered' ? '#E65100' : '#6A1B9A',
                        }]}>{item.line_status}</Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={cancelModalStyles.itemQtyRow}>
                  <Text style={cancelModalStyles.itemQtyLabel}>Qty: {parseInt(item.qty) || 0}</Text>
                  {isStoreTransaction ? (
                    <Text style={cancelModalStyles.itemIdLabel}>Lines ID: {item.lines_id || item.Lines_id || item.LINES_ID || '—'}</Text>
                  ) : (
                    <Text style={cancelModalStyles.itemIdLabel}>FulfillLineId: {item.fulfill_line_id || item.FULFILL_LINE_ID || ''}</Text>
                  )}
                </View>
              </View>
            ))}

            {/* Cancel Reason */}
            <View style={cancelModalStyles.reasonSection}>
              <Text style={cancelModalStyles.sectionTitle}>Cancel Reason (applies to all lines)</Text>
              <TextInput
                style={cancelModalStyles.reasonInput}
                placeholder="Enter cancel reason"
                placeholderTextColor="#999"
                value={cancelReason}
                onChangeText={setCancelReason}
                editable={!currentStep}
              />
            </View>

            {/* Steps Progress */}
            {currentStep && (
              <View style={cancelModalStyles.stepsSection}>
                {isStoreTransaction ? (
                  /* Store Orders: single step */
                  <View style={cancelModalStyles.stepRow}>
                    {currentStep === 'step1' && !step1Result ? (
                      <ActivityIndicator size="small" color="#1565C0" style={{ width: 20 }} />
                    ) : (
                      <Ionicons name={getStepIcon('step1')} size={20} color={getStepColor('step1')} />
                    )}
                    <View style={cancelModalStyles.stepTextContainer}>
                      <Text style={[cancelModalStyles.stepTitle, { color: getStepColor('step1') }]}>Cancelling Store Orders (S2V)</Text>
                      {step1Result && (
                        <Text style={cancelModalStyles.stepStatus}>
                          {step1Result.success
                            ? `Success (${markedItems.length} line${markedItems.length > 1 ? 's' : ''} cancelled)`
                            : `Failed: ${step1Result.error || 'Unknown error'}`}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  /* Sales Orders: two steps */
                  <>
                    <View style={cancelModalStyles.stepRow}>
                      {currentStep === 'step1' && !step1Result ? (
                        <ActivityIndicator size="small" color="#1565C0" style={{ width: 20 }} />
                      ) : (
                        <Ionicons name={getStepIcon('step1')} size={20} color={getStepColor('step1')} />
                      )}
                      <View style={cancelModalStyles.stepTextContainer}>
                        <Text style={[cancelModalStyles.stepTitle, { color: getStepColor('step1') }]}>Step 1: Cancelling in Fusion</Text>
                        {step1Result && (
                          <Text style={cancelModalStyles.stepStatus}>
                            {step1Result.success ? `Success (HTTP ${step1Result.status || 200})` : `Failed: ${step1Result.error || 'Unknown error'}`}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={cancelModalStyles.stepRow}>
                      {currentStep === 'step2' && !step2Result ? (
                        <ActivityIndicator size="small" color="#1565C0" style={{ width: 20 }} />
                      ) : (
                        <Ionicons name={getStepIcon('step2')} size={20} color={getStepColor('step2')} />
                      )}
                      <View style={cancelModalStyles.stepTextContainer}>
                        <Text style={[cancelModalStyles.stepTitle, { color: getStepColor('step2') }]}>Step 2: Updating APEX Status</Text>
                        {step2Result && (
                          <Text style={cancelModalStyles.stepStatus}>
                            {step2Result.success ? `Success (HTTP ${step2Result.status || 200})` : `Failed: ${step2Result.error || 'Unknown error'}`}
                          </Text>
                        )}
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* API Details Section - collapsed by default */}
            <TouchableOpacity
              style={cancelModalStyles.apiToggle}
              onPress={() => setShowApiDetails(!showApiDetails)}
            >
              <View style={cancelModalStyles.apiToggleLeft}>
                <Ionicons name="code-slash" size={16} color="#1565C0" />
                <Text style={cancelModalStyles.apiToggleText}>API Details</Text>
              </View>
              <Ionicons name={showApiDetails ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
            </TouchableOpacity>

            {showApiDetails && (
              <View style={cancelModalStyles.apiSection}>
                {isStoreTransaction ? (
                  /* Store Orders: single APEX POST per line */
                  <>
                    <Text style={cancelModalStyles.apiStepLabel}>Cancel S2V Lot — called per line (APEX)</Text>
                    <View style={cancelModalStyles.apiMethodRow}>
                      <View style={[cancelModalStyles.methodBadge, { backgroundColor: '#FF9800' }]}>
                        <Text style={cancelModalStyles.methodText}>POST</Text>
                      </View>
                      <Text style={cancelModalStyles.instanceBadgeText}>{instanceName}</Text>
                    </View>
                    <Text style={cancelModalStyles.apiUrl} selectable numberOfLines={4}>{cancelS2VBaseUrl}</Text>
                    {step1Result && (
                      <View style={[cancelModalStyles.apiResultInline, { borderLeftColor: step1Result.success ? '#4CAF50' : '#D32F2F' }]}>
                        <Text style={cancelModalStyles.apiResultLabel}>Response:</Text>
                        <Text style={cancelModalStyles.jsonText} selectable>
                          {step1Result.data ? JSON.stringify(step1Result.data, null, 2) : step1Result.error || '-'}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  /* Sales Orders: Fusion PATCH + APEX POST */
                  <>
                    <Text style={cancelModalStyles.apiStepLabel}>Step 1: Fusion Cancel</Text>
                    <View style={cancelModalStyles.apiMethodRow}>
                      <View style={cancelModalStyles.methodBadge}>
                        <Text style={cancelModalStyles.methodText}>PATCH</Text>
                      </View>
                      <Text style={cancelModalStyles.instanceBadgeText}>{instanceName}</Text>
                    </View>
                    <Text style={cancelModalStyles.apiUrl} selectable numberOfLines={3}>{fusionUrl}</Text>
                    <Text style={cancelModalStyles.jsonLabel}>Request Body:</Text>
                    <View style={cancelModalStyles.jsonContainer}>
                      <Text style={cancelModalStyles.jsonText} selectable>
                        {JSON.stringify(fusionPayload, null, 2)}
                      </Text>
                    </View>
                    {step1Result && (
                      <View style={[cancelModalStyles.apiResultInline, { borderLeftColor: step1Result.success ? '#4CAF50' : '#D32F2F' }]}>
                        <Text style={cancelModalStyles.apiResultLabel}>Response ({step1Result.status || '-'}):</Text>
                        <Text style={cancelModalStyles.jsonText} selectable>
                          {step1Result.data ? JSON.stringify(step1Result.data, null, 2) : step1Result.error || '-'}
                        </Text>
                      </View>
                    )}
                    <View style={cancelModalStyles.apiDivider} />
                    <Text style={cancelModalStyles.apiStepLabel}>Step 2: APEX Update Cancel Status</Text>
                    <View style={cancelModalStyles.apiMethodRow}>
                      <View style={[cancelModalStyles.methodBadge, { backgroundColor: '#FF9800' }]}>
                        <Text style={cancelModalStyles.methodText}>POST</Text>
                      </View>
                      <Text style={cancelModalStyles.instanceBadgeText}>{instanceName}</Text>
                    </View>
                    <Text style={cancelModalStyles.apiUrl} selectable numberOfLines={3}>{apexBaseUrl}</Text>
                    <Text style={cancelModalStyles.jsonLabel}>Request Body:</Text>
                    <View style={cancelModalStyles.jsonContainer}>
                      <Text style={cancelModalStyles.jsonText} selectable>
                        {JSON.stringify({ P_TRANSACTION_ID: '{each line ID}', p_instance_name: instanceName }, null, 2)}
                      </Text>
                    </View>
                    {step2Result && (
                      <View style={[cancelModalStyles.apiResultInline, { borderLeftColor: step2Result.success ? '#4CAF50' : '#D32F2F' }]}>
                        <Text style={cancelModalStyles.apiResultLabel}>Response ({step2Result.status || '-'}):</Text>
                        <Text style={cancelModalStyles.jsonText} selectable>
                          {step2Result.data ? JSON.stringify(step2Result.data, null, 2) : step2Result.error || '-'}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={cancelModalStyles.actions}>
            <TouchableOpacity
              style={cancelModalStyles.keepButton}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Text style={cancelModalStyles.keepButtonText}>
                {allDone ? 'Close' : 'Go Back'}
              </Text>
            </TouchableOpacity>
            {!allDone && !hasFailed && (
              <TouchableOpacity
                style={[cancelModalStyles.cancelButton, isProcessing && cancelModalStyles.disabledButton]}
                onPress={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#FFF" />
                    <Text style={cancelModalStyles.cancelButtonText}>Cancel All ({markedItems.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Line Item Card Component
const LineItemCard = ({ item, transactionType, onConfirmPick, onCancelPick, onShipConfirm, onUndoPick, onSearchLots, isConfirming, isCancelling, isShipping, isUndoing, isMarkedForCancel, onToggleMarkCancel }) => {
  const [showDetails, setShowDetails] = useState(false);
  const isPicked = item.pick_confirm_status === 'YES';
  const isShipped = item.shipped_status === 'YES';
  const isCancelled = item.cancelled_status === 'YES' || (item.cancel_status || '').toUpperCase() === 'YES' || (item.cancel_status || '').toUpperCase() === 'CANCELLED' || /^cancel/i.test(item.line_status || '');
  const pickedQty = parseInt(item.picked_qty) || 0;
  const requestedQty = parseInt(item.qty) || 0;
  const discPer = item.disc_per != null ? String(item.disc_per) : '';
  const isStoreTransfer = (transactionType || '').toLowerCase().includes('store');
  const hasStatusInfo = pickedQty > 0 || isShipped || isCancelled;

  // Check if discount is 50% (handle both "50%" and "50" formats)
  const discValue = parseFloat(discPer.replace('%', '')) || 0;
  const isHighDiscount = discValue >= 50;

  // Blinking animation for high discount
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isHighDiscount && !isStoreTransfer) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      blink.start();
      return () => blink.stop();
    }
  }, [isHighDiscount, isStoreTransfer]);

  // Show Confirm and Cancel buttons only when picked_qty = 0 and not cancelled
  const showPickButtons = pickedQty === 0 && !isCancelled;
  // Show Ship Confirm button when picked but not shipped (Store orders only)
  const showShipButtons = pickedQty > 0 && !isShipped && !isCancelled;
  // Cancel button only shows in pending state (within showPickButtons)

  // Use the "id" field directly as-is
  const rawId = item.id || item.source_delivery_detail_id || item.delivery_detail_id || '';
  const formattedId = String(rawId);

  // Get FulfillLineId for cancel API
  const fulfillLineId = item.fulfill_line_id || item.FULFILL_LINE_ID || '';

  // Get Lines_id for ship confirm API
  const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';

  // Status determination: cancelled > shipped > picked > pending
  let statusColor = '#FF9800'; // Pending
  let statusIcon = 'time-outline';
  let statusText = 'Pending';

  if (isCancelled) {
    statusColor = '#D32F2F';
    statusIcon = 'close-circle';
    statusText = 'Cancelled';
  } else if (isShipped) {
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
            {fulfillLineId ? <Text style={styles.linesIdSmall}>F:{fulfillLineId}</Text> : null}
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
        {item.lot_expiry_date && (() => {
          const days = getDaysToExpiry(item.lot_expiry_date);
          const color = getExpiryColor(days);
          return (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Days to Expiry</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name={days !== null && days < 30 ? 'warning' : 'time-outline'}
                  size={14}
                  color={color}
                />
                <Text style={[styles.detailValue, { color, fontWeight: '700' }]}>
                  {days !== null ? (days < 0 ? `Expired (${Math.abs(days)}d ago)` : `${days} days`) : 'N/A'}
                </Text>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Barcode Info */}
      {/* OrderLine + LineStatus badges from Fusion */}
      {(item.order_line || item.line_status) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {item.order_line && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E3F2FD', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Ionicons name="layers-outline" size={12} color="#1565C0" />
              <Text style={{ fontSize: 11, color: '#1565C0', fontWeight: '600' }}>Line {item.order_line}</Text>
            </View>
          )}
          {item.line_status && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: /^cancel/i.test(item.line_status || '') ? '#FFEBEE' : item.line_status === 'Staged' ? '#E8F5E9' : item.line_status === 'Backordered' ? '#FFF3E0' : '#F3E5F5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Ionicons name={/^cancel/i.test(item.line_status || '') ? 'close-circle-outline' : item.line_status === 'Staged' ? 'checkmark-circle-outline' : item.line_status === 'Backordered' ? 'time-outline' : 'ellipse-outline'} size={12} color={/^cancel/i.test(item.line_status || '') ? '#C62828' : item.line_status === 'Staged' ? '#2E7D32' : item.line_status === 'Backordered' ? '#E65100' : '#6A1B9A'} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: /^cancel/i.test(item.line_status || '') ? '#C62828' : item.line_status === 'Staged' ? '#2E7D32' : item.line_status === 'Backordered' ? '#E65100' : '#6A1B9A' }}>{item.line_status}</Text>
            </View>
          )}
          {item.fusion_only && (
            <View style={{ backgroundColor: '#FFF9C4', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, color: '#F57F17', fontWeight: '700' }}>FUSION ONLY</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.barcodeRow}>
        <Ionicons name="barcode-outline" size={14} color="#666" />
        <Text style={styles.barcodeText}>Barcode: {item.barcode || 'N/A'}</Text>
        {!isStoreTransfer && discPer && (
          isHighDiscount ? (
            <Animated.View style={[styles.highDiscountBadge, { opacity: blinkAnim }]}>
              <Ionicons name="pricetag" size={12} color="#fff" />
              <Text style={styles.highDiscountText}>Disc: {discPer}</Text>
            </Animated.View>
          ) : (
            <Text style={styles.discPerText}>Disc: {discPer}</Text>
          )
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
            style={[styles.markCancelButton, isMarkedForCancel && styles.markCancelButtonActive]}
            onPress={() => onToggleMarkCancel(item)}
          >
            <Ionicons name={isMarkedForCancel ? 'checkmark-circle' : 'flag-outline'} size={20} color={isMarkedForCancel ? '#FFF' : '#D32F2F'} />
            <Text style={[styles.markCancelButtonText, isMarkedForCancel && styles.markCancelButtonTextActive]}>
              {isMarkedForCancel ? 'Marked' : 'Mark Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ship Action Buttons - show when picked but not shipped, only for Store transactions */}
      {showShipButtons && isStoreTransfer && (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.shipConfirmButton, { flex: 1 }]}
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
        </View>
      )}

      {/* Mark for Cancel Button removed - no buttons needed after picking is done */}

      {/* Cancelled Banner - show when line is cancelled */}
      {isCancelled && (
        <View style={styles.cancelledBanner}>
          <Ionicons name="close-circle" size={16} color="#D32F2F" />
          <Text style={styles.cancelledBannerText}>
            Cancelled{item.cancel_reason ? `: ${item.cancel_reason}` : ''}
          </Text>
          {item.cancelled_date && (
            <Text style={styles.cancelledBannerDate}>
              {new Date(item.cancelled_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}

      {/* Collapsible Status Info - shows when picked, shipped, or cancelled */}
      {hasStatusInfo && (
        <TouchableOpacity
          style={styles.statusInfoToggle}
          onPress={() => setShowDetails(!showDetails)}
          activeOpacity={0.7}
        >
          <View style={styles.statusBadges}>
            {pickedQty > 0 && (
              <View style={styles.statusBadgePicked}>
                <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                <Text style={styles.statusBadgeText}>Picked</Text>
              </View>
            )}
            {isShipped && (
              <View style={styles.statusBadgeShipped}>
                <Ionicons name="checkmark-done-circle" size={12} color="#9C27B0" />
                <Text style={styles.statusBadgeTextShipped}>Shipped</Text>
              </View>
            )}
            {isCancelled && (
              <View style={styles.statusBadgeCancelled}>
                <Ionicons name="close-circle" size={12} color="#D32F2F" />
                <Text style={styles.statusBadgeTextCancelled}>Cancelled</Text>
              </View>
            )}
          </View>
          <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
        </TouchableOpacity>
      )}

      {/* Expanded Status Details */}
      {hasStatusInfo && showDetails && (
        <View style={styles.statusDetailsExpanded}>
          {pickedQty > 0 && (
            <View style={styles.statusDetailRow}>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
              <Text style={styles.statusDetailText}>
                Picked: {pickedQty} by {item.pick_confirm_by || item.picker_name || 'Unknown'}
              </Text>
              <Text style={styles.statusDetailDate}>
                {item.pick_confirm_date ? new Date(item.pick_confirm_date).toLocaleDateString() : ''}
              </Text>
            </View>
          )}
          {isShipped && (
            <View style={styles.statusDetailRow}>
              <Ionicons name="checkmark-done-circle" size={14} color="#9C27B0" />
              <Text style={styles.statusDetailText}>Shipped</Text>
              <Text style={styles.statusDetailDate}>
                {item.shipped_date ? new Date(item.shipped_date).toLocaleDateString() : ''}
              </Text>
            </View>
          )}
          {isCancelled && (
            <View style={styles.statusDetailRow}>
              <Ionicons name="close-circle" size={14} color="#D32F2F" />
              <Text style={styles.statusDetailText}>
                Cancelled{item.cancelled_by ? ` by ${item.cancelled_by}` : ''}
                {item.cancel_reason ? ` - ${item.cancel_reason}` : ''}
              </Text>
              <Text style={styles.statusDetailDate}>
                {item.cancelled_date ? new Date(item.cancelled_date).toLocaleDateString() : ''}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Lots & Locators Modal Component
const LotsLocatorsModal = ({ visible, onClose, lines }) => {
  const [activeTab, setActiveTab] = useState('lots'); // 'lots' | 'locators'
  const [lotsData, setLotsData] = useState({}); // { itemNumber: { lots: [], loading, error } }
  const [loadingAll, setLoadingAll] = useState(false);

  // Get unique items from lines
  const uniqueItems = [];
  const seen = new Set();
  (lines || []).forEach(line => {
    const itemNum = line.item_number || '';
    if (itemNum && !seen.has(itemNum)) {
      seen.add(itemNum);
      uniqueItems.push({
        itemNumber: itemNum,
        description: line.description || '',
        lotNumber: line.lot_number || '',
        lotExpiryDate: line.lot_expiry_date || '',
        qty: line.qty || 0,
        subinventory: line.subinventory_code || 'DUTY PAID',
      });
    }
  });

  // Fetch all lots when modal opens
  useEffect(() => {
    if (visible && uniqueItems.length > 0 && Object.keys(lotsData).length === 0) {
      fetchAllLots();
    }
  }, [visible]);

  const fetchAllLots = async () => {
    setLoadingAll(true);
    const results = {};

    for (const item of uniqueItems) {
      results[item.itemNumber] = { lots: [], loading: true, error: null };
      setLotsData({ ...results });

      try {
        const onhandResult = await fetchItemOnhand('GIC', item.subinventory, item.itemNumber);
        if (onhandResult.success && onhandResult.items?.length > 0) {
          const firstOnhand = onhandResult.items[0];
          if (firstOnhand.lotsHref) {
            const lotsResult = await fetchItemLots(firstOnhand.lotsHref);
            if (lotsResult.success && lotsResult.lots) {
              results[item.itemNumber] = { lots: lotsResult.lots, loading: false, error: null };
            } else {
              results[item.itemNumber] = { lots: [], loading: false, error: lotsResult.error || 'No lots' };
            }
          } else {
            results[item.itemNumber] = { lots: [], loading: false, error: 'No lots link' };
          }
        } else {
          results[item.itemNumber] = { lots: [], loading: false, error: 'No onhand data' };
        }
      } catch (error) {
        results[item.itemNumber] = { lots: [], loading: false, error: error.message };
      }
      setLotsData({ ...results });
    }
    setLoadingAll(false);
  };

  const handleClose = () => {
    setLotsData({});
    onClose();
  };

  // Warehouse locator data (simulated Line-Rack-Bin grid)
  const AISLES = ['A', 'B', 'C', 'D'];
  const RACKS = [1, 2, 3, 4, 5];
  const BINS = [1, 2, 3];

  // Assign random locators to order items for visual demo
  const itemLocators = {};
  uniqueItems.forEach((item, idx) => {
    const aisle = AISLES[idx % AISLES.length];
    const rack = RACKS[(idx * 2) % RACKS.length];
    const bin = BINS[idx % BINS.length];
    const locator = `${aisle}-${rack}-${bin}`;
    itemLocators[locator] = item;
  });

  // Render Lots Tab
  const renderLotsTab = () => (
    <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      {loadingAll && uniqueItems.length > 0 && Object.keys(lotsData).length === 0 && (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={{ color: '#666', marginTop: 8 }}>Fetching lots for all items...</Text>
        </View>
      )}
      {uniqueItems.map((item, index) => {
        const itemLots = lotsData[item.itemNumber];
        return (
          <View key={item.itemNumber} style={llStyles.itemSection}>
            {/* Item Header */}
            <View style={llStyles.itemHeader}>
              <View style={{ flex: 1 }}>
                <Text style={llStyles.itemNumber}>{item.itemNumber}</Text>
                <Text style={llStyles.itemDesc} numberOfLines={1}>{item.description}</Text>
              </View>
              <View style={llStyles.itemQtyBadge}>
                <Text style={llStyles.itemQtyText}>Qty: {item.qty}</Text>
              </View>
            </View>

            {/* Order Lot Info */}
            {item.lotNumber ? (
              <View style={llStyles.orderLotRow}>
                <Ionicons name="bookmark" size={12} color="#1565C0" />
                <Text style={llStyles.orderLotText}>
                  Order Lot: {item.lotNumber}
                  {item.lotExpiryDate ? ` | Exp: ${new Date(item.lotExpiryDate).toLocaleDateString()}` : ''}
                  {item.lotExpiryDate ? (() => {
                    const d = getDaysToExpiry(item.lotExpiryDate);
                    return d !== null ? ` (${d}d)` : '';
                  })() : ''}
                </Text>
              </View>
            ) : null}

            {/* Lots Table */}
            {itemLots?.loading ? (
              <View style={{ padding: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1565C0" />
              </View>
            ) : itemLots?.error ? (
              <Text style={llStyles.errorText}>{itemLots.error}</Text>
            ) : itemLots?.lots?.length > 0 ? (
              <View style={llStyles.tableContainer}>
                {/* Table Header */}
                <View style={llStyles.tableHeaderRow}>
                  <Text style={[llStyles.tableHeaderCell, { flex: 2 }]}>Lot Number</Text>
                  <Text style={[llStyles.tableHeaderCell, { flex: 1 }]}>Qty</Text>
                  <Text style={[llStyles.tableHeaderCell, { flex: 1.5 }]}>Expiry</Text>
                  <Text style={[llStyles.tableHeaderCell, { flex: 1 }]}>Days</Text>
                </View>
                {/* Table Rows */}
                {itemLots.lots.map((lot, lotIdx) => {
                  const daysLeft = getDaysToExpiry(lot.expirationDate);
                  const expiryColor = getExpiryColor(daysLeft);
                  const isOrderLot = lot.lotNumber === item.lotNumber;
                  return (
                    <View key={lotIdx} style={[
                      llStyles.tableRow,
                      isOrderLot && llStyles.tableRowHighlight,
                      lotIdx % 2 === 0 && { backgroundColor: '#FAFAFA' },
                    ]}>
                      <View style={[{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        {isOrderLot && <Ionicons name="checkmark-circle" size={12} color="#1565C0" />}
                        <Text style={[llStyles.tableCell, isOrderLot && { fontWeight: '700', color: '#1565C0' }]} numberOfLines={1}>
                          {lot.lotNumber}
                        </Text>
                      </View>
                      <Text style={[llStyles.tableCell, { flex: 1 }]}>{lot.quantity || '-'}</Text>
                      <Text style={[llStyles.tableCell, { flex: 1.5, fontSize: 10 }]}>
                        {lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString() : '-'}
                      </Text>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        {daysLeft !== null && (
                          <Ionicons
                            name={daysLeft < 30 ? 'warning' : 'time-outline'}
                            size={10}
                            color={expiryColor}
                          />
                        )}
                        <Text style={[llStyles.tableCell, { color: expiryColor, fontWeight: '600' }]}>
                          {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`) : '-'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : !itemLots ? (
              <View style={{ padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#999', fontSize: 12 }}>Waiting...</Text>
              </View>
            ) : (
              <Text style={llStyles.errorText}>No lots available</Text>
            )}
          </View>
        );
      })}
      {uniqueItems.length === 0 && (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Ionicons name="cube-outline" size={48} color="#CCC" />
          <Text style={{ color: '#999', marginTop: 8 }}>No items to show</Text>
        </View>
      )}
    </ScrollView>
  );

  // Render Locators Tab - Visual warehouse grid
  const renderLocatorsTab = () => (
    <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      {/* Legend */}
      <View style={llStyles.locLegend}>
        <View style={llStyles.locLegendItem}>
          <View style={[llStyles.locLegendDot, { backgroundColor: '#E3F2FD' }]} />
          <Text style={llStyles.locLegendText}>Empty</Text>
        </View>
        <View style={llStyles.locLegendItem}>
          <View style={[llStyles.locLegendDot, { backgroundColor: '#1565C0' }]} />
          <Text style={llStyles.locLegendText}>Order Item</Text>
        </View>
        <View style={llStyles.locLegendItem}>
          <View style={[llStyles.locLegendDot, { backgroundColor: '#E0E0E0' }]} />
          <Text style={llStyles.locLegendText}>Occupied</Text>
        </View>
      </View>

      {/* Warehouse Grid by Aisle */}
      {AISLES.map(aisle => (
        <View key={aisle} style={llStyles.aisleSection}>
          <View style={llStyles.aisleHeader}>
            <View style={llStyles.aisleBadge}>
              <Text style={llStyles.aisleBadgeText}>Aisle {aisle}</Text>
            </View>
          </View>
          {/* Rack labels */}
          <View style={llStyles.rackLabelsRow}>
            <View style={{ width: 30 }} />
            {RACKS.map(rack => (
              <View key={rack} style={llStyles.rackLabel}>
                <Text style={llStyles.rackLabelText}>R{rack}</Text>
              </View>
            ))}
          </View>
          {/* Bins */}
          {BINS.map(bin => (
            <View key={bin} style={llStyles.binRow}>
              <Text style={llStyles.binLabel}>B{bin}</Text>
              {RACKS.map(rack => {
                const locator = `${aisle}-${rack}-${bin}`;
                const assignedItem = itemLocators[locator];
                // Simulate some random occupied bins
                const isRandomOccupied = !assignedItem && ((aisle.charCodeAt(0) + rack + bin) % 3 === 0);
                return (
                  <TouchableOpacity
                    key={rack}
                    style={[
                      llStyles.binCell,
                      assignedItem && llStyles.binCellAssigned,
                      isRandomOccupied && llStyles.binCellOccupied,
                    ]}
                    activeOpacity={0.7}
                  >
                    {assignedItem ? (
                      <View style={llStyles.binCellContent}>
                        <Ionicons name="cube" size={14} color="#FFF" />
                        <Text style={llStyles.binCellItemText} numberOfLines={1}>{assignedItem.itemNumber}</Text>
                        <Text style={llStyles.binCellQtyText}>x{assignedItem.qty}</Text>
                      </View>
                    ) : isRandomOccupied ? (
                      <Ionicons name="cube-outline" size={14} color="#999" />
                    ) : null}
                    <Text style={[
                      llStyles.binCellLocator,
                      assignedItem && { color: 'rgba(255,255,255,0.7)' },
                    ]}>
                      {locator}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      ))}

      {/* Item-Locator mapping list */}
      <View style={llStyles.locMappingSection}>
        <Text style={llStyles.locMappingTitle}>Item Locator Assignments</Text>
        {uniqueItems.map((item, idx) => {
          const aisle = AISLES[idx % AISLES.length];
          const rack = RACKS[(idx * 2) % RACKS.length];
          const bin = BINS[idx % BINS.length];
          return (
            <View key={item.itemNumber} style={llStyles.locMappingRow}>
              <View style={llStyles.locMappingLocBadge}>
                <Text style={llStyles.locMappingLocText}>{aisle}-{rack}-{bin}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={llStyles.locMappingItemNum}>{item.itemNumber}</Text>
                <Text style={llStyles.locMappingItemDesc} numberOfLines={1}>{item.description}</Text>
              </View>
              <Text style={llStyles.locMappingQty}>x{item.qty}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.cpModalOverlay}>
        <View style={styles.cpModalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={llStyles.headerIcon}>
                <Text style={llStyles.headerIconText}>LL</Text>
              </View>
              <Text style={styles.modalTitle}>Lots & Locators</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={llStyles.tabContainer}>
            <TouchableOpacity
              style={[llStyles.tab, activeTab === 'lots' && llStyles.tabActive]}
              onPress={() => setActiveTab('lots')}
            >
              <Ionicons name="layers" size={16} color={activeTab === 'lots' ? '#1565C0' : '#999'} />
              <Text style={[llStyles.tabText, activeTab === 'lots' && llStyles.tabTextActive]}>Lots</Text>
              <View style={[llStyles.tabBadge, activeTab === 'lots' && { backgroundColor: '#1565C0' }]}>
                <Text style={llStyles.tabBadgeText}>{uniqueItems.length}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[llStyles.tab, activeTab === 'locators' && llStyles.tabActive]}
              onPress={() => setActiveTab('locators')}
            >
              <Ionicons name="grid" size={16} color={activeTab === 'locators' ? '#1565C0' : '#999'} />
              <Text style={[llStyles.tabText, activeTab === 'locators' && llStyles.tabTextActive]}>Locators</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'lots' ? renderLotsTab() : renderLocatorsTab()}
        </View>
      </View>
    </Modal>
  );
};

// Lots & Locators inline styles
const llStyles = StyleSheet.create({
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1565C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1565C0',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#1565C0',
  },
  tabBadge: {
    backgroundColor: '#CCC',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  // Lots Tab
  itemSection: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  itemNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  itemDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  itemQtyBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  itemQtyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565C0',
  },
  orderLotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E3F2FD',
  },
  orderLotText: {
    fontSize: 11,
    color: '#1565C0',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 11,
    color: '#999',
    padding: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tableContainer: {
    margin: 0,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1565C0',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEE',
  },
  tableRowHighlight: {
    backgroundColor: '#E3F2FD',
  },
  tableCell: {
    fontSize: 11,
    color: '#333',
  },
  // Locators Tab
  locLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  locLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  locLegendText: {
    fontSize: 10,
    color: '#666',
  },
  aisleSection: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  aisleHeader: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  aisleBadge: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  aisleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  rackLabelsRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  rackLabel: {
    flex: 1,
    alignItems: 'center',
  },
  rackLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#999',
  },
  binRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  binLabel: {
    width: 30,
    fontSize: 9,
    fontWeight: '700',
    color: '#999',
    textAlign: 'center',
  },
  binCell: {
    flex: 1,
    height: 56,
    margin: 2,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  binCellAssigned: {
    backgroundColor: '#1565C0',
    borderColor: '#0D47A1',
  },
  binCellOccupied: {
    backgroundColor: '#E0E0E0',
    borderColor: '#BDBDBD',
  },
  binCellContent: {
    alignItems: 'center',
  },
  binCellItemText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 1,
  },
  binCellQtyText: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  binCellLocator: {
    fontSize: 7,
    color: '#999',
    position: 'absolute',
    bottom: 2,
  },
  locMappingSection: {
    margin: 12,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  locMappingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  locMappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEE',
    gap: 10,
  },
  locMappingLocBadge: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  locMappingLocText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  locMappingItemNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  locMappingItemDesc: {
    fontSize: 10,
    color: '#999',
  },
  locMappingQty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
  },
});

// Bottom Toolbar Component
const BottomToolbar = ({ onHome, onBack, onRefresh, onLotsLocators, isRefreshing }) => (
  <View style={styles.bottomToolbar}>
    <TouchableOpacity style={styles.toolbarButton} onPress={onHome}>
      <Ionicons name="home" size={24} color="#1565C0" />
      <Text style={styles.toolbarButtonText}>Home</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolbarButton} onPress={onBack}>
      <Ionicons name="arrow-back" size={24} color="#666" />
      <Text style={styles.toolbarButtonText}>Back</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolbarButton} onPress={onLotsLocators}>
      <View style={styles.toolbarLLBadge}>
        <Text style={styles.toolbarLLText}>LL</Text>
      </View>
      <Text style={styles.toolbarButtonText}>Lots</Text>
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

// Tracks which orders have already been auto-synced this app session
const syncedOrdersThisSession = new Set();

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

  // Sales Ship Confirm Modal state
  const [salesShipModalVisible, setSalesShipModalVisible] = useState(false);

  // Lots & Locators Modal state
  const [lotsLocatorsVisible, setLotsLocatorsVisible] = useState(false);

  // QR Code Modal state
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // Cancel Order Line Modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelItem, setCancelItem] = useState(null);
  const [isCancellingLine, setIsCancellingLine] = useState(false);

  // Bulk Cancel (Mark for Cancel) state
  const [markedForCancel, setMarkedForCancel] = useState(new Set());
  const [bulkCancelModalVisible, setBulkCancelModalVisible] = useState(false);

  // BOGO sets: Map of item_number → partner item_number
  const [bogoSets, setBogoSets] = useState(new Map());
  // Items to pass to ConfirmPickModal as a BOGO set (null = single item)
  const [bogoSetConfirmItems, setBogoSetConfirmItems] = useState(null);

  // Fusion shipment lines (4th API): keyed by item code (uppercase)
  // Provides: orderLine, lineStatus, sourceOrderFulfillmentLineId, requestedQuantity
  const [fusionLineMap, setFusionLineMap] = useState(new Map());

  // Report Preview Modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const orderNumber = order?.order_number || order?.source_order_number || '';
  const pickerName = user?.PICKER_NAME || user?.picker_name || user?.username || '';

  const syncModeRef = useRef('sync'); // 'sync' | 'shipconfirm'

  const loadOrderLines = useCallback(async () => {
    if (!orderNumber) {
      setLoading(false);
      return null;
    }

    try {
      // Run APEX lines + Fusion shipment lines in parallel
      const [apexResult, fusionResult] = await Promise.all([
        fetchShipmentLines(orderNumber),
        fetchFusionShipmentLines(orderNumber, user?.instance),
      ]);

      // Build fusion map keyed by sourceOrderFulfillmentLineId
      const fMapById = new Map();
      if (fusionResult.success && fusionResult.items.length > 0) {
        fusionResult.items.forEach(fl => {
          if (fl.sourceOrderFulfillmentLineId) {
            fMapById.set(String(fl.sourceOrderFulfillmentLineId), fl);
          }
        });
        setFusionLineMap(fMapById);
        console.log('[Merge] Fusion lines:', fusionResult.items.map(fl => `id=${fl.sourceOrderFulfillmentLineId} orderLine=${fl.orderLine} item=${fl.item}`));
      }

      if (apexResult.success && apexResult.data?.items) {
        // Step 1: Match each APEX line to Fusion by fulfill_line_id → assign orderLine.
        const matchedFusionIds = new Set();
        const merged = apexResult.data.items.map(line => {
          const apexFulfillId = String(
            line.fulfill_line_id || line.FULFILL_LINE_ID ||
            line.FULFILLMENT_LINE_ID || line.fulfillment_line_id || ''
          ).trim();

          console.log(`[Merge] APEX line item=${line.item_number} fulfillId=${apexFulfillId}`);

          if (apexFulfillId && fMapById.has(apexFulfillId)) {
            const fl = fMapById.get(apexFulfillId);
            matchedFusionIds.add(apexFulfillId);
            console.log(`[Merge]   → matched Fusion orderLine=${fl.orderLine} lineStatus=${fl.lineStatus}`);
            return {
              ...line,
              order_line: fl.orderLine,
              line_status: fl.lineStatus,
              fulfill_line_id: apexFulfillId,
              fusion_fulfill_line_id: fl.sourceOrderFulfillmentLineId,
              fusion_requested_qty: fl.requestedQuantity,
            };
          }

          console.log(`[Merge]   → no Fusion match, no order_line assigned`);
          return line;
        });

        // Step 2: Fusion lines not matched to any APEX line → add as fusion-only.
        // Skip lines with no sourceOrderFulfillmentLineId (ambiguous).
        const fusionOnlyLines = [];
        fusionResult.items.forEach(fl => {
          const flId = String(fl.sourceOrderFulfillmentLineId || '').trim();
          if (!flId) return; // skip if no ID
          if (!matchedFusionIds.has(flId)) {
            console.log(`[Merge] Fusion-only: id=${flId} orderLine=${fl.orderLine} item=${fl.item}`);

            fusionOnlyLines.push({
              id: `fusion_${fl.sourceOrderFulfillmentLineId || fl.orderLine}`,
              delivery_detail_id: '',
              item_number: fl.item,
              description: fl.itemDescription,
              qty: fl.requestedQuantity,
              picked_qty: 0,
              pick_confirm_status: 'NO',
              shipped_status: 'NO',
              cancel_status: '',
              cancelled_status: 'NO',
              order_line: fl.orderLine,
              line_status: fl.lineStatus,
              fulfill_line_id: fl.sourceOrderFulfillmentLineId,
              fusion_fulfill_line_id: fl.sourceOrderFulfillmentLineId,
              fusion_only: true, // flag: came only from Fusion
            });
          }
        });

        const allLines = [...merged, ...fusionOnlyLines];
        setLines(allLines);
        return allLines.length;
      } else {
        setLines([]);
        return 0;
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error loading lines:', error);
      Alert.alert('Error', 'Failed to load order details');
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderNumber, user?.instance]);

  useEffect(() => {
    loadOrderLines();
  }, [loadOrderLines]);

  // Build BOGO set map after lines load
  useEffect(() => {
    if (lines.length === 0) return;
    (async () => {
      const allBogo = await getAllBogo();
      if (!allBogo || allBogo.length === 0) return;

      const itemCodes = new Set(lines.map(l => (l.item_number || '').toUpperCase()));
      const map = new Map();

      allBogo.forEach(bogo => {
        const main = (bogo.main_item_code || '').toUpperCase();
        const promo = (bogo.promo_item_code || '').toUpperCase();
        if (itemCodes.has(main) && itemCodes.has(promo)) {
          map.set(main, promo);
          map.set(promo, main); // bidirectional so promo knows its partner
        }
      });

      setBogoSets(map);
    })();
  }, [lines]);

  // Auto-run sync once per order per session, only for pending orders
  useEffect(() => {
    const isPending = order?.pick_confirm_status !== 'YES' && order?.shipped_status !== 'YES';
    if (!orderNumber || !isPending || syncedOrdersThisSession.has(orderNumber)) return;
    syncedOrdersThisSession.add(orderNumber);
    syncModeRef.current = 'auto';
    handleSync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrderLines();
  };

  // Fetch Fusion Order Lines - syncs lines from Fusion then refreshes
  const [fetchingFusionLines, setFetchingFusionLines] = useState(false);
  const [fusionRecordCount, setFusionRecordCount] = useState(null);

  // Sync Modal state
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncApiStatuses, setSyncApiStatuses] = useState([
    { key: 'callpickwave', label: 'Call Pick Wave', status: 'pending', message: '' },
    { key: 'getopenpicksbyorder', label: 'Get Open Picks', status: 'pending', message: '' },
    { key: 'getlotsforpicks', label: 'Get Lots for Picks', status: 'pending', message: '' },
    { key: 'fusionshipmentlines', label: 'Fusion Shipment Lines', status: 'pending', message: '' },
  ]);

  const handleShipConfirmWithSync = () => {
    setSalesShipModalVisible(true);
  };

  const handleSync = async () => {
    if (fetchingFusionLines) return;
    const beforeTotal = lines.length;
    const orgCode = order?.organization_name || 'GIC';
    const instanceName = await getInstance();
    const BASE = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT';

    setSyncApiStatuses([
      { key: 'callpickwave', label: 'Call Pick Wave', status: 'pending', message: '' },
      { key: 'getopenpicksbyorder', label: 'Get Open Picks', status: 'pending', message: '' },
      { key: 'getlotsforpicks', label: 'Get Lots for Picks', status: 'pending', message: '' },
      { key: 'fusionshipmentlines', label: 'Fusion Shipment Lines', status: 'pending', message: '' },
    ]);
    setSyncModalVisible(true);
    setFetchingFusionLines(true);

    const updateStatus = (key, status, message) => {
      setSyncApiStatuses(prev => prev.map(s => s.key === key ? { ...s, status, message } : s));
    };

    const safeJsonPost = async (label, url, body) => {
      console.log(`[Sync][${label}] → POST ${url}`, JSON.stringify(body));
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.log(`[Sync][${label}] ← HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`[Sync][${label}] Raw response (first 300 chars):`, text.slice(0, 300));
      if (!text || text.trim() === '') throw new Error('Empty response from server');
      if (text.trim().startsWith('<')) throw new Error('Server returned HTML error page — check APEX URL or connectivity');
      try {
        const json = JSON.parse(text);
        console.log(`[Sync][${label}] Parsed JSON:`, JSON.stringify(json, null, 2).slice(0, 500));
        return json;
      } catch (e) {
        throw new Error(`JSON parse failed: ${text.slice(0, 80)}`);
      }
    };

    // API 1: callpickwave
    try {
      updateStatus('callpickwave', 'loading', '');
      const url1 = `${BASE}/trip/callpickwave`;
      const data1 = await safeJsonPost('callpickwave', url1, { warehouse: orgCode, order_number: orderNumber, p_instance_name: instanceName });
      const msg1 = data1?.message || data1?.status || JSON.stringify(data1).slice(0, 80);
      updateStatus('callpickwave', 'success', msg1);
    } catch (e) {
      console.error('[Sync][callpickwave] Error:', e.message);
      updateStatus('callpickwave', 'error', e.message || 'Failed');
    }

    // API 2: getopenpicksbyorder
    try {
      updateStatus('getopenpicksbyorder', 'loading', '');
      const url2 = `${BASE}/trips/getopenpicksbyorder`;
      const data2 = await safeJsonPost('getopenpicksbyorder', url2, { organization_code: orgCode, order_number: orderNumber, p_instance_name: instanceName });
      const count2 = Array.isArray(data2?.items) ? data2.items.length : (data2?.count || data2?.recordcount || '');
      const msg2 = count2 !== '' ? `${count2} pick(s) found` : (data2?.message || JSON.stringify(data2).slice(0, 80));
      updateStatus('getopenpicksbyorder', 'success', msg2);
    } catch (e) {
      console.error('[Sync][getopenpicksbyorder] Error:', e.message);
      updateStatus('getopenpicksbyorder', 'error', e.message || 'Failed');
    }

    // API 3: getlotsforpicks
    try {
      updateStatus('getlotsforpicks', 'loading', '');
      const url3 = `${BASE}/trip/getlotsforpicks`;
      const data3 = await safeJsonPost('getlotsforpicks', url3, { source_order_number: orderNumber, p_instance_name: instanceName });
      const count3 = Array.isArray(data3?.items) ? data3.items.length : (data3?.count || data3?.recordcount || '');
      const msg3 = count3 !== '' ? `${count3} lot(s) found` : (data3?.message || JSON.stringify(data3).slice(0, 80));
      updateStatus('getlotsforpicks', 'success', msg3);
    } catch (e) {
      console.error('[Sync][getlotsforpicks] Error:', e.message);
      updateStatus('getlotsforpicks', 'error', e.message || 'Failed');
    }

    // API 4: Fusion shipmentLines (order line grouping + staged/backordered lines)
    try {
      updateStatus('fusionshipmentlines', 'loading', '');
      const fusionResult = await fetchFusionShipmentLines(orderNumber, instanceName);
      if (fusionResult.success) {
        const count4 = fusionResult.items.length;
        const staged = fusionResult.items.filter(i => i.lineStatus === 'Staged').length;
        const backordered = fusionResult.items.filter(i => i.lineStatus === 'Backordered').length;
        const parts = [`${count4} line(s)`];
        if (staged) parts.push(`${staged} staged`);
        if (backordered) parts.push(`${backordered} backordered`);
        updateStatus('fusionshipmentlines', 'success', parts.join(' · '));

        // Update fusion map so merged data is available immediately after loadOrderLines
        const fMap = new Map();
        fusionResult.items.forEach(fl => {
          const key = (fl.item || '').toUpperCase();
          if (!fMap.has(key) || fl.orderLine < fMap.get(key).orderLine) fMap.set(key, fl);
        });
        setFusionLineMap(fMap);
      } else {
        updateStatus('fusionshipmentlines', 'error', fusionResult.error || 'Failed');
      }
    } catch (e) {
      console.error('[Sync][fusionshipmentlines] Error:', e.message);
      updateStatus('fusionshipmentlines', 'error', e.message || 'Failed');
    }

    setFetchingFusionLines(false);
    const afterTotal = await loadOrderLines();

    if (syncModeRef.current === 'shipconfirm') {
      syncModeRef.current = 'sync';
      setSyncModalVisible(false);
      if (afterTotal !== null && afterTotal !== beforeTotal) {
        const diff = afterTotal - beforeTotal;
        Alert.alert(
          'New Items to Pick',
          `${diff > 0 ? diff + ' new item(s) were added.' : 'Item count changed.'} Please pick all items before confirming shipment.`,
          [{ text: 'OK' }]
        );
      } else {
        setSalesShipModalVisible(true);
      }
    } else if (syncModeRef.current === 'auto') {
      syncModeRef.current = 'sync';
      setSyncModalVisible(false);
    }
  };

  const handleFetchFusionOrderLines = async () => {
    if (fetchingFusionLines) return;
    setFetchingFusionLines(true);
    try {
      const currentInstance = await getInstance();
      const url = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT/trip/order/fetchfusionorderlines';
      const body = {
        P_INSTANCE_NAME: currentInstance,
        p_order_number: orderNumber,
      };
      console.log('[WMSOrderDetails] Fetch Fusion Order Lines:', url, JSON.stringify(body));
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const responseData = await response.json();
      console.log('[WMSOrderDetails] Fetch Fusion Order Lines response:', JSON.stringify(responseData, null, 2));

      // Parse nested JSON in data field
      let parsedData = responseData;
      if (responseData?.data && typeof responseData.data === 'string') {
        try { parsedData = JSON.parse(responseData.data); } catch (e) { parsedData = responseData; }
      }
      const recordCount = parsedData?.RECORDCOUNT || parsedData?.recordcount || null;
      if (recordCount !== null) {
        setFusionRecordCount(Number(recordCount));
      }
      // Refresh lines to get updated data
      await loadOrderLines();
    } catch (error) {
      console.error('[WMSOrderDetails] Error fetching fusion order lines:', error);
      Alert.alert('Error', 'Failed to fetch fusion order lines');
    } finally {
      setFetchingFusionLines(false);
    }
  };

  // Open report preview modal
  const handlePrintReport = () => {
    setReportModalVisible(true);
  };

  // Get report data for preview and sharing
  const getReportData = () => {
    const orderNum = order?.delivery_name || order?.order_number || 'N/A';
    const accountCode = order?.account_code || order?.ACCOUNT_CODE || 'N/A';
    const accountName = order?.account_name || order?.customer_name || '';
    const transType = order?.transaction_type || 'N/A';

    const pickedItems = lines.filter(item => {
      const pickedQty = parseInt(item.picked_qty) || 0;
      return pickedQty > 0;
    });

    const pendingItems = lines.filter(item => {
      const pickedQty = parseInt(item.picked_qty) || 0;
      return pickedQty === 0;
    });

    return {
      orderNum,
      accountCode,
      accountName,
      transType,
      pickedItems,
      pendingItems,
      totalLines: lines.length,
      pickedCount: pickedItems.length,
      pendingCount: pendingItems.length,
    };
  };

  // Share report as text
  const handleShareReport = async () => {
    try {
      const data = getReportData();

      let reportText = '═══════════════════════════════════\n';
      reportText += '        PICK SUMMARY REPORT\n';
      reportText += '═══════════════════════════════════\n\n';
      reportText += `Order #: ${data.orderNum}\n`;
      reportText += `Account: ${data.accountCode}`;
      if (data.accountName) reportText += ` - ${data.accountName}`;
      reportText += '\n';
      reportText += `Type: ${data.transType}\n`;
      reportText += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
      reportText += '\n───────────────────────────────────\n';
      reportText += 'PICKED ITEMS\n';
      reportText += '───────────────────────────────────\n\n';

      if (data.pickedItems.length === 0) {
        reportText += '(No items picked yet)\n';
      } else {
        data.pickedItems.forEach((item, index) => {
          const desc = item.description || item.item_number || 'Unknown';
          const pickedQty = parseInt(item.picked_qty) || 0;
          reportText += `${index + 1}. ${desc}\n`;
          reportText += `   Qty: ${pickedQty}\n\n`;
        });
      }

      reportText += '───────────────────────────────────\n';
      reportText += `Total: ${data.totalLines} | Picked: ${data.pickedCount} | Pending: ${data.pendingCount}\n`;
      reportText += '═══════════════════════════════════\n';

      await Share.share({
        message: reportText,
        title: `Pick Report - ${data.orderNum}`,
      });
    } catch (error) {
      if (error.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share report');
      }
    }
  };

  // Filter items based on search text
  const filteredLines = filterText.trim()
    ? lines.filter(item =>
        String(item.item_number || '').toLowerCase().includes(filterText.toLowerCase()) ||
        String(item.description || '').toLowerCase().includes(filterText.toLowerCase()) ||
        String(item.delivery_detail_id || '').toLowerCase().includes(filterText.toLowerCase()) ||
        String(item.barcode || '').toLowerCase().includes(filterText.toLowerCase())
      )
    : lines;

  // Group filtered lines by OrderLine prefix (e.g. "1.1","1.2","1.3" → group "1")
  // Falls back to BOGO grouping when no OrderLine data is available
  const displayGroups = useMemo(() => {
    // Group by order_line prefix (integer before first dot): "3", "3.1", "3.2" → group "3"
    const groupMap = new Map(); // prefix → [lines]
    const noLineItems = [];

    filteredLines.forEach(item => {
      const ol = item.order_line || '';
      if (!ol) { noLineItems.push(item); return; }
      const prefix = ol.split('.')[0];
      if (!groupMap.has(prefix)) groupMap.set(prefix, []);
      groupMap.get(prefix).push(item);
    });

    const groups = [];
    const sortedKeys = [...groupMap.keys()].sort((a, b) => parseInt(a) - parseInt(b));
    sortedKeys.forEach(prefix => {
      const members = groupMap.get(prefix);
      if (members.length > 1) {
        groups.push({ type: 'order_set', prefix, items: members });
      } else {
        groups.push({ type: 'single', item: members[0] });
      }
    });
    noLineItems.forEach(item => groups.push({ type: 'single', item }));

    console.log('[Groups]', groups.map(g =>
      g.type === 'order_set'
        ? `Group ${g.prefix}: [${g.items.map(i => `${i.item_number}(${i.order_line})`).join(', ')}]`
        : `Single: ${g.item?.item_number}(${g.item?.order_line || 'no-ol'})`
    ));

    return groups;
  }, [filteredLines]);

  // Get unique item suggestions for autocomplete
  const getFilterSuggestions = () => {
    if (!filterText.trim()) return [];
    const suggestions = lines
      .filter(item =>
        String(item.item_number || '').toLowerCase().includes(filterText.toLowerCase()) ||
        String(item.description || '').toLowerCase().includes(filterText.toLowerCase())
      )
      .slice(0, 5)
      .map(item => ({
        id: item.delivery_detail_id,
        label: item.item_number,
        description: item.description,
      }));
    return suggestions;
  };

  // Open confirm pick modal with item details (BOGO-aware)
  const handleConfirmPick = (item) => {
    const partnerCode = bogoSets.get((item.item_number || '').toUpperCase());
    const partner = partnerCode ? lines.find(l => (l.item_number || '').toUpperCase() === partnerCode) : null;
    const partnerPending = partner &&
      (parseInt(partner.picked_qty) || 0) === 0 &&
      partner.cancelled_status !== 'YES' &&
      (partner.cancel_status || '').toUpperCase() !== 'CANCELLED';

    setConfirmPickItem(item);
    setBogoSetConfirmItems(partnerPending ? [item, partner] : null);
    setConfirmPickModalVisible(true);
  };

  // Execute the confirm pick API call
  // silentMode: if true, returns result without showing alert (used for chained operations)
  // targetItem: override confirmPickItem for BOGO multi-item processing
  const executeConfirmPick = async (payload, silentMode = false, targetItem = null) => {
    setIsConfirmingPick(true);
    const activeItem = targetItem || confirmPickItem;
    try {
      console.log('[WMSOrderDetails] Confirm Pick Payload:', JSON.stringify(payload, null, 2));

      const result = await confirmPickPending(payload);

      if (result.success) {
        const confirmedItemId = getItemId(activeItem);
        setLines(prev =>
          prev.map(line =>
            getItemId(line) === confirmedItemId && confirmedItemId !== ''
              ? {
                  ...line,
                  picked_qty: activeItem.qty,
                  pick_confirm_status: 'YES',
                  pick_confirm_date: new Date().toISOString(),
                  pick_confirm_by: pickerName,
                }
              : line
          )
        );

        sendPickNotification({
          orderNumber: orderNumber,
          pickerName: pickerName,
          qty: activeItem?.qty,
          itemDescription: activeItem?.item_description || activeItem?.description || '',
        });

        if (silentMode) {
          return { success: true };
        } else {
          Alert.alert('Success', 'Pick confirmed successfully', [
            {
              text: 'OK',
              onPress: () => {
                setConfirmPickModalVisible(false);
                setConfirmPickItem(null);
              }
            }
          ]);
        }
      } else {
        if (silentMode) {
          return { success: false, error: result.error || 'Failed to confirm pick' };
        } else {
          Alert.alert('Error', result.error || 'Failed to confirm pick');
        }
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error confirming pick:', error);
      if (silentMode) {
        return { success: false, error: error.message || 'Unknown error' };
      } else {
        Alert.alert('Error', 'Failed to confirm pick: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setIsConfirmingPick(false);
    }
  };

  // Execute Lot-Based confirm pick: Step 1 = Fusion, returns handler for Step 2
  // targetItem: override confirmPickItem for BOGO multi-item processing
  const executeLotBasedConfirm = async (fusionPayload, targetItem = null) => {
    setIsConfirmingPick(true);
    const activeItem = targetItem || confirmPickItem;
    try {
      console.log('[WMSOrderDetails] Lot-Based Confirm - Fusion Payload:', JSON.stringify(fusionPayload, null, 2));

      const fusionResult = await fusionPickTransaction(fusionPayload);

      if (!fusionResult.success) {
        setIsConfirmingPick(false);
        return { success: false, error: fusionResult.error || 'Fusion pick transaction failed' };
      }

      return {
        success: true,
        data: fusionResult.data,
        updatePickStatus: async (updatePayload) => {
          try {
            console.log('[WMSOrderDetails] Lot-Based Confirm - Update Payload:', JSON.stringify(updatePayload, null, 2));

            const updateResult = await updatePickConfirmStatus(updatePayload);

            if (updateResult.success) {
              const confirmedItemId = getItemId(activeItem);
              setLines(prev =>
                prev.map(line =>
                  getItemId(line) === confirmedItemId && confirmedItemId !== ''
                    ? {
                        ...line,
                        picked_qty: activeItem.qty,
                        pick_confirm_status: 'YES',
                        pick_confirm_date: new Date().toISOString(),
                        pick_confirm_by: pickerName,
                      }
                    : line
                )
              );
              sendPickNotification({
                orderNumber: orderNumber,
                pickerName: pickerName,
                qty: activeItem?.qty,
                itemDescription: activeItem?.item_description || activeItem?.description || '',
              });
              return { success: true, data: updateResult.data };
            } else {
              return { success: false, error: updateResult.error || 'Update pick confirm status failed' };
            }
          } catch (error) {
            console.error('[WMSOrderDetails] Error updating pick confirm status:', error);
            return { success: false, error: error.message || 'Unknown error' };
          } finally {
            setIsConfirmingPick(false);
          }
        },
      };
    } catch (error) {
      console.error('[WMSOrderDetails] Error lot-based confirm:', error);
      setIsConfirmingPick(false);
      return { success: false, error: error.message || 'Unknown error' };
    }
  };

  const handleCancelPick = (item) => {
    setCancelItem(item);
    setCancelModalVisible(true);
  };

  // Toggle mark for cancel on a line
  const handleToggleMarkCancel = (item, groupItems) => {
    const itemId = getItemId(item);

    // Collect all IDs that should toggle together
    const idsToToggle = new Set();
    idsToToggle.add(itemId);

    // If part of an order_set group, include all siblings
    if (groupItems && groupItems.length > 1) {
      groupItems.forEach(gi => idsToToggle.add(getItemId(gi)));
    } else {
      // BOGO partner fallback
      const partnerCode = bogoSets.get((item.item_number || '').toUpperCase());
      const partnerLine = partnerCode ? lines.find(l => (l.item_number || '').toUpperCase() === partnerCode) : null;
      if (partnerLine) idsToToggle.add(getItemId(partnerLine));
    }

    setMarkedForCancel(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        idsToToggle.forEach(id => next.delete(id));
      } else {
        idsToToggle.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Execute cancel order line:
  // Store Orders: single POST to cancels2vlot (no Fusion PATCH)
  // Sales Orders: Step 1 = Fusion PATCH, Step 2 = APEX update cancel status
  const executeCancelOrderLine = async (item, cancelReason, setCurrentStep, setStep1Result, setStep2Result) => {
    setIsCancellingLine(true);
    setCancellingId(item.delivery_detail_id);
    const instanceName = await getInstance();
    const isStore = (order?.transaction_type || '').toLowerCase().includes('store');

    try {
      setCurrentStep('step1');

      if (isStore) {
        // Store Orders: POST /trip/cancels2vlot/:P_LID only
        const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';
        console.log('[WMSOrderDetails] Cancel Store Order (S2V Lot), linesId:', linesId);
        const result = await cancelS2VLot(linesId);
        setStep1Result({ success: result.success, data: result.data, error: result.error, status: result.status });

        // Update local state
        const cancelledItemId = getItemId(item);
        setLines(prev =>
          prev.map(line =>
            getItemId(line) === cancelledItemId && cancelledItemId !== ''
              ? {
                  ...line,
                  cancelled_status: 'YES',
                  cancel_status: 'CANCELLED',
                  cancelled_date: new Date().toISOString(),
                  cancelled_by: pickerName,
                  cancel_reason: cancelReason || 'OUT OF STOCK',
                }
              : line
          )
        );

        setCurrentStep('done');
        return { success: result.success, error: result.error };
      } else {
        // Sales Orders: Step 1 Fusion PATCH, Step 2 APEX update cancel status
        const fulfillLineId = item.fulfill_line_id || item.FULFILL_LINE_ID || '';
        const payload = {
          orderNumber: orderNumber,
          lines: [
            {
              FulfillLineId: fulfillLineId,
              CancelReason: cancelReason || 'OUT OF STOCK',
            },
          ],
        };

        console.log('[WMSOrderDetails] Cancel Order Line Payload:', JSON.stringify(payload, null, 2));

        const result = await cancelOrderLine(payload);
        setStep1Result({ success: result.success, data: result.data, error: result.error, status: result.status });

        // Step 2: Update APEX cancel status — always run even if Fusion failed
        setCurrentStep('step2');
        const transactionId = item.id || item.source_delivery_detail_id || item.delivery_detail_id || '';
        const apexResult = await updateCancelStatus(transactionId, instanceName);
        setStep2Result({ success: apexResult.success, data: apexResult.data, error: apexResult.error, status: apexResult.status });

        // Update local state — mark line as cancelled regardless of Fusion result
        const cancelledItemId = getItemId(item);
        setLines(prev =>
          prev.map(line =>
            getItemId(line) === cancelledItemId && cancelledItemId !== ''
              ? {
                  ...line,
                  cancelled_status: 'YES',
                  cancel_status: 'CANCELLED',
                  cancelled_date: new Date().toISOString(),
                  cancelled_by: pickerName,
                  cancel_reason: cancelReason || 'OUT OF STOCK',
                }
              : line
          )
        );

        setCurrentStep('done');
        return { success: apexResult.success, fusionSuccess: result.success };
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error cancelling order line:', error);
      setCurrentStep('done');
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setIsCancellingLine(false);
      setCancellingId(null);
    }
  };

  // Execute bulk cancel:
  // Store Orders: POST cancels2vlot per line (no Fusion PATCH)
  // Sales Orders: Step 1 = Fusion PATCH (all lines), Step 2 = APEX update per line
  const executeBulkCancel = async (items, cancelReason, setCurrentStep, setStep1Result, setStep2Result) => {
    setIsCancellingLine(true);
    const instanceName = await getInstance();
    const isStore = (order?.transaction_type || '').toLowerCase().includes('store');

    try {
      setCurrentStep('step1');

      if (isStore) {
        // Store Orders: call cancelS2VLot for each line
        const results = [];
        for (const item of items) {
          const linesId = item.lines_id || item.Lines_id || item.LINES_ID || '';
          console.log('[WMSOrderDetails] Bulk Cancel Store Order (S2V Lot), linesId:', linesId);
          const r = await cancelS2VLot(linesId);
          results.push({ linesId, ...r });
        }
        const allSuccess = results.every(r => r.success);
        setStep1Result({
          success: allSuccess,
          data: results,
          status: allSuccess ? 200 : results.find(r => !r.success)?.status,
          error: allSuccess ? null : results.find(r => !r.success)?.error || 'Some lines failed',
        });

        // Update local state
        const cancelledIds = new Set(items.map(item => getItemId(item)));
        setLines(prev =>
          prev.map(line =>
            cancelledIds.has(getItemId(line))
              ? {
                  ...line,
                  cancelled_status: 'YES',
                  cancel_status: 'CANCELLED',
                  cancelled_date: new Date().toISOString(),
                  cancelled_by: pickerName,
                  cancel_reason: cancelReason || 'OUT OF STOCK',
                }
              : line
          )
        );
        setMarkedForCancel(new Set());
        setCurrentStep('done');
        return { success: allSuccess };
      }

      // Sales Orders: Step 1 = Fusion PATCH (all lines in one call)
      const payload = {
        orderNumber: orderNumber,
        lines: items.map(item => ({
          FulfillLineId: item.fulfill_line_id || item.FULFILL_LINE_ID || '',
          CancelReason: cancelReason || 'OUT OF STOCK',
        })),
      };

      console.log('[WMSOrderDetails] Bulk Cancel Payload:', JSON.stringify(payload, null, 2));

      const result = await cancelOrderLine(payload);
      setStep1Result({ success: result.success, data: result.data, error: result.error, status: result.status });

      // Step 2: Update APEX cancel status for each line — always run even if Fusion failed
      setCurrentStep('step2');
      const apexResults = [];
      for (const item of items) {
        const transactionId = item.id || item.source_delivery_detail_id || item.delivery_detail_id || '';
        const apexResult = await updateCancelStatus(transactionId, instanceName);
        apexResults.push({ transactionId, ...apexResult });
      }
      const allApexSuccess = apexResults.every(r => r.success);
      setStep2Result({
        success: allApexSuccess,
        data: apexResults,
        status: allApexSuccess ? 200 : apexResults.find(r => !r.success)?.status,
        error: allApexSuccess ? null : 'Some APEX updates failed',
      });

      // Update local state to mark all items as cancelled regardless of Fusion result
      const cancelledIds = new Set(items.map(item => getItemId(item)));
      setLines(prev =>
        prev.map(line =>
          cancelledIds.has(getItemId(line))
            ? {
                ...line,
                cancelled_status: 'YES',
                cancel_status: 'CANCELLED',
                cancelled_date: new Date().toISOString(),
                cancelled_by: pickerName,
                cancel_reason: cancelReason || 'OUT OF STOCK',
              }
            : line
        )
      );
      // Clear marked items
      setMarkedForCancel(new Set());

      setCurrentStep('done');
      return { success: allApexSuccess, fusionSuccess: result.success };
    } catch (error) {
      console.error('[WMSOrderDetails] Error bulk cancelling order lines:', error);
      setCurrentStep('done');
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setIsCancellingLine(false);
    }
  };

  // Handle Ship Confirm
  // silentMode: if true, returns result without showing modal (used for chained operations)
  const handleShipConfirm = async (item, linesId, silentMode = false) => {
    setShippingId(item.delivery_detail_id);

    if (!silentMode) {
      setApiResponseTitle('Ship Confirm');
      setApiResponseLoading(true);
      setApiResponse(null);
      setApiResponseSuccess(false);
      setApiResponseModalVisible(true);
    }

    try {
      // Debug: Log all item fields to find the correct Lines_id field
      console.log('[WMSOrderDetails] Ship Confirm - Item keys:', Object.keys(item));
      console.log('[WMSOrderDetails] Ship Confirm - Full item:', JSON.stringify(item, null, 2));
      console.log('[WMSOrderDetails] Ship Confirm - Extracted Lines_id:', linesId);

      const result = await shipConfirm(linesId);

      if (!silentMode) {
        setApiResponseLoading(false);
        setApiResponse(result.data || { error: result.error });
        setApiResponseSuccess(result.success);
      }

      if (result.success) {
        // Update local state to reflect shipped status
        const itemId = getItemId(item);
        setLines(prev =>
          prev.map(line =>
            getItemId(line) === itemId && itemId !== ''
              ? {
                  ...line,
                  shipped_status: 'YES',
                  shipped_date: new Date().toISOString(),
                }
              : line
          )
        );

        // Fire-and-forget ship notification
        sendShipNotification({
          orderNumber,
          pickerName,
          itemCount: 1,
        });
      }

      if (silentMode) {
        return { success: result.success, error: result.error };
      }
    } catch (error) {
      console.error('[WMSOrderDetails] Error ship confirm:', error);
      if (!silentMode) {
        setApiResponseLoading(false);
        setApiResponse({ error: error.message || 'Unknown error' });
        setApiResponseSuccess(false);
      }
      if (silentMode) {
        return { success: false, error: error.message || 'Unknown error' };
      }
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
        const instanceName = await getInstance();
        const finalResult = await processS2VShipment(orderNumber, instanceName);

        if (finalResult.success) {
          setBulkFinalStatus('success');
          console.log('[WMSOrderDetails] S2V shipment processed successfully:', finalResult.data);

          // Fire-and-forget ship notification for entire order
          sendShipNotification({
            orderNumber,
            pickerName,
            itemCount: pickedItems.length,
          });
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
    // Pending: picked_qty = 0 and not cancelled; Picked: picked_qty > 0 and not shipped and not cancelled
    pendingLines: lines.filter(l => (parseInt(l.picked_qty) || 0) === 0 && l.cancelled_status !== 'YES' && (l.cancel_status || '').toUpperCase() !== 'CANCELLED' && (l.cancel_status || '').toUpperCase() !== 'YES' && !/^cancel/i.test(l.line_status || '')).length,
    pickedLines: lines.filter(l => (parseInt(l.picked_qty) || 0) > 0 && l.shipped_status !== 'YES' && l.cancelled_status !== 'YES' && (l.cancel_status || '').toUpperCase() !== 'CANCELLED' && (l.cancel_status || '').toUpperCase() !== 'YES' && !/^cancel/i.test(l.line_status || '')).length,
    shippedLines: lines.filter(l => l.shipped_status === 'YES' && l.cancelled_status !== 'YES' && (l.cancel_status || '').toUpperCase() !== 'CANCELLED' && (l.cancel_status || '').toUpperCase() !== 'YES' && !/^cancel/i.test(l.line_status || '')).length,
    cancelledLines: lines.filter(l => l.cancelled_status === 'YES' || (l.cancel_status || '').toUpperCase() === 'CANCELLED' || (l.cancel_status || '').toUpperCase() === 'YES' || /^cancel/i.test(l.line_status || '')).length,
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
          setBogoSetConfirmItems(null);
        }}
        onConfirm={executeConfirmPick}
        onLotBasedConfirm={executeLotBasedConfirm}
        onShipConfirm={handleShipConfirm}
        item={confirmPickItem}
        order={order}
        pickerName={pickerName}
        instance={user?.instance || 'TEST'}
        isProcessing={isConfirmingPick}
        transactionType={order?.transaction_type}
        bogoSetItems={bogoSetConfirmItems}
      />

      {/* Cancel Order Line Modal (single line - legacy) */}
      <CancelOrderModal
        visible={cancelModalVisible}
        onClose={() => {
          setCancelModalVisible(false);
          setCancelItem(null);
        }}
        onConfirm={executeCancelOrderLine}
        item={cancelItem}
        order={order}
        instance={user?.instance || 'TEST'}
        isProcessing={isCancellingLine}
        transactionType={order?.transaction_type}
      />

      {/* Bulk Cancel Modal - cancel all marked lines */}
      <BulkCancelModal
        visible={bulkCancelModalVisible}
        onClose={() => setBulkCancelModalVisible(false)}
        markedItems={lines.filter(l => markedForCancel.has(getItemId(l)))}
        order={order}
        instance={user?.instance || 'TEST'}
        onExecuteBulkCancel={executeBulkCancel}
        isProcessing={isCancellingLine}
        transactionType={order?.transaction_type}
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

      {/* Sales Ship Confirm Modal - 3-step for Sales Orders */}
      <SalesShipConfirmModal
        visible={salesShipModalVisible}
        onClose={() => setSalesShipModalVisible(false)}
        order={order}
        instance={order?.instance}
        onProcess={(result) => {
          if (result?.success) {
            // Refresh lines after successful ship confirm
            loadOrderLines();

            // Fire-and-forget ship notification
            sendShipNotification({
              orderNumber,
              pickerName,
              itemCount: result?.itemCount || undefined,
            });
          }
        }}
      />

      {/* QR Code Print Modal */}
      <QRCodePrintModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        order={order}
        pickerName={pickerName}
      />

      {/* Report Preview Modal */}
      <Modal visible={reportModalVisible} animationType="slide" transparent>
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContainer}>
            {/* Header */}
            <View style={styles.reportModalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="document-text" size={24} color="#1565C0" />
                <Text style={styles.modalTitle}>Pick Summary Report</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Report Content */}
            <ScrollView style={styles.reportContent} showsVerticalScrollIndicator={false}>
              {/* Order Header Info */}
              <View style={styles.reportHeaderSection}>
                <View style={styles.reportHeaderRow}>
                  <Text style={styles.reportHeaderLabel}>Order #</Text>
                  <Text style={styles.reportHeaderValue}>{getReportData().orderNum}</Text>
                </View>
                <View style={styles.reportHeaderRow}>
                  <Text style={styles.reportHeaderLabel}>Account</Text>
                  <Text style={styles.reportHeaderValue}>
                    {getReportData().accountCode}
                    {getReportData().accountName ? ` - ${getReportData().accountName}` : ''}
                  </Text>
                </View>
                <View style={styles.reportHeaderRow}>
                  <Text style={styles.reportHeaderLabel}>Type</Text>
                  <Text style={styles.reportHeaderValue}>{getReportData().transType}</Text>
                </View>
              </View>

              {/* Summary Stats */}
              <View style={styles.reportStatsRow}>
                <View style={styles.reportStatBox}>
                  <Text style={styles.reportStatValue}>{getReportData().totalLines}</Text>
                  <Text style={styles.reportStatLabel}>Total</Text>
                </View>
                <View style={[styles.reportStatBox, { borderColor: '#4CAF50' }]}>
                  <Text style={[styles.reportStatValue, { color: '#4CAF50' }]}>{getReportData().pickedCount}</Text>
                  <Text style={styles.reportStatLabel}>Picked</Text>
                </View>
                <View style={[styles.reportStatBox, { borderColor: '#FF9800' }]}>
                  <Text style={[styles.reportStatValue, { color: '#FF9800' }]}>{getReportData().pendingCount}</Text>
                  <Text style={styles.reportStatLabel}>Pending</Text>
                </View>
              </View>

              {/* Picked Items List */}
              <View style={styles.reportSection}>
                <Text style={styles.reportSectionTitle}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" /> Picked Items
                </Text>
                {getReportData().pickedItems.length === 0 ? (
                  <Text style={styles.reportEmptyText}>No items picked yet</Text>
                ) : (
                  getReportData().pickedItems.map((item, index) => (
                    <View key={`picked-${index}`} style={styles.reportItemRow}>
                      <Text style={styles.reportItemNum}>{index + 1}.</Text>
                      <View style={styles.reportItemDetails}>
                        <Text style={styles.reportItemDesc} numberOfLines={2}>
                          {item.description || item.item_number || 'Unknown'}
                        </Text>
                        <Text style={styles.reportItemCode}>{item.item_number}</Text>
                      </View>
                      <View style={styles.reportItemQty}>
                        <Text style={styles.reportItemQtyValue}>{parseInt(item.picked_qty) || 0}</Text>
                        <Text style={styles.reportItemQtyLabel}>Qty</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.reportActions}>
              <TouchableOpacity
                style={styles.reportCloseBtn}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.reportCloseBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportShareBtn}
                onPress={handleShareReport}
              >
                <Ionicons name="share-outline" size={20} color="#FFF" />
                <Text style={styles.reportShareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <LinearGradient colors={['#1565C0', '#0D47A1']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>{orderNumber || 'Order Details'}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {order?.account_name || order?.customer_name || 'Customer'} | {order?.transaction_type || 'Order'}{order?.instance_name ? ` | ${(order.instance_name).toUpperCase()}` : ''}
            </Text>
          </View>
        </View>
        {/* Header Action Buttons Row */}
        <View style={styles.headerActionsRow}>
          <TouchableOpacity style={styles.printQRButton} onPress={() => setQrModalVisible(true)}>
            <Ionicons name="qr-code" size={16} color="#FFF" />
            <Text style={styles.printQRButtonText}>Print QR</Text>
          </TouchableOpacity>
          {/* Sync Button */}
          <TouchableOpacity
            style={[styles.shipAllButton, { backgroundColor: '#0288D1' }]}
            onPress={handleSync}
            disabled={fetchingFusionLines}
          >
            {fetchingFusionLines ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="sync" size={16} color="#FFF" />
            )}
            <Text style={styles.shipAllButtonText}>Sync</Text>
          </TouchableOpacity>
          {/* Ship Confirm All Button - Only for Store transactions */}
          {summary.pickedLines > 0 && (order?.transaction_type || '').toLowerCase().includes('store') && (
            <TouchableOpacity style={styles.shipAllButton} onPress={handleOpenBulkShipConfirm}>
              <Ionicons name="airplane" size={16} color="#FFF" />
              <Text style={styles.shipAllButtonText}>Ship All</Text>
            </TouchableOpacity>
          )}
          {/* Sales Ship Confirm Button - Only for Sales Orders when all lines are pick confirmed and not yet shipped */}
          {lines.length > 0 && summary.pendingLines === 0 && summary.shippedLines < lines.length && !(order?.transaction_type || '').toLowerCase().includes('store') && (
            <TouchableOpacity style={[styles.shipAllButton, { backgroundColor: '#7B1FA2' }]} onPress={handleShipConfirmWithSync}>
              <Ionicons name="airplane" size={16} color="#FFF" />
              <Text style={styles.shipAllButtonText}>Ship Confirm</Text>
            </TouchableOpacity>
          )}
          {/* Cancel Marked Lines Button - show when lines are marked */}
          {markedForCancel.size > 0 && (
            <TouchableOpacity
              style={[styles.shipAllButton, { backgroundColor: '#D32F2F' }]}
              onPress={() => setBulkCancelModalVisible(true)}
            >
              <Ionicons name="close-circle" size={16} color="#FFF" />
              <Text style={styles.shipAllButtonText}>Cancel ({markedForCancel.size})</Text>
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
          {/* Order Info Card - Compact with Print Button */}
          <View style={styles.orderInfoCardCompact}>
            <View style={styles.orderInfoCompactRow}>
              <Text style={styles.orderInfoCompactItem}>
                <Text style={styles.orderInfoCompactLabel}>Lorry: </Text>
                {order?.lorry_number || 'N/A'}
              </Text>
              <Text style={styles.orderInfoCompactItem}>
                <Text style={styles.orderInfoCompactLabel}>Bay: </Text>
                {order?.loading_bay || 'N/A'}
              </Text>
              <Text style={styles.orderInfoCompactItem}>
                <Text style={styles.orderInfoCompactLabel}>Priority: </Text>
                {order?.order_priority || 'N/A'}
              </Text>
              {order?.instance_name ? (
                <View style={{ backgroundColor: (order.instance_name || '').toUpperCase() === 'PROD' ? '#E8F5E9' : '#FFF3E0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: (order.instance_name || '').toUpperCase() === 'PROD' ? '#2E7D32' : '#E65100' }}>
                    {(order.instance_name).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.printReportButton} onPress={handlePrintReport}>
              <Ionicons name="document-text-outline" size={18} color="#1565C0" />
              <Text style={styles.printReportButtonText}>Report</Text>
            </TouchableOpacity>
          </View>

          {/* Summary Stats */}
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryItem, { borderColor: '#1565C0' }]}>
              <Text style={[styles.summaryValue, { color: '#1565C0' }]}>
                {fusionRecordCount !== null ? fusionRecordCount : summary.totalLines}
              </Text>
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
            {summary.cancelledLines > 0 && (
              <View style={[styles.summaryItem, { borderColor: '#D32F2F' }]}>
                <Text style={[styles.summaryValue, { color: '#D32F2F' }]}>{summary.cancelledLines}</Text>
                <Text style={styles.summaryLabel}>Cancelled</Text>
              </View>
            )}
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
            displayGroups.map((group, index) => {
              // OrderLine-based set (primary grouping when Fusion data available)
              if (group.type === 'order_set') {
                const { prefix, items: setItems } = group;
                return (
                  <View key={`order-set-${prefix}-${index}`} style={styles.bogoSetWrapper}>
                    <View style={styles.bogoSetHeader}>
                      <Ionicons name="layers-outline" size={14} color="#E65100" />
                      <Text style={styles.bogoSetHeaderText}>
                        Order Line {prefix}
                        <Text style={{ fontWeight: '400', fontSize: 11 }}>  ({setItems.length} items)</Text>
                      </Text>
                    </View>
                    {setItems.map((setItem, si) => (
                      <React.Fragment key={`set-item-${getItemId(setItem) || si}`}>
                        {si > 0 && (
                          <View style={styles.bogoSetConnector}>
                            <View style={styles.bogoSetConnectorLine} />
                            <View style={[styles.bogoSetConnectorBadge, { backgroundColor: '#78909C' }]}>
                              <Text style={styles.bogoSetConnectorText}>{setItem.order_line}</Text>
                            </View>
                            <View style={styles.bogoSetConnectorLine} />
                          </View>
                        )}
                        <LineItemCard
                          item={setItem}
                          transactionType={order?.transaction_type}
                          onConfirmPick={handleConfirmPick}
                          onCancelPick={handleCancelPick}
                          onShipConfirm={handleShipConfirm}
                          onUndoPick={handleUndoPick}
                          onSearchLots={handleSearchLots}
                          isConfirming={confirmingId === setItem.delivery_detail_id}
                          isCancelling={cancellingId === setItem.delivery_detail_id}
                          isShipping={shippingId === setItem.delivery_detail_id}
                          isUndoing={undoingId === setItem.delivery_detail_id}
                          isMarkedForCancel={markedForCancel.has(getItemId(setItem))}
                          onToggleMarkCancel={(it) => handleToggleMarkCancel(it, setItems)}
                        />
                      </React.Fragment>
                    ))}
                  </View>
                );
              }

              // BOGO fallback set
              if (group.type === 'bogo_set') {
                const { main, promo } = group;
                return (
                  <View key={`bogo-set-${index}`} style={styles.bogoSetWrapper}>
                    <View style={styles.bogoSetHeader}>
                      <Ionicons name="gift-outline" size={14} color="#E65100" />
                      <Text style={styles.bogoSetHeaderText} numberOfLines={1}>
                        {main.description || main.item_number || 'BOGO SET'}
                      </Text>
                    </View>
                    <LineItemCard
                      item={main}
                      transactionType={order?.transaction_type}
                      onConfirmPick={handleConfirmPick}
                      onCancelPick={handleCancelPick}
                      onShipConfirm={handleShipConfirm}
                      onUndoPick={handleUndoPick}
                      onSearchLots={handleSearchLots}
                      isConfirming={confirmingId === main.delivery_detail_id}
                      isCancelling={cancellingId === main.delivery_detail_id}
                      isShipping={shippingId === main.delivery_detail_id}
                      isUndoing={undoingId === main.delivery_detail_id}
                      isMarkedForCancel={markedForCancel.has(getItemId(main))}
                      onToggleMarkCancel={handleToggleMarkCancel}
                    />
                    <View style={styles.bogoSetConnector}>
                      <View style={styles.bogoSetConnectorLine} />
                      <View style={styles.bogoSetConnectorBadge}>
                        <Text style={styles.bogoSetConnectorText}>+ PROMO</Text>
                      </View>
                      <View style={styles.bogoSetConnectorLine} />
                    </View>
                    <LineItemCard
                      item={promo}
                      transactionType={order?.transaction_type}
                      onConfirmPick={handleConfirmPick}
                      onCancelPick={handleCancelPick}
                      onShipConfirm={handleShipConfirm}
                      onUndoPick={handleUndoPick}
                      onSearchLots={handleSearchLots}
                      isConfirming={confirmingId === promo.delivery_detail_id}
                      isCancelling={cancellingId === promo.delivery_detail_id}
                      isShipping={shippingId === promo.delivery_detail_id}
                      isUndoing={undoingId === promo.delivery_detail_id}
                      isMarkedForCancel={markedForCancel.has(getItemId(promo))}
                      onToggleMarkCancel={handleToggleMarkCancel}
                    />
                  </View>
                );
              }

              // Single item
              const item = group.item;
              return (
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
                  isMarkedForCancel={markedForCancel.has(getItemId(item))}
                  onToggleMarkCancel={handleToggleMarkCancel}
                />
              );
            })
          )}
        </ScrollView>
      )}

      {/* Bottom Toolbar */}
      {/* Lots & Locators Modal */}
      <LotsLocatorsModal
        visible={lotsLocatorsVisible}
        onClose={() => setLotsLocatorsVisible(false)}
        lines={lines}
      />

      <BottomToolbar
        onHome={() => navigation.navigate('WMSHome')}
        onBack={() => navigation.goBack()}
        onLotsLocators={() => setLotsLocatorsVisible(true)}
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
      />

      {/* Sync Status Modal */}
      <Modal
        visible={syncModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!fetchingFusionLines) setSyncModalVisible(false); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 4 }}>Syncing Order</Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>{orderNumber}</Text>
            {syncApiStatuses.map((api) => (
              <View key={api.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: api.status === 'success' ? '#4CAF50' : api.status === 'error' ? '#D32F2F' : api.status === 'loading' ? '#0288D1' : '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 }}>
                  {api.status === 'loading' ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : api.status === 'success' ? (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  ) : api.status === 'error' ? (
                    <Ionicons name="close" size={16} color="#FFF" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={14} color="#999" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{api.label}</Text>
                  {api.message ? <Text style={{ fontSize: 12, color: api.status === 'error' ? '#D32F2F' : '#666', marginTop: 2 }} numberOfLines={2}>{api.message}</Text> : null}
                </View>
              </View>
            ))}
            {!fetchingFusionLines && (
              <TouchableOpacity
                style={{ marginTop: 8, backgroundColor: '#1565C0', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => setSyncModalVisible(false)}
              >
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 15 }}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  // Modal account row
  modalAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalAccountText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '500',
    flex: 1,
  },
  // BOGO pick section in ConfirmPickModal
  bogoPickSection: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#FF9800',
    borderRadius: 10,
    overflow: 'hidden',
  },
  bogoPickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bogoPickHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
  },
  bogoPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#FFE0B2',
    backgroundColor: '#FFF',
  },
  bogoPickRowChecked: {
    backgroundColor: '#FFF8F0',
  },
  bogoCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  bogoCheckboxChecked: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  bogoPickItemCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
  },
  bogoPickItemDesc: {
    fontSize: 12,
    color: '#555',
    marginTop: 1,
  },
  bogoPickItemQty: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  bogoSetWrapper: {
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 12,
    overflow: 'hidden',
  },
  bogoSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bogoSetHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
    letterSpacing: 0.5,
  },
  bogoSetConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bogoSetConnectorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFB74D',
  },
  bogoSetConnectorBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginHorizontal: 8,
  },
  bogoSetConnectorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
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
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingLeft: 40,
    gap: 8,
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
  // Compact Order Info Card with Print Button
  orderInfoCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  orderInfoCompactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 12,
  },
  orderInfoCompactItem: {
    fontSize: 12,
    color: '#333',
  },
  orderInfoCompactLabel: {
    color: '#666',
    fontWeight: '500',
  },
  printReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  printReportButtonText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
  },
  // Report Modal Styles
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  reportModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '100%',
    maxHeight: '95%',
    minHeight: '70%',
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  reportContent: {
    flex: 1,
    padding: 16,
  },
  reportHeaderSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  reportHeaderLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  reportHeaderValue: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  reportStatsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  reportStatBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  reportStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1565C0',
  },
  reportStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  reportSection: {
    marginBottom: 16,
  },
  reportSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  reportEmptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  reportItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  reportItemNum: {
    fontSize: 12,
    color: '#999',
    width: 24,
  },
  reportItemDetails: {
    flex: 1,
    marginRight: 8,
  },
  reportItemDesc: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  reportItemCode: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  reportItemQty: {
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reportItemQtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  reportItemQtyLabel: {
    fontSize: 10,
    color: '#666',
  },
  reportActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  reportCloseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  reportCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  reportShareBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#1565C0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportShareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
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
  highDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  highDiscountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
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
  markCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#D32F2F',
    gap: 6,
  },
  markCancelButtonActive: {
    backgroundColor: '#D32F2F',
    borderColor: '#D32F2F',
  },
  markCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D32F2F',
  },
  markCancelButtonTextActive: {
    color: '#FFF',
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
  // Picked/Shipped Info
  // Collapsible Status Toggle
  statusInfoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    marginTop: 6,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadgePicked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    gap: 3,
  },
  statusBadgeShipped: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    gap: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
  },
  statusBadgeTextShipped: {
    fontSize: 10,
    color: '#9C27B0',
    fontWeight: '600',
  },
  statusBadgeCancelled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    gap: 3,
  },
  statusBadgeTextCancelled: {
    fontSize: 10,
    color: '#D32F2F',
    fontWeight: '600',
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
  },
  cancelledBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#C62828',
    fontWeight: '600',
  },
  cancelledBannerDate: {
    fontSize: 11,
    color: '#999',
  },
  statusDetailsExpanded: {
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  statusDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  statusDetailText: {
    flex: 1,
    fontSize: 11,
    color: '#666',
  },
  statusDetailDate: {
    fontSize: 11,
    color: '#999',
  },
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
  toolbarLLBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1565C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarLLText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
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
  // Confirm Pick Modal - Full Height Overlay & Container
  cpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 4,
  },
  cpModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '100%',
    flex: 1,
    maxHeight: '98%',
    overflow: 'hidden',
  },
  // Confirm Pick Modal - Toggle & Info Styles
  cpToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 3,
  },
  cpToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  cpToggleBtnActive: {
    backgroundColor: '#1565C0',
  },
  cpToggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  cpToggleBtnTextActive: {
    color: '#FFF',
  },
  cpInfoSection: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
  },
  cpInfoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  cpInfoItem: {
    flex: 1,
  },
  cpInfoLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 3,
  },
  cpInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cpExpiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  cpExpiryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cpInstanceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cpInstanceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cpApiStepHeader: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  cpApiStepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1565C0',
  },
  // Step Indicator Styles
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  stepIndicator: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: '#1565C0',
  },
  stepCircleCompleted: {
    backgroundColor: '#4CAF50',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  stepNumberActive: {
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#1565C0',
    fontWeight: '600',
  },
  stepLine: {
    width: 50,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
    marginBottom: 18,
  },
  stepLineActive: {
    backgroundColor: '#4CAF50',
  },
  // Sequence Status Styles (for Pick & Ship progress)
  sequenceStatusContainer: {
    padding: 20,
    minHeight: 180,
  },
  sequenceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sequenceStatusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sequenceStatusCircleCompleted: {
    backgroundColor: '#4CAF50',
  },
  sequenceStatusCircleProcessing: {
    backgroundColor: '#1565C0',
  },
  sequenceStatusNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  sequenceStatusTextContainer: {
    flex: 1,
  },
  sequenceStatusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  sequenceStatusLabelCompleted: {
    color: '#4CAF50',
  },
  sequenceStatusLabelProcessing: {
    color: '#1565C0',
  },
  sequenceStatusSuccess: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 2,
  },
  sequenceStatusProcessing: {
    fontSize: 13,
    color: '#1565C0',
    marginTop: 2,
  },
  sequenceStatusLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginLeft: 19,
  },
  sequenceStatusLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  sequenceErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  sequenceErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#D32F2F',
    marginLeft: 8,
  },
  sequenceSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  sequenceSuccessText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 8,
    fontWeight: '500',
  },
  // Details Toggle Button
  detailsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginTop: 8,
  },
  detailsToggleText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginLeft: 6,
  },
  detailsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  technicalDetailsScroll: {
    maxHeight: 250,
    marginTop: 8,
  },
  technicalDetailsContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
  },
  // Ship Confirm Modal Button
  shipConfirmModalBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#9C27B0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Step Success Banner
  stepSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  stepSuccessText: {
    marginLeft: 12,
    flex: 1,
  },
  stepSuccessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  stepSuccessSubtitle: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  // Ship Info Container
  shipInfoContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  shipInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  shipInfoLabel: {
    fontSize: 13,
    color: '#666',
  },
  shipInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
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
  // Print Preview Styles
  printPreviewSection: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  printPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  printPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  printPreviewContent: {
    alignItems: 'center',
    padding: 12,
  },
  previewQRBox: {
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  printPreviewText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    lineHeight: 16,
  },
  qrPrintButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  qrPrintButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  qrPrintButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  qrCloseButton: {
    marginTop: 10,
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
  // Scanner styles for QR print
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1565C0',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  scannerCloseBtn: {
    padding: 4,
  },
  scannerCameraContainer: {
    flex: 1,
    position: 'relative',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  scannerCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#4CAF50',
  },
  scannerCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  scannerCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  scannerCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  scannerCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scannerHint: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 30,
    textAlign: 'center',
  },
  scannerCancelBtn: {
    backgroundColor: '#FF5252',
    padding: 16,
    alignItems: 'center',
  },
  scannerCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Log modal styles
  logModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  logModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  logContent: {
    padding: 12,
    maxHeight: 300,
  },
  logEntry: {
    marginBottom: 8,
  },
  logTimestamp: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  logMessage: {
    fontSize: 13,
    color: '#333',
    fontFamily: 'monospace',
  },
  logError: {
    color: '#D32F2F',
  },
  logSuccess: {
    color: '#388E3C',
  },
  logActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  logRetryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  logRetryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logCloseButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565C0',
    borderRadius: 8,
    padding: 12,
  },
  logCloseText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default WMSOrderDetailsScreen;
