import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendInstanceParam } from './api';

const TRIP_CACHE_KEY = 'trip_data_cache';
const TRIP_API_BASE = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/WAREHOUSEMANAGEMENT';
const TRIP_MGMT_API_BASE = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP/TRIPMANAGEMENT';

/**
 * Trip Management Service
 * Handles fleet management operations for delivery trips
 */

// Format date for API
const formatDateForAPI = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Fetch trips from API
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Object>} Trip data
 */
export const fetchTrips = async (fromDate, toDate) => {
  try {
    const from = formatDateForAPI(fromDate);
    const to = formatDateForAPI(toDate);

    const url = await appendInstanceParam(`${TRIP_API_BASE}/appTripdetailsall?from_date=${from}&to_date=${to}`);
    console.log('[TripService] Fetching trips:', url);

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
    console.log('[TripService] Fetched trips:', data?.trips?.length || 0);

    // Cache the data
    await AsyncStorage.setItem(TRIP_CACHE_KEY, JSON.stringify({
      data,
      fromDate: from,
      toDate: to,
      timestamp: Date.now(),
    }));

    return { success: true, data };
  } catch (error) {
    console.error('[TripService] Error fetching trips:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch order line/lot details from API
 * @param {string} orderNumber - Order number
 * @returns {Promise<Object>} Order line details
 */
export const fetchOrderLineDetails = async (orderNumber) => {
  try {
    const url = await appendInstanceParam(`${TRIP_MGMT_API_BASE}/trips/orders/getlotdetails/${orderNumber}`);
    console.log('[TripService] Fetching order lines:', url);

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
    console.log('[TripService] Fetched order lines:', data?.items?.length || 0);

    return { success: true, data };
  } catch (error) {
    console.error('[TripService] Error fetching order lines:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get cached trip data
 * @returns {Promise<Object|null>} Cached trip data or null
 */
export const getCachedTrips = async () => {
  try {
    const cached = await AsyncStorage.getItem(TRIP_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('[TripService] Error getting cached trips:', error);
    return null;
  }
};

/**
 * Clear trip cache
 */
export const clearTripCache = async () => {
  try {
    await AsyncStorage.removeItem(TRIP_CACHE_KEY);
    console.log('[TripService] Cache cleared');
  } catch (error) {
    console.error('[TripService] Error clearing cache:', error);
  }
};

/**
 * Calculate trip statistics
 * @param {Array} trips - Array of trip objects
 * @returns {Object} Trip statistics
 */
export const calculateTripStats = (trips) => {
  if (!trips || trips.length === 0) {
    return {
      totalTrips: 0,
      totalOrders: 0,
      verifiedOrders: 0,
      deliveredOrders: 0,
      pendingOrders: 0,
      totalVolume: 0,
      lorries: [],
    };
  }

  let totalOrders = 0;
  let verifiedOrders = 0;
  let deliveredOrders = 0;
  let pendingOrders = 0;
  let totalVolume = 0;
  const lorrySet = new Set();

  trips.forEach(trip => {
    lorrySet.add(trip.tripLorry);
    if (trip.details) {
      trip.details.forEach(order => {
        totalOrders++;
        if (order.orderVolume) {
          totalVolume += parseFloat(order.orderVolume) || 0;
        }
        // Track order status based on pickConfirmSt and shipConfirmSt
        if (order.shipConfirmSt === 'YES') {
          deliveredOrders++;
        } else if (order.pickConfirmSt === 'YES') {
          verifiedOrders++;
        } else {
          pendingOrders++;
        }
      });
    }
  });

  return {
    totalTrips: trips.length,
    totalOrders,
    verifiedOrders,
    deliveredOrders,
    pendingOrders,
    totalVolume,
    lorries: Array.from(lorrySet),
  };
};

/**
 * Calculate single trip statistics
 * @param {Object} trip - Trip object with details
 * @returns {Object} Trip statistics
 */
export const calculateSingleTripStats = (trip) => {
  if (!trip || !trip.details) {
    return {
      totalOrders: 0,
      totalLines: 0,
      verifiedOrders: 0,
      deliveredOrders: 0,
      pendingOrders: 0,
      totalAmount: 0,
      totalVolume: 0,
      capacityUsed: 0,
    };
  }

  let totalOrders = trip.details.length;
  let totalLines = 0;
  let verifiedOrders = 0;
  let deliveredOrders = 0;
  let pendingOrders = 0;
  let totalAmount = 0;
  let totalVolume = 0;

  trip.details.forEach(order => {
    totalLines += order.orderLines || 0;
    totalAmount += parseFloat(order.orderAmount) || 0;
    totalVolume += parseFloat(order.orderVolume) || 0;

    if (order.shipConfirmSt === 'YES') {
      deliveredOrders++;
    } else if (order.pickConfirmSt === 'YES') {
      verifiedOrders++;
    } else {
      pendingOrders++;
    }
  });

  // Assume lorry capacity (this could come from API in future)
  const lorryCapacity = getLorryCapacity(trip.tripLorry);
  const capacityUsed = lorryCapacity > 0 ? (totalVolume / lorryCapacity) * 100 : 0;

  return {
    totalOrders,
    totalLines,
    verifiedOrders,
    deliveredOrders,
    pendingOrders,
    totalAmount,
    totalVolume,
    capacityUsed: Math.min(capacityUsed, 100),
  };
};

/**
 * Get lorry capacity based on type
 * @param {string} lorryType - Type of lorry
 * @returns {number} Capacity in cubic meters or units
 */
export const getLorryCapacity = (lorryType) => {
  const capacities = {
    'PICKUP': 500,
    'VAN': 1000,
    'TRUCK': 2000,
    'LORRY': 3000,
    'LARGE_TRUCK': 5000,
  };

  return capacities[lorryType?.toUpperCase()] || 1000;
};

/**
 * Update order verification status (local only - API integration needed)
 * @param {string} tripId - Trip ID
 * @param {string} orderId - Order ID
 * @param {Object} verification - Verification data
 */
export const updateOrderVerification = async (tripId, orderId, verification) => {
  try {
    // For now, store locally - API integration would go here
    const key = `order_verification_${tripId}_${orderId}`;
    await AsyncStorage.setItem(key, JSON.stringify({
      ...verification,
      timestamp: Date.now(),
    }));

    console.log('[TripService] Order verification updated:', orderId);
    return { success: true };
  } catch (error) {
    console.error('[TripService] Error updating verification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get order verification status
 * @param {string} tripId - Trip ID
 * @param {string} orderId - Order ID
 */
export const getOrderVerification = async (tripId, orderId) => {
  try {
    const key = `order_verification_${tripId}_${orderId}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[TripService] Error getting verification:', error);
    return null;
  }
};

/**
 * Mark order as delivered (local only - API integration needed)
 * @param {string} tripId - Trip ID
 * @param {string} orderId - Order ID
 * @param {Object} deliveryData - Delivery confirmation data
 */
export const markOrderDelivered = async (tripId, orderId, deliveryData) => {
  try {
    const key = `order_delivery_${tripId}_${orderId}`;
    await AsyncStorage.setItem(key, JSON.stringify({
      ...deliveryData,
      deliveredAt: Date.now(),
    }));

    console.log('[TripService] Order marked as delivered:', orderId);
    return { success: true };
  } catch (error) {
    console.error('[TripService] Error marking delivery:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get order delivery status
 * @param {string} tripId - Trip ID
 * @param {string} orderId - Order ID
 */
export const getOrderDelivery = async (tripId, orderId) => {
  try {
    const key = `order_delivery_${tripId}_${orderId}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[TripService] Error getting delivery status:', error);
    return null;
  }
};

export default {
  fetchTrips,
  fetchOrderLineDetails,
  getCachedTrips,
  clearTripCache,
  calculateTripStats,
  calculateSingleTripStats,
  getLorryCapacity,
  updateOrderVerification,
  getOrderVerification,
  markOrderDelivered,
  getOrderDelivery,
};
