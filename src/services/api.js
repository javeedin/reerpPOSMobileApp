import axios from 'axios';

const BASE_URL = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Login API
export const loginUser = async (username, password) => {
  try {
    const response = await api.get(`/LOGIN/user/`, {
      params: {
        username: username,
        password: password,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Login Error:', error);
    throw error;
  }
};

// Get Menu Items API
export const getMenuItems = async (username) => {
  try {
    const response = await api.get(`/APPMENU/MENU/${username}`);
    return response.data;
  } catch (error) {
    console.error('Menu Fetch Error:', error);
    throw error;
  }
};

// Get KPIs API (placeholder - update with actual endpoint)
export const getKPIs = async (username) => {
  try {
    // This can be updated with actual KPI endpoint
    return {
      todaySales: '12,450',
      ordersCount: 45,
      pendingOrders: 8,
      totalCustomers: 156,
    };
  } catch (error) {
    console.error('KPI Fetch Error:', error);
    throw error;
  }
};

export default api;
