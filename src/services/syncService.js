import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BASE_URL = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';

// Storage keys
const STORAGE_KEYS = {
  CUSTOMERS: 'sync_customers',
  ITEMS: 'sync_items',
  AGENTS: 'sync_agents',
  PRICE_LIST: 'sync_price_list',
  PRICE_LIST_ITEMS: 'sync_price_list_items', // Legacy - kept for backward compatibility
  PRICE_LIST_SYNC_STATUS: 'sync_price_list_status', // Per-pricelist sync status
  ONHAND: 'sync_onhand',
  SYNC_META: 'sync_metadata',
};

// Prefix for individual pricelist storage keys
const PRICELIST_KEY_PREFIX = 'sync_pricelist_';

// Helper to generate storage key for a specific price list
const getPriceListStorageKey = (priceListName) => {
  // Sanitize the name to create a valid storage key
  const sanitized = priceListName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${PRICELIST_KEY_PREFIX}${sanitized}`;
};

// Fusion Cloud API configuration
const FUSION_BASE_URL = 'https://efmh.fa.em3.oraclecloud.com/fscmRestApi/resources/11.13.18.05';
const FUSION_CREDENTIALS = {
  username: 'shaik',
  password: 'fusion1234',
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
  PRICE_LIST_ITEMS: '/pricelist/onlypricelist', // ?p_list_name=<NAME> - New API with pagination (10,000 per page)
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

// Extract price list item fields - minimal fields to save storage
const extractPriceListItemFields = (item) => ({
  itemNumber: item.item_number || item.ITEM_NUMBER,
  itemDesc: item.item_desc || item.ITEM_DESC,
  barcode: item.barcode || item.BARCODE,
  basePrice: item.base_price || item.BASE_PRICE,
  currency: item.currency_code || item.CURRENCY_CODE,
  uom: item.pricing_uom_code || item.PRICING_UOM_CODE,
  taxRate: item.tax_rate || item.TAX_RATE,
  allowDiscount: item.allow_discount || item.ALLOW_DISCOUNT,
});

// Extract onhand balance fields
const extractOnhandFields = (item) => {
  // Find the lots href from links array
  let lotsHref = null;
  if (item.links && Array.isArray(item.links)) {
    const lotsLink = item.links.find(link => link.name === 'lots' && link.rel === 'child');
    if (lotsLink) {
      lotsHref = lotsLink.href;
    }
  }

  return {
    inventoryItemId: item.InventoryItemId,
    itemNumber: item.ItemNumber,
    itemDescription: item.ItemDescription,
    primaryQuantity: item.PrimaryQuantity,
    primaryUOMCode: item.PrimaryUOMCode,
    organizationCode: item.OrganizationCode,
    organizationId: item.OrganizationId,
    subinventoryCode: item.SubinventoryCode,
    locatorId: item.LocatorId,
    revision: item.Revision,
    summaryLevel: item.SummaryLevel,
    lotsHref: lotsHref,
  };
};

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
      onhand: { lastSync: null, count: 0 },
    };
  } catch (error) {
    console.error('Get metadata error:', error);
    return {
      customers: { lastSync: null, count: 0 },
      items: { lastSync: null, count: 0 },
      agents: { lastSync: null, count: 0 },
      priceList: { lastSync: null, count: 0 },
      onhand: { lastSync: null, count: 0 },
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

// Sync Price List Names only (Step 1)
export const syncPriceListNames = async (onProgress, username) => {
  try {
    const salesRepNumber = username || 'njohar';
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

    return { success: true, priceLists };
  } catch (error) {
    console.error('Sync price list names error:', error);
    return { success: false, error: error.message };
  }
};

// Aggressively clear all storage for a pricelist (handles both old and new formats)
const clearPriceListStorageCompletely = async (storageKey) => {
  try {
    // Get all keys to find any related chunks
    const allKeys = await AsyncStorage.getAllKeys();
    const relatedKeys = allKeys.filter(key => key.startsWith(storageKey));

    if (relatedKeys.length > 0) {
      console.log(`Clearing ${relatedKeys.length} storage keys for ${storageKey}`);
      await AsyncStorage.multiRemove(relatedKeys);
    }
  } catch (error) {
    console.error('Error clearing pricelist storage:', error);
  }
};

// Clear ALL pricelist data from ALL pricelists to free up space
const clearAllPriceListDataBeforeSync = async () => {
  try {
    console.log('Clearing ALL pricelist data to free up space...');
    const allKeys = await AsyncStorage.getAllKeys();

    // Find ALL keys related to pricelists (both old format and new format)
    const pricelistKeys = allKeys.filter(key =>
      key.startsWith(PRICELIST_KEY_PREFIX) ||
      key.startsWith(STORAGE_KEYS.PRICE_LIST_ITEMS) ||
      key.startsWith(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS)
    );

    if (pricelistKeys.length > 0) {
      console.log(`Clearing ${pricelistKeys.length} pricelist storage keys`);
      await AsyncStorage.multiRemove(pricelistKeys);
    }

    // Also clear any legacy pricelist data
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);

    console.log('All pricelist data cleared');
  } catch (error) {
    console.error('Error clearing all pricelist data:', error);
  }
};

// Sync a single price list with pagination (2000 items per fetch using p_start_row/p_end_row)
// Each price list is stored in its own AsyncStorage key to avoid storage limits
// Saves incrementally to avoid memory issues with large datasets
export const syncSinglePriceList = async (priceListName, onProgress, clearAllFirst = true) => {
  try {
    const encodedName = encodeURIComponent(priceListName);
    const storageKey = getPriceListStorageKey(priceListName);
    let startRow = 1;
    const batchSize = 2000;
    let hasMore = true;
    let chunkIndex = 0;
    let totalItems = 0;

    console.log(`Syncing price list: ${priceListName} -> storage key: ${storageKey}`);

    // FIRST: Clear old data to free up space
    if (onProgress) {
      onProgress({
        status: 'Clearing old data...',
        fetched: 0,
        priceListName,
      });
    }

    if (clearAllFirst) {
      // Clear ALL pricelist data to ensure we have enough space
      await clearAllPriceListDataBeforeSync();
    } else {
      // Just clear this specific pricelist
      await clearPriceListStorageCompletely(storageKey);
    }

    while (hasMore) {
      const endRow = startRow + batchSize - 1;
      const url = `${BASE_URL}${ENDPOINTS.PRICE_LIST_ITEMS}?p_list_name=${encodedName}&p_start_row=${startRow}&p_end_row=${endRow}`;
      console.log(`Fetching rows ${startRow}-${endRow}:`, url);

      if (onProgress) {
        onProgress({
          status: `Fetching ${totalItems.toLocaleString()}+ items...`,
          fetched: totalItems,
          priceListName,
        });
      }

      const response = await axios.get(url, { timeout: 120000 });
      let items = [];

      if (response.data?.items && Array.isArray(response.data.items)) {
        items = response.data.items;
      } else if (Array.isArray(response.data)) {
        items = response.data;
      }

      if (items.length === 0) {
        hasMore = false;
      } else {
        // Extract items
        const extractedItems = items.map(item => ({
          ...extractPriceListItemFields(item),
          priceListName: priceListName,
        }));

        // SAVE IMMEDIATELY - each batch as a separate chunk
        // This avoids accumulating all items in memory
        try {
          if (onProgress) {
            onProgress({
              status: `Saving batch ${chunkIndex + 1} (${totalItems.toLocaleString()}+ items)...`,
              fetched: totalItems,
              priceListName,
            });
          }
          await AsyncStorage.setItem(`${storageKey}_${chunkIndex}`, JSON.stringify(extractedItems));
          chunkIndex++;
          totalItems += extractedItems.length;
        } catch (saveError) {
          console.error('Storage save error:', saveError);
          if (saveError.message && saveError.message.includes('full')) {
            // Clean up partial data
            await clearPriceListStorageCompletely(storageKey);
            return {
              success: false,
              error: `Storage full at ${totalItems.toLocaleString()} items. Clear other data first.`,
              priceListName
            };
          }
          throw saveError;
        }

        startRow = endRow + 1;

        // If less than batchSize items returned, we're done
        if (items.length < batchSize) {
          hasMore = false;
        }
      }
    }

    // Save the chunk count at the end
    await AsyncStorage.setItem(`${storageKey}_count`, JSON.stringify(chunkIndex));

    // Update sync status for this price list
    const syncStatus = await loadFromStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS) || {};
    syncStatus[priceListName] = {
      lastSync: new Date().toISOString(),
      count: totalItems,
      storageKey: storageKey,
    };
    await saveToStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS, syncStatus);

    // Update overall metadata with total count from all pricelists
    const totalCount = await getTotalPriceListItemCount();
    await updateSyncMetadata('priceList', totalCount);

    if (onProgress) {
      onProgress({
        status: `Done: ${totalItems.toLocaleString()} items`,
        fetched: totalItems,
        priceListName,
        complete: true,
      });
    }

    return { success: true, count: totalItems, priceListName };
  } catch (error) {
    console.error(`Sync price list ${priceListName} error:`, error);
    return { success: false, error: error.message, priceListName };
  }
};

// Get price list sync status
export const getPriceListSyncStatus = async () => {
  return await loadFromStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS) || {};
};

// Sync all price lists (legacy function for backward compatibility)
export const syncPriceList = async (onProgress, username) => {
  try {
    // Clear existing data
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS);

    // Step 1: Get price list names
    const namesResult = await syncPriceListNames(onProgress, username);
    if (!namesResult.success) {
      return namesResult;
    }

    const priceLists = namesResult.priceLists;
    let totalItems = 0;

    // Step 2: Sync each price list
    for (let i = 0; i < priceLists.length; i++) {
      const priceList = priceLists[i];

      if (onProgress) {
        onProgress({
          status: `Syncing ${priceList.name}...`,
          fetched: totalItems,
          currentList: i + 1,
          totalLists: priceLists.length,
        });
      }

      const result = await syncSinglePriceList(priceList.name, (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            currentList: i + 1,
            totalLists: priceLists.length,
          });
        }
      });

      if (result.success) {
        totalItems += result.count;
      }
    }

    return { success: true, count: totalItems, priceListCount: priceLists.length };
  } catch (error) {
    console.error('Sync price list error:', error);
    return { success: false, error: error.message };
  }
};

// Get price list names (for displaying list)
export const getPriceListNames = async () => loadFromStorage(STORAGE_KEYS.PRICE_LIST);

// Get total item count from all pricelists
const getTotalPriceListItemCount = async () => {
  const syncStatus = await loadFromStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS) || {};
  let total = 0;
  for (const name of Object.keys(syncStatus)) {
    total += syncStatus[name].count || 0;
  }
  return total;
};

// Get price list items (all items from all price lists - merged in memory)
export const getPriceListItems = async () => {
  const syncStatus = await loadFromStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS) || {};
  let allItems = [];

  // Load from each individual pricelist storage key
  for (const priceListName of Object.keys(syncStatus)) {
    const storageKey = syncStatus[priceListName].storageKey || getPriceListStorageKey(priceListName);
    const items = await loadFromStorage(storageKey) || [];
    allItems = [...allItems, ...items];
  }

  console.log(`Loaded ${allItems.length} total pricelist items from ${Object.keys(syncStatus).length} pricelists`);
  return allItems;
};

// Get items for a specific price list
export const getItemsForPriceList = async (priceListName) => {
  // Load directly from this pricelist's individual storage key
  const storageKey = getPriceListStorageKey(priceListName);
  const items = await loadFromStorage(storageKey) || [];
  return items;
};

// Sync Fusion Onhand Balances
export const syncOnhand = async (onProgress, userWarehouse, userSubinventory) => {
  try {
    await clearFromStorage(STORAGE_KEYS.ONHAND);

    // Use user's warehouse and subinventory or default values
    const organizationCode = userWarehouse || 'SHOPS';
    const subinventoryCode = userSubinventory || 'SHCS';

    if (onProgress) {
      onProgress({ status: 'Connecting to Fusion Cloud...', fetched: 0 });
    }

    // Build the query URL
    const queryUrl = `${FUSION_BASE_URL}/inventoryOnhandBalances?q=OrganizationCode=${organizationCode};SubinventoryCode=${subinventoryCode}&limit=500`;
    console.log('Fetching onhand from:', queryUrl);

    // Create Basic Auth header
    const authHeader = 'Basic ' + btoa(`${FUSION_CREDENTIALS.username}:${FUSION_CREDENTIALS.password}`);

    let allItems = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      const url = offset > 0 ? `${queryUrl}&offset=${offset}` : queryUrl;

      if (onProgress) {
        onProgress({ status: `Fetching onhand balances...`, fetched: allItems.length });
      }

      const response = await axios.get(url, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      });

      let items = [];
      if (response.data?.items && Array.isArray(response.data.items)) {
        items = response.data.items;
      }

      if (items.length === 0) {
        hasMore = false;
      } else {
        const extractedItems = items.map(extractOnhandFields);
        allItems = [...allItems, ...extractedItems];
        offset += items.length;

        if (onProgress) {
          onProgress({ status: `Fetched ${allItems.length} items...`, fetched: allItems.length });
        }

        // Check if there are more items
        hasMore = response.data?.hasMore === true || items.length === 500;
      }
    }

    // Save onhand data
    await saveToStorage(STORAGE_KEYS.ONHAND, allItems);
    await updateSyncMetadata('onhand', allItems.length);

    return { success: true, count: allItems.length };
  } catch (error) {
    console.error('Sync onhand error:', error);
    return { success: false, error: error.message };
  }
};

// Get onhand data
export const getOnhand = async () => loadFromStorage(STORAGE_KEYS.ONHAND);

// Fetch lot details for an onhand item
export const fetchLotDetails = async (lotsHref) => {
  try {
    if (!lotsHref) {
      return { success: false, error: 'No lots URL provided' };
    }

    const authHeader = 'Basic ' + btoa(`${FUSION_CREDENTIALS.username}:${FUSION_CREDENTIALS.password}`);

    const response = await axios.get(lotsHref, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    let lots = [];
    if (response.data?.items && Array.isArray(response.data.items)) {
      lots = response.data.items.map(lot => ({
        lotNumber: lot.LotNumber,
        quantity: lot.OnhandQuantity || lot.PrimaryQuantity,
        expirationDate: lot.ExpirationDate,
        gradeCode: lot.GradeCode,
        parentLotNumber: lot.ParentLotNumber,
        originationDate: lot.OriginationDate,
      }));
    }

    return { success: true, lots };
  } catch (error) {
    console.error('Fetch lots error:', error);
    return { success: false, error: error.message };
  }
};

// Get synced data
export const getCustomers = async () => loadFromStorage(STORAGE_KEYS.CUSTOMERS);
export const getItems = async () => loadFromStorage(STORAGE_KEYS.ITEMS);
export const getAgents = async () => loadFromStorage(STORAGE_KEYS.AGENTS);
export const getPriceList = async () => loadFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);

// Clear all pricelist storage keys
const clearAllPriceListStorage = async () => {
  try {
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();

    // Find all keys that start with the pricelist prefix
    const pricelistKeys = allKeys.filter(key => key.startsWith(PRICELIST_KEY_PREFIX));

    // Clear each pricelist key (handles chunked storage)
    for (const key of pricelistKeys) {
      // Check if this is a chunked storage key
      if (key.endsWith('_count')) {
        const baseKey = key.replace('_count', '');
        await clearFromStorage(baseKey);
      } else if (!key.includes('_count') && !/_\d+$/.test(key)) {
        // This is a base key (not a chunk or count key)
        await clearFromStorage(key);
      }
    }

    // Also clear sync status
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS);
  } catch (error) {
    console.error('Error clearing pricelist storage:', error);
  }
};

// Clear all synced data
export const clearAllSyncData = async () => {
  try {
    await clearFromStorage(STORAGE_KEYS.CUSTOMERS);
    await clearFromStorage(STORAGE_KEYS.ITEMS);
    await clearFromStorage(STORAGE_KEYS.AGENTS);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS); // Legacy key
    await clearAllPriceListStorage(); // Clear all individual pricelist keys
    await clearFromStorage(STORAGE_KEYS.ONHAND);
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
