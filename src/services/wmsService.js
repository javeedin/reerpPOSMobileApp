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

/**
 * Fetch shipment lines for a specific order
 * @param {string} orderNumber - Source order number
 * @returns {Promise<Object>} Shipment lines data
 */
export const fetchShipmentLines = async (orderNumber) => {
  try {
    const url = `${WMS_API_BASE}/SHIPMENTLINESFORAPP?p_SOURCE_ORDER_NUMBER=${encodeURIComponent(orderNumber)}`;

    console.log('[WMSService] Fetching shipment lines:', url);

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
    console.log('[WMSService] Fetched shipment lines:', data?.items?.length || 0);

    return { success: true, data };
  } catch (error) {
    console.error('[WMSService] Error fetching shipment lines:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Confirm pick for a shipment line
 * @param {string} deliveryDetailId - Delivery detail ID
 * @param {number} qty - Quantity to confirm
 * @param {string} pickerName - Name of the picker
 * @returns {Promise<Object>} Confirmation result
 */
export const confirmPick = async (deliveryDetailId, qty, pickerName) => {
  try {
    const url = `${WMS_API_BASE}/CONFIRMPICK`;

    console.log('[WMSService] Confirming pick:', { deliveryDetailId, qty, pickerName });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        delivery_detail_id: deliveryDetailId,
        picked_qty: qty,
        pick_confirm_status: 'YES',
        picker_name: pickerName,
        pick_confirm_date: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WMSService] Pick confirmed:', data);

    return { success: true, data };
  } catch (error) {
    console.error('[WMSService] Error confirming pick:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Confirm pick via PENDING_PICKING_DETAILS endpoint
 * @param {Object} payload - Pick confirmation payload
 * @param {string} payload.id - Delivery detail ID (keep S2V- prefix)
 * @param {string} payload.line_number - Line number
 * @param {string} payload.lot - Lot number
 * @param {string} payload.pickedQty - Picked quantity
 * @param {string} payload.pickedBy - Picker name
 * @param {string} payload.pickConfirmDate - Pick confirm date (DD-MON-YYYY HH:MI:SS AM/PM)
 * @param {string} payload.pickConfirmStatus - Pick confirm status (YES/NO)
 * @param {string} payload.instance - Instance (PROD/TEST)
 * @returns {Promise<Object>} Confirmation result
 */
export const confirmPickPending = async (payload) => {
  try {
    const url = `${WMS_API_BASE}/PENDING_PICKING_DETAILS`;

    console.log('[WMSService] Confirming pick (PENDING_PICKING_DETAILS):', url);
    console.log('[WMSService] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[WMSService] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WMSService] Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[WMSService] Pick confirmed (PENDING_PICKING_DETAILS):', data);

    return { success: true, data };
  } catch (error) {
    console.error('[WMSService] Error confirming pick (PENDING_PICKING_DETAILS):', error);
    return { success: false, error: error.message };
  }
};

/**
 * Ship confirm via trip/processs2vauto endpoint
 * @param {string} deliveryDetailId - Delivery detail ID (with S2V- prefix)
 * @returns {Promise<Object>} Ship confirmation result with full response data
 */
export const shipConfirm = async (deliveryDetailId) => {
  try {
    const url = `${WMS_API_BASE}/trip/processs2vauto/${encodeURIComponent(deliveryDetailId)}`;

    console.log('[WMSService] Ship confirm:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[WMSService] Ship confirm response status:', response.status);

    // Try to parse JSON response regardless of status
    let data;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { raw_response: responseText };
    }

    console.log('[WMSService] Ship confirm response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        data,
        status: response.status
      };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error ship confirm:', error);
    return { success: false, error: error.message };
  }
};

// Fusion Cloud API configuration for onhand lookup
const FUSION_BASE_URL = 'https://efmh.fa.em3.oraclecloud.com/fscmRestApi/resources/11.13.18.05';
const FUSION_CREDENTIALS = {
  username: 'shaik',
  password: 'fusion1234',
};

// Base64 encode for Basic Auth (cross-platform)
const base64Encode = (str) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const byte1 = str.charCodeAt(i);
    const byte2 = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const byte3 = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;

    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const enc4 = byte3 & 63;

    output += chars.charAt(enc1) + chars.charAt(enc2);
    output += i + 1 < str.length ? chars.charAt(enc3) : '=';
    output += i + 2 < str.length ? chars.charAt(enc4) : '=';
  }
  return output;
};

/**
 * Fetch item onhand from Fusion API
 * @param {string} organizationCode - Organization code (e.g., 'GIC')
 * @param {string} subinventoryCode - Subinventory code (e.g., 'DUTY PAID')
 * @param {string} itemNumber - Item number
 * @returns {Promise<Object>} Onhand data with lots href
 */
export const fetchItemOnhand = async (organizationCode, subinventoryCode, itemNumber) => {
  try {
    const url = `${FUSION_BASE_URL}/inventoryOnhandBalances?q=OrganizationCode=${encodeURIComponent(organizationCode)};SubinventoryCode=${encodeURIComponent(subinventoryCode)};ItemNumber=${encodeURIComponent(itemNumber)}`;

    console.log('[WMSService] Fetching item onhand:', url);

    const authHeader = 'Basic ' + base64Encode(`${FUSION_CREDENTIALS.username}:${FUSION_CREDENTIALS.password}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WMSService] Fetched onhand:', data?.items?.length || 0);

    // Extract onhand items with lots href
    const onhandItems = [];
    if (data?.items && data.items.length > 0) {
      data.items.forEach(item => {
        // Find lots href from links
        let lotsHref = null;
        if (item.links) {
          const lotsLink = item.links.find(link => link.name === 'lots' && link.rel === 'child');
          if (lotsLink) {
            lotsHref = lotsLink.href;
          }
        }

        onhandItems.push({
          itemNumber: item.ItemNumber,
          description: item.ItemDescription,
          organizationCode: item.OrganizationCode,
          subinventoryCode: item.SubinventoryCode,
          locatorId: item.LocatorId,
          primaryQuantity: item.PrimaryQuantity,
          primaryUomCode: item.PrimaryUomCode,
          secondaryQuantity: item.SecondaryQuantity,
          secondaryUomCode: item.SecondaryUomCode,
          lotsHref: lotsHref,
        });
      });
    }

    return { success: true, items: onhandItems };
  } catch (error) {
    console.error('[WMSService] Error fetching item onhand:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch lot details from Fusion API using lots href
 * @param {string} lotsHref - Full URL to fetch lots
 * @returns {Promise<Object>} Lots data
 */
export const fetchItemLots = async (lotsHref) => {
  try {
    if (!lotsHref) {
      return { success: false, error: 'No lots URL provided' };
    }

    console.log('[WMSService] Fetching lots:', lotsHref);

    const authHeader = 'Basic ' + base64Encode(`${FUSION_CREDENTIALS.username}:${FUSION_CREDENTIALS.password}`);

    const response = await fetch(lotsHref, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WMSService] Fetched lots:', data?.items?.length || 0);

    const lots = [];
    if (data?.items && data.items.length > 0) {
      data.items.forEach(lot => {
        lots.push({
          lotNumber: lot.LotNumber,
          quantity: lot.OnhandQuantity || lot.PrimaryQuantity,
          expirationDate: lot.ExpirationDate,
          gradeCode: lot.GradeCode,
          parentLotNumber: lot.ParentLotNumber,
          originationDate: lot.OriginationDate,
        });
      });
    }

    return { success: true, lots };
  } catch (error) {
    console.error('[WMSService] Error fetching lots:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch picker performance data
 * @param {string} pickerName - Picker name
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @param {string} pickConfirmStatus - Pick confirm status filter (optional)
 * @returns {Promise<Object>} Picker performance data
 */
export const fetchPickerPerformance = async (pickerName, fromDate, toDate, pickConfirmStatus = '') => {
  try {
    const from = formatDateForAPI(fromDate);
    const to = formatDateForAPI(toDate);

    let url = `${WMS_API_BASE}/PICKERPERFORMANCE?pickerName=${encodeURIComponent(pickerName)}&P_fromDate=${from}&P_todate=${to}`;

    if (pickConfirmStatus) {
      url += `&pickConfirmStatus=${encodeURIComponent(pickConfirmStatus)}`;
    }

    console.log('[WMSService] Fetching picker performance:', url);

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
    console.log('[WMSService] Fetched picker performance:', data?.items?.length || 0);

    return { success: true, data };
  } catch (error) {
    console.error('[WMSService] Error fetching picker performance:', error);
    return { success: false, error: error.message };
  }
};

export default {
  fetchShipmentsSummary,
  fetchShipmentLines,
  confirmPick,
  confirmPickPending,
  shipConfirm,
  fetchItemOnhand,
  fetchItemLots,
  fetchPickerPerformance,
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
