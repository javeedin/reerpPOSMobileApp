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
  Modal,
  ScrollView,
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

// Format currency
const formatCurrency = (value) => {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('en-US', { minimumFractionDigits: 0 });
};

// Customer Detail Modal
const CustomerDetailModal = ({ visible, customer, onClose }) => {
  if (!customer) return null;

  const DetailRow = ({ label, value, icon }) => (
    value ? (
      <View style={modalStyles.detailRow}>
        <View style={modalStyles.detailIcon}>
          <Ionicons name={icon} size={18} color={colors.accent} />
        </View>
        <View style={modalStyles.detailContent}>
          <Text style={modalStyles.detailLabel}>{label}</Text>
          <Text style={modalStyles.detailValue}>{value}</Text>
        </View>
      </View>
    ) : null
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>Customer Details</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
            {/* Customer Name */}
            <View style={modalStyles.nameSection}>
              <View style={modalStyles.avatarLarge}>
                <Text style={modalStyles.avatarTextLarge}>
                  {(customer.name || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={modalStyles.customerName}>{customer.name || 'Unknown'}</Text>
              <Text style={modalStyles.accountNumber}>#{customer.accountNumber}</Text>
              <View style={[
                modalStyles.statusBadge,
                { backgroundColor: customer.status === 'A' ? colors.accentGreen + '20' : colors.accentRed + '20' }
              ]}>
                <Text style={[
                  modalStyles.statusText,
                  { color: customer.status === 'A' ? colors.accentGreen : colors.accentRed }
                ]}>
                  {customer.status === 'A' ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            {/* Main Details */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Contact Information</Text>
              <DetailRow label="Email" value={customer.email} icon="mail-outline" />
              <DetailRow label="Phone" value={customer.phone} icon="call-outline" />
              <DetailRow label="Address" value={customer.address} icon="location-outline" />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Business Information</Text>
              <DetailRow label="Price List" value={customer.priceList} icon="pricetag-outline" />
              <DetailRow
                label="Credit Limit"
                value={customer.creditLimit ? `MUR ${formatCurrency(customer.creditLimit)}` : null}
                icon="wallet-outline"
              />
              <DetailRow label="Payment Term" value={customer.paymentTerm} icon="time-outline" />
              <DetailRow label="Salesperson" value={customer.salesperson} icon="person-outline" />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Classification</Text>
              <DetailRow label="Customer Class" value={customer.customerClass} icon="albums-outline" />
              <DetailRow label="Category" value={customer.customerCategory} icon="folder-outline" />
              <DetailRow label="MRA Category" value={customer.mraCategory} icon="business-outline" />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Tax & Registration</Text>
              <DetailRow label="BRN" value={customer.brn} icon="document-text-outline" />
              <DetailRow label="VAT No" value={customer.vatNo} icon="receipt-outline" />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Status</Text>
              <DetailRow
                label="Hold Status"
                value={customer.holdStatus === 'N' ? 'No Hold' : 'On Hold'}
                icon={customer.holdStatus === 'N' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              />
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Customer Card
const CustomerCard = ({ item, onViewDetails }) => (
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
          #{item.accountNumber || 'N/A'}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onViewDetails(item)} style={styles.moreButton}>
        <Ionicons name="information-circle-outline" size={24} color={colors.accent} />
      </TouchableOpacity>
    </View>

    <View style={styles.cardDetails}>
      {item.address && (
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.detailText} numberOfLines={1}>{item.address}</Text>
        </View>
      )}
      <View style={styles.tagsRow}>
        {item.priceList && (
          <View style={styles.tag}>
            <Ionicons name="pricetag" size={12} color={colors.accentPurple} />
            <Text style={styles.tagText}>{item.priceList}</Text>
          </View>
        )}
        {item.creditLimit && (
          <View style={[styles.tag, { backgroundColor: colors.accentGreen + '15' }]}>
            <Ionicons name="wallet" size={12} color={colors.accentGreen} />
            <Text style={[styles.tagText, { color: colors.accentGreen }]}>
              {formatCurrency(item.creditLimit)}
            </Text>
          </View>
        )}
      </View>
    </View>
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
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, [type]);

  useEffect(() => {
    filterData();
  }, [searchQuery, data]);

  useEffect(() => {
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

  const handleViewDetails = (customer) => {
    setSelectedCustomer(customer);
    setModalVisible(true);
  };

  const renderItem = ({ item }) => {
    switch (type) {
      case 'customers':
        return <CustomerCard item={item} onViewDetails={handleViewDetails} />;
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

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        visible={modalVisible}
        customer={selectedCustomer}
        onClose={() => setModalVisible(false)}
      />

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
  moreButton: {
    padding: 8,
  },
  cardDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPurple + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accentPurple,
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
    maxHeight: '85%',
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
  content: {
    paddingHorizontal: 20,
  },
  nameSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTextLarge: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.accent,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: colors.textPrimary,
  },
});

export default SyncedDataViewScreen;
