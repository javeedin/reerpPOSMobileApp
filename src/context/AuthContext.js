import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginUser, getMenuOptions, saveUserData, getUserData, saveMenuData, getMenuData, clearAllData } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [menuData, setMenuDataState] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

      if (loginResponse.success && loginResponse.data) {
        // API returns { items: [...], hasMore: false, ... }
        // User data is in items[0]
        let userData = null;

        if (loginResponse.data.items && loginResponse.data.items.length > 0) {
          // Oracle ORDS format: { items: [{...}] }
          userData = loginResponse.data.items[0];
        } else if (Array.isArray(loginResponse.data) && loginResponse.data.length > 0) {
          // Direct array format: [{...}]
          userData = loginResponse.data[0];
        } else if (loginResponse.data.username || loginResponse.data.user_name) {
          // Direct object format: {...}
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
      await clearAllData();
      setUser(null);
      setMenuDataState([]);
      setIsLoggedIn(false);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        menuData,
        isLoading,
        isLoggedIn,
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
