import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const loadingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(slideUpAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Loading bar animation (separate, uses scaleX)
    Animated.timing(loadingAnim, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: true,
    }).start();

    // Navigate after splash
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary, colors.primaryDark]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated Logo Container */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Outer Ring */}
          <View style={styles.outerRing}>
            {/* Inner Logo Circle */}
            <View style={styles.logoCircle}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="cart" size={60} color={colors.accent} />
              </Animated.View>
            </View>
          </View>

          {/* Decorative Elements */}
          <View style={styles.decorativeRing1} />
          <View style={styles.decorativeRing2} />
        </Animated.View>

        {/* App Name */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <Text style={styles.appName}>ReERP</Text>
          <Text style={styles.appSubName}>POS</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Point of Sale System</Text>
        </Animated.View>

        {/* Loading indicator */}
        <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
          <View style={styles.loadingBar}>
            <Animated.View
              style={[
                styles.loadingProgress,
                {
                  transform: [
                    {
                      translateX: loadingAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-200, 0],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
          <Text style={styles.loadingText}>Loading...</Text>
        </Animated.View>

        {/* Footer */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <Text style={styles.footerText}>Powered by Oracle Fusion</Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  outerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  decorativeRing1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.2)',
  },
  decorativeRing2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.1)',
  },
  textContainer: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  appSubName: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.accent,
    letterSpacing: 8,
    marginTop: -5,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: colors.accent,
    marginVertical: 15,
    borderRadius: 2,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
  },
  loadingBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 200,
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 10,
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  versionText: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 5,
    opacity: 0.7,
  },
});

export default SplashScreen;
