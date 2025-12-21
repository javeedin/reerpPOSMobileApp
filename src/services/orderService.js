import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for orders
const ORDER_KEYS = {
  ORDERS: 'pos_orders',
  ORDER_COUNTER: 'pos_order_counter',
};

// Order status constants
export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

// Payment method constants
export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  VOUCHER: 'VOUCHER',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT: 'CREDIT',
};

// Generate unique order number
const generateOrderNumber = async (userPrefix = 'USR') => {
  try {
    const counterStr = await AsyncStorage.getItem(ORDER_KEYS.ORDER_COUNTER);
    let counter = counterStr ? parseInt(counterStr, 10) : 0;
    counter++;
    await AsyncStorage.setItem(ORDER_KEYS.ORDER_COUNTER, counter.toString());

    const prefix = userPrefix.substring(0, 3).toUpperCase();
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const orderNum = String(counter).padStart(5, '0');

    return `${prefix}-${dateStr}-${orderNum}`;
  } catch (error) {
    console.error('Generate order number error:', error);
    const timestamp = Date.now().toString().slice(-8);
    return `ORD-${timestamp}`;
  }
};

// Load all orders from storage
const loadOrders = async () => {
  try {
    const ordersStr = await AsyncStorage.getItem(ORDER_KEYS.ORDERS);
    return ordersStr ? JSON.parse(ordersStr) : [];
  } catch (error) {
    console.error('Load orders error:', error);
    return [];
  }
};

// Save orders to storage
const saveOrders = async (orders) => {
  try {
    await AsyncStorage.setItem(ORDER_KEYS.ORDERS, JSON.stringify(orders));
    return true;
  } catch (error) {
    console.error('Save orders error:', error);
    return false;
  }
};

// Calculate line totals
export const calculateLineTotal = (item, menuConfig = {}) => {
  const quantity = item.quantity || 1;
  const unitPrice = item.unitPrice || item.basePrice || 0;
  const discount = item.discount || 0;
  const discountType = item.discountType || 'amount'; // 'amount' or 'percent'

  // Gross amount
  const gross = quantity * unitPrice;

  // Calculate discount
  let discountAmount = 0;
  if (menuConfig.allowDiscount && discount > 0) {
    if (discountType === 'percent') {
      discountAmount = (gross * discount) / 100;
    } else {
      discountAmount = discount;
    }
  }

  // Amount after discount
  const afterDiscount = gross - discountAmount;

  // Calculate tax (15% if enabled)
  let taxAmount = 0;
  if (menuConfig.allowTax) {
    taxAmount = (afterDiscount * 15) / 100;
  }

  // Net amount
  const net = afterDiscount + taxAmount;

  return {
    quantity,
    unitPrice,
    gross,
    discountAmount,
    taxAmount,
    net,
  };
};

// Calculate order totals
export const calculateOrderTotals = (lines, menuConfig = {}) => {
  let totalGross = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let totalNet = 0;
  let totalItems = 0;
  let totalQuantity = 0;

  lines.forEach(line => {
    const lineTotals = calculateLineTotal(line, menuConfig);
    totalGross += lineTotals.gross;
    totalDiscount += lineTotals.discountAmount;
    totalTax += lineTotals.taxAmount;
    totalNet += lineTotals.net;
    totalItems++;
    totalQuantity += lineTotals.quantity;
  });

  return {
    totalGross,
    totalDiscount,
    totalTax,
    totalNet,
    totalItems,
    totalQuantity,
  };
};

// Create new order
export const createOrder = async (orderData, userPrefix = 'USR') => {
  try {
    const orders = await loadOrders();
    const orderNumber = await generateOrderNumber(userPrefix);
    const now = new Date();

    const newOrder = {
      id: `order_${Date.now()}`,
      orderNumber,
      orderDate: now.toISOString().split('T')[0],
      orderTime: now.toTimeString().split(' ')[0],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: orderData.status || ORDER_STATUS.DRAFT,

      // Customer info
      customer: orderData.customer || null,
      customerId: orderData.customer?.id || null,
      customerName: orderData.customer?.name || 'Walk-in Customer',

      // Menu config
      menuConfig: orderData.menuConfig || {},
      menuName: orderData.menuConfig?.name || '',

      // Order lines
      lines: orderData.lines || [],

      // Order totals
      totals: calculateOrderTotals(orderData.lines || [], orderData.menuConfig || {}),

      // Payments
      payments: orderData.payments || [],
      totalPaid: 0,

      // Notes
      notes: orderData.notes || '',
    };

    // Calculate total paid
    if (newOrder.payments.length > 0) {
      newOrder.totalPaid = newOrder.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }

    orders.unshift(newOrder); // Add to beginning
    await saveOrders(orders);

    return { success: true, order: newOrder };
  } catch (error) {
    console.error('Create order error:', error);
    return { success: false, error: error.message };
  }
};

// Update order
export const updateOrder = async (orderId, updates) => {
  try {
    const orders = await loadOrders();
    const index = orders.findIndex(o => o.id === orderId);

    if (index === -1) {
      return { success: false, error: 'Order not found' };
    }

    const updatedOrder = {
      ...orders[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate totals if lines changed
    if (updates.lines) {
      updatedOrder.totals = calculateOrderTotals(updates.lines, updatedOrder.menuConfig || {});
    }

    // Recalculate total paid if payments changed
    if (updates.payments) {
      updatedOrder.totalPaid = updates.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }

    orders[index] = updatedOrder;
    await saveOrders(orders);

    return { success: true, order: updatedOrder };
  } catch (error) {
    console.error('Update order error:', error);
    return { success: false, error: error.message };
  }
};

// Confirm order
export const confirmOrder = async (orderId, payments) => {
  try {
    const orders = await loadOrders();
    const index = orders.findIndex(o => o.id === orderId);

    if (index === -1) {
      return { success: false, error: 'Order not found' };
    }

    const order = orders[index];
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    if (totalPaid < order.totals.totalNet) {
      return { success: false, error: 'Insufficient payment amount' };
    }

    orders[index] = {
      ...order,
      status: ORDER_STATUS.CONFIRMED,
      payments,
      totalPaid,
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveOrders(orders);
    return { success: true, order: orders[index] };
  } catch (error) {
    console.error('Confirm order error:', error);
    return { success: false, error: error.message };
  }
};

// Get all orders
export const getOrders = async (filters = {}) => {
  try {
    let orders = await loadOrders();

    // Filter by status
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }

    // Filter by date range
    if (filters.fromDate) {
      orders = orders.filter(o => o.orderDate >= filters.fromDate);
    }
    if (filters.toDate) {
      orders = orders.filter(o => o.orderDate <= filters.toDate);
    }

    // Search by order number or customer name
    if (filters.search) {
      const search = filters.search.toLowerCase();
      orders = orders.filter(o =>
        o.orderNumber.toLowerCase().includes(search) ||
        (o.customerName || '').toLowerCase().includes(search)
      );
    }

    return orders;
  } catch (error) {
    console.error('Get orders error:', error);
    return [];
  }
};

// Get order by ID
export const getOrderById = async (orderId) => {
  try {
    const orders = await loadOrders();
    return orders.find(o => o.id === orderId) || null;
  } catch (error) {
    console.error('Get order by ID error:', error);
    return null;
  }
};

// Get draft orders
export const getDraftOrders = async () => {
  return getOrders({ status: ORDER_STATUS.DRAFT });
};

// Delete order (only drafts)
export const deleteOrder = async (orderId) => {
  try {
    const orders = await loadOrders();
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.status !== ORDER_STATUS.DRAFT) {
      return { success: false, error: 'Only draft orders can be deleted' };
    }

    const filteredOrders = orders.filter(o => o.id !== orderId);
    await saveOrders(filteredOrders);

    return { success: true };
  } catch (error) {
    console.error('Delete order error:', error);
    return { success: false, error: error.message };
  }
};

// Get order statistics
export const getOrderStats = async (dateFrom = null, dateTo = null) => {
  try {
    let orders = await loadOrders();

    if (dateFrom) {
      orders = orders.filter(o => o.orderDate >= dateFrom);
    }
    if (dateTo) {
      orders = orders.filter(o => o.orderDate <= dateTo);
    }

    const confirmedOrders = orders.filter(o => o.status === ORDER_STATUS.CONFIRMED);
    const draftOrders = orders.filter(o => o.status === ORDER_STATUS.DRAFT);

    const totalSales = confirmedOrders.reduce((sum, o) => sum + (o.totals?.totalNet || 0), 0);
    const totalOrders = confirmedOrders.length;

    return {
      totalOrders,
      totalSales,
      draftCount: draftOrders.length,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
    };
  } catch (error) {
    console.error('Get order stats error:', error);
    return { totalOrders: 0, totalSales: 0, draftCount: 0, averageOrderValue: 0 };
  }
};
