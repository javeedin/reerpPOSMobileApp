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

  const handleAction = () => {
    Alert.alert(
      'Coming Soon',
      `The ${item?.name || 'feature'} functionality will be implemented in the next phase.`,
      [{ text: 'OK' }]
    );
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

          {/* Action Button */}
          <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
            <LinearGradient
              colors={[colors.secondary, colors.secondaryDark]}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="play-circle" size={24} color={colors.textPrimary} />
              <Text style={styles.actionButtonText}>Open {item.PageName || 'Module'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
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
  actionButton: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 100,
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
});

export default MenuDetailScreen;
