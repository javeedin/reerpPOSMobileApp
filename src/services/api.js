import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Login API - Validate user credentials
export const loginUser = async (username, password) => {
  try {
    const response = await api.get(`/LOGIN/user/`, {
      params: {
        username: username,
        password: password,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error.response?.data?.message || 'Login failed. Please check your credentials.',
    };
  }
};

// Get Menu Options for the logged-in user
export const getMenuOptions = async (username) => {
  try {
    const response = await api.get(`/APPMENU/MENU/${username}`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Menu fetch error:', error);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch menu options.',
    };
  }
};

// Storage helpers
export const saveUserData = async (userData) => {
  try {
    await AsyncStorage.setItem('userData', JSON.stringify(userData));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

export const getUserData = async () => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const saveMenuData = async (menuData) => {
  try {
    await AsyncStorage.setItem('menuData', JSON.stringify(menuData));
  } catch (error) {
    console.error('Error saving menu data:', error);
  }
};

export const getMenuData = async () => {
  try {
    const menuData = await AsyncStorage.getItem('menuData');
    return menuData ? JSON.parse(menuData) : null;
  } catch (error) {
    console.error('Error getting menu data:', error);
    return null;
  }
};

export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove(['userData', 'menuData']);
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

export default api;
