import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for on-hand adjustments
const ONHAND_KEYS = {
  ADJUSTMENTS: 'onhand_adjustments',
  LOCAL_ONHAND: 'onhand_local_cache',
};

// Adjustment types
export const ADJUSTMENT_TYPE = {
  ORDER_SALE: 'ORDER_SALE',       // Reduction from confirmed order
  ORDER_CANCEL: 'ORDER_CANCEL',   // Restore from cancelled order
  MANUAL_ADD: 'MANUAL_ADD',       // Manual addition
  MANUAL_REMOVE: 'MANUAL_REMOVE', // Manual removal
};

// Load adjustments from storage
const loadAdjustments = async () => {
  try {
    const data = await AsyncStorage.getItem(ONHAND_KEYS.ADJUSTMENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Load adjustments error:', error);
    return [];
  }
};

// Save adjustments to storage
const saveAdjustments = async (adjustments) => {
  try {
    await AsyncStorage.setItem(ONHAND_KEYS.ADJUSTMENTS, JSON.stringify(adjustments));
    return true;
  } catch (error) {
    console.error('Save adjustments error:', error);
    return false;
  }
};

// Load local on-hand cache
const loadLocalOnhand = async () => {
  try {
    const data = await AsyncStorage.getItem(ONHAND_KEYS.LOCAL_ONHAND);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Load local onhand error:', error);
    return {};
  }
};

// Save local on-hand cache
const saveLocalOnhand = async (cache) => {
  try {
    await AsyncStorage.setItem(ONHAND_KEYS.LOCAL_ONHAND, JSON.stringify(cache));
    return true;
  } catch (error) {
    console.error('Save local onhand error:', error);
    return false;
  }
};

// Create an on-hand adjustment
export const createAdjustment = async ({
  itemNumber,
  itemDescription,
  quantity,
  adjustmentType,
  orderNumber = null,
  notes = '',
}) => {
  try {
    const adjustments = await loadAdjustments();
    const now = new Date();

    const adjustment = {
      id: `adj_${Date.now()}`,
      itemNumber,
      itemDescription,
      quantity: adjustmentType.includes('REMOVE') || adjustmentType === ADJUSTMENT_TYPE.ORDER_SALE
        ? -Math.abs(quantity)
        : Math.abs(quantity),
      adjustmentType,
      orderNumber,
      notes,
      createdAt: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
    };

    adjustments.unshift(adjustment);
    await saveAdjustments(adjustments);

    // Update local on-hand cache
    const localOnhand = await loadLocalOnhand();
    if (!localOnhand[itemNumber]) {
      localOnhand[itemNumber] = 0;
    }
    localOnhand[itemNumber] += adjustment.quantity;
    await saveLocalOnhand(localOnhand);

    return { success: true, adjustment };
  } catch (error) {
    console.error('Create adjustment error:', error);
    return { success: false, error: error.message };
  }
};

// Reduce on-hand for order lines
export const reduceOnhandForOrder = async (orderNumber, lines) => {
  try {
    const results = [];
    for (const line of lines) {
      const result = await createAdjustment({
        itemNumber: line.itemNumber,
        itemDescription: line.itemDesc || line.itemNumber,
        quantity: line.quantity,
        adjustmentType: ADJUSTMENT_TYPE.ORDER_SALE,
        orderNumber,
        notes: `Sold in order ${orderNumber}`,
      });
      results.push(result);
    }
    return { success: true, results };
  } catch (error) {
    console.error('Reduce onhand for order error:', error);
    return { success: false, error: error.message };
  }
};

// Restore on-hand for cancelled order
export const restoreOnhandForOrder = async (orderNumber, lines) => {
  try {
    const results = [];
    for (const line of lines) {
      const result = await createAdjustment({
        itemNumber: line.itemNumber,
        itemDescription: line.itemDesc || line.itemNumber,
        quantity: line.quantity,
        adjustmentType: ADJUSTMENT_TYPE.ORDER_CANCEL,
        orderNumber,
        notes: `Restored from cancelled order ${orderNumber}`,
      });
      results.push(result);
    }
    return { success: true, results };
  } catch (error) {
    console.error('Restore onhand for order error:', error);
    return { success: false, error: error.message };
  }
};

// Get local adjustment total for an item
export const getLocalAdjustment = async (itemNumber) => {
  try {
    const localOnhand = await loadLocalOnhand();
    return localOnhand[itemNumber] || 0;
  } catch (error) {
    console.error('Get local adjustment error:', error);
    return 0;
  }
};

// Get all local adjustments map
export const getAllLocalAdjustments = async () => {
  try {
    return await loadLocalOnhand();
  } catch (error) {
    console.error('Get all local adjustments error:', error);
    return {};
  }
};

// Get all adjustments with optional filters
export const getAdjustments = async (filters = {}) => {
  try {
    let adjustments = await loadAdjustments();

    // Filter by item number
    if (filters.itemNumber) {
      adjustments = adjustments.filter(a => a.itemNumber === filters.itemNumber);
    }

    // Filter by date range
    if (filters.fromDate) {
      adjustments = adjustments.filter(a => a.date >= filters.fromDate);
    }
    if (filters.toDate) {
      adjustments = adjustments.filter(a => a.date <= filters.toDate);
    }

    // Filter by type
    if (filters.adjustmentType) {
      adjustments = adjustments.filter(a => a.adjustmentType === filters.adjustmentType);
    }

    return adjustments;
  } catch (error) {
    console.error('Get adjustments error:', error);
    return [];
  }
};

// Get adjustment summary for an item
export const getItemAdjustmentSummary = async (itemNumber) => {
  try {
    const adjustments = await getAdjustments({ itemNumber });

    const summary = {
      totalAdjustment: 0,
      salesQty: 0,
      cancelsQty: 0,
      manualAddQty: 0,
      manualRemoveQty: 0,
      adjustmentCount: adjustments.length,
    };

    adjustments.forEach(adj => {
      summary.totalAdjustment += adj.quantity;
      switch (adj.adjustmentType) {
        case ADJUSTMENT_TYPE.ORDER_SALE:
          summary.salesQty += Math.abs(adj.quantity);
          break;
        case ADJUSTMENT_TYPE.ORDER_CANCEL:
          summary.cancelsQty += adj.quantity;
          break;
        case ADJUSTMENT_TYPE.MANUAL_ADD:
          summary.manualAddQty += adj.quantity;
          break;
        case ADJUSTMENT_TYPE.MANUAL_REMOVE:
          summary.manualRemoveQty += Math.abs(adj.quantity);
          break;
      }
    });

    return summary;
  } catch (error) {
    console.error('Get item adjustment summary error:', error);
    return { totalAdjustment: 0, salesQty: 0, cancelsQty: 0, adjustmentCount: 0 };
  }
};

// Clear all adjustments (for reset/sync)
export const clearAdjustments = async () => {
  try {
    await AsyncStorage.removeItem(ONHAND_KEYS.ADJUSTMENTS);
    await AsyncStorage.removeItem(ONHAND_KEYS.LOCAL_ONHAND);
    return { success: true };
  } catch (error) {
    console.error('Clear adjustments error:', error);
    return { success: false, error: error.message };
  }
};
