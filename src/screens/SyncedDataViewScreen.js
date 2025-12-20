import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import {
  getCustomers,
  getItems,
  getAgents,
  getPriceList,
} from '../services/syncService';

const PAGE_SIZE = 50;

const getDataLoader = (type) => {
  switch (type) {
    case 'customers':
      return getCustomers;
    case 'items':
      return getItems;
    case 'agents':
      return getAgents;
    case 'priceList':
      return getPriceList;
    default:
      return () => [];
  }
};

const getTitle = (type) => {
  switch (type) {
    case 'customers':
      return 'Customers';
    case 'items':
      return 'Items';
    case 'agents':
      return 'Agents';
    case 'priceList':
      return 'Price List';
    default:
      return 'Data';
  }
};

const getIcon = (type) => {
  switch (type) {
    case 'customers':
      return 'people';
    case 'items':
      return 'cube';
    case 'agents':
      return 'person';
    case 'priceList':
      return 'pricetag';
    default:
      return 'list';
  }
};

// Customer Card
const CustomerCard = ({ item }) => (
  <View style={styles.dataCard}>
    <View style={styles.cardHeader}>
      <View style={[styles.avatar, { backgroundColor: colors.accent + '20' }]}>
        <Text style={styles.avatarText}>
          {(item.name || 'C').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name || 'Unknown'}
        </Text>
        <Text style={styles.cardSubtitle}>
          #{item.number || item.id || 'N/A'}
        </Text>
      </View>
    </View>
    {(item.email || item.phone || item.address) && (
      <View style={styles.cardDetails}>
        {item.email && (
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
            <Text style={styles.detailText}>{item.email}</Text>
          </View>
        )}
        {item.phone && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={14} color={colors.textMuted} />
            <Text style={styles.detailText}>{item.phone}</Text>
          </View>
        )}
        {item.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.detailText} numberOfLines={1}>{item.address}</Text>
          </View>
        )}
      </View>
    )}
  </View>
);

// Item Card
const ItemCard = ({ item }) => (
  <View style={styles.dataCard}>
    <View style={styles.cardHeader}>
      <View style={[styles.avatar, { backgroundColor: colors.accentPurple + '20' }]}>
        <Ionicons name="cube" size={24} color={colors.accentPurple} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name || 'Unknown Item'}
        </Text>
        <Text style={styles.cardSubtitle}>
          {item.number || item.id || 'N/A'}
        </Text>
      </View>
    </View>
    {(item.uom || item.price || item.category) && (
      <View style={styles.cardDetails}>
        {item.uom && (
          <View style={styles.detailRow}>
            <Ionicons name="resize-outline" size={14} color={colors.textMuted} />
            <Text style={styles.detailText}>UOM: {item.uom}</Text>
          </View>
        )}
        {item.price && (
          <View style={styles.detailRow}>
            <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
            <Text style={styles.detailText}>Price: ${item.price}</Text>
          </View>
        )}
        {item.category && (
          <View style={styles.detailRow}>
            <Ionicons name="folder-outline" size={14} color={colors.textMuted} />
            <Text style={styles.detailText}>{item.category}</Text>
          </View>
        )}
      </View>
    )}
  </View>
);

// Agent Card
const AgentCard = ({ item }) => (
  <View style={styles.dataCard}>
    <View style={styles.cardHeader}>
      <View style={[styles.avatar, { backgroundColor: colors.accentGreen + '20' }]}>
        <Ionicons name="person" size={24} color={colors.accentGreen} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name || 'Unknown Agent'}
        </Text>
        <Text style={styles.cardSubtitle}>
          #{item.id || 'N/A'}
        </Text>
      </View>
    </View>
  </View>
);

// Price List Card
const PriceListCard = ({ item }) => (
  <View style={styles.dataCard}>
    <View style={styles.cardHeader}>
      <View style={[styles.avatar, { backgroundColor: colors.accentOrange + '20' }]}>
        <Ionicons name="pricetag" size={24} color={colors.accentOrange} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name || 'Unknown Price List'}
        </Text>
        <Text style={styles.cardSubtitle}>
          {item.currency || 'USD'}
        </Text>
      </View>
    </View>
    {item.price && (
      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={14} color={colors.textMuted} />
          <Text style={styles.detailText}>Price: ${item.price}</Text>
        </View>
      </View>
    )}
  </View>
);

const SyncedDataViewScreen = ({ navigation, route }) => {
  const { type } = route.params;
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [type]);

  useEffect(() => {
    filterData();
  }, [searchQuery, data]);

  useEffect(() => {
    // Load first page of filtered data
    setDisplayData(filteredData.slice(0, PAGE_SIZE));
    setPage(1);
  }, [filteredData]);

  const loadData = async () => {
    setLoading(true);
    const loader = getDataLoader(type);
    const loadedData = await loader();
    setData(loadedData);
    setFilteredData(loadedData);
    setLoading(false);
  };

  const filterData = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = data.filter((item) => {
      const searchFields = Object.values(item)
        .filter((v) => typeof v === 'string')
        .join(' ')
        .toLowerCase();
      return searchFields.includes(lowerQuery);
    });
    setFilteredData(filtered);
  }, [searchQuery, data]);

  const loadMore = () => {
    if (displayData.length < filteredData.length) {
      const nextPage = page + 1;
      const newData = filteredData.slice(0, nextPage * PAGE_SIZE);
      setDisplayData(newData);
      setPage(nextPage);
    }
  };

  const renderItem = ({ item }) => {
    switch (type) {
      case 'customers':
        return <CustomerCard item={item} />;
      case 'items':
        return <ItemCard item={item} />;
      case 'agents':
        return <AgentCard item={item} />;
      case 'priceList':
        return <PriceListCard item={item} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Blue Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name={getIcon(type)} size={22} color="#FFFFFF" />
          <Text style={styles.headerTitle}>{getTitle(type)}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filteredData.length.toLocaleString()}</Text>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${getTitle(type).toLowerCase()}...`}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      ) : filteredData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name={getIcon(type)} size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Data Found</Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Try a different search term'
              : 'Sync data from the Sync Data screen'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item, index) => `${type}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            displayData.length < filteredData.length ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadMoreText}>Loading more...</Text>
              </View>
            ) : (
              <Text style={styles.endText}>
                Showing {displayData.length.toLocaleString()} of{' '}
                {filteredData.length.toLocaleString()} records
              </Text>
            )
          }
        />
      )}
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  dataCard: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cardDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
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

export default SyncedDataViewScreen;
