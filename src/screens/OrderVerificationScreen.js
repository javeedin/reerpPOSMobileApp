import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateOrderVerification, fetchOrderLineDetails } from '../services/tripService';

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

// Line Item Card Component
const LineItemCard = ({ line, onVerify, isVerified }) => {
  const [verifiedQty, setVerifiedQty] = useState(
    line.verifiedQty !== null ? String(line.verifiedQty) : ''
  );
  const [localVerified, setLocalVerified] = useState(line.isVerified);

  const handleQuickVerify = () => {
    setVerifiedQty(String(line.shippedQty));
    setLocalVerified(true);
    onVerify(line.lineId, line.shippedQty);
  };

  const handleManualVerify = () => {
    const qty = parseInt(verifiedQty, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }
    setLocalVerified(true);
    onVerify(line.lineId, qty);
  };

  const getStatusColor = () => {
    if (!localVerified) return THEME.warning;
    const verified = parseInt(verifiedQty, 10) || 0;
    if (verified === line.shippedQty) return THEME.success;
    if (verified < line.shippedQty) return THEME.error;
    return THEME.warning;
  };

  const getStatusText = () => {
    if (!localVerified) return 'Pending';
    const verified = parseInt(verifiedQty, 10) || 0;
    if (verified === line.shippedQty) return 'Match';
    if (verified < line.shippedQty) return 'Short';
    return 'Over';
  };

  return (
    <View style={[styles.lineCard, localVerified && styles.lineCardVerified]}>
      <View style={styles.lineHeader}>
        <View style={styles.lineInfo}>
          <Text style={styles.lineItemNumber}>{line.itemNumber}</Text>
          <Text style={styles.lineItemDesc} numberOfLines={2}>{line.itemDesc}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      <View style={styles.lineQuantities}>
        <View style={styles.qtyBox}>
          <Text style={styles.qtyLabel}>Shipped</Text>
          <Text style={styles.qtyValue}>{line.shippedQty}</Text>
          <Text style={styles.qtyUnit}>{line.unit}</Text>
        </View>

        <View style={styles.qtyArrow}>
          <Ionicons name="arrow-forward" size={20} color={THEME.textLight} />
        </View>

        <View style={styles.qtyInputBox}>
          <Text style={styles.qtyLabel}>Verified</Text>
          <TextInput
            style={[
              styles.qtyInput,
              localVerified && {
                backgroundColor: getStatusColor() + '15',
                borderColor: getStatusColor(),
              },
            ]}
            value={verifiedQty}
            onChangeText={setVerifiedQty}
            keyboardType="numeric"
            placeholder="0"
            editable={!localVerified}
          />
        </View>
      </View>

      {!localVerified && (
        <View style={styles.lineActions}>
          <TouchableOpacity
            style={styles.quickVerifyButton}
            onPress={handleQuickVerify}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.quickVerifyText}>Match ({line.shippedQty})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualVerifyButton}
            onPress={handleManualVerify}
          >
            <Ionicons name="create" size={18} color={THEME.primary} />
            <Text style={styles.manualVerifyText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}

      {localVerified && (
        <View style={styles.verifiedBanner}>
          <Ionicons name="checkmark-done-circle" size={18} color={getStatusColor()} />
          <Text style={[styles.verifiedBannerText, { color: getStatusColor() }]}>
            Verified: {verifiedQty} {line.unit}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setLocalVerified(false);
              setVerifiedQty('');
              onVerify(line.lineId, null);
            }}
          >
            <Text style={styles.resetLink}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const OrderVerificationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { order, tripId, onComplete } = route.params;
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    loadOrderLines();
  }, []);

  const loadOrderLines = async () => {
    try {
      const result = await fetchOrderLineDetails(order.orderNumber);

      if (result.success && result.data?.items) {
        // Map API response to our line structure
        const mappedLines = result.data.items.map((item, index) => ({
          lineId: item.transaction_id || index + 1,
          itemNumber: item.item,
          itemDesc: item.description,
          unit: 'EA', // Default unit
          shippedQty: parseInt(item.picked_qty, 10) || parseInt(item.requested_quantity, 10) || 0,
          verifiedQty: item.verified_qty > 0 ? item.verified_qty : null,
          isVerified: item.verified_qty > 0,
          // Additional fields from API
          lot: item.lot,
          pickSlip: item.pick_slip,
          pickConfirmSt: item.pick_confirm_st,
        }));

        setLines(mappedLines);
      } else {
        Alert.alert('Error', result.error || 'Failed to load order items');
      }
    } catch (error) {
      console.error('[OrderVerification] Error loading lines:', error);
      Alert.alert('Error', 'Failed to load order items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLine = (lineId, verifiedQty) => {
    setLines(prev =>
      prev.map(line =>
        line.lineId === lineId
          ? { ...line, verifiedQty, isVerified: verifiedQty !== null }
          : line
      )
    );
  };

  const allLinesVerified = lines.every(line => line.isVerified);
  const verifiedCount = lines.filter(line => line.isVerified).length;

  const handleVerifyAll = () => {
    setLines(prev =>
      prev.map(line => ({
        ...line,
        verifiedQty: line.shippedQty,
        isVerified: true,
      }))
    );
  };

  const handleSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);

    try {
      // Calculate verification summary
      const summary = {
        orderNumber: order.orderNumber,
        totalLines: lines.length,
        verifiedLines: verifiedCount,
        matches: lines.filter(l => l.verifiedQty === l.shippedQty).length,
        shorts: lines.filter(l => l.verifiedQty < l.shippedQty).length,
        overs: lines.filter(l => l.verifiedQty > l.shippedQty).length,
        lines: lines.map(l => ({
          lineId: l.lineId,
          itemNumber: l.itemNumber,
          shippedQty: l.shippedQty,
          verifiedQty: l.verifiedQty,
        })),
      };

      // Save verification
      await updateOrderVerification(tripId, order.orderNumber, summary);

      // Notify parent
      if (onComplete) {
        onComplete(true);
      }

      Alert.alert(
        'Verification Complete',
        `Order ${order.orderNumber} has been verified.\n\nMatches: ${summary.matches}\nShorts: ${summary.shorts}\nOvers: ${summary.overs}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Loading order items...</Text>
      </View>
    );
  }

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
            <Text style={styles.headerTitle}>Verify Order</Text>
            <Text style={styles.headerSubtitle}>{order.orderNumber}</Text>
          </View>
          <TouchableOpacity
            style={styles.verifyAllButton}
            onPress={handleVerifyAll}
          >
            <Text style={styles.verifyAllText}>Verify All</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Order Info */}
      <View style={styles.orderInfoCard}>
        <View style={styles.orderInfoRow}>
          <Text style={styles.orderInfoLabel}>Customer</Text>
          <Text style={styles.orderInfoValue} numberOfLines={1}>
            {order.accountName || 'Unknown'}
          </Text>
        </View>
        <View style={styles.orderInfoDivider} />
        <View style={styles.orderInfoRow}>
          <Text style={styles.orderInfoLabel}>Items</Text>
          <Text style={styles.orderInfoValue}>{order.orderLines || 0}</Text>
        </View>
        <View style={styles.orderInfoDivider} />
        <View style={styles.orderInfoRow}>
          <Text style={styles.orderInfoLabel}>Amount</Text>
          <Text style={[styles.orderInfoValue, { color: THEME.primary }]}>
            ₹{(order.orderAmount || 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Verification Progress</Text>
          <Text style={styles.progressCount}>{verifiedCount}/{lines.length}</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(verifiedCount / lines.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Lines List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.linesContainer}>
          {lines.map((line, index) => (
            <LineItemCard
              key={`verify-line-${index}`}
              line={line}
              onVerify={handleVerifyLine}
            />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            !allLinesVerified && styles.submitButtonDisabled,
          ]}
          onPress={() => setShowConfirmModal(true)}
          disabled={!allLinesVerified || submitting}
        >
          <LinearGradient
            colors={allLinesVerified ? [THEME.primary, THEME.primaryLight] : ['#999', '#BBB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButtonGradient}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {allLinesVerified ? 'Submit Verification' : `Verify All Items (${verifiedCount}/${lines.length})`}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={48} color={THEME.success} />
            </View>
            <Text style={styles.modalTitle}>Confirm Verification</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to submit the verification for order {order.orderNumber}?
            </Text>

            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatValue}>
                  {lines.filter(l => l.verifiedQty === l.shippedQty).length}
                </Text>
                <Text style={styles.modalStatLabel}>Matches</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: THEME.error }]}>
                  {lines.filter(l => l.verifiedQty < l.shippedQty).length}
                </Text>
                <Text style={styles.modalStatLabel}>Shorts</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: THEME.warning }]}>
                  {lines.filter(l => l.verifiedQty > l.shippedQty).length}
                </Text>
                <Text style={styles.modalStatLabel}>Overs</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleSubmit}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textLight,
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
  verifyAllButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifyAllText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Order Info
  orderInfoCard: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    margin: 16,
    borderRadius: 12,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  orderInfoRow: {
    flex: 1,
    alignItems: 'center',
  },
  orderInfoLabel: {
    fontSize: 10,
    color: THEME.textLight,
  },
  orderInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
    marginTop: 2,
  },
  orderInfoDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: THEME.textLight,
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.primary,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.success,
    borderRadius: 3,
  },

  // Lines
  scrollView: {
    flex: 1,
  },
  linesContainer: {
    padding: 16,
    paddingTop: 8,
  },
  lineCard: {
    backgroundColor: THEME.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: THEME.warning,
  },
  lineCardVerified: {
    borderLeftColor: THEME.success,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lineInfo: {
    flex: 1,
  },
  lineItemNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
  },
  lineItemDesc: {
    fontSize: 14,
    color: THEME.text,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lineQuantities: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  qtyBox: {
    flex: 1,
    backgroundColor: THEME.background,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  qtyLabel: {
    fontSize: 10,
    color: THEME.textLight,
    marginBottom: 4,
  },
  qtyValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.text,
  },
  qtyUnit: {
    fontSize: 10,
    color: THEME.textLight,
    marginTop: 2,
  },
  qtyArrow: {
    paddingHorizontal: 12,
  },
  qtyInputBox: {
    flex: 1,
    alignItems: 'center',
  },
  qtyInput: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 10,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: THEME.text,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  lineActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickVerifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.success,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  quickVerifyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  manualVerifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary + '15',
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  manualVerifyText: {
    color: THEME.primary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.success + '10',
    borderRadius: 8,
    padding: 10,
  },
  verifiedBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },
  resetLink: {
    fontSize: 12,
    color: THEME.info,
    fontWeight: '600',
  },

  // Submit
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: THEME.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: THEME.background,
    borderRadius: 12,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.success,
  },
  modalStatLabel: {
    fontSize: 12,
    color: THEME.textLight,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: THEME.textLight,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: THEME.success,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default OrderVerificationScreen;
