import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BleManager } from 'react-native-ble-plx';

const PRINTER_STORAGE_KEY = '@fcpos_printer_settings';

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const PrinterSettingsScreen = () => {
  const navigation = useNavigation();
  const bleManagerRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [savedPrinter, setSavedPrinter] = useState(null);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [bluetoothState, setBluetoothState] = useState('Unknown');

  useEffect(() => {
    // Initialize BLE Manager
    bleManagerRef.current = new BleManager();

    // Monitor Bluetooth state
    const subscription = bleManagerRef.current.onStateChange((state) => {
      setBluetoothState(state);
    }, true);

    // Load saved printer
    loadSavedPrinter();

    return () => {
      subscription.remove();
      if (bleManagerRef.current) {
        bleManagerRef.current.destroy();
      }
    };
  }, []);

  const loadSavedPrinter = async () => {
    try {
      const savedData = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
      if (savedData) {
        const printer = JSON.parse(savedData);
        setSavedPrinter(printer);
      }
    } catch (error) {
      console.error('Error loading saved printer:', error);
    }
  };

  const savePrinter = async (device) => {
    try {
      const printerData = {
        id: device.id,
        name: device.name || 'Unknown Printer',
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(printerData));
      setSavedPrinter(printerData);
      Alert.alert('Success', `Printer "${printerData.name}" saved as default`);
    } catch (error) {
      console.error('Error saving printer:', error);
      Alert.alert('Error', 'Failed to save printer settings');
    }
  };

  const removeSavedPrinter = async () => {
    try {
      await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
      setSavedPrinter(null);
      Alert.alert('Success', 'Saved printer removed');
    } catch (error) {
      console.error('Error removing printer:', error);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;

        if (apiLevel >= 31) {
          // Android 12+
          const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          const allGranted = Object.values(results).every(
            result => result === PermissionsAndroid.RESULTS.GRANTED
          );

          return allGranted;
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (error) {
        console.error('Permission error:', error);
        return false;
      }
    }
    return true;
  };

  const startScan = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Bluetooth permissions are required to scan for printers');
      return;
    }

    if (bluetoothState !== 'PoweredOn') {
      Alert.alert('Bluetooth Required', 'Please enable Bluetooth to scan for printers');
      return;
    }

    setIsScanning(true);
    setDevices([]);

    try {
      bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          setIsScanning(false);
          return;
        }

        if (device && device.name) {
          // Filter for likely printer devices
          const name = device.name.toLowerCase();
          const isPrinter = name.includes('printer') ||
                          name.includes('print') ||
                          name.includes('pos') ||
                          name.includes('thermal') ||
                          name.includes('epson') ||
                          name.includes('zebra') ||
                          name.includes('brother') ||
                          name.includes('star') ||
                          name.includes('bixolon') ||
                          name.includes('xp-') ||
                          name.includes('pt-') ||
                          name.includes('mpt') ||
                          name.includes('bt-') ||
                          name.includes('spp') ||
                          !name.includes('phone') && !name.includes('watch') && !name.includes('band');

          if (isPrinter || true) { // Show all named devices for now
            setDevices(prevDevices => {
              const exists = prevDevices.find(d => d.id === device.id);
              if (!exists) {
                return [...prevDevices, device];
              }
              return prevDevices;
            });
          }
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        stopScan();
      }, 10000);
    } catch (error) {
      console.error('Start scan error:', error);
      setIsScanning(false);
      Alert.alert('Error', 'Failed to start scanning');
    }
  };

  const stopScan = () => {
    if (bleManagerRef.current) {
      bleManagerRef.current.stopDeviceScan();
    }
    setIsScanning(false);
  };

  const connectToDevice = async (device) => {
    setIsConnecting(true);
    stopScan();

    try {
      const connected = await bleManagerRef.current.connectToDevice(device.id);
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      Alert.alert('Connected', `Connected to ${device.name || 'printer'}`);
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Connection Failed', 'Could not connect to the printer. Make sure it is turned on and in pairing mode.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
        setConnectedDevice(null);
        Alert.alert('Disconnected', 'Printer disconnected');
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
  };

  const printTestLabel = async () => {
    if (!connectedDevice) {
      Alert.alert('Not Connected', 'Please connect to a printer first');
      return;
    }

    setIsPrinting(true);

    try {
      // Discover services and characteristics
      const services = await connectedDevice.services();
      let writeCharacteristic = null;

      for (const service of services) {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            writeCharacteristic = char;
            break;
          }
        }
        if (writeCharacteristic) break;
      }

      if (!writeCharacteristic) {
        Alert.alert('Error', 'Could not find writable characteristic on printer');
        return;
      }

      // Create test label data
      const testLabelCommands = createTestLabelCommands();

      // Convert to base64 and send
      const base64Data = Buffer.from(testLabelCommands).toString('base64');
      await writeCharacteristic.writeWithResponse(base64Data);

      Alert.alert('Success', 'Test label printed!');
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', 'Failed to print test label. Please check the printer connection.');
    } finally {
      setIsPrinting(false);
    }
  };

  const createTestLabelCommands = () => {
    // ESC/POS commands for test label
    const commands = [];

    // Initialize printer
    commands.push(ESC, 0x40);

    // Center alignment
    commands.push(ESC, 0x61, 0x01);

    // Bold on
    commands.push(ESC, 0x45, 0x01);

    // Add text
    const text1 = 'FCPos Test Print\n';
    for (let i = 0; i < text1.length; i++) {
      commands.push(text1.charCodeAt(i));
    }

    // Bold off
    commands.push(ESC, 0x45, 0x00);

    // Add separator line
    const line = '------------------------\n';
    for (let i = 0; i < line.length; i++) {
      commands.push(line.charCodeAt(i));
    }

    // Add date/time
    const dateText = `Date: ${new Date().toLocaleString()}\n`;
    for (let i = 0; i < dateText.length; i++) {
      commands.push(dateText.charCodeAt(i));
    }

    // Add QR code (model 2, size 6)
    commands.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00); // QR model
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06); // QR size

    const qrData = 'FCPOS-TEST-OK';
    const qrLen = qrData.length + 3;
    commands.push(GS, 0x28, 0x6B, qrLen & 0xFF, (qrLen >> 8) & 0xFF, 0x31, 0x50, 0x30);
    for (let i = 0; i < qrData.length; i++) {
      commands.push(qrData.charCodeAt(i));
    }
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30); // Print QR

    // Line feeds
    commands.push(LF, LF, LF);

    // Cut paper (partial)
    commands.push(GS, 0x56, 0x01);

    return new Uint8Array(commands);
  };

  const renderDeviceItem = ({ item }) => {
    const isConnected = connectedDevice?.id === item.id;
    const isSaved = savedPrinter?.id === item.id;

    return (
      <View style={styles.deviceItem}>
        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            <Ionicons
              name={isConnected ? "bluetooth-outline" : "print-outline"}
              size={24}
              color={isConnected ? "#4CAF50" : "#2196F3"}
            />
            <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
            {isSaved && (
              <View style={styles.savedBadge}>
                <Text style={styles.savedBadgeText}>Saved</Text>
              </View>
            )}
          </View>
          <Text style={styles.deviceId}>ID: {item.id}</Text>
        </View>
        <View style={styles.deviceActions}>
          {isConnected ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.disconnectButton]}
                onPress={disconnectDevice}
              >
                <Text style={styles.actionButtonText}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={() => savePrinter(item)}
              >
                <Ionicons name="save-outline" size={16} color="#FFF" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.connectButton]}
              onPress={() => connectToDevice(item)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.actionButtonText}>Connect</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Printer Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Bluetooth Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Ionicons
              name="bluetooth"
              size={24}
              color={bluetoothState === 'PoweredOn' ? '#4CAF50' : '#FF5252'}
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Bluetooth Status</Text>
              <Text style={[
                styles.statusValue,
                { color: bluetoothState === 'PoweredOn' ? '#4CAF50' : '#FF5252' }
              ]}>
                {bluetoothState === 'PoweredOn' ? 'Enabled' : bluetoothState}
              </Text>
            </View>
          </View>
        </View>

        {/* Saved Printer Card */}
        {savedPrinter && (
          <View style={styles.savedPrinterCard}>
            <View style={styles.savedPrinterHeader}>
              <Ionicons name="print" size={24} color="#1565C0" />
              <Text style={styles.savedPrinterTitle}>Default Printer</Text>
            </View>
            <View style={styles.savedPrinterInfo}>
              <Text style={styles.savedPrinterName}>{savedPrinter.name}</Text>
              <Text style={styles.savedPrinterId}>ID: {savedPrinter.id}</Text>
              <Text style={styles.savedPrinterDate}>
                Saved: {new Date(savedPrinter.savedAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.savedPrinterActions}>
              <TouchableOpacity
                style={styles.removePrinterButton}
                onPress={removeSavedPrinter}
              >
                <Ionicons name="trash-outline" size={18} color="#FF5252" />
                <Text style={styles.removePrinterText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Scan Section */}
        <View style={styles.scanSection}>
          <Text style={styles.sectionTitle}>Find Printers</Text>
          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanButtonActive]}
            onPress={isScanning ? stopScan : startScan}
          >
            {isScanning ? (
              <>
                <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.scanButtonText}>Scanning... (Tap to Stop)</Text>
              </>
            ) : (
              <>
                <Ionicons name="search" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.scanButtonText}>Scan for Printers</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Devices List */}
        {devices.length > 0 && (
          <View style={styles.devicesSection}>
            <Text style={styles.sectionTitle}>Available Devices ({devices.length})</Text>
            {devices.map((device, index) => (
              <View key={device.id || index}>
                {renderDeviceItem({ item: device })}
              </View>
            ))}
          </View>
        )}

        {/* Test Print Section */}
        {connectedDevice && (
          <View style={styles.testSection}>
            <Text style={styles.sectionTitle}>Test Printer</Text>
            <TouchableOpacity
              style={styles.testButton}
              onPress={printTestLabel}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="print-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.testButtonText}>Print Test Label</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to Connect</Text>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Turn on your Bluetooth thermal printer</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Enable Bluetooth on your phone</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Tap "Scan for Printers" to find nearby devices</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>Select your printer and tap "Connect"</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>5</Text>
            <Text style={styles.stepText}>Tap the save icon to set as default printer</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusInfo: {
    marginLeft: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  savedPrinterCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  savedPrinterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  savedPrinterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
    marginLeft: 8,
  },
  savedPrinterInfo: {
    marginBottom: 12,
  },
  savedPrinterName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  savedPrinterId: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  savedPrinterDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  savedPrinterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  removePrinterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  removePrinterText: {
    color: '#FF5252',
    marginLeft: 4,
    fontSize: 14,
  },
  scanSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
  },
  scanButtonActive: {
    backgroundColor: '#FF9800',
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  devicesSection: {
    marginBottom: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  deviceId: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    marginLeft: 34,
  },
  savedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  savedBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#2196F3',
  },
  disconnectButton: {
    backgroundColor: '#FF5252',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    minWidth: 40,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  testSection: {
    marginBottom: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});

export default PrinterSettingsScreen;
