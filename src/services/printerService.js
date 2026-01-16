import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BleManager } from 'react-native-ble-plx';

const PRINTER_STORAGE_KEY = '@fcpos_printer_settings';

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

class PrinterService {
  constructor() {
    this.bleManager = null;
    this.connectedDevice = null;
    this.writeCharacteristic = null;
  }

  initialize() {
    if (!this.bleManager) {
      this.bleManager = new BleManager();
    }
  }

  destroy() {
    if (this.bleManager) {
      this.bleManager.destroy();
      this.bleManager = null;
    }
    this.connectedDevice = null;
    this.writeCharacteristic = null;
  }

  async getSavedPrinter() {
    try {
      const savedData = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
      if (savedData) {
        return JSON.parse(savedData);
      }
      return null;
    } catch (error) {
      console.error('Error getting saved printer:', error);
      return null;
    }
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;

        if (apiLevel >= 31) {
          const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          return Object.values(results).every(
            result => result === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
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
  }

  async connectToSavedPrinter() {
    this.initialize();

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Bluetooth permissions not granted');
    }

    const savedPrinter = await this.getSavedPrinter();
    if (!savedPrinter) {
      throw new Error('No saved printer found. Please configure a printer in Settings.');
    }

    try {
      // Connect to device
      this.connectedDevice = await this.bleManager.connectToDevice(savedPrinter.id);
      await this.connectedDevice.discoverAllServicesAndCharacteristics();

      // Find writable characteristic
      const services = await this.connectedDevice.services();
      for (const service of services) {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            this.writeCharacteristic = char;
            break;
          }
        }
        if (this.writeCharacteristic) break;
      }

      if (!this.writeCharacteristic) {
        throw new Error('Could not find writable characteristic on printer');
      }

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      throw new Error(`Failed to connect to printer: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch (error) {
        console.error('Disconnect error:', error);
      }
      this.connectedDevice = null;
      this.writeCharacteristic = null;
    }
  }

  async printData(data) {
    if (!this.writeCharacteristic) {
      throw new Error('Not connected to printer');
    }

    try {
      const base64Data = Buffer.from(data).toString('base64');
      await this.writeCharacteristic.writeWithResponse(base64Data);
      return true;
    } catch (error) {
      console.error('Print error:', error);
      throw new Error(`Failed to print: ${error.message}`);
    }
  }

  // Create ESC/POS commands for label with QR code
  createLabelCommands(orderData) {
    const commands = [];

    // Initialize printer
    commands.push(ESC, 0x40);

    // Set character code table (PC437)
    commands.push(ESC, 0x74, 0x00);

    // Center alignment
    commands.push(ESC, 0x61, 0x01);

    // Print QR code
    const qrData = orderData.orderNumber || 'NO-ORDER';

    // QR Code: Select model (model 2)
    commands.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);

    // QR Code: Set size (6 = medium-large)
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08);

    // QR Code: Set error correction level (L = 48, M = 49, Q = 50, H = 51)
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);

    // QR Code: Store data
    const qrDataLen = qrData.length + 3;
    const pL = qrDataLen & 0xFF;
    const pH = (qrDataLen >> 8) & 0xFF;
    commands.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < qrData.length; i++) {
      commands.push(qrData.charCodeAt(i));
    }

    // QR Code: Print
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

    // Line feed after QR
    commands.push(LF);

    // Left alignment for text
    commands.push(ESC, 0x61, 0x00);

    // Add separator
    this.addText(commands, '--------------------------------');
    commands.push(LF);

    // Bold on for order number
    commands.push(ESC, 0x45, 0x01);
    this.addText(commands, `Order: ${orderData.orderNumber || 'N/A'}`);
    commands.push(LF);
    commands.push(ESC, 0x45, 0x00); // Bold off

    // Order details
    if (orderData.orderDate) {
      this.addText(commands, `Date: ${orderData.orderDate}`);
      commands.push(LF);
    }

    if (orderData.accountName) {
      this.addText(commands, `Customer: ${orderData.accountName}`);
      commands.push(LF);
    }

    if (orderData.picker) {
      this.addText(commands, `Picker: ${orderData.picker}`);
      commands.push(LF);
    }

    if (orderData.loadingBy) {
      this.addText(commands, `Loading By: ${orderData.loadingBy}`);
      commands.push(LF);
    }

    if (orderData.lorry) {
      this.addText(commands, `Lorry: ${orderData.lorry}`);
      commands.push(LF);
    }

    // Add separator
    this.addText(commands, '--------------------------------');
    commands.push(LF);

    // Line feeds for paper advance
    commands.push(LF, LF, LF);

    // Cut paper (partial cut)
    commands.push(GS, 0x56, 0x01);

    return new Uint8Array(commands);
  }

  addText(commands, text) {
    for (let i = 0; i < text.length; i++) {
      commands.push(text.charCodeAt(i));
    }
  }

  // Main function to print order label
  async printOrderLabel(orderData) {
    try {
      await this.connectToSavedPrinter();
      const commands = this.createLabelCommands(orderData);
      await this.printData(commands);
      await this.disconnect();
      return { success: true, message: 'Label printed successfully!' };
    } catch (error) {
      await this.disconnect();
      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance
export const printerService = new PrinterService();

export default printerService;
