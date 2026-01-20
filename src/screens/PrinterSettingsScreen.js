import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import printerService from '../services/printerService';

const PrinterSettingsScreen = () => {
  const navigation = useNavigation();

  const [savedPrinter, setSavedPrinter] = useState(null);
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('9100');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    loadSavedPrinter();
  }, []);

  const loadSavedPrinter = async () => {
    const printer = await printerService.getSavedPrinter();
    if (printer) {
      setSavedPrinter(printer);
      setIpAddress(printer.ipAddress || '');
      setPort(printer.port?.toString() || '9100');
    }
  };

  const handleSavePrinter = async () => {
    if (!ipAddress.trim()) {
      Alert.alert('Error', 'Please enter an IP address');
      return;
    }

    if (!printerService.isValidIPAddress(ipAddress.trim())) {
      Alert.alert('Invalid IP', 'Please enter a valid IP address (e.g., 192.168.1.100)');
      return;
    }

    const portNum = parseInt(port, 10) || 9100;
    if (portNum < 1 || portNum > 65535) {
      Alert.alert('Invalid Port', 'Port must be between 1 and 65535');
      return;
    }

    setIsSaving(true);
    try {
      const printerData = {
        ipAddress: ipAddress.trim(),
        port: portNum,
        name: `Printer @ ${ipAddress.trim()}`,
      };

      const success = await printerService.savePrinter(printerData);
      if (success) {
        setSavedPrinter(printerData);
        Alert.alert('Success', 'Printer saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save printer');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePrinter = async () => {
    Alert.alert(
      'Remove Printer',
      'Are you sure you want to remove the saved printer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await printerService.removeSavedPrinter();
            setSavedPrinter(null);
            setIpAddress('');
            setPort('9100');
            Alert.alert('Success', 'Printer removed');
          },
        },
      ]
    );
  };

  const handleTestPrint = async () => {
    if (!ipAddress.trim() || !printerService.isValidIPAddress(ipAddress.trim())) {
      Alert.alert('Error', 'Please enter a valid IP address first');
      return;
    }

    setIsPrinting(true);
    try {
      const portNum = parseInt(port, 10) || 9100;
      const result = await printerService.printTestLabel(ipAddress.trim(), portNum);

      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Print Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan barcodes');
        return;
      }
    }
    setScanned(false);
    setScannerVisible(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    const parsed = printerService.parseIPFromBarcode(data);

    if (parsed) {
      setIpAddress(parsed.ipAddress);
      setPort(parsed.port.toString());
      setScannerVisible(false);
      Alert.alert('Scanned', `IP Address: ${parsed.ipAddress}:${parsed.port}`);
    } else {
      Alert.alert(
        'Invalid Barcode',
        `Scanned: "${data}"\n\nExpected format: IP address (e.g., 192.168.1.100 or 192.168.1.100:9100)`,
        [
          { text: 'Try Again', onPress: () => setScanned(false) },
          { text: 'Cancel', onPress: () => setScannerVisible(false) },
        ]
      );
    }
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
        {/* Saved Printer Card */}
        {savedPrinter && (
          <View style={styles.savedPrinterCard}>
            <View style={styles.savedPrinterHeader}>
              <Ionicons name="print" size={24} color="#4CAF50" />
              <Text style={styles.savedPrinterTitle}>Saved Printer</Text>
            </View>
            <View style={styles.savedPrinterInfo}>
              <Text style={styles.savedPrinterIP}>{savedPrinter.ipAddress}:{savedPrinter.port}</Text>
              <Text style={styles.savedPrinterDate}>
                Saved: {new Date(savedPrinter.savedAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity style={styles.removeButton} onPress={handleRemovePrinter}>
              <Ionicons name="trash-outline" size={18} color="#FF5252" />
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scan Barcode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scan Printer Barcode</Text>
          <Text style={styles.sectionDescription}>
            Scan the barcode on your printer to automatically capture its IP address
          </Text>
          <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
            <Ionicons name="barcode-outline" size={24} color="#FFF" />
            <Text style={styles.scanButtonText}>Scan Printer Barcode</Text>
          </TouchableOpacity>
        </View>

        {/* Manual Entry Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Or Enter Manually</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>IP Address</Text>
            <TextInput
              style={styles.input}
              value={ipAddress}
              onChangeText={setIpAddress}
              placeholder="192.168.1.100"
              placeholderTextColor="#999"
              keyboardType="numeric"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Port (default: 9100)</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              placeholder="9100"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSavePrinter}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Printer</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, isPrinting && styles.buttonDisabled]}
            onPress={handleTestPrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="print-outline" size={20} color="#FFF" />
                <Text style={styles.testButtonText}>Test Print</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to Connect</Text>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Ensure your printer is on the same network as your device</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Scan the printer's IP barcode or enter IP manually</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Tap "Test Print" to verify connection</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>Tap "Save Printer" to use for label printing</Text>
          </View>
        </View>
      </ScrollView>

      {/* Barcode Scanner Modal */}
      <Modal visible={scannerVisible} animationType="slide">
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan Printer Barcode</Text>
            <TouchableOpacity
              style={styles.scannerCloseButton}
              onPress={() => setScannerVisible(false)}
            >
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame}>
                <View style={[styles.cornerTL, styles.corner]} />
                <View style={[styles.cornerTR, styles.corner]} />
                <View style={[styles.cornerBL, styles.corner]} />
                <View style={[styles.cornerBR, styles.corner]} />
              </View>
              <Text style={styles.scannerHint}>
                Point camera at printer's IP barcode
              </Text>
            </View>
          </CameraView>

          <TouchableOpacity
            style={styles.cancelScanButton}
            onPress={() => setScannerVisible(false)}
          >
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
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
  savedPrinterCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  savedPrinterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  savedPrinterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginLeft: 8,
  },
  savedPrinterInfo: {
    marginBottom: 12,
  },
  savedPrinterIP: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  savedPrinterDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  removeButtonText: {
    color: '#FF5252',
    marginLeft: 4,
    fontSize: 14,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 10,
    padding: 16,
    gap: 10,
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
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
  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1565C0',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  scannerCloseButton: {
    padding: 4,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#4CAF50',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scannerHint: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 30,
    textAlign: 'center',
  },
  cancelScanButton: {
    backgroundColor: '#FF5252',
    padding: 16,
    alignItems: 'center',
  },
  cancelScanText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PrinterSettingsScreen;
