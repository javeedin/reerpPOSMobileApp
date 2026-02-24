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

    let rawUrl = `${WMS_API_BASE}/SHIPMENTSSUMMARYFORAPP?pickerName=${encodeURIComponent(pickerName)}&P_fromDate=${from}&P_todate=${to}`;

    if (pickConfirmStatus) {
      rawUrl += `&pickConfirmStatus=${encodeURIComponent(pickConfirmStatus)}`;
    }

    const url = await appendInstanceParam(rawUrl);
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
      // New detailed KPIs for Sales and Store Transactions
      salesKPIs: { orders: 0, pendingLines: 0, pickedLines: 0, shippedLines: 0 },
      storeKPIs: { orders: 0, pendingLines: 0, pickedLines: 0, shippedLines: 0 },
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

  // Detailed KPIs for Sales and Store Transactions
  const salesKPIs = { orders: 0, pendingLines: 0, pickedLines: 0, shippedLines: 0 };
  const storeKPIs = { orders: 0, pendingLines: 0, pickedLines: 0, shippedLines: 0 };

  items.forEach(item => {
    const transType = item.transaction_type || 'Unknown';
    const pickStatus = item.pick_confirm_status || 'NO';
    const shipStatus = item.shipped_status || 'NO';
    const lines = parseInt(item.no_of_lines) || 0;

    // Count by transaction type
    byTransactionType[transType] = (byTransactionType[transType] || 0) + 1;

    // Count by pick status
    byPickStatus[pickStatus] = (byPickStatus[pickStatus] || 0) + 1;

    // Count by ship status
    byShipStatus[shipStatus] = (byShipStatus[shipStatus] || 0) + 1;

    // Determine if Sales or Store type
    const isSales = transType === 'Sales Orders' || transType === 'Sales Order';
    const isStore = transType === 'Store Transfers' || transType === 'Store Transfer' || transType === 'Store Transactions' || transType === 'Store Transaction';

    // Count by type (handle various naming conventions)
    if (isSales) {
      salesOrders++;
      salesKPIs.orders++;
      // Categorize lines based on order status
      if (shipStatus === 'YES') {
        salesKPIs.shippedLines += lines;
      } else if (pickStatus === 'YES') {
        salesKPIs.pickedLines += lines;
      } else {
        salesKPIs.pendingLines += lines;
      }
    } else if (isStore) {
      storeTransactions++;
      storeKPIs.orders++;
      // Categorize lines based on order status
      if (shipStatus === 'YES') {
        storeKPIs.shippedLines += lines;
      } else if (pickStatus === 'YES') {
        storeKPIs.pickedLines += lines;
      } else {
        storeKPIs.pendingLines += lines;
      }
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
    totalLines += lines;
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
    salesKPIs,
    storeKPIs,
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
    const url = await appendInstanceParam(`${WMS_API_BASE}/SHIPMENTLINESFORAPP?p_SOURCE_ORDER_NUMBER=${encodeURIComponent(orderNumber)}`);

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
    const currentInstance = await getInstance();

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
        p_instance_name: currentInstance,
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
    const currentInstance = await getInstance();

    console.log('[WMSService] Confirming pick (PENDING_PICKING_DETAILS):', url);
    console.log('[WMSService] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, p_instance_name: currentInstance }),
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
 * Update picked quantity for a Store (S2V) line before ship confirm
 * @param {string|number} linesId - Lines ID (P_LID)
 * @param {string} instanceName - Instance name (e.g. 'TEST' or 'PROD')
 * @param {number} pickedQty - Picked quantity
 * @returns {Promise<Object>} Result with success flag and data
 */
export const updatePickedQty = async (linesId, instanceName, pickedQty) => {
  try {
    if (!linesId) {
      return { success: false, error: 'Lines ID (p_lid) is required', data: null };
    }

    const url = `${WMS_API_BASE}/updatepickedqty`;
    const payload = {
      p_lid: linesId,
      p_instance_name: instanceName || 'TEST',
      p_pickedQty: parseInt(pickedQty) || 0,
    };

    console.log('[WMSService] Update picked qty:', url);
    console.log('[WMSService] Payload:', JSON.stringify(payload));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[WMSService] Update picked qty response status:', response.status);

    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('[WMSService] Update picked qty response first 500 chars:', responseText.substring(0, 500));
    } catch (textError) {
      console.error('[WMSService] Error reading response text:', textError);
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        const h1Match = responseText.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const errorMatch = responseText.match(/error[:\s]*(.*?)(?:<|$)/i);
        const errorMessage = titleMatch?.[1] || h1Match?.[1] || errorMatch?.[1] || 'Server returned HTML error page';
        data = { error: errorMessage, type: 'HTML_ERROR', status: response.status, preview: responseText.substring(0, 300) };
      } else {
        data = { message: responseText.substring(0, 500), type: 'TEXT_RESPONSE' };
      }
    }

    console.log('[WMSService] Update picked qty response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data, status: response.status };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error update picked qty:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Ship confirm via trip/processs2vauto endpoint
 * @param {string} deliveryDetailId - Delivery detail ID (Lines_id)
 * @returns {Promise<Object>} Ship confirmation result with full response data
 */
export const shipConfirm = async (deliveryDetailId) => {
  try {
    if (!deliveryDetailId) {
      return { success: false, error: 'Lines_id is required', data: null };
    }

    // Don't encode - it's just a number
    const url = await appendInstanceParam(`${WMS_API_BASE}/trip/processs2vauto/${deliveryDetailId}`);

    console.log('[WMSService] Ship confirm:', url);
    console.log('[WMSService] Lines_id:', deliveryDetailId);

    // Try simple POST without body
    const response = await fetch(url, {
      method: 'POST',
    });

    console.log('[WMSService] Ship confirm response status:', response.status);

    // Try to parse JSON response regardless of status
    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      // Log first 500 chars to see actual error
      console.log('[WMSService] Response first 500 chars:', responseText.substring(0, 500));

      // Truncate very long responses (HTML error pages)
      if (responseText.length > 5000) {
        console.log('[WMSService] Response truncated (was ' + responseText.length + ' chars)');
      }
    } catch (textError) {
      console.error('[WMSService] Error reading response text:', textError);
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // Check if it's an HTML error page
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        // Extract error message from HTML - try multiple patterns
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        const h1Match = responseText.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const errorMatch = responseText.match(/error[:\s]*(.*?)(?:<|$)/i);
        const errorMessage = titleMatch?.[1] || h1Match?.[1] || errorMatch?.[1] || 'Server returned HTML error page';
        data = {
          error: errorMessage,
          type: 'HTML_ERROR',
          status: response.status,
          preview: responseText.substring(0, 300)
        };
      } else {
        data = {
          message: responseText.substring(0, 500),
          type: 'TEXT_RESPONSE'
        };
      }
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
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Process S2V shipment after all lines are ship confirmed
 * @param {string} sourceOrderNumber - Source order number (with or without S2V- prefix)
 * @param {string} instanceName - Instance name (default: PROD)
 * @returns {Promise<Object>} Process result
 */
export const processS2VShipment = async (sourceOrderNumber, instanceName = 'PROD') => {
  try {
    // Remove S2V- prefix if present
    const orderNumber = String(sourceOrderNumber).replace(/^S2V-/i, '');

    if (!orderNumber) {
      return { success: false, error: 'Order number is required', data: null };
    }

    const url = `${WMS_API_BASE}/trip/processs2v`;
    const currentInstance = await getInstance();
    const payload = {
      p_trx_number: orderNumber,
      p_instance_name: instanceName || currentInstance,
    };

    console.log('[WMSService] Process S2V shipment:', url);
    console.log('[WMSService] Payload:', JSON.stringify(payload));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[WMSService] Process S2V response status:', response.status);

    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('[WMSService] Response first 500 chars:', responseText.substring(0, 500));
    } catch (textError) {
      console.error('[WMSService] Error reading response text:', textError);
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        data = {
          error: titleMatch?.[1] || 'Server returned HTML error page',
          type: 'HTML_ERROR',
          status: response.status
        };
      } else {
        data = {
          message: responseText.substring(0, 500),
          type: 'TEXT_RESPONSE'
        };
      }
    }

    console.log('[WMSService] Process S2V response:', JSON.stringify(data, null, 2));

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
    console.error('[WMSService] Error process S2V:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

// Dynamic instance support - Fusion URLs + Apex p_instance_name helper
import { getInstance, getFusionBaseUrl, appendInstanceParam } from './api';

// Fusion credentials - fetched dynamically from API, cached in memory
let _fusionCredentialsCache = null;

/**
 * Fetch Fusion user credentials from Apex API
 * Caches in memory so it's only fetched once per app session
 * @returns {Promise<{username: string, password: string}>}
 */
const getFusionCredentials = async () => {
  if (_fusionCredentialsCache) {
    return _fusionCredentialsCache;
  }

  try {
    const url = await appendInstanceParam(`${WMS_API_BASE}/trip/fusionuserdetails`);
    console.log('[WMSService] Fetching Fusion credentials:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WMSService] Fusion credentials fetched successfully');

    // Extract credentials from response (handle both single item and items array)
    const item = data?.items?.[0] || data;
    const username = item.user_name || item.USER_NAME || item.username || item.USERNAME || '';
    const password = item.passwordd || item.PASSWORDD || item.password || item.PASSWORD || '';

    if (username && password) {
      _fusionCredentialsCache = { username, password };
      return _fusionCredentialsCache;
    }

    throw new Error('No credentials found in API response');
  } catch (error) {
    console.error('[WMSService] Error fetching Fusion credentials:', error);
    // No fallback - throw so caller knows it failed
    throw new Error('Failed to fetch Fusion credentials: ' + error.message);
  }
};

/**
 * Build Basic Auth header from Fusion credentials
 * @returns {Promise<string>} Authorization header value
 */
const getFusionAuthHeader = async () => {
  const creds = await getFusionCredentials();
  return 'Basic ' + base64Encode(`${creds.username}:${creds.password}`);
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
    const currentInstance = await getInstance();
    const fusionBaseUrl = getFusionBaseUrl(currentInstance);
    const url = `${fusionBaseUrl}/inventoryOnhandBalances?q=OrganizationCode=${encodeURIComponent(organizationCode)};SubinventoryCode=${encodeURIComponent(subinventoryCode)};ItemNumber=${encodeURIComponent(itemNumber)}`;

    console.log('[WMSService] Fetching item onhand:', url);

    const authHeader = await getFusionAuthHeader();

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

    const authHeader = await getFusionAuthHeader();

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
 * Lot-Based Pick Confirm via Fusion pickTransactions API
 * Step 1: POST to Fusion /pickTransactions
 * @param {Object} payload - Pick transaction payload
 * @param {string} payload.deliveryDetailId - DELIVERY_DETAIL_ID (PickSlip)
 * @param {string} payload.linesId - LINES_ID (PickSlipLine)
 * @param {number} payload.pickedQty - Picked quantity
 * @param {string} payload.subinventoryCode - Subinventory code (default: DUTY PAID)
 * @param {string} payload.lot - Lot number
 * @param {number} payload.lotQty - Lot quantity (same as pickedQty)
 * @returns {Promise<Object>} Fusion pick transaction result
 */
export const fusionPickTransaction = async (payload) => {
  try {
    const currentInstance = await getInstance();
    const fusionBaseUrl = getFusionBaseUrl(currentInstance);
    const url = `${fusionBaseUrl}/pickTransactions`;

    const body = {
      pickLines: [
        {
          PickSlip: String(payload.deliveryDetailId),
          PickSlipLine: String(payload.linesId),
          PickedQuantity: String(payload.pickedQty),
          SubinventoryCode: payload.subinventoryCode || 'DUTY PAID',
          lotItemLots: [
            {
              Lot: String(payload.lot),
              Quantity: String(payload.lotQty || payload.pickedQty),
            },
          ],
        },
      ],
    };

    console.log('[WMSService] Fusion Pick Transaction:', url);
    console.log('[WMSService] Payload:', JSON.stringify(body, null, 2));

    const authHeader = await getFusionAuthHeader();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[WMSService] Fusion Pick Transaction response status:', response.status);

    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('[WMSService] Response first 500 chars:', responseText.substring(0, 500));
    } catch (textError) {
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        data = {
          error: titleMatch?.[1] || 'Server returned HTML error page',
          type: 'HTML_ERROR',
          status: response.status,
        };
      } else {
        data = {
          message: responseText.substring(0, 500),
          type: 'TEXT_RESPONSE',
        };
      }
    }

    console.log('[WMSService] Fusion Pick Transaction response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        data,
        status: response.status,
      };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error Fusion Pick Transaction:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Update pick confirm status via Apex API (Step 2 after Fusion pick)
 * POST to /TRIPMANAGEMENT/trip/updatepickconfirmstatus
 * @param {Object} payload - Update payload
 * @param {string|number} payload.transactionId - P_TRANSACTION_ID (ID field)
 * @param {number} payload.pickedQty - Picked quantity
 * @returns {Promise<Object>} Update result
 */
export const updatePickConfirmStatus = async (payload) => {
  try {
    const APEX_BASE = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';
    const url = `${APEX_BASE}/TRIPMANAGEMENT/trip/updatepickconfirmstatus`;
    const currentInstance = await getInstance();

    const body = {
      P_TRANSACTION_ID: payload.transactionId,
      p_instance_name: currentInstance,
      p_pickedQty: payload.pickedQty,
    };

    console.log('[WMSService] Update Pick Confirm Status:', url);
    console.log('[WMSService] Payload:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[WMSService] Update Pick Confirm Status response:', response.status);

    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('[WMSService] Response first 500 chars:', responseText.substring(0, 500));
    } catch (textError) {
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        data = {
          error: titleMatch?.[1] || 'Server returned HTML error page',
          type: 'HTML_ERROR',
          status: response.status,
        };
      } else {
        data = {
          message: responseText.substring(0, 500),
          type: 'TEXT_RESPONSE',
        };
      }
    }

    console.log('[WMSService] Update Pick Confirm Status response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        data,
        status: response.status,
      };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error updating pick confirm status:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Step 1: Get shipment number for a source order (Sales Orders Ship Confirm)
 * POST /WAREHOUSEMANAGEMENT/getshipmentnumber
 * @param {string} sourceOrderNumber - Source order number
 * @returns {Promise<Object>} { success, shipmentNumber, data }
 */
export const getShipmentNumber = async (sourceOrderNumber) => {
  try {
    const url = `${WMS_API_BASE}/getshipmentnumber`;
    const currentInstance = await getInstance();

    const body = {
      source_order_number: sourceOrderNumber,
      p_instance_name: currentInstance,
    };

    console.log('[WMSService] Get Shipment Number:', url);
    console.log('[WMSService] Payload:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WMSService] Get Shipment Number response:', JSON.stringify(data, null, 2));

    // Handle items array or direct response
    const item = data?.items?.[0] || data;
    const shipmentNumber = item?.shipment_number || item?.SHIPMENT_NUMBER || data?.shipment_number || data?.SHIPMENT_NUMBER || '';

    if (shipmentNumber) {
      return { success: true, shipmentNumber, data };
    }

    return { success: false, error: data?.message || 'No shipment number found', data };
  } catch (error) {
    console.error('[WMSService] Error getting shipment number:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Step 2: Fusion Ship Confirm via shippingTransactions API (Sales Orders)
 * POST to Fusion /shippingTransactions
 * @param {string} shipmentNumber - Shipment number from Step 1
 * @param {string} organization - Organization code (default: GIC)
 * @returns {Promise<Object>} { success, data }
 */
export const fusionShipConfirmTransaction = async (shipmentNumber, organization = 'GIC') => {
  try {
    const currentInstance = await getInstance();
    const fusionBaseUrl = getFusionBaseUrl(currentInstance);
    const url = `${fusionBaseUrl}/shippingTransactions`;

    const body = {
      ShipmentName: String(shipmentNumber),
      Action: 'CONFIRM',
      Organization: organization,
    };

    console.log('[WMSService] Fusion Ship Confirm:', url);
    console.log('[WMSService] Payload:', JSON.stringify(body, null, 2));

    const authHeader = await getFusionAuthHeader();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[WMSService] Fusion Ship Confirm response status:', response.status);

    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('[WMSService] Response first 500 chars:', responseText.substring(0, 500));
    } catch (textError) {
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        data = {
          error: titleMatch?.[1] || 'Server returned HTML error page',
          type: 'HTML_ERROR',
          status: response.status,
        };
      } else {
        data = { message: responseText.substring(0, 500), type: 'TEXT_RESPONSE' };
      }
    }

    console.log('[WMSService] Fusion Ship Confirm response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data, status: response.status };
    }

    // Check Result field for SUCCESS
    const result = data?.Result || data?.result || '';
    if (result === 'SUCCESS') {
      return { success: true, data, status: response.status };
    }

    return {
      success: false,
      error: data?.ErrorMessage || data?.errorMessage || `Result: ${result}`,
      data,
      status: response.status,
    };
  } catch (error) {
    console.error('[WMSService] Error Fusion Ship Confirm:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Step 3: Update ship confirmation status via Apex API (after Fusion ship confirm)
 * POST to /TRIPMANAGEMENT/updateshipconfirmationstatus
 * @param {string|number} sourceOrder - P_SOURCE_ORDER (source order number)
 * @returns {Promise<Object>} Update result
 */
export const updateShipConfirmationStatus = async (sourceOrder) => {
  try {
    const url = `${WMS_API_BASE.replace('/WAREHOUSEMANAGEMENT', '')}/TRIPMANAGEMENT/updateshipconfirmationstatus`;
    const currentInstance = await getInstance();

    const body = {
      P_SOURCE_ORDER: sourceOrder,
      p_instance_name: currentInstance,
    };

    console.log('[WMSService] Update Ship Confirmation Status:', url);
    console.log('[WMSService] Payload:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('[WMSService] Update Ship Confirmation Status response:', response.status);

    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('[WMSService] Response first 500 chars:', responseText.substring(0, 500));
    } catch (textError) {
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        data = { error: titleMatch?.[1] || 'Server returned HTML error page', type: 'HTML_ERROR', status: response.status };
      } else {
        data = { message: responseText.substring(0, 500), type: 'TEXT_RESPONSE' };
      }
    }

    console.log('[WMSService] Update Ship Confirmation Status response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data, status: response.status };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error updating ship confirmation status:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Cancel order line(s) via Fusion salesOrdersForOrderHub REST API
 * PATCH to /fscmRestApi/resources/11.13.18.05/salesOrdersForOrderHub/OPS:{orderNumber}
 * @param {Object} payload - Cancel payload
 * @param {string} payload.orderNumber - Source order number
 * @param {Array} payload.lines - Array of line objects { FulfillLineId, CancelReason }
 * @returns {Promise<Object>} Cancel result with full API response
 */
export const cancelOrderLine = async (payload) => {
  try {
    const currentInstance = await getInstance();
    const fusionBaseUrl = getFusionBaseUrl(currentInstance);
    const url = `${fusionBaseUrl}/salesOrdersForOrderHub/OPS:${payload.orderNumber}`;

    const body = {
      lines: payload.lines.map(line => ({
        FulfillLineId: line.FulfillLineId,
        OrderedQuantity: 0,
        CancelReason: line.CancelReason || 'OUT OF STOCK',
      })),
    };

    console.log('[WMSService] Cancel Order Line (Fusion):', url);
    console.log('[WMSService] Payload:', JSON.stringify(body, null, 2));

    const authHeader = await getFusionAuthHeader();

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[WMSService] Cancel Order Line response status:', response.status);

    let data;
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('[WMSService] Response first 500 chars:', responseText.substring(0, 500));
    } catch (textError) {
      console.error('[WMSService] Error reading response text:', textError);
      responseText = 'Error reading response';
    }

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        data = {
          error: titleMatch?.[1] || 'Server returned HTML error page',
          type: 'HTML_ERROR',
          status: response.status,
        };
      } else {
        data = {
          message: responseText.substring(0, 500),
          type: 'TEXT_RESPONSE',
        };
      }
    }

    console.log('[WMSService] Cancel Order Line response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        data,
        status: response.status,
      };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error cancelling order line (Fusion):', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Get the Fusion cancel order line URL (for display purposes)
 * @param {string} orderNumber - Source order number
 * @returns {Promise<string>} Full Fusion API URL
 */
export const getCancelOrderLineUrl = async (orderNumber) => {
  const currentInstance = await getInstance();
  const fusionBaseUrl = getFusionBaseUrl(currentInstance);
  return `${fusionBaseUrl}/salesOrdersForOrderHub/OPS:${orderNumber}`;
};

/**
 * Update cancel status in APEX after successful Fusion cancel
 * @param {string} transactionId - The line transaction ID (item.id)
 * @param {string} instanceName - Instance name (PROD/TEST)
 * @returns {Promise<Object>} Update result
 */
export const updateCancelStatus = async (transactionId, instanceName) => {
  try {
    const url = `https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT/trip/updatecancelstatus`;

    const body = {
      P_TRANSACTION_ID: transactionId,
      p_instance_name: instanceName || 'TEST',
    };

    console.log('[WMSService] Update Cancel Status (APEX):', url, body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[WMSService] Update Cancel Status response status:', response.status);

    let data;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
    } catch (e) {
      data = { message: 'Response received' };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data, status: response.status };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error updating cancel status (APEX):', error);
    return { success: false, error: error.message, data: { error: error.message } };
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

    let rawUrl = `${WMS_API_BASE}/PICKERPERFORMANCE?pickerName=${encodeURIComponent(pickerName)}&P_fromDate=${from}&P_todate=${to}`;

    if (pickConfirmStatus) {
      rawUrl += `&pickConfirmStatus=${encodeURIComponent(pickConfirmStatus)}`;
    }

    const url = await appendInstanceParam(rawUrl);
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

/**
 * Fetch inventory staged transactions from Fusion (for Store Orders retry cleanup)
 * @param {string} instance - Instance name (PROD/TEST)
 * @returns {Promise<Object>} { success, data }
 */
export const getInventoryStagedTransactions = async (instance) => {
  try {
    const instanceUpper = (instance || 'TEST').toUpperCase();
    const fusionBaseUrl = getFusionBaseUrl(instanceUpper);
    const url = `${fusionBaseUrl}/inventoryStagedTransactions?q=OrganizationName=GIC;TransactionTypeName=Direct Organization Transfer`;

    console.log('[WMSService] Get Inventory Staged Transactions:', url);

    const authHeader = await getFusionAuthHeader();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('[WMSService] Get Staged Transactions status:', response.status);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, data, status: response.status };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error fetching staged transactions:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

/**
 * Delete a single inventory staged transaction from Fusion (for Store Orders retry cleanup)
 * @param {string|number} transactionInterfaceId - TransactionInterfaceId to delete
 * @param {string} instance - Instance name (PROD/TEST)
 * @returns {Promise<Object>} { success, data }
 */
export const deleteInventoryStagedTransaction = async (transactionInterfaceId, instance) => {
  try {
    const instanceUpper = (instance || 'TEST').toUpperCase();
    const fusionBaseUrl = getFusionBaseUrl(instanceUpper);
    const url = `${fusionBaseUrl}/inventoryStagedTransactions/${transactionInterfaceId}`;

    console.log('[WMSService] Delete Inventory Staged Transaction:', url);

    const authHeader = await getFusionAuthHeader();
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('[WMSService] Delete Staged Transaction status:', response.status);

    // 204 No Content is a successful delete
    if (response.status === 204 || response.ok) {
      return { success: true, status: response.status };
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    return { success: false, error: `HTTP ${response.status}`, data, status: response.status };
  } catch (error) {
    console.error('[WMSService] Error deleting staged transaction:', error);
    return { success: false, error: error.message, data: { error: error.message } };
  }
};

export default {
  fetchShipmentsSummary,
  fetchShipmentLines,
  confirmPick,
  confirmPickPending,
  fusionPickTransaction,
  updatePickConfirmStatus,
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
  getShipmentNumber,
  fusionShipConfirmTransaction,
  updateShipConfirmationStatus,
  cancelOrderLine,
  getCancelOrderLineUrl,
  updateCancelStatus,
  getInventoryStagedTransactions,
  deleteInventoryStagedTransaction,
};
