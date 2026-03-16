import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for stock requisitions
const REQUISITION_KEYS = {
  CARTS: 'stock_requisition_carts', // Cart per store
  REQUISITIONS: 'stock_requisitions', // Saved/confirmed requisitions
  SEQUENCE: 'stock_requisition_sequence', // Sequence counter per subinventory
};

// Requisition status
export const REQUISITION_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  SUBMITTED: 'SUBMITTED',
  CANCELLED: 'CANCELLED',
};

// Load carts from storage
const loadCarts = async () => {
  try {
    const data = await AsyncStorage.getItem(REQUISITION_KEYS.CARTS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Load carts error:', error);
    return {};
  }
};

// Save carts to storage
const saveCarts = async (carts) => {
  try {
    await AsyncStorage.setItem(REQUISITION_KEYS.CARTS, JSON.stringify(carts));
    return true;
  } catch (error) {
    console.error('Save carts error:', error);
    return false;
  }
};

// Load requisitions from storage
const loadRequisitions = async () => {
  try {
    const data = await AsyncStorage.getItem(REQUISITION_KEYS.REQUISITIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Load requisitions error:', error);
    return [];
  }
};

// Save requisitions to storage
const saveRequisitions = async (requisitions) => {
  try {
    await AsyncStorage.setItem(REQUISITION_KEYS.REQUISITIONS, JSON.stringify(requisitions));
    return true;
  } catch (error) {
    console.error('Save requisitions error:', error);
    return false;
  }
};

// Load sequence counters
const loadSequence = async () => {
  try {
    const data = await AsyncStorage.getItem(REQUISITION_KEYS.SEQUENCE);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Load sequence error:', error);
    return {};
  }
};

// Save sequence counters
const saveSequence = async (sequence) => {
  try {
    await AsyncStorage.setItem(REQUISITION_KEYS.SEQUENCE, JSON.stringify(sequence));
    return true;
  } catch (error) {
    console.error('Save sequence error:', error);
    return false;
  }
};

// Generate next sequence number for a subinventory
export const getNextSequence = async (destSubinventory) => {
  try {
    const sequences = await loadSequence();
    const key = destSubinventory || 'DEFAULT';
    const nextSeq = (sequences[key] || 0) + 1;
    sequences[key] = nextSeq;
    await saveSequence(sequences);
    return `${key}-${String(nextSeq).padStart(5, '0')}`;
  } catch (error) {
    console.error('Get next sequence error:', error);
    return `REQ-${Date.now()}`;
  }
};

// Get cart for a specific store
export const getCart = async (storeId) => {
  try {
    const carts = await loadCarts();
    return carts[storeId] || { items: [], updatedAt: null };
  } catch (error) {
    console.error('Get cart error:', error);
    return { items: [], updatedAt: null };
  }
};

// Add item to cart
export const addToCart = async (storeId, item) => {
  try {
    const carts = await loadCarts();
    if (!carts[storeId]) {
      carts[storeId] = { items: [], updatedAt: null };
    }

    // Check if same item+lot already exists
    const existingIndex = carts[storeId].items.findIndex(
      i => i.itemNumber === item.itemNumber && i.lotNumber === item.lotNumber
    );

    if (existingIndex >= 0) {
      // Update quantity
      carts[storeId].items[existingIndex].requestedQty += item.requestedQty;
    } else {
      // Add new item
      carts[storeId].items.push({
        id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        itemNumber: item.itemNumber,
        itemDescription: item.itemDescription,
        lotNumber: item.lotNumber,
        availableQty: item.availableQty,
        requestedQty: item.requestedQty,
        uom: item.uom || 'EA',
        expirationDate: item.expirationDate,
        addedAt: new Date().toISOString(),
      });
    }

    carts[storeId].updatedAt = new Date().toISOString();
    await saveCarts(carts);

    return { success: true, cart: carts[storeId] };
  } catch (error) {
    console.error('Add to cart error:', error);
    return { success: false, error: error.message };
  }
};

// Update cart item quantity
export const updateCartItem = async (storeId, itemId, newQty) => {
  try {
    const carts = await loadCarts();
    if (!carts[storeId]) {
      return { success: false, error: 'Cart not found' };
    }

    const itemIndex = carts[storeId].items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) {
      return { success: false, error: 'Item not found in cart' };
    }

    if (newQty <= 0) {
      // Remove item
      carts[storeId].items.splice(itemIndex, 1);
    } else {
      carts[storeId].items[itemIndex].requestedQty = newQty;
    }

    carts[storeId].updatedAt = new Date().toISOString();
    await saveCarts(carts);

    return { success: true, cart: carts[storeId] };
  } catch (error) {
    console.error('Update cart item error:', error);
    return { success: false, error: error.message };
  }
};

// Remove item from cart
export const removeFromCart = async (storeId, itemId) => {
  return updateCartItem(storeId, itemId, 0);
};

// Clear cart for a store
export const clearCart = async (storeId) => {
  try {
    const carts = await loadCarts();
    if (carts[storeId]) {
      carts[storeId] = { items: [], updatedAt: null };
      await saveCarts(carts);
    }
    return { success: true };
  } catch (error) {
    console.error('Clear cart error:', error);
    return { success: false, error: error.message };
  }
};

// Get cart item count for a store
export const getCartItemCount = async (storeId) => {
  try {
    const cart = await getCart(storeId);
    return cart.items.length;
  } catch (error) {
    console.error('Get cart item count error:', error);
    return 0;
  }
};

// Create requisition from cart (checkout)
export const createRequisition = async ({
  storeId,
  sourceOrg,
  sourceSubinventory,
  destOrg,
  destSubinventory,
  notes = '',
}) => {
  try {
    const cart = await getCart(storeId);
    if (cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    const requisitions = await loadRequisitions();
    const seqNo = await getNextSequence(destSubinventory);
    const now = new Date();

    const requisition = {
      id: `req_${Date.now()}`,
      seqNo,
      storeId,
      sourceOrg,
      sourceSubinventory,
      destOrg,
      destSubinventory,
      requestDate: now.toISOString(),
      status: REQUISITION_STATUS.DRAFT,
      notes,
      lines: cart.items.map((item, index) => ({
        lineNo: index + 1,
        itemNumber: item.itemNumber,
        itemDescription: item.itemDescription,
        lotNumber: item.lotNumber,
        requestedQty: item.requestedQty,
        uom: item.uom,
        expirationDate: item.expirationDate,
      })),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    requisitions.unshift(requisition);
    await saveRequisitions(requisitions);

    // Clear cart after creating requisition
    await clearCart(storeId);

    return { success: true, requisition };
  } catch (error) {
    console.error('Create requisition error:', error);
    return { success: false, error: error.message };
  }
};

// Get all requisitions with optional filters
export const getRequisitions = async (filters = {}) => {
  try {
    let requisitions = await loadRequisitions();

    // Filter by store
    if (filters.storeId) {
      requisitions = requisitions.filter(r => r.storeId === filters.storeId);
    }

    // Filter by status
    if (filters.status) {
      requisitions = requisitions.filter(r => r.status === filters.status);
    }

    // Filter by date range
    if (filters.fromDate) {
      requisitions = requisitions.filter(r => r.requestDate >= filters.fromDate);
    }
    if (filters.toDate) {
      requisitions = requisitions.filter(r => r.requestDate <= filters.toDate);
    }

    return requisitions;
  } catch (error) {
    console.error('Get requisitions error:', error);
    return [];
  }
};

// Get requisition by ID
export const getRequisitionById = async (requisitionId) => {
  try {
    const requisitions = await loadRequisitions();
    return requisitions.find(r => r.id === requisitionId) || null;
  } catch (error) {
    console.error('Get requisition by ID error:', error);
    return null;
  }
};

// Update requisition
export const updateRequisition = async (requisitionId, updates) => {
  try {
    const requisitions = await loadRequisitions();
    const index = requisitions.findIndex(r => r.id === requisitionId);

    if (index < 0) {
      return { success: false, error: 'Requisition not found' };
    }

    requisitions[index] = {
      ...requisitions[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await saveRequisitions(requisitions);
    return { success: true, requisition: requisitions[index] };
  } catch (error) {
    console.error('Update requisition error:', error);
    return { success: false, error: error.message };
  }
};

// Confirm requisition
export const confirmRequisition = async (requisitionId) => {
  return updateRequisition(requisitionId, { status: REQUISITION_STATUS.CONFIRMED });
};

// Cancel requisition
export const cancelRequisition = async (requisitionId) => {
  return updateRequisition(requisitionId, { status: REQUISITION_STATUS.CANCELLED });
};

// Delete requisition (only drafts)
export const deleteRequisition = async (requisitionId) => {
  try {
    const requisitions = await loadRequisitions();
    const index = requisitions.findIndex(r => r.id === requisitionId);

    if (index < 0) {
      return { success: false, error: 'Requisition not found' };
    }

    if (requisitions[index].status !== REQUISITION_STATUS.DRAFT) {
      return { success: false, error: 'Only draft requisitions can be deleted' };
    }

    requisitions.splice(index, 1);
    await saveRequisitions(requisitions);

    return { success: true };
  } catch (error) {
    console.error('Delete requisition error:', error);
    return { success: false, error: error.message };
  }
};

// Add line to existing requisition
export const addLineToRequisition = async (requisitionId, line) => {
  try {
    const requisitions = await loadRequisitions();
    const index = requisitions.findIndex(r => r.id === requisitionId);

    if (index < 0) {
      return { success: false, error: 'Requisition not found' };
    }

    if (requisitions[index].status !== REQUISITION_STATUS.DRAFT) {
      return { success: false, error: 'Can only add lines to draft requisitions' };
    }

    const newLineNo = requisitions[index].lines.length + 1;
    requisitions[index].lines.push({
      lineNo: newLineNo,
      itemNumber: line.itemNumber,
      itemDescription: line.itemDescription,
      lotNumber: line.lotNumber,
      requestedQty: line.requestedQty,
      uom: line.uom || 'EA',
      expirationDate: line.expirationDate,
    });

    requisitions[index].updatedAt = new Date().toISOString();
    await saveRequisitions(requisitions);

    return { success: true, requisition: requisitions[index] };
  } catch (error) {
    console.error('Add line to requisition error:', error);
    return { success: false, error: error.message };
  }
};

// Update line in requisition
export const updateRequisitionLine = async (requisitionId, lineNo, updates) => {
  try {
    const requisitions = await loadRequisitions();
    const reqIndex = requisitions.findIndex(r => r.id === requisitionId);

    if (reqIndex < 0) {
      return { success: false, error: 'Requisition not found' };
    }

    const lineIndex = requisitions[reqIndex].lines.findIndex(l => l.lineNo === lineNo);
    if (lineIndex < 0) {
      return { success: false, error: 'Line not found' };
    }

    requisitions[reqIndex].lines[lineIndex] = {
      ...requisitions[reqIndex].lines[lineIndex],
      ...updates,
    };

    requisitions[reqIndex].updatedAt = new Date().toISOString();
    await saveRequisitions(requisitions);

    return { success: true, requisition: requisitions[reqIndex] };
  } catch (error) {
    console.error('Update requisition line error:', error);
    return { success: false, error: error.message };
  }
};

// Remove line from requisition
export const removeRequisitionLine = async (requisitionId, lineNo) => {
  try {
    const requisitions = await loadRequisitions();
    const reqIndex = requisitions.findIndex(r => r.id === requisitionId);

    if (reqIndex < 0) {
      return { success: false, error: 'Requisition not found' };
    }

    requisitions[reqIndex].lines = requisitions[reqIndex].lines.filter(l => l.lineNo !== lineNo);

    // Renumber lines
    requisitions[reqIndex].lines.forEach((line, idx) => {
      line.lineNo = idx + 1;
    });

    requisitions[reqIndex].updatedAt = new Date().toISOString();
    await saveRequisitions(requisitions);

    return { success: true, requisition: requisitions[reqIndex] };
  } catch (error) {
    console.error('Remove requisition line error:', error);
    return { success: false, error: error.message };
  }
};
