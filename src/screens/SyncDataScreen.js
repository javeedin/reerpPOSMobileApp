import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  syncCustomers,
  syncItems,
  syncAgents,
  syncPriceList,
  syncOnhand,
  syncBogo,
  syncPaymentMethods,
  getSyncMetadata,
  clearAllSyncData,
  syncPriceListNames,
  syncSinglePriceList,
  getPriceListNames,
  getPriceListSyncStatus,
  clearAllDataForLargePricelistSync,
} from '../services/syncService';

const SyncObjectCard = ({
  title,
  icon,
  color,
  lastSync,
  count,
  isSyncing,
  progress,
  onSync,
  onView,
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Never synced';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <View style={styles.syncCard}>
      <View style={styles.syncCardHeader}>
        <View style={[styles.syncIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={28} color={color} />
        </View>
        <View style={styles.syncInfo}>
          <Text style={styles.syncTitle}>{title}</Text>
          <Text style={styles.syncMeta}>
            {count > 0 ? `${count.toLocaleString()} records` : 'No data'}
          </Text>
        </View>
        {count > 0 && (
          <TouchableOpacity
            style={styles.viewButton}
            onPress={onView}
            disabled={isSyncing}
          >
            <Ionicons name="eye-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.syncCardBody}>
        <View style={styles.lastSyncRow}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.lastSyncText}>Last sync: {formatDate(lastSync)}</Text>
        </View>

        {isSyncing && progress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((progress.fetched / 10000) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.status || `Fetching... ${progress.fetched?.toLocaleString() || 0} records`}
            </Text>
            {progress.currentList && (
              <Text style={styles.progressSubText}>
                Price list {progress.currentList} of {progress.totalLists}
              </Text>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
        onPress={onSync}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="sync" size={20} color="#FFFFFF" />
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

// Price List Item Row
const PriceListRow = ({ name, syncStatus, isSyncing, progress, onSync, onView }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Never synced';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.priceListRow}>
      <View style={styles.priceListInfo}>
        <Text style={styles.priceListName} numberOfLines={1}>{name}</Text>
        <View style={styles.priceListMeta}>
          {syncStatus ? (
            <>
              <Text style={styles.priceListCount}>{syncStatus.count?.toLocaleString() || 0} items</Text>
              <Text style={styles.priceListDot}>•</Text>
              <Text style={styles.priceListDate}>{formatDate(syncStatus.lastSync)}</Text>
            </>
          ) : (
            <Text style={styles.priceListDate}>Not synced</Text>
          )}
        </View>
        {isSyncing && progress && (
          <View style={styles.priceListProgress}>
            <View style={styles.priceListProgressBar}>
              <View
                style={[
                  styles.priceListProgressFill,
                  { width: `${Math.min((progress.fetched / 10000) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.priceListProgressText}>{progress.status}</Text>
          </View>
        )}
      </View>
      <View style={styles.priceListActions}>
        {syncStatus && syncStatus.count > 0 && (
          <TouchableOpacity
            style={styles.priceListViewBtn}
            onPress={onView}
            disabled={isSyncing}
          >
            <Ionicons name="eye-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.priceListSyncBtn, isSyncing && styles.priceListSyncBtnDisabled]}
          onPress={onSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="sync" size={18} color={syncStatus ? colors.accent : colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Price List Sync Section
const PriceListSyncSection = ({ priceLists, syncStatus, syncingList, progressMap, onSyncSingle, onSyncAll, onRefreshNames, isRefreshing, onViewPriceList, onViewAllPriceLists }) => {
  // Calculate total synced items
  const totalSyncedItems = Object.values(syncStatus).reduce((sum, s) => sum + (s?.count || 0), 0);

  return (
    <View style={styles.priceListSection}>
      <View style={styles.priceListHeader}>
        <View style={[styles.syncIconContainer, { backgroundColor: colors.accentOrange + '20' }]}>
          <Ionicons name="pricetag" size={28} color={colors.accentOrange} />
        </View>
        <View style={styles.priceListHeaderInfo}>
          <Text style={styles.syncTitle}>Price Lists</Text>
          <Text style={styles.syncMeta}>{priceLists.length} price lists</Text>
        </View>
        {totalSyncedItems > 0 && (
          <TouchableOpacity
            style={styles.viewButton}
            onPress={onViewAllPriceLists}
            disabled={!!syncingList}
          >
            <Ionicons name="eye-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.refreshNamesBtn}
          onPress={onRefreshNames}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="refresh" size={20} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.priceListBody}>
        {priceLists.length === 0 ? (
          <View style={styles.noPriceLists}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.textMuted} />
            <Text style={styles.noPriceListsText}>No price lists found. Tap refresh to load.</Text>
          </View>
        ) : (
          priceLists.map((pl) => (
            <PriceListRow
              key={pl.name}
              name={pl.name}
              syncStatus={syncStatus[pl.name]}
              isSyncing={syncingList === pl.name}
              progress={progressMap[pl.name]}
              onSync={() => onSyncSingle(pl.name)}
              onView={() => onViewPriceList(pl.name)}
            />
          ))
        )}
      </View>

      {priceLists.length > 0 && (
        <TouchableOpacity
          style={[styles.syncButton, syncingList && styles.syncButtonDisabled]}
          onPress={onSyncAll}
          disabled={!!syncingList}
        >
          {syncingList ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="sync" size={20} color="#FFFFFF" />
              <Text style={styles.syncButtonText}>Sync All Price Lists</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const SyncDataScreen = ({ navigation }) => {
  const { user } = useAuth();

  const [metadata, setMetadata] = useState({
    customers: { lastSync: null, count: 0 },
    items: { lastSync: null, count: 0 },
    agents: { lastSync: null, count: 0 },
    priceList: { lastSync: null, count: 0 },
    onhand: { lastSync: null, count: 0 },
    bogo: { lastSync: null, count: 0 },
    paymentMethods: { lastSync: null, count: 0 },
  });

  const [syncingStates, setSyncingStates] = useState({
    customers: false,
    items: false,
    agents: false,
    priceList: false,
    onhand: false,
    bogo: false,
    paymentMethods: false,
  });

  const [progressStates, setProgressStates] = useState({
    customers: null,
    items: null,
    agents: null,
    priceList: null,
    onhand: null,
    bogo: null,
    paymentMethods: null,
  });

  // Price list specific states
  const [priceLists, setPriceLists] = useState([]);
  const [priceListSyncStatus, setPriceListSyncStatus] = useState({});
  const [syncingPriceList, setSyncingPriceList] = useState(null);
  const [priceListProgressMap, setPriceListProgressMap] = useState({});
  const [isRefreshingNames, setIsRefreshingNames] = useState(false);

  useEffect(() => {
    loadMetadata();
    loadPriceListData();
  }, []);

  const loadPriceListData = async () => {
    const lists = await getPriceListNames() || [];
    const status = await getPriceListSyncStatus() || {};
    setPriceLists(lists);
    setPriceListSyncStatus(status);
  };

  const handleRefreshPriceListNames = async () => {
    setIsRefreshingNames(true);
    const result = await syncPriceListNames(null, user?.username);
    if (result.success) {
      setPriceLists(result.priceLists);
      Alert.alert('Success', `Found ${result.priceLists.length} price lists`);
    } else {
      Alert.alert('Error', result.error || 'Failed to refresh price lists');
    }
    setIsRefreshingNames(false);
  };

  // Internal function to sync a single price list (no alert)
  // clearAllFirst: if true, clears ALL pricelist data before sync (default for single sync)
  const syncPriceListInternal = async (priceListName, clearAllFirst = true) => {
    setSyncingPriceList(priceListName);
    setPriceListProgressMap((prev) => ({ ...prev, [priceListName]: null }));

    const result = await syncSinglePriceList(priceListName, (progress) => {
      setPriceListProgressMap((prev) => ({ ...prev, [priceListName]: progress }));
    }, clearAllFirst);

    setSyncingPriceList(null);
    loadPriceListData();
    loadMetadata();

    return result;
  };

  // Handler for individual price list sync (shows alert)
  // Asks user if they want to clear ALL data first to make room
  const handleSyncSinglePriceList = async (priceListName) => {
    Alert.alert(
      'Sync Price List',
      'Large pricelists may exceed storage limits.\n\nWould you like to clear ALL other data (customers, onhand, etc.) to make room?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Keep Other Data',
          onPress: async () => {
            const result = await syncPriceListInternal(priceListName, true);
            if (result.success) {
              Alert.alert('Success', `Synced ${result.count.toLocaleString()} items for ${priceListName}`);
            } else {
              Alert.alert('Error', result.error || `Failed to sync ${priceListName}`);
            }
          },
        },
        {
          text: 'Clear All & Sync',
          style: 'destructive',
          onPress: async () => {
            // Clear ALL data first
            await clearAllDataForLargePricelistSync();
            loadMetadata(); // Refresh UI to show cleared data

            const result = await syncPriceListInternal(priceListName, true);
            if (result.success) {
              Alert.alert('Success', `Synced ${result.count.toLocaleString()} items for ${priceListName}`);
            } else {
              Alert.alert('Error', result.error || `Failed to sync ${priceListName}`);
            }
          },
        },
      ]
    );
  };

  // Handler for syncing all price lists (no alerts during, only at end)
  const handleSyncAllPriceLists = async () => {
    let totalItems = 0;
    let successCount = 0;
    let failedLists = [];

    for (let i = 0; i < priceLists.length; i++) {
      const pl = priceLists[i];
      // Only clear all data on the first pricelist, otherwise we'd delete what we just synced
      const clearAllFirst = (i === 0);
      const result = await syncPriceListInternal(pl.name, clearAllFirst);
      if (result.success) {
        totalItems += result.count;
        successCount++;
      } else {
        failedLists.push(pl.name);
      }
    }

    // Show summary at the end
    if (failedLists.length === 0) {
      Alert.alert('Success', `Synced ${totalItems.toLocaleString()} items from ${successCount} price lists`);
    } else {
      Alert.alert('Partial Success', `Synced ${totalItems.toLocaleString()} items from ${successCount} lists.\nFailed: ${failedLists.join(', ')}`);
    }
  };

  const loadMetadata = async () => {
    const meta = await getSyncMetadata();
    setMetadata(meta);
  };

  const handleSync = async (type, syncFunction) => {
    setSyncingStates((prev) => ({ ...prev, [type]: true }));
    setProgressStates((prev) => ({ ...prev, [type]: null }));

    let result;
    const progressCallback = (progress) => {
      setProgressStates((prev) => ({ ...prev, [type]: progress }));
    };

    // Handle different sync types with their specific parameters
    if (type === 'priceList') {
      result = await syncFunction(progressCallback, user?.username);
    } else if (type === 'onhand') {
      // Pass warehouse (OrganizationCode) and subinventory (SubinventoryCode) from user profile
      const warehouse = user?.WAREHOUSE || user?.warehouse;
      const subinventory = user?.SUBINVENTORY || user?.subinventory;
      result = await syncFunction(progressCallback, warehouse, subinventory);
    } else {
      result = await syncFunction(progressCallback);
    }

    setSyncingStates((prev) => ({ ...prev, [type]: false }));

    if (result.success) {
      const message = result.priceListCount
        ? `Synced ${result.count.toLocaleString()} items from ${result.priceListCount} price lists`
        : `Synced ${result.count.toLocaleString()} records`;
      Alert.alert('Success', message);
      loadMetadata();
    } else {
      Alert.alert('Error', result.error || 'Sync failed');
    }
  };

  const handleViewData = (type) => {
    navigation.navigate('SyncedDataView', { type });
  };

  // Handler for viewing a specific price list
  const handleViewPriceList = (priceListName) => {
    navigation.navigate('SyncedDataView', { type: 'priceListSingle', priceListName });
  };

  // Handler for viewing all price lists
  const handleViewAllPriceLists = () => {
    navigation.navigate('SyncedDataView', { type: 'priceList' });
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all synced data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllSyncData();
            loadMetadata();
            Alert.alert('Success', 'All synced data has been cleared');
          },
        },
      ]
    );
  };

  const syncObjects = [
    {
      key: 'customers',
      title: 'Customers',
      icon: 'people',
      color: colors.accent,
      syncFn: syncCustomers,
    },
    {
      key: 'items',
      title: 'Items',
      icon: 'cube',
      color: colors.accentPurple,
      syncFn: syncItems,
    },
    {
      key: 'agents',
      title: 'Agents',
      icon: 'person',
      color: colors.accentGreen,
      syncFn: syncAgents,
    },
    {
      key: 'onhand',
      title: 'Fusion Onhand',
      icon: 'layers',
      color: colors.accentRed || '#E53935',
      syncFn: syncOnhand,
    },
    {
      key: 'bogo',
      title: 'BOGO Promos',
      icon: 'gift',
      color: colors.secondary || '#FF6B6B',
      syncFn: syncBogo,
    },
    {
      key: 'paymentMethods',
      title: 'Payment Methods',
      icon: 'card',
      color: colors.accentPurple || '#9C27B0',
      syncFn: syncPaymentMethods,
    },
  ];

  const isSyncingAny = Object.values(syncingStates).some((v) => v);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Blue Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sync Data</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearAll}
          disabled={isSyncingAny}
        >
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* White Content Area */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.accent} />
          <Text style={styles.infoText}>
            Sync data for offline access. Data is stored locally on your device.
          </Text>
        </View>

        {/* Sync Objects */}
        {syncObjects.map((obj) => (
          <SyncObjectCard
            key={obj.key}
            title={obj.title}
            icon={obj.icon}
            color={obj.color}
            lastSync={metadata[obj.key]?.lastSync}
            count={metadata[obj.key]?.count || 0}
            isSyncing={syncingStates[obj.key]}
            progress={progressStates[obj.key]}
            onSync={() => handleSync(obj.key, obj.syncFn)}
            onView={() => handleViewData(obj.key)}
          />
        ))}

        {/* Price Lists Section */}
        <PriceListSyncSection
          priceLists={priceLists}
          syncStatus={priceListSyncStatus}
          syncingList={syncingPriceList}
          progressMap={priceListProgressMap}
          onSyncSingle={handleSyncSinglePriceList}
          onSyncAll={handleSyncAllPriceLists}
          onRefreshNames={handleRefreshPriceListNames}
          isRefreshing={isRefreshingNames}
          onViewPriceList={handleViewPriceList}
          onViewAllPriceLists={handleViewAllPriceLists}
        />

        {/* Sync All Button */}
        <TouchableOpacity
          style={[styles.syncAllButton, isSyncingAny && styles.syncAllButtonDisabled]}
          onPress={async () => {
            for (const obj of syncObjects) {
              await handleSync(obj.key, obj.syncFn);
            }
          }}
          disabled={isSyncingAny}
        >
          <Ionicons name="sync-circle" size={24} color="#FFFFFF" />
          <Text style={styles.syncAllButtonText}>Sync All</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '15',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  syncCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  syncCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncInfo: {
    flex: 1,
    marginLeft: 14,
  },
  syncTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  syncMeta: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  viewButton: {
    padding: 8,
    backgroundColor: colors.accent + '15',
    borderRadius: 10,
  },
  syncCardBody: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lastSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastSyncText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  progressSubText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  syncButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  syncAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 18,
    gap: 10,
  },
  syncAllButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  syncAllButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 40,
  },
  // Price List Section Styles
  priceListSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  priceListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceListHeaderInfo: {
    flex: 1,
    marginLeft: 14,
  },
  refreshNamesBtn: {
    padding: 8,
    backgroundColor: colors.accent + '15',
    borderRadius: 10,
  },
  priceListBody: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noPriceLists: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noPriceListsText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  priceListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceListInfo: {
    flex: 1,
  },
  priceListName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  priceListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceListCount: {
    fontSize: 12,
    color: colors.accentGreen,
    fontWeight: '500',
  },
  priceListDot: {
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 6,
  },
  priceListDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  priceListProgress: {
    marginTop: 8,
  },
  priceListProgressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  priceListProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  priceListProgressText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  priceListActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceListViewBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceListSyncBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceListSyncBtnDisabled: {
    backgroundColor: colors.border,
  },
});

export default SyncDataScreen;
