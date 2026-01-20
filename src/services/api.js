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
  const url = `${BASE_URL}/LOGIN/user/?username=${username}&password=${password}`;
  console.log('=== LOGIN API CALL ===');
  console.log('URL:', url);
  console.log('Username:', username);
  console.log('Password:', password);

  try {
    const response = await api.get(`/LOGIN/user/`, {
      params: {
        username: username,
        password: password,
      },
    });
    console.log('=== LOGIN RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('=== LOGIN ERROR ===');
    console.log('Error:', error.message);
    console.log('Response:', error.response?.data);
    console.log('Status:', error.response?.status);
    return {
      success: false,
      error: error.response?.data?.message || 'Login failed. Please check your credentials.',
    };
  }
};

// Get Menu Options for the logged-in user
export const getMenuOptions = async (username) => {
  const url = `${BASE_URL}/APPMENU/MENU/${username}`;
  console.log('=== MENU API CALL ===');
  console.log('URL:', url);

  try {
    const response = await api.get(`/APPMENU/MENU/${username}`);
    console.log('=== MENU RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('=== MENU ERROR ===');
    console.log('Error:', error.message);
    console.log('Response:', error.response?.data);
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
