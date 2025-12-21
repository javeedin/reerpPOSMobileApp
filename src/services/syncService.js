import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BASE_URL = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';

// Storage keys
const STORAGE_KEYS = {
  CUSTOMERS: 'sync_customers',
  ITEMS: 'sync_items',
  AGENTS: 'sync_agents',
  PRICE_LIST: 'sync_price_list',
  PRICE_LIST_ITEMS: 'sync_price_list_items',
  SYNC_META: 'sync_metadata',
};

// Batch size for fetching data
const BATCH_SIZE = 500;
const MAX_RECORDS_TEST = 2000; // For testing, limit to 2,000 records (storage limit)

// API endpoints
const ENDPOINTS = {
  CUSTOMERS: '/ALLCUSTOMERS/ALL',
  ITEMS: '/ALLITEMS/ALL',
  AGENTS: '/ALLAGENTS/ALL',
  PRICE_LIST_FOR_USER: '/SYNCPRICELIST/LIST', // ?SALESREP_NUMBER=username
  PRICE_LIST_ITEMS: '/pricelist/pricelist', // /:PRICE_LIST
};

// Extract only essential fields to reduce storage size
const extractCustomerFields = (customer) => ({
  id: customer.cust_account_id || customer.party_id,
  accountNumber: customer.account_number || customer.party_number,
  name: customer.account_name || customer.party_name,
  address: [customer.address1, customer.address2, customer.city, customer.country]
    .filter(a => a && a !== '.' && a !== null)
    .join(', '),
  priceList: customer.price_list,
  creditLimit: customer.credit_limit,
  email: customer.email_address,
  phone: customer.phone,
  status: customer.status,
  holdStatus: customer.hold_status,
  paymentTerm: customer.payment_term,
  customerClass: customer.customer_class_code,
  customerCategory: customer.cust_cat_code || customer.customer_main_cat,
  salesperson: customer.salesperon,
  brn: customer.brn,
  vatNo: customer.vatregno,
  mraCategory: customer.mra_customer_cat,
});

const extractItemFields = (item) => ({
  id: item.INVENTORY_ITEM_ID || item.inventory_item_id || item.ID,
  name: item.ITEM_NAME || item.item_name || item.DESCRIPTION || item.description,
  number: item.ITEM_NUMBER || item.item_number || item.ITEM_CODE,
  uom: item.UOM || item.uom_code || item.PRIMARY_UOM_CODE,
  price: item.PRICE || item.list_price,
  category: item.CATEGORY || item.category_name,
});

const extractAgentFields = (agent) => ({
  id: agent.AGENT_ID || agent.agent_id || agent.RESOURCE_ID || agent.ID,
  name: agent.AGENT_NAME || agent.agent_name || agent.NAME || agent.name,
});

const extractPriceListFields = (priceList) => ({
  name: priceList.price_list_name || priceList.PRICE_LIST_NAME || priceList.name,
  currency: priceList.currency_code || priceList.CURRENCY_CODE || priceList.currency,
});

// Extract price list item fields
const extractPriceListItemFields = (item) => ({
  id: item.inventory_item_id || item.INVENTORY_ITEM_ID,
  itemNumber: item.item_number || item.ITEM_NUMBER,
  itemDesc: item.item_desc || item.ITEM_DESC,
  barcode: item.barcode || item.BARCODE,
  basePrice: item.base_price || item.BASE_PRICE,
  currency: item.currency_code || item.CURRENCY_CODE,
  uom: item.pricing_uom_code || item.PRICING_UOM_CODE,
  listName: item.list_name || item.LIST_NAME,
  profitCenter: item.profit_center || item.PROFIT_CENTER,
  supplier: item.supplier || item.SUPPLIER,
  brand: item.brand || item.BRAND,
  category: item.category_name || item.CATEGORY_NAME,
  subCategory: item.sub_category || item.SUB_CATEGORY,
  superCategory: item.super_category || item.SUPER_CATEGORY,
  itemStatus: item.item_status || item.ITEM_STATUS,
  taxCode: item.tax_code || item.TAX_CODE,
  taxRate: item.tax_rate || item.TAX_RATE,
  allowDiscount: item.allow_discount || item.ALLOW_DISCOUNT,
  alcoholicFlag: item.alcoholic_flag || item.ALCOHOLIC_FLAG,
  startDate: item.start_date || item.START_DATE,
});

// Fetch data with pagination
const fetchWithPagination = async (endpoint, onProgress, maxRecords = MAX_RECORDS_TEST) => {
  let allData = [];
  let startRow = 1;
  let hasMore = true;
  let totalFetched = 0;

  while (hasMore && totalFetched < maxRecords) {
    const endRow = Math.min(startRow + BATCH_SIZE - 1, maxRecords);

    try {
      const url = `${BASE_URL}${endpoint}?start_row=${startRow}&end_row=${endRow}`;
      console.log(`Fetching: ${url}`);

      const response = await axios.get(url, { timeout: 60000 });

      let items = [];
      if (response.data?.items && Array.isArray(response.data.items)) {
        items = response.data.items;
      } else if (Array.isArray(response.data)) {
        items = response.data;
      }

      if (items.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...items];
        totalFetched = allData.length;
        startRow = endRow + 1;

        // Report progress
        if (onProgress) {
          onProgress({
            fetched: totalFetched,
            currentBatch: items.length,
            startRow,
            endRow,
          });
        }

        // If we got less than batch size, we're done
        if (items.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    } catch (error) {
      console.error('Fetch error:', error.message);
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }

  return allData;
};

// Save data to local storage (chunked for large datasets)
const saveToStorage = async (key, data) => {
  try {
    // For large datasets, we might need to chunk the data
    const CHUNK_SIZE = 1000;
    const chunks = [];

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, i + CHUNK_SIZE));
    }

    // Save chunk count and each chunk
    await AsyncStorage.setItem(`${key}_count`, JSON.stringify(chunks.length));

    for (let i = 0; i < chunks.length; i++) {
      await AsyncStorage.setItem(`${key}_${i}`, JSON.stringify(chunks[i]));
    }

    return true;
  } catch (error) {
    console.error('Save error:', error);
    throw new Error(`Failed to save data: ${error.message}`);
  }
};

// Load data from local storage
const loadFromStorage = async (key) => {
  try {
    const countStr = await AsyncStorage.getItem(`${key}_count`);
    if (!countStr) return [];

    const chunkCount = JSON.parse(countStr);
    let allData = [];

    for (let i = 0; i < chunkCount; i++) {
      const chunkStr = await AsyncStorage.getItem(`${key}_${i}`);
      if (chunkStr) {
        const chunk = JSON.parse(chunkStr);
        allData = [...allData, ...chunk];
      }
    }

    return allData;
  } catch (error) {
    console.error('Load error:', error);
    return [];
  }
};

// Clear data from storage
const clearFromStorage = async (key) => {
  try {
    const countStr = await AsyncStorage.getItem(`${key}_count`);
    if (countStr) {
      const chunkCount = JSON.parse(countStr);
      const keysToRemove = [`${key}_count`];
      for (let i = 0; i < chunkCount; i++) {
        keysToRemove.push(`${key}_${i}`);
      }
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (error) {
    console.error('Clear error:', error);
  }
};

// Get sync metadata
export const getSyncMetadata = async () => {
  try {
    const metaStr = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_META);
    return metaStr ? JSON.parse(metaStr) : {
      customers: { lastSync: null, count: 0 },
      items: { lastSync: null, count: 0 },
      agents: { lastSync: null, count: 0 },
      priceList: { lastSync: null, count: 0 },
    };
  } catch (error) {
    console.error('Get metadata error:', error);
    return {
      customers: { lastSync: null, count: 0 },
      items: { lastSync: null, count: 0 },
      agents: { lastSync: null, count: 0 },
      priceList: { lastSync: null, count: 0 },
    };
  }
};

// Update sync metadata
const updateSyncMetadata = async (type, count) => {
  try {
    const meta = await getSyncMetadata();
    meta[type] = {
      lastSync: new Date().toISOString(),
      count: count,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_META, JSON.stringify(meta));
  } catch (error) {
    console.error('Update metadata error:', error);
  }
};

// Sync Customers
export const syncCustomers = async (onProgress) => {
  try {
    // Clear existing data first to free up space
    await clearFromStorage(STORAGE_KEYS.CUSTOMERS);

    const rawData = await fetchWithPagination(ENDPOINTS.CUSTOMERS, onProgress);
    // Extract only essential fields to reduce storage size
    const data = rawData.map(extractCustomerFields);
    await saveToStorage(STORAGE_KEYS.CUSTOMERS, data);
    await updateSyncMetadata('customers', data.length);
    return { success: true, count: data.length };
  } catch (error) {
    console.error('Sync customers error:', error);
    return { success: false, error: error.message };
  }
};

// Sync Items
export const syncItems = async (onProgress) => {
  try {
    await clearFromStorage(STORAGE_KEYS.ITEMS);

    const rawData = await fetchWithPagination(ENDPOINTS.ITEMS, onProgress);
    const data = rawData.map(extractItemFields);
    await saveToStorage(STORAGE_KEYS.ITEMS, data);
    await updateSyncMetadata('items', data.length);
    return { success: true, count: data.length };
  } catch (error) {
    console.error('Sync items error:', error);
    return { success: false, error: error.message };
  }
};

// Sync Agents
export const syncAgents = async (onProgress) => {
  try {
    await clearFromStorage(STORAGE_KEYS.AGENTS);

    const rawData = await fetchWithPagination(ENDPOINTS.AGENTS, onProgress);
    const data = rawData.map(extractAgentFields);
    await saveToStorage(STORAGE_KEYS.AGENTS, data);
    await updateSyncMetadata('agents', data.length);
    return { success: true, count: data.length };
  } catch (error) {
    console.error('Sync agents error:', error);
    return { success: false, error: error.message };
  }
};

// Sync Price List - Two step process:
// 1. Get list of price lists for logged user
// 2. For each price list, fetch all items
export const syncPriceList = async (onProgress, username) => {
  try {
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);

    // Step 1: Get list of price lists for the user
    const salesRepNumber = username || 'njohar'; // fallback for testing
    const listUrl = `${BASE_URL}${ENDPOINTS.PRICE_LIST_FOR_USER}?SALESREP_NUMBER=${salesRepNumber}`;
    console.log('Fetching price lists:', listUrl);

    if (onProgress) {
      onProgress({ status: 'Fetching price list names...', fetched: 0 });
    }

    const listResponse = await axios.get(listUrl, { timeout: 60000 });
    let priceLists = [];

    if (listResponse.data?.items && Array.isArray(listResponse.data.items)) {
      priceLists = listResponse.data.items.map(extractPriceListFields);
    }

    // Save the price list names
    await saveToStorage(STORAGE_KEYS.PRICE_LIST, priceLists);

    if (onProgress) {
      onProgress({ status: `Found ${priceLists.length} price lists`, fetched: priceLists.length });
    }

    // Step 2: For each price list, fetch items
    let allItems = [];
    for (let i = 0; i < priceLists.length; i++) {
      const priceList = priceLists[i];
      const encodedName = encodeURIComponent(priceList.name);
      const itemsUrl = `${BASE_URL}${ENDPOINTS.PRICE_LIST_ITEMS}/${encodedName}`;

      console.log(`Fetching items for price list ${i + 1}/${priceLists.length}: ${priceList.name}`);

      if (onProgress) {
        onProgress({
          status: `Syncing ${priceList.name}...`,
          fetched: allItems.length,
          currentList: i + 1,
          totalLists: priceLists.length,
        });
      }

      try {
        const itemsResponse = await axios.get(itemsUrl, { timeout: 120000 });
        let items = [];

        if (itemsResponse.data?.items && Array.isArray(itemsResponse.data.items)) {
          items = itemsResponse.data.items;
        } else if (Array.isArray(itemsResponse.data)) {
          items = itemsResponse.data;
        }

        // Extract and add to all items
        const extractedItems = items.map(item => ({
          ...extractPriceListItemFields(item),
          priceListName: priceList.name,
        }));

        allItems = [...allItems, ...extractedItems];

        // Limit total items for storage
        if (allItems.length > MAX_RECORDS_TEST * 2) {
          console.log('Reached max items limit');
          break;
        }
      } catch (itemError) {
        console.error(`Error fetching items for ${priceList.name}:`, itemError.message);
        // Continue with other price lists
      }
    }

    // Save all price list items
    await saveToStorage(STORAGE_KEYS.PRICE_LIST_ITEMS, allItems);
    await updateSyncMetadata('priceList', allItems.length);

    return { success: true, count: allItems.length, priceListCount: priceLists.length };
  } catch (error) {
    console.error('Sync price list error:', error);
    return { success: false, error: error.message };
  }
};

// Get price list names (for displaying list)
export const getPriceListNames = async () => loadFromStorage(STORAGE_KEYS.PRICE_LIST);

// Get price list items (all items from all price lists)
export const getPriceListItems = async () => loadFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);

// Get items for a specific price list
export const getItemsForPriceList = async (priceListName) => {
  const allItems = await loadFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);
  return allItems.filter(item => item.priceListName === priceListName || item.listName === priceListName);
};

// Get synced data
export const getCustomers = async () => loadFromStorage(STORAGE_KEYS.CUSTOMERS);
export const getItems = async () => loadFromStorage(STORAGE_KEYS.ITEMS);
export const getAgents = async () => loadFromStorage(STORAGE_KEYS.AGENTS);
export const getPriceList = async () => loadFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);

// Clear all synced data
export const clearAllSyncData = async () => {
  try {
    await clearFromStorage(STORAGE_KEYS.CUSTOMERS);
    await clearFromStorage(STORAGE_KEYS.ITEMS);
    await clearFromStorage(STORAGE_KEYS.AGENTS);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);
    await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_META);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Search in synced data
export const searchCustomers = async (query) => {
  const customers = await getCustomers();
  const lowerQuery = query.toLowerCase();
  return customers.filter(c =>
    (c.name || '').toLowerCase().includes(lowerQuery) ||
    (c.number || '').toLowerCase().includes(lowerQuery)
  ).slice(0, 50); // Limit results
};

export const searchItems = async (query) => {
  const items = await getItems();
  const lowerQuery = query.toLowerCase();
  return items.filter(i =>
    (i.name || '').toLowerCase().includes(lowerQuery) ||
    (i.number || '').toLowerCase().includes(lowerQuery)
  ).slice(0, 50);
};
