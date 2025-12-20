import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import {
  SplashScreen,
  LoginScreen,
  AccountDetailsScreen,
  MenuDetailScreen,
  SyncDataScreen,
  SyncedDataViewScreen,
} from '../screens';
import BottomTabs from './BottomTabs';
import colors from '../theme/colors';

const Stack = createNativeStackNavigator();

// Auth Stack (Login)
const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
};

// Main Stack Navigator (replaces Drawer)
const MainStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabs} />
      <Stack.Screen name="AccountDetails" component={AccountDetailsScreen} />
      <Stack.Screen name="MenuDetail" component={MenuDetailScreen} />
      <Stack.Screen name="SyncData" component={SyncDataScreen} />
      <Stack.Screen name="SyncedDataView" component={SyncedDataViewScreen} />
    </Stack.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash for minimum 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Show splash screen initially
  if (showSplash || isLoading) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer>
      {isLoggedIn ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
