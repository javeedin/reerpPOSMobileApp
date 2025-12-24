import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const InfoBadge = ({ label, value, color }) => (
  <View style={[styles.infoBadge, { backgroundColor: color + '20' }]}>
    <Text style={[styles.infoBadgeLabel, { color }]}>{label}</Text>
    <Text style={styles.infoBadgeValue}>{value}</Text>
  </View>
);

const ConfigItem = ({ label, value }) => (
  <View style={styles.configItem}>
    <Text style={styles.configLabel}>{label}</Text>
    <Text style={[styles.configValue, { color: value === 'YES' || value === 'Y' ? colors.accentGreen : colors.textSecondary }]}>
      {value || 'N/A'}
    </Text>
  </View>
);

const MenuDetailScreen = ({ navigation, route }) => {
  const { item } = route.params || {};

  // Check if this is a report menu item
  const isReport = () => {
    const name = (item?.name || '').toLowerCase();
    return name.includes('report') || name.includes('lodgement') || name.includes('lodgment');
  };

  // Check if this is a scan/reconciliation menu item
  const isScan = () => {
    const name = (item?.name || '').toLowerCase();
    return name.includes('scan') || name.includes('reconcil') || name.includes('batch');
  };

  // Get the report type for navigation
  const getReportScreen = () => {
    const name = (item?.name || '').toLowerCase();
    if (name.includes('lodgement') || name.includes('lodgment')) {
      return 'LodgementReport';
    }
    // Add more report types here as needed
    return null;
  };

  const handleOpenNewOrder = () => {
    // Prepare menu config for order
    const menuConfig = {
      name: item?.name || '',
      orderType: item?.ordertype || '',
      transactionType: item?.transaction_type || '',
      paymentFormRequired: item?.payment_form === 'YES' || item?.payment_form === 'Y',
      priceList: item?.pricelist || '',
      allowDiscount: item?.allow_discount === 'YES' || item?.allow_discount === 'Y',
      allowTax: item?.allow_tax === 'YES' || item?.allow_tax === 'Y',
      signatureRequired: item?.signature_required === 'YES' || item?.signature_required === 'Y',
      approvalRequired: item?.approval_required === 'YES' || item?.approval_required === 'Y',
      showVatLabel: item?.show_vat_label === 'YES' || item?.show_vat_label === 'Y',
      dutyFree: item?.Duty_free === 'YES' || item?.Duty_free === 'Y',
      creditSales: item?.creditsales === 'YES' || item?.creditsales === 'Y',
      warehouse: item?.warehouse || '',
      subinventory: item?.subinventory || '',
    };

    navigation.navigate('CustomerSelection', { menuConfig });
  };

  const handleOpenReport = () => {
    const reportScreen = getReportScreen();
    if (reportScreen) {
      navigation.navigate(reportScreen);
    } else {
      Alert.alert('Coming Soon', 'This report is not yet available.');
    }
  };

  const handleOpenScan = () => {
    navigation.navigate('Scan');
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[colors.primaryDark, colors.background]} style={styles.gradient}>
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No item data available</Text>
            <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
              <Text style={styles.goBackText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.primaryDark, colors.background]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            {item.src ? (
              <Image source={{ uri: item.src }} style={styles.heroImage} />
            ) : (
              <View style={styles.heroIconContainer}>
                <Ionicons name="document-text" size={60} color={colors.accent} />
              </View>
            )}
            <Text style={styles.itemName}>{item.name}</Text>
            {item.ordertype && (
              <View style={styles.orderTypeBadge}>
                <Text style={styles.orderTypeText}>{item.ordertype}</Text>
              </View>
            )}
          </View>

          {/* Quick Info Badges */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {item.transaction_type && (
              <InfoBadge label="Type" value={item.transaction_type} color={colors.accent} />
            )}
            {item.payment_form && (
              <InfoBadge label="Payment" value={item.payment_form} color={colors.accentGreen} />
            )}
            {item.pricelist && (
              <InfoBadge label="Price List" value={item.pricelist} color={colors.accentOrange} />
            )}
            {item.creditsales && (
              <InfoBadge label="Credit" value={item.creditsales} color={colors.accentPurple} />
            )}
          </ScrollView>

          {/* Configuration Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Configuration</Text>
            <ConfigItem label="Allow Discount" value={item.allow_discount} />
            <ConfigItem label="Allow Tax" value={item.allow_tax} />
            <ConfigItem label="Signature Required" value={item.signature_required} />
            <ConfigItem label="Approval Required" value={item.approval_required} />
            <ConfigItem label="Show VAT Label" value={item.show_vat_label} />
            <ConfigItem label="Duty Free" value={item.Duty_free} />
          </View>

          {/* Inventory Settings Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inventory Settings</Text>
            <ConfigItem label="Global Onhand" value={item.allow_global_onhand} />
            <ConfigItem label="Online Search" value={item.ONLINE_SEARCH} />
            <ConfigItem label="Pre-Sale Status" value={item.PRE_SALE_STATUS} />
            <ConfigItem label="MRA Enable" value={item.MRA_ENABLE} />
            {item.warehouse && <ConfigItem label="Warehouse" value={item.warehouse} />}
            {item.subinventory && <ConfigItem label="Subinventory" value={item.subinventory} />}
            {item.source_warehouse && <ConfigItem label="Source Warehouse" value={item.source_warehouse} />}
            {item.source_subinventory && <ConfigItem label="Source Subinventory" value={item.source_subinventory} />}
          </View>

          {/* Display Settings Card */}
          {item.REPORT_DISPLAY_LABEL && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Display Settings</Text>
              <ConfigItem label="Report Label" value={item.REPORT_DISPLAY_LABEL} />
              <ConfigItem label="Page Name" value={item.PageName} />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={isScan() ? handleOpenScan : isReport() ? handleOpenReport : handleOpenNewOrder}
        >
          <LinearGradient
            colors={isScan() ? [colors.accentPurple || '#9C27B0', colors.primary] : isReport() ? [colors.accent, colors.primary] : [colors.secondary, colors.secondaryDark]}
            style={styles.floatingButtonGradient}
          >
            <Ionicons
              name={isScan() ? 'scan' : isReport() ? 'document-text' : 'add'}
              size={28}
              color="#FFFFFF"
            />
            <Text style={styles.floatingButtonText}>
              {isScan() ? 'Start Scan' : isReport() ? 'View Report' : 'New Order'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  moreButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroImage: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 16,
  },
  heroIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  orderTypeBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  orderTypeText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  badgesContainer: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  infoBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  infoBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoBadgeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  configLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  configValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 120,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goBackText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    left: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default MenuDetailScreen;
