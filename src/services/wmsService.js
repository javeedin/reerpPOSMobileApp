import AsyncStorage from '@react-native-async-storage/async-storage';

const WMS_CACHE_KEY = 'wms_data_cache';
const WMS_API_BASE = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/WAREHOUSEMANAGEMENT';

/**
 * Warehouse Management Service
 * Handles WMS operations for picking, shipping, and warehouse management
 */

// Format date for API (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Fetch shipments summary from API
 * @param {string} pickerName - Picker name from login
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @param {string} pickConfirmStatus - Pick confirm status filter (null for all)
 * @returns {Promise<Object>} Shipments summary data
 */
export const fetchShipmentsSummary = async (pickerName, fromDate, toDate, pickConfirmStatus = null) => {
  try {
    const from = formatDateForAPI(fromDate);
    const to = formatDateForAPI(toDate);

    let url = `${WMS_API_BASE}/SHIPMENTSSUMMARYFORAPP?pickerName=${encodeURIComponent(pickerName)}&P_fromDate=${from}&P_todate=${to}`;

    if (pickConfirmStatus) {
      url += `&pickConfirmStatus=${encodeURIComponent(pickConfirmStatus)}`;
    }

    console.log('[WMSService] Fetching shipments summary:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WMSService] Fetched shipments:', data?.items?.length || 0);

    // Cache the data
    await AsyncStorage.setItem(WMS_CACHE_KEY, JSON.stringify({
      data,
      pickerName,
      fromDate: from,
      toDate: to,
      timestamp: Date.now(),
    }));

    return { success: true, data };
  } catch (error) {
    console.error('[WMSService] Error fetching shipments summary:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get cached WMS data
 * @returns {Promise<Object|null>} Cached WMS data or null
 */
export const getCachedWMSData = async () => {
  try {
    const cached = await AsyncStorage.getItem(WMS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('[WMSService] Error getting cached data:', error);
    return null;
  }
};

/**
 * Clear WMS cache
 */
export const clearWMSCache = async () => {
  try {
    await AsyncStorage.removeItem(WMS_CACHE_KEY);
    console.log('[WMSService] Cache cleared');
  } catch (error) {
    console.error('[WMSService] Error clearing cache:', error);
  }
};

/**
 * Calculate KPIs from shipments data
 * @param {Array} items - Array of shipment items
 * @returns {Object} KPI statistics
 */
export const calculateWMSKPIs = (items) => {
  if (!items || items.length === 0) {
    return {
      totalOrders: 0,
      salesOrders: 0,
      storeTransactions: 0,
      orderReturns: 0,
      pendingPick: 0,
      pickedOrders: 0,
      shippedOrders: 0,
      totalLines: 0,
      byTransactionType: {},
      byPickStatus: {},
      byShipStatus: {},
    };
  }

  let salesOrders = 0;
  let storeTransactions = 0;
  let orderReturns = 0;
  let pendingPick = 0;
  let pickedOrders = 0;
  let shippedOrders = 0;
  let totalLines = 0;
  const byTransactionType = {};
  const byPickStatus = {};
  const byShipStatus = {};

  items.forEach(item => {
    const transType = item.transaction_type || 'Unknown';
    const pickStatus = item.pick_confirm_status || 'NO';
    const shipStatus = item.shipped_status || 'NO';

    // Count by transaction type
    byTransactionType[transType] = (byTransactionType[transType] || 0) + 1;

    // Count by pick status
    byPickStatus[pickStatus] = (byPickStatus[pickStatus] || 0) + 1;

    // Count by ship status
    byShipStatus[shipStatus] = (byShipStatus[shipStatus] || 0) + 1;

    // Count by type (handle various naming conventions)
    if (transType === 'Sales Orders' || transType === 'Sales Order') {
      salesOrders++;
    } else if (transType === 'Store Transfers' || transType === 'Store Transfer' || transType === 'Store Transactions' || transType === 'Store Transaction') {
      storeTransactions++;
    } else if (transType === 'Order Returns' || transType === 'Order Return' || transType.includes('Return')) {
      orderReturns++;
    }

    // Count by pick status
    if (pickStatus === 'YES') {
      pickedOrders++;
    } else {
      pendingPick++;
    }

    // Count by ship status
    if (shipStatus === 'YES') {
      shippedOrders++;
    }

    // Sum total lines
    totalLines += parseInt(item.no_of_lines) || 0;
  });

  return {
    totalOrders: items.length,
    salesOrders,
    storeTransactions,
    orderReturns,
    pendingPick,
    pickedOrders,
    shippedOrders,
    totalLines,
    byTransactionType,
    byPickStatus,
    byShipStatus,
  };
};

/**
 * Group orders by lorry, loading bay, and priority
 * @param {Array} items - Array of shipment items
 * @returns {Array} Grouped orders
 */
export const groupOrdersByLorry = (items) => {
  if (!items || items.length === 0) {
    return [];
  }

  // Group by lorry_number -> loading_bay -> order_priority
  const grouped = {};

  items.forEach(item => {
    const lorry = item.lorry_number || 'No Lorry';
    const bay = item.loading_bay || 'No Bay';
    const priority = item.order_priority || '99';

    if (!grouped[lorry]) {
      grouped[lorry] = {
        lorry_number: lorry,
        loading_bays: {},
        orderCount: 0,
        totalLines: 0,
      };
    }

    if (!grouped[lorry].loading_bays[bay]) {
      grouped[lorry].loading_bays[bay] = {
        loading_bay: bay,
        priorities: {},
        orderCount: 0,
      };
    }

    if (!grouped[lorry].loading_bays[bay].priorities[priority]) {
      grouped[lorry].loading_bays[bay].priorities[priority] = {
        priority,
        orders: [],
      };
    }

    grouped[lorry].loading_bays[bay].priorities[priority].orders.push(item);
    grouped[lorry].loading_bays[bay].orderCount++;
    grouped[lorry].orderCount++;
    grouped[lorry].totalLines += parseInt(item.no_of_lines) || 0;
  });

  // Convert to array and sort
  const result = Object.values(grouped).map(lorryGroup => ({
    ...lorryGroup,
    loading_bays: Object.values(lorryGroup.loading_bays).map(bayGroup => ({
      ...bayGroup,
      priorities: Object.values(bayGroup.priorities).sort((a, b) =>
        parseInt(a.priority) - parseInt(b.priority)
      ),
    })),
  }));

  // Sort lorries alphabetically
  return result.sort((a, b) => a.lorry_number.localeCompare(b.lorry_number));
};

/**
 * Filter orders by transaction type
 * @param {Array} items - Array of shipment items
 * @param {string} transactionType - Transaction type filter
 * @returns {Array} Filtered orders
 */
export const filterByTransactionType = (items, transactionType) => {
  if (!transactionType || transactionType === 'All') {
    return items;
  }
  // Handle Store Transfers/Store Transactions as same category
  if (transactionType === 'Store Transfers' || transactionType === 'Store Transactions') {
    return items.filter(item =>
      item.transaction_type === 'Store Transfers' ||
      item.transaction_type === 'Store Transfer' ||
      item.transaction_type === 'Store Transactions' ||
      item.transaction_type === 'Store Transaction'
    );
  }
  return items.filter(item => item.transaction_type === transactionType);
};

/**
 * Group orders by date
 * @param {Array} items - Array of shipment items
 * @returns {Array} Orders grouped by date
 */
export const groupOrdersByDate = (items) => {
  if (!items || items.length === 0) {
    return [];
  }

  const grouped = {};

  items.forEach(item => {
    const dateStr = item.assignment_date
      ? new Date(item.assignment_date).toISOString().split('T')[0]
      : 'No Date';

    if (!grouped[dateStr]) {
      grouped[dateStr] = {
        date: dateStr,
        displayDate: item.assignment_date
          ? new Date(item.assignment_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })
          : 'No Date',
        orders: [],
        totalLines: 0,
        pendingCount: 0,
        pickedCount: 0,
        shippedCount: 0,
      };
    }

    grouped[dateStr].orders.push(item);
    grouped[dateStr].totalLines += parseInt(item.no_of_lines) || 0;

    if (item.shipped_status === 'YES') {
      grouped[dateStr].shippedCount++;
    } else if (item.pick_confirm_status === 'YES') {
      grouped[dateStr].pickedCount++;
    } else {
      grouped[dateStr].pendingCount++;
    }
  });

  // Convert to array and sort by date (newest first)
  return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * Filter orders by pick status
 * @param {Array} items - Array of shipment items
 * @param {string} pickStatus - Pick status filter ('YES', 'NO', or null for all)
 * @returns {Array} Filtered orders
 */
export const filterByPickStatus = (items, pickStatus) => {
  if (!pickStatus) {
    return items;
  }
  return items.filter(item => item.pick_confirm_status === pickStatus);
};

/**
 * Filter orders for pending (Today and Today-1)
 * @param {Array} items - Array of shipment items
 * @returns {Array} Pending orders from today and yesterday
 */
export const filterPendingOrders = (items) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return items.filter(item => {
    // Only include pending (not pick confirmed)
    if (item.pick_confirm_status === 'YES') {
      return false;
    }

    // Check assignment date
    if (item.assignment_date) {
      const assignDate = new Date(item.assignment_date);
      assignDate.setHours(0, 0, 0, 0);
      return assignDate >= yesterday && assignDate <= today;
    }

    return true; // Include if no date for safety
  });
};

/**
 * Get date range for WMS (3-4 days past data)
 * @returns {Object} fromDate and toDate
 */
export const getWMSDateRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 3); // 3 days back

  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 1); // Include today + 1 for upcoming

  return { fromDate, toDate };
};

export default {
  fetchShipmentsSummary,
  getCachedWMSData,
  clearWMSCache,
  calculateWMSKPIs,
  groupOrdersByLorry,
  groupOrdersByDate,
  filterByTransactionType,
  filterByPickStatus,
  filterPendingOrders,
  getWMSDateRange,
};
