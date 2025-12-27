import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#0A1628" />
        <AppNavigator />
      </AuthProvider>
    </View>
  );
}
