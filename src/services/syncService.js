import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import axios from 'axios';

const BASE_URL = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';

// SQLite database for pricelist (NO size limit!)
let pricelistDb = null;

const getPricelistDb = async () => {
  if (!pricelistDb) {
    pricelistDb = await SQLite.openDatabaseAsync('pricelist.db');
    // Create table if not exists
    await pricelistDb.execAsync(`
      CREATE TABLE IF NOT EXISTS pricelist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_name TEXT,
        item_desc TEXT,
        barcode TEXT,
        item_number TEXT,
        currency_code TEXT,
        pricing_uom_code TEXT,
        tax_code TEXT,
        tax_rate TEXT,
        base_price TEXT,
        allow_discount TEXT,
        alcoholic_flag TEXT,
        inventory_item_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_list_name ON pricelist_items(list_name);
      CREATE INDEX IF NOT EXISTS idx_item_number ON pricelist_items(item_number);
      CREATE INDEX IF NOT EXISTS idx_barcode ON pricelist_items(barcode);

      CREATE TABLE IF NOT EXISTS bogo_promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_id INTEGER,
        promo_name TEXT,
        promo_number TEXT,
        promo_type TEXT,
        main_item_code TEXT,
        main_item_desc TEXT,
        promo_item_code TEXT,
        promo_item_desc TEXT,
        promo_price TEXT,
        buy_qty INTEGER,
        get_qty INTEGER,
        customer_number TEXT,
        is_discount_allowed TEXT,
        vat_code TEXT,
        start_date TEXT,
        end_date TEXT,
        allow_delete_flag TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_bogo_main_item ON bogo_promotions(main_item_code);
      CREATE INDEX IF NOT EXISTS idx_bogo_customer ON bogo_promotions(customer_number);
    `);
  }
  return pricelistDb;
};

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

// Extract price list item fields - ALL required fields with ACTUAL names
// Using chunked storage (5000 items per key) to handle large pricelists
const extractPriceListItemFields = (item) => ({
  list_name: item.list_name || item.LIST_NAME,
  item_desc: item.item_desc || item.ITEM_DESC,
  barcode: item.barcode || item.BARCODE,
  item_number: item.item_number || item.ITEM_NUMBER,
  currency_code: item.currency_code || item.CURRENCY_CODE,
  pricing_uom_code: item.pricing_uom_code || item.PRICING_UOM_CODE,
  tax_code: item.tax_code || item.TAX_CODE,
  tax_rate: item.tax_rate || item.TAX_RATE,
  base_price: item.base_price || item.BASE_PRICE,
  allow_discount: item.allow_discount || item.ALLOW_DISCOUNT,
  alcoholic_flag: item.alcoholic_flag || item.ALCOHOLIC_FLAG,
  inventory_item_id: item.inventory_item_id || item.INVENTORY_ITEM_ID,
});

// Chunk size for pricelist storage (2000 items per key to stay under storage limits)
const PRICELIST_CHUNK_SIZE = 2000;

// API fetch batch size (fetch 2000 at a time from API - same as chunk size)
const PRICELIST_FETCH_BATCH_SIZE = 2000;

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

// Clear EVERYTHING except pricelist names to make room for large pricelists
export const clearAllDataForLargePricelistSync = async () => {
  try {
    console.log('Clearing ALL data to make room for large pricelist...');

    // Clear all sync data from AsyncStorage
    await clearFromStorage(STORAGE_KEYS.CUSTOMERS);
    await clearFromStorage(STORAGE_KEYS.ITEMS);
    await clearFromStorage(STORAGE_KEYS.AGENTS);
    await clearFromStorage(STORAGE_KEYS.ONHAND);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);

    // Clear all pricelist data from AsyncStorage (legacy)
    const allKeys = await AsyncStorage.getAllKeys();
    const pricelistKeys = allKeys.filter(key =>
      key.startsWith(PRICELIST_KEY_PREFIX) ||
      key.startsWith(STORAGE_KEYS.PRICE_LIST_ITEMS) ||
      key.startsWith(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS)
    );

    if (pricelistKeys.length > 0) {
      await AsyncStorage.multiRemove(pricelistKeys);
    }

    // Clear SQLite pricelist data
    try {
      const db = await getPricelistDb();
      await db.runAsync('DELETE FROM pricelist_items');
      console.log('Cleared pricelist data from SQLite');
    } catch (sqliteError) {
      console.error('Error clearing SQLite pricelist:', sqliteError);
    }

    // Reset metadata (but keep pricelist names)
    await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_META);

    console.log('All data cleared for large pricelist sync');
    return { success: true };
  } catch (error) {
    console.error('Error clearing all data:', error);
    return { success: false, error: error.message };
  }
};

// Sync a single price list with pagination - stores in SQLite (NO size limit!)
// SQLite can store unlimited items, unlike AsyncStorage which has a 6MB limit
export const syncSinglePriceList = async (priceListName, onProgress, clearAllFirst = false) => {
  try {
    const encodedName = encodeURIComponent(priceListName);
    let startRow = 1;
    const batchSize = PRICELIST_FETCH_BATCH_SIZE; // Fetch 2000 items at a time
    let hasMore = true;
    let totalItems = 0;

    console.log(`Syncing price list: ${priceListName} -> SQLite database (clearAllFirst=${clearAllFirst})`);

    // Get SQLite database
    const db = await getPricelistDb();

    // Clear old data for this pricelist (or all if explicitly requested)
    if (onProgress) {
      onProgress({
        status: clearAllFirst ? 'Clearing all price list data...' : `Clearing ${priceListName} data...`,
        fetched: 0,
        priceListName,
      });
    }

    if (clearAllFirst) {
      // Clear ALL pricelist data from SQLite (only when explicitly requested)
      await db.runAsync('DELETE FROM pricelist_items');
      console.log('Cleared ALL pricelist data from SQLite');
    } else {
      // Just clear this specific pricelist (default behavior - preserves other price lists)
      await db.runAsync('DELETE FROM pricelist_items WHERE list_name = ?', [priceListName]);
      console.log(`Cleared only ${priceListName} from SQLite (other price lists preserved)`);
    }

    // Batch insert size (insert 500 items at a time for efficiency)
    const INSERT_BATCH_SIZE = 500;
    let pendingItems = [];

    while (hasMore) {
      const endRow = startRow + batchSize - 1;
      const url = `${BASE_URL}${ENDPOINTS.PRICE_LIST_ITEMS}?p_list_name=${encodedName}&p_start_row=${startRow}&p_end_row=${endRow}`;
      console.log(`Fetching rows ${startRow}-${endRow}:`, url);

      if (onProgress) {
        onProgress({
          status: `Fetching rows ${startRow}-${endRow}...`,
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

      console.log(`API returned ${items.length} items for rows ${startRow}-${endRow}`);

      if (items.length === 0) {
        console.log('No items returned, stopping pagination');
        hasMore = false;
      } else {
        // Extract items with ALL required fields using actual field names
        const extractedItems = items.map(item => extractPriceListItemFields(item));
        pendingItems = [...pendingItems, ...extractedItems];
        totalItems += extractedItems.length;
        console.log(`Total items so far: ${totalItems}`);

        // Insert in batches of 500
        while (pendingItems.length >= INSERT_BATCH_SIZE) {
          const batch = pendingItems.slice(0, INSERT_BATCH_SIZE);
          pendingItems = pendingItems.slice(INSERT_BATCH_SIZE);

          if (onProgress) {
            onProgress({
              status: `Saving to SQLite... ${totalItems.toLocaleString()} items`,
              fetched: totalItems,
              priceListName,
            });
          }

          // Insert batch into SQLite
          await insertPricelistBatch(db, batch);
        }

        startRow = endRow + 1;

        // Continue to next page regardless of how many items we got
        // Only stop when we get 0 items (handled above)
        console.log(`Got ${items.length} items, continuing to next page (startRow: ${startRow})`);
      }
    }

    // Insert any remaining items
    if (pendingItems.length > 0) {
      if (onProgress) {
        onProgress({
          status: `Saving final batch... ${pendingItems.length} items`,
          fetched: totalItems,
          priceListName,
        });
      }
      await insertPricelistBatch(db, pendingItems);
    }

    // Update sync status for this price list (use direct AsyncStorage for object storage)
    const statusStr = await AsyncStorage.getItem(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS);
    const syncStatus = statusStr ? JSON.parse(statusStr) : {};
    syncStatus[priceListName] = {
      lastSync: new Date().toISOString(),
      count: totalItems,
      storage: 'sqlite', // Mark as SQLite storage
    };
    await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS, JSON.stringify(syncStatus));

    // Update overall metadata with total count
    const totalCount = await getTotalPriceListItemCount();
    await updateSyncMetadata('priceList', totalCount);

    if (onProgress) {
      onProgress({
        status: `Done: ${totalItems.toLocaleString()} items (SQLite)`,
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

// Helper function to insert a batch of pricelist items into SQLite
const insertPricelistBatch = async (db, items) => {
  // Use a transaction for better performance
  const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = items.flatMap(item => [
    item.list_name || '',
    item.item_desc || '',
    item.barcode || '',
    item.item_number || '',
    item.currency_code || '',
    item.pricing_uom_code || '',
    item.tax_code || '',
    item.tax_rate || '',
    item.base_price || '',
    item.allow_discount || '',
    item.alcoholic_flag || '',
    item.inventory_item_id || '',
  ]);

  const sql = `INSERT INTO pricelist_items (list_name, item_desc, barcode, item_number, currency_code, pricing_uom_code, tax_code, tax_rate, base_price, allow_discount, alcoholic_flag, inventory_item_id) VALUES ${placeholders}`;

  await db.runAsync(sql, values);
};

// Get price list sync status (direct AsyncStorage, not chunked storage)
export const getPriceListSyncStatus = async () => {
  try {
    const statusStr = await AsyncStorage.getItem(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS);
    return statusStr ? JSON.parse(statusStr) : {};
  } catch (error) {
    console.error('Error loading pricelist sync status:', error);
    return {};
  }
};

// Sync all price lists (legacy function for backward compatibility)
export const syncPriceList = async (onProgress, username) => {
  try {
    // Clear existing data
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS);
    await AsyncStorage.removeItem(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS);

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

// Get total item count from SQLite
const getTotalPriceListItemCount = async () => {
  try {
    const db = await getPricelistDb();
    const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM pricelist_items');
    return result?.count || 0;
  } catch (error) {
    console.error('Error getting pricelist count from SQLite:', error);
    // Fallback to metadata if SQLite fails
    const syncStatus = await loadFromStorage(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS) || {};
    let total = 0;
    for (const name of Object.keys(syncStatus)) {
      total += syncStatus[name].count || 0;
    }
    return total;
  }
};

// Search pricelist items by barcode or item number (fast with SQLite indexes)
export const searchPriceListItems = async (query, limit = 50) => {
  try {
    const db = await getPricelistDb();
    const items = await db.getAllAsync(
      `SELECT * FROM pricelist_items
       WHERE barcode LIKE ? OR item_number LIKE ? OR item_desc LIKE ?
       LIMIT ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`, limit]
    );
    return items;
  } catch (error) {
    console.error('Error searching pricelist items:', error);
    return [];
  }
};

// Get pricelist item by exact barcode (fast lookup)
export const getPriceListItemByBarcode = async (barcode) => {
  try {
    const db = await getPricelistDb();
    const item = await db.getFirstAsync(
      'SELECT * FROM pricelist_items WHERE barcode = ?',
      [barcode]
    );
    return item;
  } catch (error) {
    console.error('Error getting pricelist item by barcode:', error);
    return null;
  }
};

// Get price list items (all items from all price lists - from SQLite)
export const getPriceListItems = async () => {
  try {
    const db = await getPricelistDb();
    const items = await db.getAllAsync('SELECT * FROM pricelist_items');
    console.log(`=== getPriceListItems Debug ===`);
    console.log(`Loaded ${items.length} total pricelist items from SQLite`);

    // Log unique list_name values in the database
    const uniqueLists = await db.getAllAsync('SELECT DISTINCT list_name FROM pricelist_items');
    console.log('Unique price lists in SQLite:', uniqueLists.map(l => l.list_name).join(', '));

    return items;
  } catch (error) {
    console.error('Error loading pricelist items from SQLite:', error);
    return [];
  }
};

// Get price list items with pagination (for large datasets - 10,000 per page)
export const getPriceListItemsPaginated = async (page = 1, pageSize = 10000) => {
  try {
    const db = await getPricelistDb();
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = await db.getFirstAsync('SELECT COUNT(*) as total FROM pricelist_items');
    const total = countResult?.total || 0;

    // Get page of items
    const items = await db.getAllAsync(
      'SELECT * FROM pricelist_items LIMIT ? OFFSET ?',
      [pageSize, offset]
    );

    const totalPages = Math.ceil(total / pageSize);

    console.log(`Loaded page ${page}/${totalPages} (${items.length} items, offset ${offset})`);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    };
  } catch (error) {
    console.error('Error loading paginated pricelist items:', error);
    return { items: [], page: 1, pageSize, total: 0, totalPages: 0, hasMore: false };
  }
};

// Get items for a specific price list with pagination
export const getItemsForPriceListPaginated = async (priceListName, page = 1, pageSize = 10000) => {
  try {
    const db = await getPricelistDb();
    const offset = (page - 1) * pageSize;

    // Get total count for this pricelist
    const countResult = await db.getFirstAsync(
      'SELECT COUNT(*) as total FROM pricelist_items WHERE list_name = ?',
      [priceListName]
    );
    const total = countResult?.total || 0;

    // Get page of items
    const items = await db.getAllAsync(
      'SELECT * FROM pricelist_items WHERE list_name = ? LIMIT ? OFFSET ?',
      [priceListName, pageSize, offset]
    );

    const totalPages = Math.ceil(total / pageSize);

    console.log(`Loaded page ${page}/${totalPages} for ${priceListName} (${items.length} items)`);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
      priceListName,
    };
  } catch (error) {
    console.error(`Error loading paginated items for ${priceListName}:`, error);
    return { items: [], page: 1, pageSize, total: 0, totalPages: 0, hasMore: false, priceListName };
  }
};

// Get items for a specific price list (from SQLite)
export const getItemsForPriceList = async (priceListName) => {
  try {
    console.log(`=== getItemsForPriceList Debug ===`);
    console.log(`Looking for price list: "${priceListName}"`);

    const db = await getPricelistDb();

    // First, show what price lists are actually in the database
    const uniqueLists = await db.getAllAsync('SELECT DISTINCT list_name FROM pricelist_items');
    console.log('Available price lists in SQLite:', uniqueLists.map(l => `"${l.list_name}"`).join(', '));

    // Query for the specific price list
    const items = await db.getAllAsync(
      'SELECT * FROM pricelist_items WHERE list_name = ?',
      [priceListName]
    );
    console.log(`Found ${items.length} items for pricelist "${priceListName}" from SQLite`);

    // If no exact match, try case-insensitive search
    if (items.length === 0) {
      console.log('Trying case-insensitive search...');
      const itemsCI = await db.getAllAsync(
        'SELECT * FROM pricelist_items WHERE UPPER(list_name) = UPPER(?)',
        [priceListName]
      );
      console.log(`Case-insensitive search found ${itemsCI.length} items`);
      if (itemsCI.length > 0) {
        return itemsCI;
      }
    }

    return items;
  } catch (error) {
    console.error(`Error loading pricelist ${priceListName} from SQLite:`, error);
    return [];
  }
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

    // Also clear sync status (direct AsyncStorage, not chunked)
    await AsyncStorage.removeItem(STORAGE_KEYS.PRICE_LIST_SYNC_STATUS);
  } catch (error) {
    console.error('Error clearing pricelist storage:', error);
  }
};

// Clear all synced data (including SQLite pricelist data)
export const clearAllSyncData = async () => {
  try {
    await clearFromStorage(STORAGE_KEYS.CUSTOMERS);
    await clearFromStorage(STORAGE_KEYS.ITEMS);
    await clearFromStorage(STORAGE_KEYS.AGENTS);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST);
    await clearFromStorage(STORAGE_KEYS.PRICE_LIST_ITEMS); // Legacy key
    await clearAllPriceListStorage(); // Clear all individual pricelist keys (legacy AsyncStorage)
    await clearFromStorage(STORAGE_KEYS.ONHAND);
    await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_META);

    // Clear SQLite pricelist data
    try {
      const db = await getPricelistDb();
      await db.runAsync('DELETE FROM pricelist_items');
      console.log('Cleared pricelist data from SQLite');
    } catch (sqliteError) {
      console.error('Error clearing SQLite pricelist:', sqliteError);
    }

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

// ==================== BOGO PROMOTIONS ====================

// BOGO API endpoint
const BOGO_ENDPOINT = '/ARMODULE/BOGO';

// Extract BOGO fields from API response
const extractBogoFields = (item) => ({
  line_id: item.line_id,
  promo_name: item.promoname,
  promo_number: item.promonumber,
  promo_type: item.promotype,
  main_item_code: item.mainitemcode,
  main_item_desc: item.mainitemdesc,
  promo_item_code: item.promoitemcode,
  promo_item_desc: item.promoitemdesc,
  promo_price: item.promoprice,
  buy_qty: parseInt(item.buyqty) || 1,
  get_qty: parseInt(item.getqty) || 1,
  customer_number: item.customernumber || 'ALL',
  is_discount_allowed: item.isdiscountallowed || 'N',
  vat_code: item.vatcode,
  start_date: item.startdate,
  end_date: item.enddate,
  allow_delete_flag: item.allow_delete_flag || 'Y',
});

// Sync BOGO promotions
export const syncBogo = async (onProgress) => {
  try {
    const db = await getPricelistDb();

    if (onProgress) {
      onProgress({ status: 'Clearing old BOGO data...', fetched: 0 });
    }

    // Clear existing BOGO data
    await db.runAsync('DELETE FROM bogo_promotions');

    if (onProgress) {
      onProgress({ status: 'Fetching BOGO promotions...', fetched: 0 });
    }

    const url = `${BASE_URL}${BOGO_ENDPOINT}`;
    console.log('Fetching BOGO from:', url);

    const response = await axios.get(url, { timeout: 60000 });
    let items = [];

    if (response.data?.items && Array.isArray(response.data.items)) {
      items = response.data.items;
    } else if (Array.isArray(response.data)) {
      items = response.data;
    }

    console.log(`BOGO API returned ${items.length} promotions`);

    if (items.length > 0) {
      const extractedItems = items.map(extractBogoFields);

      if (onProgress) {
        onProgress({ status: `Saving ${extractedItems.length} BOGO promotions...`, fetched: extractedItems.length });
      }

      // Insert all BOGO items
      for (const item of extractedItems) {
        await db.runAsync(
          `INSERT INTO bogo_promotions (
            line_id, promo_name, promo_number, promo_type,
            main_item_code, main_item_desc, promo_item_code, promo_item_desc,
            promo_price, buy_qty, get_qty, customer_number,
            is_discount_allowed, vat_code, start_date, end_date, allow_delete_flag
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.line_id, item.promo_name, item.promo_number, item.promo_type,
            item.main_item_code, item.main_item_desc, item.promo_item_code, item.promo_item_desc,
            item.promo_price, item.buy_qty, item.get_qty, item.customer_number,
            item.is_discount_allowed, item.vat_code, item.start_date, item.end_date, item.allow_delete_flag
          ]
        );
      }
    }

    // Update sync metadata
    await updateSyncMetadata('bogo', items.length);

    if (onProgress) {
      onProgress({ status: `Done: ${items.length} BOGO promotions`, fetched: items.length, complete: true });
    }

    return { success: true, count: items.length };
  } catch (error) {
    console.error('Sync BOGO error:', error);
    return { success: false, error: error.message };
  }
};

// Get BOGO promotions for a specific main item code
export const getBogoForItem = async (mainItemCode, customerNumber = 'ALL') => {
  try {
    const db = await getPricelistDb();
    const now = new Date().toISOString();

    // Get BOGO rules for this item that are currently active
    // Match either the specific customer or 'ALL' customers
    const bogos = await db.getAllAsync(
      `SELECT * FROM bogo_promotions
       WHERE main_item_code = ?
       AND (customer_number = ? OR customer_number = 'ALL')
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)`,
      [mainItemCode, customerNumber, now, now]
    );

    return bogos;
  } catch (error) {
    console.error('Error getting BOGO for item:', error);
    return [];
  }
};

// Get all BOGO promotions
export const getAllBogo = async () => {
  try {
    const db = await getPricelistDb();
    const bogos = await db.getAllAsync('SELECT * FROM bogo_promotions');
    return bogos;
  } catch (error) {
    console.error('Error getting all BOGO:', error);
    return [];
  }
};

// Calculate BOGO quantity based on main item quantity
// Formula: Math.floor(mainQty / buyQty) * getQty
export const calculateBogoQty = (mainQty, buyQty, getQty) => {
  if (!buyQty || buyQty <= 0) return 0;
  return Math.floor(mainQty / buyQty) * getQty;
};

// Build BOGO items for a cart
// Returns array of BOGO items to add based on cart contents
export const buildBogoItemsForCart = async (cart, customerNumber = 'ALL') => {
  try {
    const bogoItems = [];
    const db = await getPricelistDb();
    const now = new Date().toISOString();

    for (const cartItem of cart) {
      const mainItemCode = cartItem.itemNumber || cartItem.item_number;
      if (!mainItemCode) continue;

      // Get BOGO rules for this item
      const bogos = await db.getAllAsync(
        `SELECT * FROM bogo_promotions
         WHERE main_item_code = ?
         AND (customer_number = ? OR customer_number = 'ALL')
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
        [mainItemCode, customerNumber, now, now]
      );

      for (const bogo of bogos) {
        const bogoQty = calculateBogoQty(cartItem.quantity, bogo.buy_qty, bogo.get_qty);

        if (bogoQty > 0) {
          bogoItems.push({
            // Identification
            itemNumber: bogo.promo_item_code,
            itemDesc: bogo.promo_item_desc,
            // Quantity and price
            quantity: bogoQty,
            unitPrice: parseFloat(bogo.promo_price) || 0,
            basePrice: parseFloat(bogo.promo_price) || 0,
            // BOGO metadata
            isBogo: true,
            bogoParentItemCode: mainItemCode,
            bogoPromoName: bogo.promo_name,
            bogoPromoNumber: bogo.promo_number,
            bogoPromoType: bogo.promo_type,
            bogoBuyQty: bogo.buy_qty,
            bogoGetQty: bogo.get_qty,
            bogoLineId: bogo.line_id,
            // Tax and discount rules from BOGO
            allow_discount: bogo.is_discount_allowed,
            tax_code: bogo.vat_code,
            // Deletion rules
            allowDelete: bogo.allow_delete_flag === 'Y',
            // Currency (inherit from parent or default)
            currency: cartItem.currency || 'MUR',
          });
        }
      }
    }

    return bogoItems;
  } catch (error) {
    console.error('Error building BOGO items for cart:', error);
    return [];
  }
};
