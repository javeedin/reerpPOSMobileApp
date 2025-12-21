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
  getSyncMetadata,
  clearAllSyncData,
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

const SyncDataScreen = ({ navigation }) => {
  const { user } = useAuth();

  const [metadata, setMetadata] = useState({
    customers: { lastSync: null, count: 0 },
    items: { lastSync: null, count: 0 },
    agents: { lastSync: null, count: 0 },
    priceList: { lastSync: null, count: 0 },
    onhand: { lastSync: null, count: 0 },
  });

  const [syncingStates, setSyncingStates] = useState({
    customers: false,
    items: false,
    agents: false,
    priceList: false,
    onhand: false,
  });

  const [progressStates, setProgressStates] = useState({
    customers: null,
    items: null,
    agents: null,
    priceList: null,
    onhand: null,
  });

  useEffect(() => {
    loadMetadata();
  }, []);

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
      key: 'priceList',
      title: 'Price List',
      icon: 'pricetag',
      color: colors.accentOrange,
      syncFn: syncPriceList,
    },
    {
      key: 'onhand',
      title: 'Fusion Onhand',
      icon: 'layers',
      color: colors.accentRed || '#E53935',
      syncFn: syncOnhand,
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
});

export default SyncDataScreen;
