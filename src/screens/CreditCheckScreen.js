import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { createOrder, ORDER_STATUS } from '../services/orderService';
import { useAuth } from '../context/AuthContext';

// Format number with commas
const formatNumber = (num) => {
  return (num || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const CreditCheckScreen = ({ navigation, route }) => {
  const {
    menuConfig,
    customer,
    cart,
    totals,
    notes,
    currency,
    signature, // Optional signature data from SignatureScreen
  } = route.params || {};

  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Customer credit information (from customer data or API)
  const creditLimit = customer?.creditLimit || customer?.credit_limit || 0;
  const outstandingBalance = customer?.outstandingBalance || customer?.outstanding_balance || 0;
  const availableCredit = Math.max(0, creditLimit - outstandingBalance);
  const orderAmount = totals?.totalNet || 0;
  const newBalance = outstandingBalance + orderAmount;
  const withinCreditLimit = orderAmount <= availableCredit;
  const creditUtilization = creditLimit > 0 ? ((newBalance / creditLimit) * 100).toFixed(1) : 0;

  const handleConfirmOrder = async () => {
    if (!withinCreditLimit) {
      Alert.alert(
        'Credit Limit Exceeded',
        `This order of ${currency} ${formatNumber(orderAmount)} exceeds the available credit of ${currency} ${formatNumber(availableCredit)}.\n\nPlease reduce the order amount or contact management for credit limit approval.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setConfirming(true);
    try {
      const userPrefix = user?.username?.substring(0, 3) || user?.name?.substring(0, 3) || 'USR';

      const result = await createOrder({
        customer,
        menuConfig,
        lines: cart,
        status: ORDER_STATUS.CONFIRMED,
        payments: [], // Credit sale - no immediate payment
        notes,
        signature,
        creditSale: true,
      }, userPrefix);

      if (result.success) {
        Alert.alert(
          'Order Confirmed',
          `Credit order ${result.order.orderNumber} has been confirmed.\n\nNew outstanding balance: ${currency} ${formatNumber(newBalance)}`,
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
      setConfirming(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Credit Check</Text>
          <Text style={styles.headerSubtitle}>{customer?.name || 'Customer'}</Text>
        </View>
        <View style={styles.headerRight}>
          <Ionicons name="card" size={24} color="#FFFFFF" />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Credit Status Card */}
        <View style={[styles.statusCard, withinCreditLimit ? styles.statusCardOk : styles.statusCardWarning]}>
          <View style={styles.statusIconContainer}>
            <Ionicons
              name={withinCreditLimit ? "checkmark-circle" : "warning"}
              size={48}
              color={withinCreditLimit ? colors.accentGreen : colors.accentOrange}
            />
          </View>
          <Text style={styles.statusTitle}>
            {withinCreditLimit ? 'Credit Available' : 'Credit Limit Warning'}
          </Text>
          <Text style={styles.statusMessage}>
            {withinCreditLimit
              ? 'This order is within the customer\'s credit limit.'
              : 'This order exceeds the available credit limit.'}
          </Text>
        </View>

        {/* Customer Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Customer Information</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{customer?.name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account</Text>
            <Text style={styles.infoValue}>{customer?.accountNumber || customer?.account_number || 'N/A'}</Text>
          </View>
          {customer?.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{customer.phone}</Text>
            </View>
          )}
        </View>

        {/* Credit Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet" size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Credit Details</Text>
          </View>

          <View style={styles.creditRow}>
            <Text style={styles.creditLabel}>Credit Limit</Text>
            <Text style={styles.creditValue}>{currency} {formatNumber(creditLimit)}</Text>
          </View>

          <View style={styles.creditRow}>
            <Text style={styles.creditLabel}>Outstanding Balance</Text>
            <Text style={[styles.creditValue, outstandingBalance > 0 && styles.creditValueWarning]}>
              {currency} {formatNumber(outstandingBalance)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.creditRow}>
            <Text style={styles.creditLabel}>Available Credit</Text>
            <Text style={[styles.creditValue, styles.creditValueHighlight]}>
              {currency} {formatNumber(availableCredit)}
            </Text>
          </View>

          {/* Credit Utilization Bar */}
          <View style={styles.utilizationContainer}>
            <View style={styles.utilizationHeader}>
              <Text style={styles.utilizationLabel}>Credit Utilization</Text>
              <Text style={[
                styles.utilizationPercent,
                parseFloat(creditUtilization) > 80 && styles.utilizationPercentWarning,
                parseFloat(creditUtilization) > 100 && styles.utilizationPercentDanger
              ]}>
                {creditUtilization}%
              </Text>
            </View>
            <View style={styles.utilizationBar}>
              <View
                style={[
                  styles.utilizationFill,
                  { width: `${Math.min(100, creditUtilization)}%` },
                  parseFloat(creditUtilization) > 80 && styles.utilizationFillWarning,
                  parseFloat(creditUtilization) > 100 && styles.utilizationFillDanger
                ]}
              />
            </View>
          </View>
        </View>

        {/* Order Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt" size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>

          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Items</Text>
            <Text style={styles.orderValue}>{cart?.length || 0}</Text>
          </View>

          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Order Total</Text>
            <Text style={[styles.orderValue, styles.orderValueBold]}>
              {currency} {formatNumber(orderAmount)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>New Balance (After Order)</Text>
            <Text style={[
              styles.orderValue,
              styles.orderValueBold,
              !withinCreditLimit && styles.orderValueDanger
            ]}>
              {currency} {formatNumber(newBalance)}
            </Text>
          </View>

          {!withinCreditLimit && (
            <View style={styles.overLimitBadge}>
              <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
              <Text style={styles.overLimitText}>
                Over limit by {currency} {formatNumber(orderAmount - availableCredit)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleGoBack}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            !withinCreditLimit && styles.confirmBtnDisabled
          ]}
          onPress={handleConfirmOrder}
          disabled={confirming || !withinCreditLimit}
        >
          {confirming ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name={withinCreditLimit ? "checkmark-circle" : "close-circle"}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.confirmBtnText}>
                {withinCreditLimit ? 'Confirm Credit Order' : 'Credit Exceeded'}
              </Text>
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
  headerRight: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  statusCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusCardOk: {
    backgroundColor: (colors.accentGreen || '#4CAF50') + '15',
    borderWidth: 1,
    borderColor: (colors.accentGreen || '#4CAF50') + '30',
  },
  statusCardWarning: {
    backgroundColor: (colors.accentOrange || '#FF9800') + '15',
    borderWidth: 1,
    borderColor: (colors.accentOrange || '#FF9800') + '30',
  },
  statusIconContainer: {
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  statusMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  creditLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  creditValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  creditValueWarning: {
    color: colors.accentOrange || '#FF9800',
  },
  creditValueHighlight: {
    color: colors.accentGreen || '#4CAF50',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  utilizationContainer: {
    marginTop: 12,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  utilizationLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  utilizationPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentGreen || '#4CAF50',
  },
  utilizationPercentWarning: {
    color: colors.accentOrange || '#FF9800',
  },
  utilizationPercentDanger: {
    color: colors.accentRed || '#E53935',
  },
  utilizationBar: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  utilizationFill: {
    height: '100%',
    backgroundColor: colors.accentGreen || '#4CAF50',
    borderRadius: 4,
  },
  utilizationFillWarning: {
    backgroundColor: colors.accentOrange || '#FF9800',
  },
  utilizationFillDanger: {
    backgroundColor: colors.accentRed || '#E53935',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  orderLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  orderValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  orderValueBold: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  orderValueDanger: {
    color: colors.accentRed || '#E53935',
  },
  overLimitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentRed || '#E53935',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  overLimitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 100,
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelBtn: {
    flex: 0.35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 10,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 0.65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGreen || '#4CAF50',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CreditCheckScreen;
