import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CRMBottomNav = ({ navigation, activeTab = 'home' }) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {/* Curved Background */}
      <View style={styles.navBackground}>
        {/* Left Curve */}
        <View style={styles.navLeft} />
        {/* Center Curve Cutout */}
        <View style={styles.navCenterCutout}>
          <View style={styles.curveLeft} />
          <View style={styles.curveCenter} />
          <View style={styles.curveRight} />
        </View>
        {/* Right Curve */}
        <View style={styles.navRight} />
      </View>

      {/* Navigation Items */}
      <View style={styles.navContent}>
        {/* Home */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('CRMHome')}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={24}
            color={activeTab === 'home' ? '#0D47A1' : '#666666'}
          />
          <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>
            Home
          </Text>
          {activeTab === 'home' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        {/* Search */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('CustomerSearch')}
        >
          <Ionicons
            name={activeTab === 'search' ? 'person' : 'person-outline'}
            size={24}
            color={activeTab === 'search' ? '#0D47A1' : '#666666'}
          />
          <Text style={[styles.navLabel, activeTab === 'search' && styles.navLabelActive]}>
            My Profile
          </Text>
        </TouchableOpacity>

        {/* Center Spacer for Floating Button */}
        <View style={styles.centerSpacer} />

        {/* Offers */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {}}
        >
          <Ionicons
            name={activeTab === 'offers' ? 'pricetag' : 'pricetag-outline'}
            size={24}
            color={activeTab === 'offers' ? '#0D47A1' : '#666666'}
          />
          <Text style={[styles.navLabel, activeTab === 'offers' && styles.navLabelActive]}>
            Offers
          </Text>
        </TouchableOpacity>

        {/* More */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={activeTab === 'more' ? '#0D47A1' : '#666666'}
          />
          <Text style={[styles.navLabel, activeTab === 'more' && styles.navLabelActive]}>
            More
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floating Center Button - My Customers */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => navigation.navigate('CustomerList')}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#0D47A1', '#1565C3']}
          style={styles.floatingButtonGradient}
        >
          <Ionicons name="people" size={22} color="#FFFFFF" />
          <Text style={styles.floatingButtonText}>My</Text>
          <Text style={styles.floatingButtonText}>Customers</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  navBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  navLeft: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
  },
  navCenterCutout: {
    width: 90,
    height: 65,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  curveLeft: {
    width: 25,
    height: 65,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 50,
  },
  curveCenter: {
    width: 40,
    height: 30,
    backgroundColor: 'transparent',
  },
  curveRight: {
    width: 25,
    height: 65,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 50,
  },
  navRight: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 0,
  },
  navContent: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 5,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  centerSpacer: {
    width: 90,
  },
  navLabel: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0D47A1',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -5,
    width: 30,
    height: 3,
    backgroundColor: '#0D47A1',
    borderRadius: 2,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 25,
    alignSelf: 'center',
    elevation: 12,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  floatingButtonGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  floatingButtonText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 10,
  },
});

export default CRMBottomNav;
