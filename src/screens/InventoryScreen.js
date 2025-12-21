import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  Keyboard,
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
          <Ionicons name="cube" size={20} color={stockStatus.color} />
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
              <Ionicons name="layers" size={8} color={colors.accentPurple} />
              <Text style={[styles.statusText, { color: colors.accentPurple, marginLeft: 3 }]}>Lots</Text>
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

const FILTER_SECTION_HEIGHT = 280; // Height includes search, filters, and KPI cards
const ITEM_HEIGHT = 75; // Approximate height of each list item (reduced)
const COLLAPSE_THRESHOLD = 5; // Number of items to scroll before collapsing

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

  // Sorting and filtering - now with column selection and direction
  const [sortColumn, setSortColumn] = useState('none'); // 'none', 'itemNumber', 'itemDescription', 'primaryQuantity'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [qtyFrom, setQtyFrom] = useState('');
  const [qtyTo, setQtyTo] = useState('');
  const [quickFilter, setQuickFilter] = useState('none'); // 'none', 'top20', 'low20'
  const [quickFilterLimit, setQuickFilterLimit] = useState(20); // How many items to show for quick filter

  // Collapsible filter section
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const filterHeight = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const isUserScrolling = useRef(false);


  // Lot modal states
  const [lotModalVisible, setLotModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);

  // FlatList ref for scroll tracking
  const flatListRef = useRef(null);

  useEffect(() => {
    loadOnhandData();
  }, []);

  useEffect(() => {
    filterAndSortData();
  }, [searchQuery, onhandData, sortColumn, sortDirection, qtyFrom, qtyTo, quickFilter]);

  // Animate filter section collapse/expand
  const animateFilterSection = useCallback((expand) => {
    Animated.spring(filterHeight, {
      toValue: expand ? 1 : 0,
      useNativeDriver: false,
      friction: 10,
      tension: 50,
    }).start();
    setIsFilterExpanded(expand);
  }, [filterHeight]);

  // Handle scroll to auto-collapse/expand filter section
  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;
    const scrollThreshold = ITEM_HEIGHT * COLLAPSE_THRESHOLD;

    // Scrolling down past threshold - collapse
    if (currentScrollY > scrollThreshold && isFilterExpanded && scrollDiff > 0) {
      animateFilterSection(false);
      Keyboard.dismiss();
    }
    // Scrolling up near top - expand
    else if (currentScrollY < ITEM_HEIGHT && !isFilterExpanded && scrollDiff < 0) {
      animateFilterSection(true);
    }

    lastScrollY.current = currentScrollY;
  }, [isFilterExpanded, animateFilterSection]);

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

    // Quick filter: Top N or Low N
    if (quickFilter === 'top20') {
      result.sort((a, b) => (b.primaryQuantity || 0) - (a.primaryQuantity || 0));
      result = result.slice(0, quickFilterLimit);
    } else if (quickFilter === 'low20') {
      result.sort((a, b) => (a.primaryQuantity || 0) - (b.primaryQuantity || 0));
      result = result.slice(0, quickFilterLimit);
    } else if (sortColumn !== 'none') {
      // Column-based sorting with direction (only if no quick filter)
      result.sort((a, b) => {
        let aVal, bVal;

        switch (sortColumn) {
          case 'itemNumber':
            aVal = (a.itemNumber || '').toLowerCase();
            bVal = (b.itemNumber || '').toLowerCase();
            break;
          case 'itemDescription':
            aVal = (a.itemDescription || '').toLowerCase();
            bVal = (b.itemDescription || '').toLowerCase();
            break;
          case 'primaryQuantity':
            aVal = a.primaryQuantity || 0;
            bVal = b.primaryQuantity || 0;
            break;
          default:
            return 0;
        }

        // Compare based on type
        let comparison = 0;
        if (typeof aVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else {
          comparison = aVal - bVal;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredData(result);
  }, [searchQuery, onhandData, sortColumn, sortDirection, qtyFrom, qtyTo, quickFilter, quickFilterLimit]);

  const handleClearSearch = () => {
    setSearchQuery('');
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
    setSortColumn('none');
    setSortDirection('asc');
    setQuickFilter('none');
    setQuickFilterLimit(20);
  };

  // Load more for quick filter
  const loadMoreQuickFilter = () => {
    setQuickFilterLimit(prev => prev + 20);
  };

  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Handle column selection for sorting
  const handleSortColumnSelect = (column) => {
    if (sortColumn === column) {
      // If same column, toggle direction
      toggleSortDirection();
    } else {
      // New column, set to asc by default
      setSortColumn(column);
      setSortDirection('asc');
    }
    setShowSortDropdown(false);
  };

  // Calculate summary
  const totalItems = onhandData.length;
  const lowStockItems = onhandData.filter(item => item.primaryQuantity > 0 && item.primaryQuantity < 10).length;
  const outOfStockItems = onhandData.filter(item => item.primaryQuantity === 0).length;

  const getSortColumnLabel = () => {
    switch (sortColumn) {
      case 'itemNumber': return 'Item Number';
      case 'itemDescription': return 'Description';
      case 'primaryQuantity': return 'Quantity';
      default: return 'Sort By';
    }
  };

  const getSortLabel = () => {
    if (sortColumn === 'none') return 'Sort By';
    const colLabel = getSortColumnLabel();
    const dirLabel = sortDirection === 'asc' ? '↑' : '↓';
    return `${colLabel} ${dirLabel}`;
  };

  // Check if any filters are active
  const hasActiveFilters = searchQuery.trim() || qtyFrom !== '' || qtyTo !== '' || sortColumn !== 'none' || quickFilter !== 'none';

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
          {lastSync && (
            <Text style={styles.headerSyncTime}>
              Synced: {lastSync.toLocaleDateString()} {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            {/* Collapsible Filter Section */}
            <Animated.View
              style={[
                styles.collapsibleSection,
                {
                  maxHeight: filterHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, FILTER_SECTION_HEIGHT],
                  }),
                  opacity: filterHeight,
                  overflow: 'hidden',
                },
              ]}
            >
              {/* Summary Cards - at top of collapsible section */}
              <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, { borderLeftColor: colors.accent }]}>
                  <Text style={styles.summaryValue}>{totalItems.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
                <View style={[styles.summaryCard, { borderLeftColor: colors.accentOrange }]}>
                  <Text style={styles.summaryValue}>{lowStockItems.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>Low Stock</Text>
                </View>
                <View style={[styles.summaryCard, { borderLeftColor: colors.accentRed || '#E53935' }]}>
                  <Text style={styles.summaryValue}>{outOfStockItems.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>Out</Text>
                </View>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search items..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={handleClearSearch}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Row 1: Sort By */}
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortButton, sortColumn !== 'none' && styles.sortButtonActive]}
                  onPress={() => setShowSortDropdown(true)}
                >
                  <Ionicons name="swap-vertical" size={16} color={sortColumn !== 'none' ? '#FFFFFF' : colors.accent} />
                  <Text style={[styles.sortButtonText, sortColumn !== 'none' && styles.sortButtonTextActive]}>
                    {sortColumn === 'none' ? 'Sort By' : getSortLabel().split(' ')[0]}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={sortColumn !== 'none' ? '#FFFFFF' : colors.textMuted}
                  />
                </TouchableOpacity>

                {/* Sort Direction Buttons - Asc / Desc */}
                {sortColumn !== 'none' && (
                  <View style={styles.directionButtons}>
                    <TouchableOpacity
                      style={[styles.directionBtn, sortDirection === 'asc' && styles.directionBtnActive]}
                      onPress={() => setSortDirection('asc')}
                    >
                      <Ionicons name="arrow-up" size={16} color={sortDirection === 'asc' ? '#FFFFFF' : colors.accent} />
                      <Text style={[styles.directionBtnText, sortDirection === 'asc' && styles.directionBtnTextActive]}>Asc</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.directionBtn, sortDirection === 'desc' && styles.directionBtnActive]}
                      onPress={() => setSortDirection('desc')}
                    >
                      <Ionicons name="arrow-down" size={16} color={sortDirection === 'desc' ? '#FFFFFF' : colors.accent} />
                      <Text style={[styles.directionBtnText, sortDirection === 'desc' && styles.directionBtnTextActive]}>Desc</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <TouchableOpacity style={styles.clearAllBtn} onPress={clearFilters}>
                    <Ionicons name="close-circle" size={20} color={colors.accentRed || '#E53935'} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Row 2: Qty Range and Quick Filters */}
              <View style={styles.qtyFilterRow}>
                {/* Quantity Range Inputs */}
                <TextInput
                  style={styles.qtyInputSmall}
                  placeholder="Min Qty"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={qtyFrom}
                  onChangeText={(val) => { setQtyFrom(val); setQuickFilter('none'); }}
                />
                <Text style={styles.qtyDividerSmall}>-</Text>
                <TextInput
                  style={styles.qtyInputSmall}
                  placeholder="Max Qty"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={qtyTo}
                  onChangeText={(val) => { setQtyTo(val); setQuickFilter('none'); }}
                />

                {/* Quick Filter Buttons */}
                <TouchableOpacity
                  style={[styles.quickFilterBtn, quickFilter === 'top20' && styles.quickFilterBtnActive]}
                  onPress={() => {
                    if (quickFilter === 'top20') {
                      setQuickFilter('none');
                    } else {
                      setQuickFilter('top20');
                      setQuickFilterLimit(20);
                    }
                    setQtyFrom('');
                    setQtyTo('');
                  }}
                >
                  <Ionicons name="arrow-up" size={14} color={quickFilter === 'top20' ? '#FFFFFF' : colors.accent} />
                  <Text style={[styles.quickFilterText, quickFilter === 'top20' && styles.quickFilterTextActive]}>Top 20</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickFilterBtn, quickFilter === 'low20' && styles.quickFilterBtnActive]}
                  onPress={() => {
                    if (quickFilter === 'low20') {
                      setQuickFilter('none');
                    } else {
                      setQuickFilter('low20');
                      setQuickFilterLimit(20);
                    }
                    setQtyFrom('');
                    setQtyTo('');
                  }}
                >
                  <Ionicons name="arrow-down" size={14} color={quickFilter === 'low20' ? '#FFFFFF' : colors.accent} />
                  <Text style={[styles.quickFilterText, quickFilter === 'low20' && styles.quickFilterTextActive]}>Low 20</Text>
                </TouchableOpacity>
              </View>

            </Animated.View>

            {/* Collapsed Filter Bar - shows when collapsed */}
            {!isFilterExpanded && (
              <TouchableOpacity
                style={styles.collapsedFilterBar}
                onPress={() => animateFilterSection(true)}
              >
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <Text style={styles.collapsedFilterText}>
                  {hasActiveFilters ? 'Filters active' : 'Tap to expand'}
                </Text>
                <View style={styles.collapsedKpiRow}>
                  <Text style={styles.collapsedKpiText}>{totalItems}</Text>
                  <Text style={styles.collapsedKpiDivider}>|</Text>
                  <Text style={[styles.collapsedKpiText, { color: colors.accentOrange }]}>{lowStockItems}</Text>
                  <Text style={styles.collapsedKpiDivider}>|</Text>
                  <Text style={[styles.collapsedKpiText, { color: colors.accentRed || '#E53935' }]}>{outOfStockItems}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}

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
              ref={flatListRef}
              data={displayData}
              keyExtractor={(item, index) => `onhand-${item.inventoryItemId}-${index}`}
              renderItem={({ item }) => (
                <OnhandCard item={item} onViewLots={handleViewLots} searchQuery={searchQuery} />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              onScroll={handleScroll}
              scrollEventThrottle={16}
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
                ) : quickFilter !== 'none' && filteredData.length === quickFilterLimit && onhandData.length > quickFilterLimit ? (
                  <TouchableOpacity style={styles.getMoreBtn} onPress={loadMoreQuickFilter}>
                    <Ionicons
                      name={quickFilter === 'top20' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                      size={20}
                      color={colors.accent}
                    />
                    <Text style={styles.getMoreBtnText}>
                      {quickFilter === 'top20' ? 'Get another Top 20' : 'Get another Low 20'}
                    </Text>
                  </TouchableOpacity>
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

      {/* Sort Dropdown Modal */}
      <Modal
        visible={showSortDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSortDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={styles.sortModalContent}>
            <Text style={styles.sortModalTitle}>Sort By Column</Text>
            <TouchableOpacity
              style={[styles.sortModalOption, sortColumn === 'none' && styles.sortModalOptionActive]}
              onPress={() => handleSortColumnSelect('none')}
            >
              <Text style={[styles.sortModalOptionText, sortColumn === 'none' && styles.sortModalOptionTextActive]}>Default</Text>
              {sortColumn === 'none' && <Ionicons name="checkmark" size={20} color={colors.accent} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortModalOption, sortColumn === 'itemNumber' && styles.sortModalOptionActive]}
              onPress={() => handleSortColumnSelect('itemNumber')}
            >
              <Text style={[styles.sortModalOptionText, sortColumn === 'itemNumber' && styles.sortModalOptionTextActive]}>Item Number</Text>
              {sortColumn === 'itemNumber' && <Ionicons name="checkmark" size={20} color={colors.accent} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortModalOption, sortColumn === 'itemDescription' && styles.sortModalOptionActive]}
              onPress={() => handleSortColumnSelect('itemDescription')}
            >
              <Text style={[styles.sortModalOptionText, sortColumn === 'itemDescription' && styles.sortModalOptionTextActive]}>Description</Text>
              {sortColumn === 'itemDescription' && <Ionicons name="checkmark" size={20} color={colors.accent} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortModalOption, sortColumn === 'primaryQuantity' && styles.sortModalOptionActive]}
              onPress={() => handleSortColumnSelect('primaryQuantity')}
            >
              <Text style={[styles.sortModalOptionText, sortColumn === 'primaryQuantity' && styles.sortModalOptionTextActive]}>Quantity</Text>
              {sortColumn === 'primaryQuantity' && <Ionicons name="checkmark" size={20} color={colors.accent} />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerSyncTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 44,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  qtyFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
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
  sortButtonActive: {
    backgroundColor: colors.accent,
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 1001,
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
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  directionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  directionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  directionBtnActive: {
    backgroundColor: colors.accent,
  },
  directionBtnText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  directionBtnTextActive: {
    color: '#FFFFFF',
  },
  qtyRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyInputSmall: {
    width: 70,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 6,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  qtyDividerSmall: {
    fontSize: 14,
    color: colors.textMuted,
  },
  quickFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickFilterBtnActive: {
    backgroundColor: colors.accent,
  },
  quickFilterText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  quickFilterTextActive: {
    color: '#FFFFFF',
  },
  clearAllBtn: {
    padding: 4,
  },
  collapsibleSection: {
    zIndex: 100,
    paddingTop: 12,
  },
  collapsedFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  collapsedFilterText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  collapsedKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapsedKpiText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  collapsedKpiDivider: {
    fontSize: 12,
    color: colors.textMuted,
  },
  filterBadge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
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
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 6,
    zIndex: 1,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
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
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLeft: {
    marginRight: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCenter: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 1,
    lineHeight: 16,
  },
  sku: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '500',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  quantityLabel: {
    fontSize: 9,
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
  getMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  getMoreBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '80%',
    maxWidth: 300,
    paddingVertical: 8,
  },
  sortModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  sortModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sortModalOptionActive: {
    backgroundColor: colors.accent + '10',
  },
  sortModalOptionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  sortModalOptionTextActive: {
    color: colors.accent,
    fontWeight: '500',
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
