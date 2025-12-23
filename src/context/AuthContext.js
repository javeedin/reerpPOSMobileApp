import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginUser, getMenuOptions, saveUserData, getUserData, saveMenuData, getMenuData, clearAllData } from '../services/api';
import { clearAllSyncData, getSyncMetadata, syncCustomers, syncOnhand, syncBogo, syncPaymentMethods } from '../services/syncService';
import { clearAllOrders } from '../services/orderService';
import { clearAdjustments } from '../services/onhandService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [menuData, setMenuDataState] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  // Check for existing session on app load
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const userData = await getUserData();
      const savedMenuData = await getMenuData();

      if (userData) {
        setUser(userData);
        setIsLoggedIn(true);
        if (savedMenuData) {
          setMenuDataState(savedMenuData);
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username, password, instance) => {
    console.log('=== AUTH CONTEXT LOGIN ===');
    console.log('Attempting login for:', username);
    setIsLoading(true);
    try {
      // Call login API
      const loginResponse = await loginUser(username, password);

      console.log('=== LOGIN RESPONSE IN CONTEXT ===');
      console.log('Success:', loginResponse.success);
      console.log('Raw Data:', JSON.stringify(loginResponse.data, null, 2));
      console.log('Has items?:', !!loginResponse.data?.items);
      console.log('Items length:', loginResponse.data?.items?.length);

      if (loginResponse.success && loginResponse.data) {
        // API returns { items: [...], hasMore: false, ... }
        // User data is in items[0]
        let userData = null;

        // Check all possible formats
        if (loginResponse.data.items && Array.isArray(loginResponse.data.items) && loginResponse.data.items.length > 0) {
          // Oracle ORDS format: { items: [{...}] }
          console.log('Found items array format');
          userData = loginResponse.data.items[0];
        } else if (Array.isArray(loginResponse.data) && loginResponse.data.length > 0) {
          // Direct array format: [{...}]
          console.log('Found direct array format');
          userData = loginResponse.data[0];
        } else if (typeof loginResponse.data === 'object' && (loginResponse.data.username || loginResponse.data.user_name)) {
          // Direct object format: {...}
          console.log('Found direct object format');
          userData = loginResponse.data;
        }

        console.log('=== PARSED USER DATA ===');
        console.log('UserData:', JSON.stringify(userData, null, 2));

        if (userData && (userData.username || userData.user_name || userData.USERNAME)) {
          console.log('=== LOGIN SUCCESS - Fetching menu ===');
          // Login successful, now fetch menu options
          const menuResponse = await getMenuOptions(username);

          const fullUserData = {
            ...userData,
            username: userData.username || userData.user_name || username,
            instance: instance,
            loginTime: new Date().toISOString(),
          };

          await saveUserData(fullUserData);
          setUser(fullUserData);
          setIsLoggedIn(true);

          if (menuResponse.success && menuResponse.data) {
            await saveMenuData(menuResponse.data);
            setMenuDataState(menuResponse.data);
          }

          setIsLoading(false);

          // Check and sync data after login (runs in background)
          checkAndSyncData(fullUserData);

          return { success: true };
        } else {
          console.log('=== LOGIN FAILED - No username in response ===');
          setIsLoading(false);
          return { success: false, error: 'Invalid credentials' };
        }
      } else {
        console.log('=== LOGIN FAILED - API error ===');
        console.log('Error:', loginResponse.error);
        setIsLoading(false);
        return { success: false, error: loginResponse.error || 'Login failed' };
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Clear user and menu data
      await clearAllData();
      // Clear all synced data (customers, items, onhand, pricelists, bogo)
      await clearAllSyncData();
      // Clear all orders
      await clearAllOrders();
      // Clear inventory adjustments
      await clearAdjustments();

      setUser(null);
      setMenuDataState([]);
      setIsLoggedIn(false);
      setSyncProgress('');
      console.log('Logout: All data cleared');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMenuData = async () => {
    if (user?.username) {
      const menuResponse = await getMenuOptions(user.username);
      if (menuResponse.success && menuResponse.data) {
        await saveMenuData(menuResponse.data);
        setMenuDataState(menuResponse.data);
      }
    }
  };

  // Check if initial data sync is needed and perform sync
  const checkAndSyncData = async (userData) => {
    try {
      const meta = await getSyncMetadata();
      const needsSync = {
        customers: !meta.customers?.lastSync || meta.customers.count === 0,
        onhand: !meta.onhand?.lastSync || meta.onhand.count === 0,
        bogo: !meta.bogo?.lastSync,
        paymentMethods: !meta.paymentMethods?.lastSync || meta.paymentMethods.count === 0,
      };

      const syncNeeded = needsSync.customers || needsSync.onhand || needsSync.bogo || needsSync.paymentMethods;

      if (syncNeeded) {
        setIsSyncing(true);

        // Sync customers
        if (needsSync.customers) {
          setSyncProgress('Syncing customers...');
          await syncCustomers((progress) => {
            if (progress?.status) setSyncProgress(progress.status);
          });
        }

        // Sync onhand (use user's warehouse/subinventory if available)
        if (needsSync.onhand) {
          setSyncProgress('Syncing inventory...');
          const warehouse = userData?.warehouse || 'GLC_MAIN';
          const subinventory = userData?.subinventory || 'MAIN_STORES';
          await syncOnhand(
            (progress) => {
              if (progress?.status) setSyncProgress(progress.status);
            },
            warehouse,
            subinventory
          );
        }

        // Sync BOGO promotions
        if (needsSync.bogo) {
          setSyncProgress('Syncing promotions...');
          await syncBogo((progress) => {
            if (progress?.status) setSyncProgress(progress.status);
          });
        }

        // Sync payment methods
        if (needsSync.paymentMethods) {
          setSyncProgress('Syncing payment methods...');
          await syncPaymentMethods((progress) => {
            if (progress?.status) setSyncProgress(progress.status);
          });
        }

        setSyncProgress('Sync complete!');
        setIsSyncing(false);
      }
    } catch (error) {
      console.error('Auto-sync error:', error);
      setIsSyncing(false);
      setSyncProgress('');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        menuData,
        isLoading,
        isLoggedIn,
        isSyncing,
        syncProgress,
        login,
        logout,
        refreshMenuData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
