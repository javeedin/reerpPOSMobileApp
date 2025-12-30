import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fetchOrderLineDetails } from '../services/tripService';
import SignaturePad from '../components/SignaturePad';

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
  { id: 'delivery', label: 'Delivery', icon: 'checkmark-done-outline' },
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

  // Delivery tab state
  const [deliveryDate, setDeliveryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [signature, setSignature] = useState(null);
  const [isDeliveryConfirmed, setIsDeliveryConfirmed] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const signatureRef = useRef(null);

  // Calculate verification status from actual line data
  const totalLines = lines.length;
  const verifiedLines = lines.filter(l => l.verified_qty > 0).length;
  const isFullyVerified = totalLines > 0 && verifiedLines === totalLines;
  const isPartiallyVerified = verifiedLines > 0 && verifiedLines < totalLines;

  // Delivery status
  const isDelivered = isDeliveryConfirmed;

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

  // Handle date change
  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDeliveryDate(selectedDate);
    }
  };

  // Clear signature
  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
    setSignature(null);
  };

  // Confirm delivery
  const handleConfirmDelivery = () => {
    if (!signature) {
      Alert.alert('Signature Required', 'Please capture customer signature before confirming delivery.');
      return;
    }

    Alert.alert(
      'Confirm Delivery',
      `Confirm delivery of order ${order.orderNumber}?\n\nDelivery Date: ${deliveryDate.toLocaleDateString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setIsDeliveryConfirmed(true);
            Alert.alert('Success', 'Order delivery confirmed!');
          },
        },
      ]
    );
  };

  // Generate delivery PDF
  const generateDeliveryPdf = async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Delivery Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #1B5E20; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { color: #1B5E20; margin: 0; font-size: 24px; }
          .header p { margin: 5px 0 0; color: #666; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; color: #1B5E20; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .label { color: #666; }
          .value { font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #1B5E20; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .signature-section { margin-top: 30px; border-top: 2px solid #1B5E20; padding-top: 20px; }
          .signature-box { text-align: center; }
          .signature-img { max-width: 300px; max-height: 150px; border: 1px solid #ddd; }
          .signature-label { margin-top: 5px; color: #666; font-size: 12px; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .status-delivered { background-color: #E8F5E9; color: #1B5E20; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Delivery Confirmation</h1>
          <p>Order #${order.orderNumber}</p>
          <span class="status-badge status-delivered">DELIVERED</span>
        </div>

        <div class="section">
          <div class="section-title">Customer Information</div>
          <div class="row"><span class="label">Customer:</span> <span class="value">${order.accountName || 'N/A'}</span></div>
          <div class="row"><span class="label">Account #:</span> <span class="value">${order.accountNumber || 'N/A'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Order Details</div>
          <div class="row"><span class="label">Order Date:</span> <span class="value">${order.orderDate || 'N/A'}</span></div>
          <div class="row"><span class="label">Order Type:</span> <span class="value">${order.orderType || 'N/A'}</span></div>
          <div class="row"><span class="label">Customer PO:</span> <span class="value">${order.customerPo || 'N/A'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Delivery Information</div>
          <div class="row"><span class="label">Delivery Date:</span> <span class="value">${deliveryDate.toLocaleDateString()}</span></div>
          <div class="row"><span class="label">Driver/Salesman:</span> <span class="value">${order.salesman || 'N/A'}</span></div>
          <div class="row"><span class="label">Lorry:</span> <span class="value">${order.lorry || 'N/A'}</span></div>
          <div class="row"><span class="label">Trip ID:</span> <span class="value">${tripId || 'N/A'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Order Lines (${lines.length} items)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((line, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${line.item || 'N/A'}</td>
                  <td>${line.description || 'N/A'}</td>
                  <td>${line.requested_quantity || 0}</td>
                  <td>${line.verified_qty || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <div class="section-title">Customer Signature</div>
            ${signature ? `<img src="${signature}" class="signature-img" />` : '<p>No signature captured</p>'}
            <div class="signature-label">
              Signed on: ${deliveryDate.toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div class="footer">
          <p>This document confirms the successful delivery of the above order.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
    return html;
  };

  // Handle print/PDF
  const handlePrintOrder = async () => {
    try {
      setGeneratingPdf(true);
      const html = await generateDeliveryPdf();
      await Print.printAsync({ html });
    } catch (error) {
      console.error('[TripOrderDetail] Print error:', error);
      Alert.alert('Error', 'Failed to print order');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Handle share PDF
  const handleSharePdf = async () => {
    try {
      setGeneratingPdf(true);
      const html = await generateDeliveryPdf();
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Delivery Confirmation - ${order.orderNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('[TripOrderDetail] Share error:', error);
      Alert.alert('Error', 'Failed to share PDF');
    } finally {
      setGeneratingPdf(false);
    }
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
            key={`${line.item}-${line.lot || ''}-${index}`}
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

  // Render Delivery Tab
  const renderDeliveryTab = () => (
    <View style={styles.deliveryContainer}>
      {/* Delivery Status Card */}
      {isDeliveryConfirmed && (
        <View style={[styles.card, { backgroundColor: THEME.success + '15', borderColor: THEME.success, borderWidth: 1 }]}>
          <View style={styles.deliveryConfirmedBanner}>
            <Ionicons name="checkmark-circle" size={32} color={THEME.success} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.cardTitle, { color: THEME.success }]}>Delivery Confirmed</Text>
              <Text style={styles.deliveryConfirmedDate}>
                {deliveryDate.toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Delivery Date Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="calendar" size={24} color={THEME.primary} />
          </View>
          <Text style={styles.cardTitle}>Delivery Date</Text>
        </View>

        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
          disabled={isDeliveryConfirmed}
        >
          <Text style={styles.datePickerText}>
            {deliveryDate.toLocaleDateString('en-GB', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {!isDeliveryConfirmed && (
            <Ionicons name="chevron-forward" size={20} color={THEME.textLight} />
          )}
        </TouchableOpacity>

        {showDatePicker && (
          Platform.OS === 'web' ? (
            <View style={styles.webDatePicker}>
              <input
                type="date"
                value={deliveryDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  setDeliveryDate(new Date(e.target.value));
                  setShowDatePicker(false);
                }}
                style={{
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: `1px solid ${THEME.primary}`,
                  width: '100%',
                }}
              />
            </View>
          ) : (
            <DateTimePicker
              value={deliveryDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )
        )}
      </View>

      {/* Signature Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="signature-freehand" size={24} color={THEME.primary} />
          </View>
          <Text style={styles.cardTitle}>Customer Signature</Text>
        </View>

        {signature ? (
          <View style={styles.signaturePreview}>
            <View style={styles.signatureImageContainer}>
              <Ionicons name="checkmark-circle" size={24} color={THEME.success} />
              <Text style={styles.signatureLabel}>Signature captured</Text>
            </View>
            {!isDeliveryConfirmed && (
              <View style={styles.signatureActions}>
                <TouchableOpacity
                  style={styles.signatureActionButton}
                  onPress={() => setShowSignatureModal(true)}
                >
                  <Ionicons name="create-outline" size={18} color={THEME.primary} />
                  <Text style={styles.signatureActionText}>Re-sign</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.signatureActionButton, { backgroundColor: THEME.error + '15' }]}
                  onPress={handleClearSignature}
                >
                  <Ionicons name="trash-outline" size={18} color={THEME.error} />
                  <Text style={[styles.signatureActionText, { color: THEME.error }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : !isDeliveryConfirmed ? (
          <TouchableOpacity
            style={styles.captureSignatureButton}
            onPress={() => setShowSignatureModal(true)}
          >
            <MaterialCommunityIcons name="signature-freehand" size={32} color={THEME.primary} />
            <Text style={styles.captureSignatureText}>Tap to capture signature</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noSignatureContainer}>
            <Ionicons name="alert-circle-outline" size={24} color={THEME.warning} />
            <Text style={styles.noSignatureText}>No signature captured</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.deliveryActions}>
        {!isDeliveryConfirmed ? (
          <TouchableOpacity
            style={[styles.deliveryButton, styles.confirmButton]}
            onPress={handleConfirmDelivery}
          >
            <LinearGradient
              colors={[THEME.success, THEME.accentLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
              <Text style={styles.buttonText}>Confirm Delivery</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.deliveryButton, styles.printButton]}
              onPress={handlePrintOrder}
              disabled={generatingPdf}
            >
              <View style={styles.outlineButton}>
                {generatingPdf ? (
                  <ActivityIndicator size="small" color={THEME.primary} />
                ) : (
                  <>
                    <Ionicons name="print-outline" size={22} color={THEME.primary} />
                    <Text style={[styles.buttonText, { color: THEME.primary }]}>Print Order</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deliveryButton, styles.shareButton]}
              onPress={handleSharePdf}
              disabled={generatingPdf}
            >
              <LinearGradient
                colors={[THEME.info, '#42A5F5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {generatingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Share PDF</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
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
        {activeTab === 'lines' && renderLinesTab()}
        {activeTab === 'info' && renderOrderInfoTab()}
        {activeTab === 'delivery' && renderDeliveryTab()}

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

      {/* Signature Modal */}
      <Modal
        visible={showSignatureModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.signatureModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customer Signature</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSignatureModal(false)}
              >
                <Ionicons name="close" size={24} color={THEME.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Please sign in the area below
            </Text>

            <View style={styles.signatureArea}>
              <SignaturePad
                ref={signatureRef}
                onSignatureChange={(sig) => setSignature(sig)}
                style={styles.modalSignaturePad}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalClearButton}
                onPress={handleClearSignature}
              >
                <Ionicons name="refresh-outline" size={20} color={THEME.error} />
                <Text style={styles.modalClearText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  !signature && styles.modalConfirmButtonDisabled
                ]}
                onPress={() => {
                  if (signature) {
                    setShowSignatureModal(false);
                  } else {
                    Alert.alert('Please Sign', 'Draw your signature before confirming');
                  }
                }}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.modalConfirmText}>Confirm Signature</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Delivery Tab
  deliveryContainer: {
    padding: 16,
    paddingTop: 8,
  },
  deliveryConfirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  deliveryConfirmedDate: {
    fontSize: 12,
    color: THEME.textLight,
    marginTop: 2,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.background,
    padding: 14,
    borderRadius: 10,
  },
  datePickerText: {
    fontSize: 15,
    color: THEME.text,
    fontWeight: '500',
  },
  webDatePicker: {
    marginTop: 12,
  },
  signatureContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  signaturePad: {
    height: 200,
    backgroundColor: '#FFFFFF',
  },
  signatureHint: {
    textAlign: 'center',
    color: THEME.textLight,
    fontSize: 12,
    marginTop: 8,
    paddingBottom: 8,
  },
  signaturePreview: {
    padding: 16,
    backgroundColor: THEME.background,
    borderRadius: 10,
    alignItems: 'center',
  },
  signatureImageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signatureLabel: {
    fontSize: 14,
    color: THEME.success,
    fontWeight: '500',
  },
  noSignatureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: THEME.warning + '15',
    borderRadius: 10,
    gap: 8,
  },
  noSignatureText: {
    fontSize: 14,
    color: THEME.warning,
  },
  clearSignatureButton: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.error + '15',
    borderRadius: 6,
  },
  clearSignatureText: {
    fontSize: 12,
    color: THEME.error,
    fontWeight: '600',
  },
  deliveryActions: {
    marginTop: 16,
    gap: 12,
  },
  deliveryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButton: {},
  printButton: {},
  shareButton: {},
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: THEME.primary,
    borderRadius: 12,
  },

  // Signature Capture Button
  captureSignatureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary + '10',
    borderWidth: 2,
    borderColor: THEME.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 30,
  },
  captureSignatureText: {
    marginTop: 8,
    fontSize: 14,
    color: THEME.primary,
    fontWeight: '500',
  },
  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  signatureActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.primary + '15',
    borderRadius: 8,
    gap: 6,
  },
  signatureActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.primary,
  },

  // Signature Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  signatureModal: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: THEME.textLight,
    marginBottom: 16,
  },
  signatureArea: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalSignaturePad: {
    height: 250,
    backgroundColor: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: THEME.error,
    borderRadius: 10,
    gap: 6,
  },
  modalClearText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.error,
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    gap: 6,
  },
  modalConfirmButtonDisabled: {
    backgroundColor: THEME.textLight,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TripOrderDetailScreen;
