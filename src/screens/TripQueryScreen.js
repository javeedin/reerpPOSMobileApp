import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchTrips, getCachedTrips } from '../services/tripService';

// Conditionally import DateTimePicker for native platforms only
let DateTimePicker = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

// Dark green theme colors
const THEME = {
  primary: '#1B5E20',
  primaryLight: '#2E7D32',
  primaryDark: '#0D3311',
  accent: '#4CAF50',
  accentLight: '#81C784',
  background: '#E8F5E9',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
};

// Web Date Picker Modal
const WebDatePickerModal = ({ visible, onClose, onSelect, currentDate, title }) => {
  const [selectedDate, setSelectedDate] = useState(
    currentDate ? currentDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (currentDate) {
      setSelectedDate(currentDate.toISOString().split('T')[0]);
    }
  }, [currentDate]);

  const handleConfirm = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    onSelect(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={webPickerStyles.overlay}>
        <View style={webPickerStyles.container}>
          <Text style={webPickerStyles.title}>{title}</Text>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #ccc',
              marginBottom: 20,
            }}
          />
          <View style={webPickerStyles.buttonRow}>
            <TouchableOpacity style={webPickerStyles.cancelButton} onPress={onClose}>
              <Text style={webPickerStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[webPickerStyles.confirmButton, { backgroundColor: THEME.primary }]} onPress={handleConfirm}>
              <Text style={webPickerStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const webPickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

const TripQueryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingCache, setCheckingCache] = useState(true);

  // Check if we have cached data on mount
  useEffect(() => {
    checkCachedData();
  }, []);

  const checkCachedData = async () => {
    try {
      const cached = await getCachedTrips();
      if (cached && cached.data && cached.data.trips && cached.data.trips.length > 0) {
        // Check if cache is recent (less than 1 hour old)
        const cacheAge = Date.now() - cached.timestamp;
        if (cacheAge < 3600000) {
          // Navigate directly to Trip Home if we have recent data
          navigation.replace('TripHome', { tripData: cached.data });
          return;
        }
      }
    } catch (error) {
      console.error('[TripQuery] Error checking cache:', error);
    } finally {
      setCheckingCache(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleFromDateChange = (event, selectedDate) => {
    setShowFromPicker(false);
    if (selectedDate) {
      setFromDate(selectedDate);
      // If from date is after to date, update to date
      if (selectedDate > toDate) {
        setToDate(selectedDate);
      }
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    setShowToPicker(false);
    if (selectedDate) {
      setToDate(selectedDate);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await fetchTrips(fromDate, toDate);

      if (result.success) {
        if (result.data && result.data.trips && result.data.trips.length > 0) {
          navigation.replace('TripHome', { tripData: result.data });
        } else {
          Alert.alert(
            'No Trips Found',
            'No trips found for the selected date range. Please try different dates.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Error',
          result.error || 'Failed to fetch trips. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const setQuickDate = (days) => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - days);
    setFromDate(from);
    setToDate(today);
  };

  if (checkingCache) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />
        <LinearGradient
          colors={[THEME.primary, THEME.primaryLight]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />

      {/* Header */}
      <LinearGradient
        colors={[THEME.primary, THEME.primaryLight, THEME.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIconContainer}>
            <MaterialCommunityIcons name="truck-delivery" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>Trip Management</Text>
          <Text style={styles.headerSubtitle}>Fleet & Delivery Operations</Text>
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={24} color={THEME.primary} />
            <Text style={styles.cardTitle}>Select Date Range</Text>
          </View>

          {/* From Date */}
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowFromPicker(true)}
          >
            <View style={styles.dateInputLeft}>
              <Text style={styles.dateLabel}>From Date</Text>
              <Text style={styles.dateValue}>{formatDate(fromDate)}</Text>
            </View>
            <Ionicons name="calendar" size={24} color={THEME.primary} />
          </TouchableOpacity>

          {/* To Date */}
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowToPicker(true)}
          >
            <View style={styles.dateInputLeft}>
              <Text style={styles.dateLabel}>To Date</Text>
              <Text style={styles.dateValue}>{formatDate(toDate)}</Text>
            </View>
            <Ionicons name="calendar" size={24} color={THEME.primary} />
          </TouchableOpacity>

          {/* Quick Date Selection */}
          <View style={styles.quickDates}>
            <Text style={styles.quickDatesLabel}>Quick Select:</Text>
            <View style={styles.quickDateButtons}>
              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => setQuickDate(0)}
              >
                <Text style={styles.quickDateText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => setQuickDate(7)}
              >
                <Text style={styles.quickDateText}>Last 7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => setQuickDate(30)}
              >
                <Text style={styles.quickDateText}>Last 30 Days</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={loading}
          >
            <LinearGradient
              colors={[THEME.primary, THEME.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.searchButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#FFFFFF" />
                  <Text style={styles.searchButtonText}>Search Trips</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={24} color={THEME.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Trip Management Features</Text>
            <Text style={styles.infoText}>• View and manage delivery trips</Text>
            <Text style={styles.infoText}>• Verify order items before delivery</Text>
            <Text style={styles.infoText}>• Track lorry capacity utilization</Text>
            <Text style={styles.infoText}>• Confirm order deliveries</Text>
          </View>
        </View>
      </View>

      {/* Native Date Pickers */}
      {Platform.OS !== 'web' && showFromPicker && DateTimePicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFromDateChange}
          maximumDate={new Date()}
        />
      )}

      {Platform.OS !== 'web' && showToPicker && DateTimePicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleToDateChange}
          minimumDate={fromDate}
          maximumDate={new Date()}
        />
      )}

      {/* Web Date Pickers */}
      {Platform.OS === 'web' && (
        <>
          <WebDatePickerModal
            visible={showFromPicker}
            onClose={() => setShowFromPicker(false)}
            onSelect={(date) => {
              setFromDate(date);
              if (date > toDate) setToDate(date);
            }}
            currentDate={fromDate}
            title="Select From Date"
          />
          <WebDatePickerModal
            visible={showToPicker}
            onClose={() => setShowToPicker(false)}
            onSelect={setToDate}
            currentDate={toDate}
            title="Select To Date"
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: -20,
  },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text,
    marginLeft: 10,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateInputLeft: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: THEME.textLight,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
  },
  quickDates: {
    marginTop: 16,
    marginBottom: 20,
  },
  quickDatesLabel: {
    fontSize: 12,
    color: THEME.textLight,
    marginBottom: 10,
  },
  quickDateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: THEME.background,
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.accentLight,
  },
  quickDateText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.primary,
  },
  searchButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: THEME.primary,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: THEME.textLight,
    marginBottom: 4,
  },
});

export default TripQueryScreen;
