import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { SplashScreen, LoginScreen, AccountDetailsScreen, MenuDetailScreen } from '../screens';
import BottomTabs from './BottomTabs';
import DrawerContent from './DrawerContent';
import colors from '../theme/colors';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Main Drawer Navigator (with hamburger menu)
const MainDrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: colors.background,
          width: 300,
        },
        drawerType: 'front',
        overlayColor: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <Drawer.Screen name="MainTabs" component={BottomTabs} />
      <Drawer.Screen name="AccountDetails" component={AccountDetailsScreen} />
      <Drawer.Screen name="MenuDetail" component={MenuDetailScreen} />
    </Drawer.Navigator>
  );
};

// Auth Stack (Login)
const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
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
      {isLoggedIn ? <MainDrawerNavigator /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
