import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  PanResponder,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import colors from '../theme/colors';
import { createOrder, ORDER_STATUS } from '../services/orderService';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIGNATURE_HEIGHT = 250;

const SignatureScreen = ({ navigation, route }) => {
  const { menuConfig, customer, cart, totals, notes, currency, payments, onConfirm, paymentForm } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Use ref to track current path for panResponder (avoids stale closure)
  const currentPathRef = useRef('');

  // Pan responder for drawing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPath = `M${locationX},${locationY}`;
        currentPathRef.current = newPath;
        setCurrentPath(newPath);
        setIsSigning(true);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const updatedPath = `${currentPathRef.current} L${locationX},${locationY}`;
        currentPathRef.current = updatedPath;
        setCurrentPath(updatedPath);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          setPaths(prev => [...prev, currentPathRef.current]);
          currentPathRef.current = '';
          setCurrentPath('');
        }
        setIsSigning(false);
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
    currentPathRef.current = '';
  };

  const handleConfirm = async () => {
    if (paths.length === 0) {
      Alert.alert('Signature Required', 'Please sign before confirming.');
      return;
    }

    // Create signature data (could be base64 image or path data)
    const signatureData = {
      paths: paths,
      timestamp: new Date().toISOString(),
      customerName: customer?.name || 'Walk-in Customer',
    };

    // If there's an onConfirm callback, use it
    if (onConfirm) {
      onConfirm(signatureData);
      return;
    }

    // Common nav params with signature
    const navParams = {
      menuConfig,
      customer,
      cart,
      totals,
      notes,
      currency,
      signature: signatureData,
    };

    // Payment form types (for SALES/RETURNS transaction types):
    // CASH = show payment form with payment methods
    // CREDIT = show credit check form
    // blank/other = direct order confirm (with user confirmation)
    const formType = (paymentForm || '').toUpperCase();
    const transactionType = (menuConfig?.transactionType || '').toUpperCase();
    const isSalesOrReturns = transactionType === 'SALES' || transactionType === 'RETURNS';

    if (isSalesOrReturns) {
      if (formType === 'CASH') {
        // Show payment form with payment methods
        navigation.navigate('Payment', navParams);
      } else if (formType === 'CREDIT') {
        // Go to credit check with signature
        navigation.navigate('CreditCheck', navParams);
      } else {
        // Direct confirm with user confirmation prompt
        Alert.alert(
          'Confirm Order',
          `Are you sure you want to confirm this order?\n\nTotal: ${currency} ${totals?.totalNet?.toFixed(2)}\nItems: ${cart?.length || 0}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              style: 'default',
              onPress: async () => {
                setProcessing(true);
                try {
                  const userPrefix = user?.username?.substring(0, 3) || user?.name?.substring(0, 3) || 'USR';

                  const result = await createOrder({
                    customer,
                    menuConfig,
                    lines: cart,
                    status: ORDER_STATUS.CONFIRMED,
                    payments: [], // No payments for direct confirm
                    notes,
                    signature: signatureData,
                  }, userPrefix);

                  if (result.success) {
                    Alert.alert(
                      'Order Confirmed',
                      `Order ${result.order.orderNumber} has been confirmed with signature.`,
                      [
                        {
                          text: 'OK',
                          onPress: () => navigation.navigate('MainTabs'),
                        },
                      ]
                    );
                  } else {
                    Alert.alert('Error', result.error || 'Failed to confirm order');
                  }
                } catch (error) {
                  Alert.alert('Error', error.message);
                } finally {
                  setProcessing(false);
                }
              },
            },
          ]
        );
      }
    } else {
      // For other transaction types, go to payment by default
      navigation.navigate('Payment', navParams);
    }
  };

  const handleSkip = () => {
    // Navigate without signature
    if (payments) {
      navigation.navigate('Payment', {
        ...route.params,
        signature: null,
        proceedToConfirm: true,
      });
    } else {
      navigation.navigate('Payment', {
        menuConfig,
        customer,
        cart,
        totals,
        notes,
        currency,
        signature: null,
      });
    }
  };

  // Handle home navigation with warning
  const handleGoHome = () => {
    Alert.alert(
      'Leave Order?',
      'Order is not confirmed and will be cleared. Do you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Go Home',
          style: 'destructive',
          onPress: () => navigation.navigate('MainTabs'),
        },
      ]
    );
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
          <Text style={styles.headerTitle}>Customer Signature</Text>
          <Text style={styles.headerSubtitle}>{customer?.name || 'Walk-in Customer'}</Text>
        </View>
        <TouchableOpacity onPress={handleGoHome} style={styles.homeButton}>
          <Ionicons name="home-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.content}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order Total</Text>
            <Text style={styles.summaryValue}>{currency} {totals?.totalNet?.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items</Text>
            <Text style={styles.summaryItems}>{cart?.length || 0} items</Text>
          </View>
        </View>

        {/* Signature Pad */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureHeader}>
            <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.signatureTitle}>Sign Below</Text>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Ionicons name="refresh" size={16} color={colors.accent} />
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signaturePad} {...panResponder.panHandlers}>
            <Svg
              width="100%"
              height={SIGNATURE_HEIGHT}
              style={styles.svgCanvas}
            >
              {/* Completed paths */}
              {paths.map((path, index) => (
                <Path
                  key={index}
                  d={path}
                  stroke={colors.textPrimary}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {/* Current path being drawn */}
              {currentPath && (
                <Path
                  d={currentPath}
                  stroke={colors.textPrimary}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>

            {/* Signature line */}
            <View style={styles.signatureLine} />

            {/* Placeholder text */}
            {paths.length === 0 && !currentPath && (
              <View style={styles.placeholderContainer}>
                <Ionicons name="finger-print-outline" size={40} color={colors.textMuted} />
                <Text style={styles.placeholderText}>Sign here</Text>
              </View>
            )}
          </View>

          <Text style={styles.signatureHint}>
            By signing, you confirm the order details above
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
          <Text style={styles.infoText}>
            Your signature will be stored with the order for verification purposes.
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, processing && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={processing}
        >
          {processing ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>Processing...</Text>
            </>
          ) : (
            <>
              <Text style={styles.confirmBtnText}>
                {(paymentForm || '').toUpperCase() === 'CASH' ? 'Proceed to Payment' :
                 (paymentForm || '').toUpperCase() === 'CREDIT' ? 'Proceed to Credit Check' : 'Confirm Order'}
              </Text>
              <Ionicons
                name={(paymentForm || '').toUpperCase() === 'CASH' ? "card-outline" :
                      (paymentForm || '').toUpperCase() === 'CREDIT' ? "wallet-outline" : "checkmark-circle"}
                size={22}
                color="#FFFFFF"
              />
            </>
          )}
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  homeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
  },
  summaryItems: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  signatureSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  signatureTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent + '15',
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
  signaturePad: {
    height: SIGNATURE_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
  },
  svgCanvas: {
    backgroundColor: 'transparent',
  },
  signatureLine: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: colors.textMuted,
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 16,
    color: colors.textMuted,
  },
  signatureHint: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accent + '10',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGreen,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default SignatureScreen;
