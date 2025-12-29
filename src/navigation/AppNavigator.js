import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
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
  CustomerSelectionScreen,
  ItemSelectionScreen,
  CheckoutScreen,
  PaymentScreen,
  OrderDetailScreen,
  LodgementReportScreen,
  ScanScreen,
  ScanTemplateScreen,
  BatchReconciliationScreen,
  StoryScreen,
  SignatureScreen,
  CreditCheckScreen,
  HistoryOrdersScreen,
  StoreRequestsScreen,
  // CRM screens
  CRMHomeScreen,
  CustomerDetailScreen,
  CustomerSearchScreen,
  CustomerListScreen,
  // Trip Management screens
  TripQueryScreen,
  TripHomeScreen,
  TripDetailsScreen,
  OrderVerificationScreen,
  TripOrderDetailScreen,
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
      {/* Order flow screens */}
      <Stack.Screen name="CustomerSelection" component={CustomerSelectionScreen} />
      <Stack.Screen name="ItemSelection" component={ItemSelectionScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      {/* Report screens */}
      <Stack.Screen name="LodgementReport" component={LodgementReportScreen} />
      {/* Scan & Reconciliation screens */}
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="ScanTemplate" component={ScanTemplateScreen} />
      <Stack.Screen name="BatchReconciliation" component={BatchReconciliationScreen} />
      {/* Story screen */}
      <Stack.Screen name="Story" component={StoryScreen} />
      {/* Signature screen */}
      <Stack.Screen name="Signature" component={SignatureScreen} />
      {/* Credit check screen */}
      <Stack.Screen name="CreditCheck" component={CreditCheckScreen} />
      {/* History orders screen */}
      <Stack.Screen name="HistoryOrders" component={HistoryOrdersScreen} />
      {/* Store requests screen */}
      <Stack.Screen name="StoreRequests" component={StoreRequestsScreen} />
      {/* CRM screens */}
      <Stack.Screen name="CRMHome" component={CRMHomeScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <Stack.Screen name="CustomerSearch" component={CustomerSearchScreen} />
      <Stack.Screen name="CustomerList" component={CustomerListScreen} />
      {/* Trip Management screens */}
      <Stack.Screen name="TripQuery" component={TripQueryScreen} />
      <Stack.Screen name="TripHome" component={TripHomeScreen} />
      <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
      <Stack.Screen name="OrderVerification" component={OrderVerificationScreen} />
      <Stack.Screen name="TripOrderDetail" component={TripOrderDetailScreen} />
    </Stack.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const { isLoggedIn, isLoading } = useAuth();
  // Skip splash on web for faster loading
  const [showSplash, setShowSplash] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') return; // Skip splash on web

    // Show splash for minimum 2.5 seconds on native
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Show splash screen initially (native only)
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
