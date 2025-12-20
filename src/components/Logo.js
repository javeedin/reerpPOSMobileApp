import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const Logo = ({ size = 'medium', showText = true }) => {
  const sizes = {
    small: { container: 60, icon: 30, text: 18, subText: 12 },
    medium: { container: 100, icon: 50, text: 32, subText: 20 },
    large: { container: 140, icon: 70, text: 44, subText: 28 },
  };

  const currentSize = sizes[size] || sizes.medium;

  return (
    <View style={styles.container}>
      <View style={[styles.logoContainer, { width: currentSize.container, height: currentSize.container, borderRadius: currentSize.container / 2 }]}>
        <View style={[styles.innerCircle, { width: currentSize.container - 20, height: currentSize.container - 20, borderRadius: (currentSize.container - 20) / 2 }]}>
          <Ionicons name="cart" size={currentSize.icon} color={colors.accent} />
        </View>
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.logoText, { fontSize: currentSize.text }]}>ReERP</Text>
          <Text style={[styles.logoSubText, { fontSize: currentSize.subText }]}>POS</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logoContainer: {
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  innerCircle: {
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  logoText: {
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 3,
  },
  logoSubText: {
    fontWeight: '300',
    color: colors.accent,
    letterSpacing: 6,
    marginTop: -4,
  },
});

export default Logo;
