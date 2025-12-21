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
  getPriceListNames,
  getPriceListItems,
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
        <Text style={styles.customerName} numberOfLines={2}>
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

// Price List Item Detail Modal
const PriceListItemDetailModal = ({ visible, item, onClose }) => {
  if (!item) return null;

  const DetailRow = ({ label, value, icon }) => (
    value ? (
      <View style={modalStyles.detailRow}>
        <View style={modalStyles.detailIcon}>
          <Ionicons name={icon} size={18} color={colors.accentOrange} />
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
            <Text style={modalStyles.headerTitle}>Item Details</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
            {/* Item Name */}
            <View style={modalStyles.nameSection}>
              <View style={[modalStyles.avatarLarge, { backgroundColor: colors.accentOrange + '20' }]}>
                <Ionicons name="cube" size={36} color={colors.accentOrange} />
              </View>
              <Text style={modalStyles.customerName}>{item.itemDesc || 'Unknown Item'}</Text>
              <Text style={modalStyles.accountNumber}>#{item.itemNumber}</Text>
              <View style={[
                modalStyles.statusBadge,
                { backgroundColor: item.itemStatus === 'Active' ? colors.accentGreen + '20' : colors.accentOrange + '20' }
              ]}>
                <Text style={[
                  modalStyles.statusText,
                  { color: item.itemStatus === 'Active' ? colors.accentGreen : colors.accentOrange }
                ]}>
                  {item.itemStatus || 'N/A'}
                </Text>
              </View>
            </View>

            {/* Pricing Info */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Pricing Information</Text>
              <DetailRow label="Base Price" value={item.basePrice ? `${item.currency || 'MUR'} ${formatCurrency(item.basePrice)}` : null} icon="cash-outline" />
              <DetailRow label="Price List" value={item.listName || item.priceListName} icon="pricetag-outline" />
              <DetailRow label="UOM" value={item.uom} icon="resize-outline" />
              <DetailRow label="Tax Code" value={item.taxCode} icon="calculator-outline" />
              <DetailRow label="Tax Rate" value={item.taxRate ? `${item.taxRate}%` : null} icon="receipt-outline" />
              <DetailRow label="Allow Discount" value={item.allowDiscount === 'Y' ? 'Yes' : item.allowDiscount === 'N' ? 'No' : null} icon="gift-outline" />
            </View>

            {/* Product Info */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Product Information</Text>
              <DetailRow label="Barcode" value={item.barcode !== 'NA' ? item.barcode : null} icon="barcode-outline" />
              <DetailRow label="Brand" value={item.brand} icon="bookmark-outline" />
              <DetailRow label="Supplier" value={item.supplier} icon="business-outline" />
              <DetailRow label="Profit Center" value={item.profitCenter} icon="trending-up-outline" />
            </View>

            {/* Category Info */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Classification</Text>
              <DetailRow label="Category" value={item.category} icon="folder-outline" />
              <DetailRow label="Sub Category" value={item.subCategory} icon="folder-open-outline" />
              <DetailRow label="Super Category" value={item.superCategory} icon="albums-outline" />
              <DetailRow label="Alcoholic" value={item.alcoholicFlag === 'Y' ? 'Yes' : item.alcoholicFlag === 'N' ? 'No' : null} icon="wine-outline" />
            </View>

            {/* Dates */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Validity</Text>
              <DetailRow label="Start Date" value={item.startDate ? new Date(item.startDate).toLocaleDateString() : null} icon="calendar-outline" />
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Price List Item Card
const PriceListCard = ({ item, onViewDetails }) => (
  <View style={styles.dataCard}>
    <View style={styles.cardHeader}>
      <View style={[styles.avatar, { backgroundColor: colors.accentOrange + '20' }]}>
        <Ionicons name="cube" size={24} color={colors.accentOrange} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.priceListItemName} numberOfLines={2}>
          {item.itemDesc || 'Unknown Item'}
        </Text>
        <Text style={styles.cardSubtitle}>
          #{item.itemNumber || 'N/A'}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onViewDetails(item)} style={styles.moreButton}>
        <Ionicons name="information-circle-outline" size={24} color={colors.accentOrange} />
      </TouchableOpacity>
    </View>

    <View style={styles.cardDetails}>
      {item.listName && (
        <View style={styles.detailRow}>
          <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
          <Text style={styles.detailText} numberOfLines={1}>{item.listName}</Text>
        </View>
      )}
      <View style={styles.tagsRow}>
        {item.basePrice && (
          <View style={[styles.tag, { backgroundColor: colors.accentGreen + '15' }]}>
            <Ionicons name="cash" size={12} color={colors.accentGreen} />
            <Text style={[styles.tagText, { color: colors.accentGreen }]}>
              {item.currency || 'MUR'} {formatCurrency(item.basePrice)}
            </Text>
          </View>
        )}
        {item.brand && (
          <View style={styles.tag}>
            <Ionicons name="bookmark" size={12} color={colors.accentPurple} />
            <Text style={styles.tagText}>{item.brand}</Text>
          </View>
        )}
        {item.category && (
          <View style={[styles.tag, { backgroundColor: colors.accentOrange + '15' }]}>
            <Ionicons name="folder" size={12} color={colors.accentOrange} />
            <Text style={[styles.tagText, { color: colors.accentOrange }]}>{item.category}</Text>
          </View>
        )}
      </View>
    </View>
  </View>
);

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
  const [selectedPriceListItem, setSelectedPriceListItem] = useState(null);
  const [priceListModalVisible, setPriceListModalVisible] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Price List specific states
  const [activeTab, setActiveTab] = useState('lists'); // 'lists' or 'items'
  const [priceListNames, setPriceListNames] = useState([]);
  const [priceListItemCounts, setPriceListItemCounts] = useState({});
  const [selectedPriceListFilter, setSelectedPriceListFilter] = useState(null);
  const [showPriceListDropdown, setShowPriceListDropdown] = useState(false);
  const [allPriceListItems, setAllPriceListItems] = useState([]);

  useEffect(() => {
    loadData();
  }, [type]);

  // Load price list names and count items when type is priceList
  useEffect(() => {
    if (type === 'priceList') {
      loadPriceListData();
    }
  }, [type]);

  useEffect(() => {
    filterData();
  }, [searchQuery, data, selectedPriceListFilter, activeTab]);

  useEffect(() => {
    setDisplayData(filteredData.slice(0, PAGE_SIZE));
    setPage(1);
  }, [filteredData]);

  // Reset search when switching tabs
  useEffect(() => {
    if (type === 'priceList') {
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
      if (activeTab === 'items') {
        setFilteredData(allPriceListItems);
        setSelectedPriceListFilter(null);
      }
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    const loader = getDataLoader(type);
    const loadedData = await loader();
    setData(loadedData);
    setFilteredData(loadedData);
    setLoading(false);
  };

  // Load price list specific data
  const loadPriceListData = async () => {
    try {
      // Get price list names
      const lists = await getPriceListNames();
      setPriceListNames(lists);

      // Get all items to calculate counts
      const allItems = await getPriceListItems();
      setAllPriceListItems(allItems);

      // Calculate item count per price list
      const counts = {};
      allItems.forEach((item) => {
        const listName = item.priceListName || item.listName;
        if (listName) {
          counts[listName] = (counts[listName] || 0) + 1;
        }
      });
      setPriceListItemCounts(counts);
    } catch (error) {
      console.error('Error loading price list data:', error);
    }
  };

  // Filter items by selected price list
  const filterByPriceList = useCallback((priceListName) => {
    setSelectedPriceListFilter(priceListName);
    setShowPriceListDropdown(false);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);

    if (!priceListName) {
      // Show all items
      setFilteredData(allPriceListItems);
    } else {
      // Filter by price list
      const filtered = allPriceListItems.filter(
        (item) => item.priceListName === priceListName || item.listName === priceListName
      );
      setFilteredData(filtered);
    }
  }, [allPriceListItems]);

  // Generate suggestions based on search query
  const generateSuggestions = useCallback((query) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matchedSuggestions = [];

    // Use filteredData for price list items to respect filter
    const searchData = type === 'priceList' && activeTab === 'items' ? filteredData : data;

    for (const item of searchData) {
      if (matchedSuggestions.length >= 6) break;

      // Get the display name based on type
      let name, secondary;
      if (type === 'priceList') {
        name = item.itemDesc || '';
        secondary = item.itemNumber || '';
      } else {
        name = item.name || '';
        secondary = item.accountNumber || item.number || item.id || '';
      }

      if (name.toLowerCase().includes(lowerQuery) || secondary.toString().toLowerCase().includes(lowerQuery)) {
        matchedSuggestions.push({
          id: item.id || secondary,
          name: name,
          secondary: secondary,
          item: item,
        });
      }
    }

    setSuggestions(matchedSuggestions);
    setShowSuggestions(matchedSuggestions.length > 0);
  }, [data, filteredData, type, activeTab]);

  const filterData = useCallback(() => {
    // For price list items tab, start with selected filter data
    let baseData = data;
    if (type === 'priceList' && activeTab === 'items') {
      if (selectedPriceListFilter) {
        baseData = allPriceListItems.filter(
          (item) => item.priceListName === selectedPriceListFilter || item.listName === selectedPriceListFilter
        );
      } else {
        baseData = allPriceListItems;
      }
    }

    if (!searchQuery.trim()) {
      setFilteredData(baseData);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = baseData.filter((item) => {
      const searchFields = Object.values(item)
        .filter((v) => typeof v === 'string')
        .join(' ')
        .toLowerCase();
      return searchFields.includes(lowerQuery);
    });
    setFilteredData(filtered);
  }, [searchQuery, data, type, activeTab, selectedPriceListFilter, allPriceListItems]);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    generateSuggestions(text);
  };

  const handleSuggestionSelect = (suggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    // Filter to show selected item
    setFilteredData([suggestion.item]);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
  };

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

  const handleViewPriceListDetails = (item) => {
    setSelectedPriceListItem(item);
    setPriceListModalVisible(true);
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
        return <PriceListCard item={item} onViewDetails={handleViewPriceListDetails} />;
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

      {/* Price List Item Detail Modal */}
      <PriceListItemDetailModal
        visible={priceListModalVisible}
        item={selectedPriceListItem}
        onClose={() => setPriceListModalVisible(false)}
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
          <Text style={styles.countText}>
            {type === 'priceList' && activeTab === 'lists'
              ? priceListNames.length.toLocaleString()
              : filteredData.length.toLocaleString()}
          </Text>
        </View>
      </LinearGradient>

      {/* Price List Tabs */}
      {type === 'priceList' && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'lists' && styles.tabActive]}
            onPress={() => setActiveTab('lists')}
          >
            <Ionicons
              name="list"
              size={18}
              color={activeTab === 'lists' ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'lists' && styles.tabTextActive]}>
              Price Lists
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'items' && styles.tabActive]}
            onPress={() => setActiveTab('items')}
          >
            <Ionicons
              name="cube"
              size={18}
              color={activeTab === 'items' ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'items' && styles.tabTextActive]}>
              Items
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Price List Filter Dropdown (for Items tab) */}
      {type === 'priceList' && activeTab === 'items' && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowPriceListDropdown(!showPriceListDropdown)}
          >
            <Ionicons name="funnel" size={18} color={colors.accent} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {selectedPriceListFilter || 'All Price Lists'}
            </Text>
            <Ionicons
              name={showPriceListDropdown ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {showPriceListDropdown && (
            <View style={styles.dropdownContainer}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    !selectedPriceListFilter && styles.dropdownItemActive,
                  ]}
                  onPress={() => filterByPriceList(null)}
                >
                  <Text style={styles.dropdownItemText}>All Price Lists</Text>
                  <Text style={styles.dropdownItemCount}>
                    {allPriceListItems.length.toLocaleString()}
                  </Text>
                </TouchableOpacity>
                {priceListNames.map((list, index) => (
                  <TouchableOpacity
                    key={`filter-${index}`}
                    style={[
                      styles.dropdownItem,
                      selectedPriceListFilter === list.name && styles.dropdownItemActive,
                    ]}
                    onPress={() => filterByPriceList(list.name)}
                  >
                    <Text style={styles.dropdownItemText} numberOfLines={1}>
                      {list.name}
                    </Text>
                    <Text style={styles.dropdownItemCount}>
                      {(priceListItemCounts[list.name] || 0).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* Search Bar with Autocomplete (hide for price list 'lists' tab) */}
      {!(type === 'priceList' && activeTab === 'lists') && (
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={type === 'priceList' ? 'Search items...' : `Search ${getTitle(type).toLowerCase()}...`}
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

        {/* Autocomplete Suggestions Dropdown */}
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
                  <Ionicons name={getIcon(type)} size={18} color={colors.accent} />
                </View>
                <View style={styles.suggestionContent}>
                  <HighlightText
                    text={suggestion.name}
                    highlight={searchQuery}
                    style={styles.suggestionName}
                  />
                  <HighlightText
                    text={`#${suggestion.secondary}`}
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
      )}

      {/* Price Lists Tab Content */}
      {type === 'priceList' && activeTab === 'lists' && (
        <FlatList
          data={priceListNames}
          keyExtractor={(item, index) => `pricelist-${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.priceListNameCard}
              onPress={() => {
                setActiveTab('items');
                setTimeout(() => filterByPriceList(item.name), 100);
              }}
            >
              <View style={[styles.avatar, { backgroundColor: colors.accentOrange + '20' }]}>
                <Ionicons name="pricetag" size={24} color={colors.accentOrange} />
              </View>
              <View style={styles.priceListNameInfo}>
                <Text style={styles.priceListNameText} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.priceListCurrency}>{item.currency || 'MUR'}</Text>
              </View>
              <View style={styles.priceListCountBadge}>
                <Text style={styles.priceListCountText}>
                  {(priceListItemCounts[item.name] || 0).toLocaleString()}
                </Text>
                <Text style={styles.priceListCountLabel}>items</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetag" size={64} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Price Lists</Text>
              <Text style={styles.emptyText}>Sync data from the Sync Data screen</Text>
            </View>
          }
        />
      )}

      {/* Pagination Info (hide for price lists tab) */}
      {!(type === 'priceList' && activeTab === 'lists') && !loading && filteredData.length > 0 && (
        <View style={styles.paginationBar}>
          <Text style={styles.paginationText}>
            Showing <Text style={styles.paginationHighlight}>1-{displayData.length.toLocaleString()}</Text> of{' '}
            <Text style={styles.paginationHighlight}>{filteredData.length.toLocaleString()}</Text> records
          </Text>
          {displayData.length < filteredData.length && (
            <Text style={styles.paginationHint}>Scroll down to load more</Text>
          )}
        </View>
      )}

      {/* Content (hide for price list 'lists' tab) */}
      {!(type === 'priceList' && activeTab === 'lists') && (
        loading ? (
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
        )
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
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.accent + '15',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  // Filter styles
  filterContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    zIndex: 200,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  dropdownContainer: {
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
    maxHeight: 300,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: colors.accent + '10',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    marginRight: 10,
  },
  dropdownItemCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  // Price List Name Card styles
  priceListNameCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  priceListNameInfo: {
    flex: 1,
    marginLeft: 12,
  },
  priceListNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    lineHeight: 20,
  },
  priceListCurrency: {
    fontSize: 12,
    color: colors.textMuted,
  },
  priceListCountBadge: {
    alignItems: 'center',
    marginRight: 8,
  },
  priceListCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentOrange,
  },
  priceListCountLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 100,
    marginHorizontal: 16,
    marginVertical: 12,
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
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  paginationText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  paginationHighlight: {
    fontWeight: '600',
    color: colors.accent,
  },
  paginationHint: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
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
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    lineHeight: 18,
  },
  priceListItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    lineHeight: 18,
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
