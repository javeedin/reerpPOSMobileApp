import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TcpSocket from 'react-native-tcp-socket';

const PRINTER_STORAGE_KEY = '@fcpos_printer_settings';
const DEFAULT_PRINTER_PORT = 9100; // Standard RAW printing port

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

class PrinterService {
  constructor() {
    this.socket = null;
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

  async savePrinter(printerData) {
    try {
      const data = {
        ...printerData,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving printer:', error);
      return false;
    }
  }

  async removeSavedPrinter() {
    try {
      await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error removing printer:', error);
      return false;
    }
  }

  // Connect to printer via TCP/IP
  connectToPrinter(ipAddress, port = DEFAULT_PRINTER_PORT) {
    return new Promise((resolve, reject) => {
      try {
        this.socket = TcpSocket.createConnection(
          {
            host: ipAddress,
            port: port,
            timeout: 5000,
          },
          () => {
            console.log('Connected to printer:', ipAddress);
            resolve(true);
          }
        );

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          reject(new Error(`Connection failed: ${error.message}`));
        });

        this.socket.on('timeout', () => {
          console.error('Socket timeout');
          this.socket.destroy();
          reject(new Error('Connection timed out'));
        });

        this.socket.on('close', () => {
          console.log('Socket closed');
        });
      } catch (error) {
        reject(new Error(`Failed to connect: ${error.message}`));
      }
    });
  }

  // Disconnect from printer
  disconnect() {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.destroy();
        this.socket = null;
      }
      resolve(true);
    });
  }

  // Send data to printer
  sendData(data) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to printer'));
        return;
      }

      try {
        // Convert Uint8Array to string for TCP socket
        // react-native-tcp-socket can accept string or Uint8Array
        let sendBuffer;
        if (data instanceof Uint8Array) {
          // Convert Uint8Array to array and then to string of bytes
          sendBuffer = String.fromCharCode.apply(null, data);
        } else if (typeof data === 'string') {
          sendBuffer = data;
        } else {
          sendBuffer = String.fromCharCode.apply(null, new Uint8Array(data));
        }

        this.socket.write(sendBuffer, 'binary', () => {
          resolve(true);
        });
      } catch (error) {
        reject(new Error(`Failed to send data: ${error.message}`));
      }
    });
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

    // QR Code: Set size (8 = large for better scanning)
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08);

    // QR Code: Set error correction level (M = 49)
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
    commands.push(LF, LF);

    // Center alignment for text
    commands.push(ESC, 0x61, 0x01);

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
      // Truncate long customer names
      const customerName = orderData.accountName.length > 28
        ? orderData.accountName.substring(0, 25) + '...'
        : orderData.accountName;
      this.addText(commands, `Customer: ${customerName}`);
      commands.push(LF);
    }

    if (orderData.picker) {
      this.addText(commands, `Picker: ${orderData.picker}`);
      commands.push(LF);
    }

    if (orderData.loadingBy) {
      this.addText(commands, `Bay: ${orderData.loadingBy}`);
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

  // Create test label
  createTestLabelCommands() {
    const commands = [];

    // Initialize printer
    commands.push(ESC, 0x40);

    // Center alignment
    commands.push(ESC, 0x61, 0x01);

    // Bold on
    commands.push(ESC, 0x45, 0x01);
    this.addText(commands, 'FCPos Test Print');
    commands.push(LF);
    commands.push(ESC, 0x45, 0x00);

    // Separator
    this.addText(commands, '------------------------');
    commands.push(LF);

    // Date/time
    this.addText(commands, `Date: ${new Date().toLocaleString()}`);
    commands.push(LF);

    // Test QR code
    const qrData = 'FCPOS-TEST-OK';
    commands.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06);
    const qrLen = qrData.length + 3;
    commands.push(GS, 0x28, 0x6B, qrLen & 0xFF, (qrLen >> 8) & 0xFF, 0x31, 0x50, 0x30);
    for (let i = 0; i < qrData.length; i++) {
      commands.push(qrData.charCodeAt(i));
    }
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

    // Line feeds
    commands.push(LF, LF, LF);

    // Cut paper
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
      const savedPrinter = await this.getSavedPrinter();
      if (!savedPrinter || !savedPrinter.ipAddress) {
        throw new Error('No printer configured. Please scan printer barcode in Settings.');
      }

      await this.connectToPrinter(savedPrinter.ipAddress, savedPrinter.port || DEFAULT_PRINTER_PORT);
      const commands = this.createLabelCommands(orderData);
      await this.sendData(commands);

      // Small delay before disconnect to ensure data is sent
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.disconnect();

      return { success: true, message: 'Label printed successfully!' };
    } catch (error) {
      await this.disconnect();
      return { success: false, message: error.message };
    }
  }

  // Print test label
  async printTestLabel(ipAddress, port = DEFAULT_PRINTER_PORT) {
    try {
      await this.connectToPrinter(ipAddress, port);
      const commands = this.createTestLabelCommands();
      await this.sendData(commands);

      await new Promise(resolve => setTimeout(resolve, 500));
      await this.disconnect();

      return { success: true, message: 'Test label printed!' };
    } catch (error) {
      await this.disconnect();
      return { success: false, message: error.message };
    }
  }

  // Print directly to IP address (scan and print flow)
  async printToIP(ipAddress, port, orderData) {
    try {
      await this.connectToPrinter(ipAddress, port || DEFAULT_PRINTER_PORT);
      const commands = this.createLabelCommands(orderData);
      await this.sendData(commands);

      await new Promise(resolve => setTimeout(resolve, 500));
      await this.disconnect();

      return { success: true, message: 'Label printed successfully!' };
    } catch (error) {
      await this.disconnect();
      return { success: false, message: error.message };
    }
  }

  // Print to IP with detailed logging
  async printToIPWithLogs(ipAddress, port, orderData, addLog) {
    try {
      addLog(`Attempting connection to ${ipAddress}:${port || DEFAULT_PRINTER_PORT}...`, 'info');

      await this.connectToPrinter(ipAddress, port || DEFAULT_PRINTER_PORT);
      addLog('Connected to printer successfully', 'success');

      addLog('Creating print commands...', 'info');
      const commands = this.createLabelCommands(orderData);
      addLog(`Print data size: ${commands.length} bytes`, 'info');

      addLog('Sending data to printer...', 'info');
      await this.sendData(commands);
      addLog('Data sent to printer', 'success');

      addLog('Waiting for printer to process...', 'info');
      await new Promise(resolve => setTimeout(resolve, 500));

      addLog('Disconnecting...', 'info');
      await this.disconnect();
      addLog('Disconnected', 'info');

      return { success: true, message: 'Label printed successfully!' };
    } catch (error) {
      addLog(`Connection/Print error: ${error.message}`, 'error');
      await this.disconnect();
      return { success: false, message: error.message };
    }
  }

  // Validate IP address format
  isValidIPAddress(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  // Extract IP from scanned barcode (may contain IP:PORT or just IP)
  parseIPFromBarcode(barcode) {
    if (!barcode) return null;

    const trimmed = barcode.trim();

    // Check if it contains port (IP:PORT format)
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const ip = parts[0];
      const port = parseInt(parts[1], 10);

      if (this.isValidIPAddress(ip) && port > 0 && port <= 65535) {
        return { ipAddress: ip, port: port };
      }
    }

    // Check if it's just an IP
    if (this.isValidIPAddress(trimmed)) {
      return { ipAddress: trimmed, port: DEFAULT_PRINTER_PORT };
    }

    return null;
  }
}

// Export singleton instance
export const printerService = new PrinterService();
export default printerService;
