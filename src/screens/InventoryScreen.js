import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getOnhand, syncOnhand, fetchLotDetails, getSyncMetadata } from '../services/syncService';

const PAGE_SIZE = 50;

const getStockStatus = (quantity) => {
  if (quantity === 0) return { label: 'Out of Stock', color: colors.accentRed || '#E53935' };
  if (quantity < 10) return { label: 'Low Stock', color: colors.accentOrange };
  return { label: 'In Stock', color: colors.accentGreen };
};

// Highlight matching text component
const HighlightText = ({ text, highlight, style }) => {
  if (!highlight.trim() || !text) {
    return <Text style={style}>{text}</Text>;
  }

  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <Text style={style}>
      {parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <Text key={index} style={[style, { backgroundColor: colors.accent + '30', fontWeight: '700' }]}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        )
      )}
    </Text>
  );
};

// Lot Detail Modal
const LotDetailModal = ({ visible, lots, itemDescription, loading, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>Lot Details</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.itemName} numberOfLines={2}>{itemDescription}</Text>

          {loading ? (
            <View style={modalStyles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={modalStyles.loadingText}>Loading lot details...</Text>
            </View>
          ) : lots && lots.length > 0 ? (
            <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
              {lots.map((lot, index) => (
                <View key={`lot-${index}`} style={modalStyles.lotCard}>
                  <View style={modalStyles.lotHeader}>
                    <Ionicons name="barcode" size={20} color={colors.accentPurple} />
                    <Text style={modalStyles.lotNumber}>{lot.lotNumber || 'N/A'}</Text>
                  </View>
                  <View style={modalStyles.lotDetails}>
                    <View style={modalStyles.lotRow}>
                      <Text style={modalStyles.lotLabel}>Quantity</Text>
                      <Text style={modalStyles.lotValue}>{lot.quantity || 0}</Text>
                    </View>
                    {lot.expirationDate && (
                      <View style={modalStyles.lotRow}>
                        <Text style={modalStyles.lotLabel}>Expiration</Text>
                        <Text style={modalStyles.lotValue}>
                          {new Date(lot.expirationDate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                    {lot.gradeCode && (
                      <View style={modalStyles.lotRow}>
                        <Text style={modalStyles.lotLabel}>Grade</Text>
                        <Text style={modalStyles.lotValue}>{lot.gradeCode}</Text>
                      </View>
                    )}
                    {lot.originationDate && (
                      <View style={modalStyles.lotRow}>
                        <Text style={modalStyles.lotLabel}>Origination</Text>
                        <Text style={modalStyles.lotValue}>
                          {new Date(lot.originationDate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              <View style={{ height: 30 }} />
            </ScrollView>
          ) : (
            <View style={modalStyles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
              <Text style={modalStyles.emptyText}>No lot information available</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Onhand Item Card
const OnhandCard = ({ item, onViewLots, searchQuery }) => {
  const stockStatus = getStockStatus(item.primaryQuantity);

  return (
    <TouchableOpacity style={styles.inventoryCard} activeOpacity={0.7} onPress={() => onViewLots(item)}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconContainer, { backgroundColor: stockStatus.color + '20' }]}>
          <Ionicons name="cube" size={24} color={stockStatus.color} />
        </View>
      </View>
      <View style={styles.cardCenter}>
        <HighlightText
          text={item.itemDescription || 'Unknown Item'}
          highlight={searchQuery}
          style={styles.productName}
        />
        <HighlightText
          text={item.itemNumber || 'N/A'}
          highlight={searchQuery}
          style={styles.sku}
        />
        <View style={styles.tagsRow}>
          <View style={[styles.statusBadge, { backgroundColor: stockStatus.color + '20' }]}>
            <Text style={[styles.statusText, { color: stockStatus.color }]}>{stockStatus.label}</Text>
          </View>
          {item.lotsHref && (
            <View style={[styles.statusBadge, { backgroundColor: colors.accentPurple + '20' }]}>
              <Ionicons name="layers" size={10} color={colors.accentPurple} />
              <Text style={[styles.statusText, { color: colors.accentPurple, marginLeft: 4 }]}>Lots</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.quantity}>{item.primaryQuantity || 0}</Text>
        <Text style={styles.quantityLabel}>{item.primaryUOMCode || 'EA'}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Empty state with fetch option
const EmptyStateWithFetch = ({ onFetch, isFetching }) => (
  <View style={styles.emptyContainer}>
    <Ionicons name="cube-outline" size={80} color={colors.textMuted} />
    <Text style={styles.emptyTitle}>Onhand Not Found</Text>
    <Text style={styles.emptyText}>
      No onhand inventory data is available. Would you like to fetch it from Fusion Cloud?
    </Text>
    <TouchableOpacity
      style={[styles.fetchButton, isFetching && styles.fetchButtonDisabled]}
      onPress={onFetch}
      disabled={isFetching}
    >
      {isFetching ? (
        <>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.fetchButtonText}>Fetching...</Text>
        </>
      ) : (
        <>
          <Ionicons name="cloud-download" size={20} color="#FFFFFF" />
          <Text style={styles.fetchButtonText}>Fetch Onhand</Text>
        </>
      )}
    </TouchableOpacity>
  </View>
);

const InventoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [onhandData, setOnhandData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(null);
  const [page, setPage] = useState(1);
  const [lastSync, setLastSync] = useState(null);

  // Organization info
  const [orgCode, setOrgCode] = useState('');
  const [subinvCode, setSubinvCode] = useState('');

  // Sorting and filtering
  const [sortOrder, setSortOrder] = useState('none'); // 'none', 'qty_asc', 'qty_desc'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [qtyFrom, setQtyFrom] = useState('');
  const [qtyTo, setQtyTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Lot modal states
  const [lotModalVisible, setLotModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);

  useEffect(() => {
    loadOnhandData();
  }, []);

  useEffect(() => {
    filterAndSortData();
  }, [searchQuery, onhandData, sortOrder, qtyFrom, qtyTo]);

  useEffect(() => {
    setDisplayData(filteredData.slice(0, PAGE_SIZE));
    setPage(1);
  }, [filteredData]);

  const loadOnhandData = async () => {
    setLoading(true);
    try {
      const data = await getOnhand();
      setOnhandData(data || []);
      setFilteredData(data || []);

      // Get org code and subinventory from first item
      if (data && data.length > 0) {
        setOrgCode(data[0].organizationCode || '');
        setSubinvCode(data[0].subinventoryCode || '');
      }

      // Get last sync time
      const meta = await getSyncMetadata();
      if (meta?.onhand?.lastSync) {
        setLastSync(new Date(meta.onhand.lastSync));
      }
    } catch (error) {
      console.error('Error loading onhand data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate suggestions for autocomplete
  const generateSuggestions = useCallback((query) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matchedSuggestions = [];

    for (const item of onhandData) {
      if (matchedSuggestions.length >= 6) break;

      const itemNumber = item.itemNumber || '';
      const itemDesc = item.itemDescription || '';

      if (itemNumber.toLowerCase().includes(lowerQuery) || itemDesc.toLowerCase().includes(lowerQuery)) {
        matchedSuggestions.push({
          id: item.inventoryItemId,
          name: itemDesc,
          secondary: itemNumber,
          item: item,
        });
      }
    }

    setSuggestions(matchedSuggestions);
    setShowSuggestions(matchedSuggestions.length > 0);
  }, [onhandData]);

  const filterAndSortData = useCallback(() => {
    let result = [...onhandData];

    // Text search filter
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const itemNumber = (item.itemNumber || '').toLowerCase();
        const itemDesc = (item.itemDescription || '').toLowerCase();
        return itemNumber.includes(lowerQuery) || itemDesc.includes(lowerQuery);
      });
    }

    // Quantity range filter
    const fromQty = qtyFrom !== '' ? parseFloat(qtyFrom) : null;
    const toQty = qtyTo !== '' ? parseFloat(qtyTo) : null;

    if (fromQty !== null) {
      result = result.filter(item => (item.primaryQuantity || 0) >= fromQty);
    }
    if (toQty !== null) {
      result = result.filter(item => (item.primaryQuantity || 0) <= toQty);
    }

    // Sorting
    if (sortOrder === 'qty_asc') {
      result.sort((a, b) => (a.primaryQuantity || 0) - (b.primaryQuantity || 0));
    } else if (sortOrder === 'qty_desc') {
      result.sort((a, b) => (b.primaryQuantity || 0) - (a.primaryQuantity || 0));
    }

    setFilteredData(result);
  }, [searchQuery, onhandData, sortOrder, qtyFrom, qtyTo]);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    generateSuggestions(text);
  };

  const handleSuggestionSelect = (suggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    setFilteredData([suggestion.item]);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleFetchOnhand = async (skipConfirm = false) => {
    // If data exists and not skipping confirm, show confirmation
    if (onhandData.length > 0 && !skipConfirm) {
      Alert.alert(
        'Re-sync Onhand',
        'Onhand data already exists. Do you want to re-sync again?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Re-sync', onPress: () => handleFetchOnhand(true) },
        ]
      );
      return;
    }

    setIsFetching(true);
    setFetchProgress(null);

    const warehouse = user?.WAREHOUSE || user?.warehouse;
    const subinventory = user?.SUBINVENTORY || user?.subinventory;

    const result = await syncOnhand(
      (progress) => setFetchProgress(progress),
      warehouse,
      subinventory
    );

    setIsFetching(false);

    if (result.success) {
      Alert.alert('Success', `Fetched ${result.count.toLocaleString()} onhand records`);
      loadOnhandData();
    } else {
      Alert.alert('Error', result.error || 'Failed to fetch onhand data');
    }
  };

  const handleViewLots = async (item) => {
    setSelectedItem(item);
    setLotModalVisible(true);
    setLots([]);

    if (item.lotsHref) {
      setLoadingLots(true);
      const result = await fetchLotDetails(item.lotsHref);
      setLoadingLots(false);

      if (result.success) {
        setLots(result.lots);
      } else {
        Alert.alert('Error', result.error || 'Failed to fetch lot details');
      }
    }
  };

  const loadMore = () => {
    if (displayData.length < filteredData.length) {
      const nextPage = page + 1;
      const newData = filteredData.slice(0, nextPage * PAGE_SIZE);
      setDisplayData(newData);
      setPage(nextPage);
    }
  };

  const clearFilters = () => {
    setQtyFrom('');
    setQtyTo('');
    setSortOrder('none');
  };

  // Calculate summary
  const totalItems = onhandData.length;
  const lowStockItems = onhandData.filter(item => item.primaryQuantity > 0 && item.primaryQuantity < 10).length;
  const outOfStockItems = onhandData.filter(item => item.primaryQuantity === 0).length;

  const getSortLabel = () => {
    switch (sortOrder) {
      case 'qty_asc': return 'Qty: Low to High';
      case 'qty_desc': return 'Qty: High to Low';
      default: return 'Sort';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Lot Detail Modal */}
      <LotDetailModal
        visible={lotModalVisible}
        lots={lots}
        itemDescription={selectedItem?.itemDescription}
        loading={loadingLots}
        onClose={() => setLotModalVisible(false)}
      />

      {/* Blue Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('AccountDetails')} style={styles.menuButton}>
          <Ionicons name="person-circle" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inventory</Text>
          {(orgCode || subinvCode) && (
            <Text style={styles.headerSubtitle}>
              {orgCode}{orgCode && subinvCode ? ' / ' : ''}{subinvCode}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => handleFetchOnhand(false)}
          disabled={isFetching}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="sync" size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* White Content Area */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading inventory...</Text>
          </View>
        ) : onhandData.length === 0 ? (
          <EmptyStateWithFetch onFetch={() => handleFetchOnhand(true)} isFetching={isFetching} />
        ) : (
          <>
            {/* Last Sync Info */}
            {lastSync && (
              <View style={styles.lastSyncBar}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.lastSyncText}>
                  Last synced: {lastSync.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Search Bar with Autocomplete */}
            <View style={styles.searchWrapper}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search items..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onFocus={() => searchQuery.length >= 2 && generateSuggestions(searchQuery)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={handleClearSearch}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Autocomplete Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={`suggestion-${suggestion.id}-${index}`}
                      style={[
                        styles.suggestionItem,
                        index === suggestions.length - 1 && styles.suggestionItemLast,
                      ]}
                      onPress={() => handleSuggestionSelect(suggestion)}
                    >
                      <View style={styles.suggestionIcon}>
                        <Ionicons name="cube" size={18} color={colors.accent} />
                      </View>
                      <View style={styles.suggestionContent}>
                        <HighlightText
                          text={suggestion.name}
                          highlight={searchQuery}
                          style={styles.suggestionName}
                        />
                        <HighlightText
                          text={suggestion.secondary}
                          highlight={searchQuery}
                          style={styles.suggestionSecondary}
                        />
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => setShowSuggestions(false)}
                  >
                    <Text style={styles.viewAllText}>
                      View all {filteredData.length} results
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Sort and Filter Row */}
            <View style={styles.sortFilterRow}>
              {/* Sort Dropdown */}
              <View style={styles.sortContainer}>
                <TouchableOpacity
                  style={styles.sortButton}
                  onPress={() => setShowSortDropdown(!showSortDropdown)}
                >
                  <Ionicons name="swap-vertical" size={16} color={colors.accent} />
                  <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
                  <Ionicons
                    name={showSortDropdown ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {showSortDropdown && (
                  <View style={styles.sortDropdown}>
                    <TouchableOpacity
                      style={[styles.sortOption, sortOrder === 'none' && styles.sortOptionActive]}
                      onPress={() => { setSortOrder('none'); setShowSortDropdown(false); }}
                    >
                      <Text style={styles.sortOptionText}>Default</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortOption, sortOrder === 'qty_asc' && styles.sortOptionActive]}
                      onPress={() => { setSortOrder('qty_asc'); setShowSortDropdown(false); }}
                    >
                      <Text style={styles.sortOptionText}>Qty: Low to High</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortOption, sortOrder === 'qty_desc' && styles.sortOptionActive]}
                      onPress={() => { setSortOrder('qty_desc'); setShowSortDropdown(false); }}
                    >
                      <Text style={styles.sortOptionText}>Qty: High to Low</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Filter Toggle */}
              <TouchableOpacity
                style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Ionicons name="options" size={16} color={showFilters ? '#FFFFFF' : colors.accent} />
                <Text style={[styles.filterToggleText, showFilters && styles.filterToggleTextActive]}>
                  Qty Range
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quantity Range Inputs */}
            {showFilters && (
              <View style={styles.filterContainer}>
                <View style={styles.qtyInputRow}>
                  <View style={styles.qtyInputWrapper}>
                    <Text style={styles.qtyLabel}>From</Text>
                    <TextInput
                      style={styles.qtyInput}
                      placeholder="Min"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={qtyFrom}
                      onChangeText={setQtyFrom}
                    />
                  </View>
                  <Text style={styles.qtyDivider}>-</Text>
                  <View style={styles.qtyInputWrapper}>
                    <Text style={styles.qtyLabel}>To</Text>
                    <TextInput
                      style={styles.qtyInput}
                      placeholder="Max"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={qtyTo}
                      onChangeText={setQtyTo}
                    />
                  </View>
                  {(qtyFrom !== '' || qtyTo !== '') && (
                    <TouchableOpacity style={styles.clearFilterBtn} onPress={clearFilters}>
                      <Ionicons name="close" size={18} color={colors.accentRed} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={[styles.summaryCard, { borderLeftColor: colors.accent }]}>
                <Text style={styles.summaryValue}>{totalItems.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Total Items</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: colors.accentOrange }]}>
                <Text style={styles.summaryValue}>{lowStockItems.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Low Stock</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: colors.accentRed || '#E53935' }]}>
                <Text style={styles.summaryValue}>{outOfStockItems.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Out of Stock</Text>
              </View>
            </View>

            {/* Fetch Progress */}
            {isFetching && fetchProgress && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.progressText}>{fetchProgress.status}</Text>
              </View>
            )}

            {/* Pagination Info */}
            {filteredData.length > 0 && (
              <View style={styles.paginationBar}>
                <Text style={styles.paginationText}>
                  Showing <Text style={styles.paginationHighlight}>1-{displayData.length.toLocaleString()}</Text> of{' '}
                  <Text style={styles.paginationHighlight}>{filteredData.length.toLocaleString()}</Text> items
                </Text>
              </View>
            )}

            {/* Inventory List */}
            <FlatList
              data={displayData}
              keyExtractor={(item, index) => `onhand-${item.inventoryItemId}-${index}`}
              renderItem={({ item }) => (
                <OnhandCard item={item} onViewLots={handleViewLots} searchQuery={searchQuery} />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={64} color={colors.textMuted} />
                  <Text style={styles.emptyStateText}>No items match your search</Text>
                </View>
              }
              ListFooterComponent={
                displayData.length < filteredData.length ? (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.loadMoreText}>Loading more...</Text>
                  </View>
                ) : displayData.length > 0 ? (
                  <Text style={styles.endText}>
                    Showing all {displayData.length.toLocaleString()} items
                  </Text>
                ) : null
              }
            />
          </>
        )}
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
    paddingBottom: 20,
  },
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  syncButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  fetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 10,
  },
  fetchButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  fetchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lastSyncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  lastSyncText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 100,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.textPrimary,
    fontSize: 15,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  suggestionSecondary: {
    fontSize: 12,
    color: colors.textMuted,
  },
  viewAllButton: {
    paddingVertical: 12,
    backgroundColor: colors.surface || '#F5F5F5',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  sortFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
    zIndex: 50,
  },
  sortContainer: {
    flex: 1,
    position: 'relative',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sortButtonText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  sortDropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  sortOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortOptionActive: {
    backgroundColor: colors.accent + '10',
  },
  sortOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterToggleActive: {
    backgroundColor: colors.accent,
  },
  filterToggleText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  filterToggleTextActive: {
    color: '#FFFFFF',
  },
  filterContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyInputWrapper: {
    flex: 1,
  },
  qtyLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  qtyInput: {
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  qtyDivider: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
  clearFilterBtn: {
    padding: 8,
    marginTop: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  progressText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  paginationBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  paginationText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  paginationHighlight: {
    fontWeight: '600',
    color: colors.accent,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  inventoryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: {
    marginRight: 14,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCenter: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    lineHeight: 18,
  },
  sku: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  quantityLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadMoreText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  endText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  itemName: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  content: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  lotCard: {
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  lotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  lotNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lotDetails: {
    gap: 8,
  },
  lotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lotLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  lotValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
});

export default InventoryScreen;
