import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safely load react-native-tcp-socket (not available in Expo Go)
let TcpSocket = null;
try {
  TcpSocket = require('react-native-tcp-socket');
  if (TcpSocket && TcpSocket.default) TcpSocket = TcpSocket.default;
} catch (e) {
  console.warn('react-native-tcp-socket not available (Expo Go). Printing disabled.');
}

const PRINTER_STORAGE_KEY = '@fcpos_printer_settings';
const PRINTER_PREFS_KEY = '@fcpos_printer_prefs'; // printer language + label size
const DEFAULT_PRINTER_PORT = 9100; // Standard RAW printing port

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

class PrinterService {
  constructor() {
    this.socket = null;
    // Records the last low-level socket error / abnormal close seen during a
    // print flow, so a job the printer silently rejected (e.g. a RST that
    // arrives AFTER the write callback already fired) can be reported as a
    // FAILURE instead of a false "completed successfully".
    this._flowError = null;
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

  // Printer preferences: which command language to send and (for label
  // printers) the label size. ESC/POS (Epson/receipt) is the default so
  // existing printers keep working; TSPL is for thermal label printers
  // (e.g. Ocom OCBP-401DT) that do not understand ESC/POS.
  async getPrinterPrefs() {
    const defaults = { printerType: 'escpos', labelWidthMm: 75, labelHeightMm: 75, labelGapMm: 3 };
    try {
      const raw = await AsyncStorage.getItem(PRINTER_PREFS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        printerType: parsed.printerType === 'tspl' ? 'tspl' : 'escpos',
        labelWidthMm: Number(parsed.labelWidthMm) || defaults.labelWidthMm,
        labelHeightMm: Number(parsed.labelHeightMm) || defaults.labelHeightMm,
        labelGapMm: (parsed.labelGapMm != null && !isNaN(Number(parsed.labelGapMm)))
          ? Number(parsed.labelGapMm)
          : defaults.labelGapMm,
      };
    } catch (error) {
      console.error('Error getting printer prefs:', error);
      return defaults;
    }
  }

  async savePrinterPrefs(prefs) {
    try {
      const current = await this.getPrinterPrefs();
      const merged = { ...current, ...(prefs || {}) };
      await AsyncStorage.setItem(PRINTER_PREFS_KEY, JSON.stringify(merged));
      return merged;
    } catch (error) {
      console.error('Error saving printer prefs:', error);
      return null;
    }
  }

  // Connect to printer via TCP/IP.
  // `log(message, type)` is an optional callback used to surface every step in
  // the on-screen print log so we can trace failures on printers that accept
  // the TCP connection but never actually print.
  connectToPrinter(ipAddress, port = DEFAULT_PRINTER_PORT, log = () => {}) {
    return new Promise((resolve, reject) => {
      if (!TcpSocket) {
        reject(new Error('Printing not available in Expo Go. Use a development build for printer support.'));
        return;
      }

      // Reset per-flow error state at the start of every connection attempt.
      this._flowError = null;
      let settled = false;
      const connectStart = Date.now();

      try {
        log(`Opening TCP socket to ${ipAddress}:${port} (connect timeout 8000ms)...`, 'info');
        this.socket = TcpSocket.createConnection(
          {
            host: ipAddress,
            port: port,
            timeout: 8000,
          },
          () => {
            settled = true;
            const ms = Date.now() - connectStart;
            let where = '';
            try {
              const la = this.socket.localAddress;
              const lp = this.socket.localPort;
              if (la) where = ` (local ${la}:${lp || '?'})`;
            } catch (e) { /* address info not always available */ }
            console.log('Connected to printer:', ipAddress);
            log(`TCP connection established in ${ms}ms${where}`, 'success');
            resolve(true);
          }
        );

        // Persistent listeners — these keep logging AFTER the connection is
        // established, which is exactly where a silently-failing printer
        // reveals itself (RST / unexpected close once it receives the data).
        this.socket.on('error', (error) => {
          const msg = (error && error.message) ? error.message : String(error);
          console.error('Socket error:', error);
          this._flowError = msg;
          if (!settled) {
            settled = true;
            log(`Connection failed: ${msg}`, 'error');
            reject(new Error(`Connection failed: ${msg}`));
          } else {
            // Error after we were already connected — the printer dropped us.
            log(`Socket error after connect: ${msg}`, 'error');
          }
        });

        this.socket.on('timeout', () => {
          console.error('Socket timeout');
          log('Socket timeout — printer did not respond within 8000ms', 'error');
          try { this.socket.destroy(); } catch (e) {}
          if (!settled) {
            settled = true;
            reject(new Error('Connection timed out'));
          }
        });

        this.socket.on('close', (hadError) => {
          console.log('Socket closed', hadError ? '(with error)' : '');
          if (hadError) this._flowError = this._flowError || 'socket closed with error';
          log(`Socket closed${hadError ? ' WITH ERROR (printer reset the connection)' : ''}`, hadError ? 'error' : 'info');
        });

        // Some printers reply on the raw 9100 channel (status / NAK). Surface it.
        this.socket.on('data', (chunk) => {
          try {
            const len = chunk && chunk.length ? chunk.length : 0;
            log(`Printer replied with ${len} byte(s): ${this._previewBytes(chunk)}`, 'info');
          } catch (e) { /* ignore preview errors */ }
        });
      } catch (error) {
        log(`Failed to open socket: ${error.message}`, 'error');
        reject(new Error(`Failed to connect: ${error.message}`));
      }
    });
  }

  // Disconnect from printer.
  // Defaults to a GRACEFUL close: end() flushes any bytes still queued and then
  // sends FIN, and we wait for the socket 'close' event before resolving. The
  // old behaviour (socket.destroy()) tore the connection down immediately and
  // could discard data the printer had not yet received — the most likely
  // reason a label prints on some printers but not on others.
  disconnect(log = () => {}, graceful = true) {
    return new Promise((resolve) => {
      const sock = this.socket;
      if (!sock) {
        resolve(true);
        return;
      }

      let done = false;
      const finish = (how) => {
        if (done) return;
        done = true;
        log(`Disconnected (${how})`, 'info');
        try {
          if (typeof sock.removeAllListeners === 'function') sock.removeAllListeners();
        } catch (e) { /* ignore */ }
        if (this.socket === sock) this.socket = null;
        resolve(true);
      };

      if (graceful && typeof sock.end === 'function') {
        log('Flushing pending data and closing socket gracefully...', 'info');
        sock.once('close', () => finish('graceful close'));
        try {
          sock.end();
        } catch (e) {
          log(`end() failed (${e.message}) — forcing close`, 'error');
          try { sock.destroy(); } catch (e2) {}
          finish('forced');
          return;
        }
        // Never hang if the printer never sends its FIN back.
        setTimeout(() => {
          if (!done) {
            log('Graceful close timed out after 3000ms — forcing close', 'error');
            try { sock.destroy(); } catch (e) {}
            finish('forced after timeout');
          }
        }, 3000);
      } else {
        try { sock.destroy(); } catch (e) {}
        finish('immediate');
      }
    });
  }

  // Send data to printer
  sendData(data, log = () => {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        log('Cannot send — not connected to printer', 'error');
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

        const byteLen = sendBuffer.length;
        let callbackFired = false;
        log(`Writing ${byteLen} byte(s) to socket...`, 'info');

        // Guard: if the write callback never fires (some printers accept the
        // bytes but never ack the write) don't hang the whole print flow.
        const writeTimeout = setTimeout(() => {
          if (!callbackFired) {
            log('Write not acknowledged within 5000ms — continuing anyway', 'error');
            resolve(true);
          }
        }, 5000);

        const flushedToKernel = this.socket.write(sendBuffer, 'binary', (err) => {
          callbackFired = true;
          clearTimeout(writeTimeout);
          if (err) {
            const msg = (err && err.message) ? err.message : String(err);
            log(`Write callback error: ${msg}`, 'error');
            reject(new Error(`Failed to send data: ${msg}`));
            return;
          }
          log(`Write acknowledged — ${byteLen} byte(s) handed to printer`, 'success');
          resolve(true);
        });

        if (flushedToKernel === false) {
          log('Socket send buffer full — waiting for drain...', 'info');
          this.socket.once('drain', () => log('Socket drained', 'info'));
        }
      } catch (error) {
        log(`Exception while sending: ${error.message}`, 'error');
        reject(new Error(`Failed to send data: ${error.message}`));
      }
    });
  }

  // Generate preview text for what will be printed
  generatePreviewText(orderData) {
    const lines = [];
    const LINE_WIDTH = 24; // Characters that fit on narrow label
    const separator = '-'.repeat(LINE_WIDTH);

    lines.push('');
    lines.push(separator);

    // Lorry and Bay on same line — values only
    const lorry = orderData.lorry || '';
    const bay = orderData.loadingBy || '';
    if (lorry || bay) {
      lines.push(this.truncateText(`${lorry} ${bay}`.trim(), LINE_WIDTH));
    }

    // Order details
    lines.push(this.truncateText(orderData.orderNumber || 'N/A', LINE_WIDTH));

    if (orderData.orderDate) {
      lines.push(this.truncateText(orderData.orderDate, LINE_WIDTH));
    }

    if (orderData.accountName) {
      lines.push(this.truncateText(orderData.accountName, LINE_WIDTH));
    }

    if (orderData.picker) {
      lines.push(this.truncateText(`Picker: ${orderData.picker}`, LINE_WIDTH));
    }

    lines.push(separator);

    return lines.join('\n');
  }

  // Truncate text to fit label width
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '..';
  }

  // Create ESC/POS commands for label with QR code
  createLabelCommands(orderData) {
    const commands = [];
    const LINE_WIDTH = 24; // Characters that fit on narrow label
    const separator = '-'.repeat(LINE_WIDTH);

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

    // QR Code: Set size (6 = medium for narrow label)
    commands.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06);

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
    this.addText(commands, separator);
    commands.push(LF);

    // Lorry and Bay on same line — values only
    const lorry = orderData.lorry || '';
    const bay = orderData.loadingBy || '';
    if (lorry || bay) {
      this.addText(commands, this.truncateText(`${lorry} ${bay}`.trim(), LINE_WIDTH));
      commands.push(LF);
    }

    // Bold on for order number
    commands.push(ESC, 0x45, 0x01);
    this.addText(commands, this.truncateText(orderData.orderNumber || 'N/A', LINE_WIDTH));
    commands.push(LF);
    commands.push(ESC, 0x45, 0x00); // Bold off

    // Order date
    if (orderData.orderDate) {
      this.addText(commands, this.truncateText(orderData.orderDate, LINE_WIDTH));
      commands.push(LF);
    }

    // Customer name (full line, no prefix)
    if (orderData.accountName) {
      this.addText(commands, this.truncateText(orderData.accountName, LINE_WIDTH));
      commands.push(LF);
    }

    // Picker
    if (orderData.picker) {
      this.addText(commands, this.truncateText(`Picker: ${orderData.picker}`, LINE_WIDTH));
      commands.push(LF);
    }

    // Add separator
    this.addText(commands, separator);
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

  // Create TSPL commands for a QR label — for thermal LABEL printers
  // (Ocom OCBP-401DT and similar) that speak TSPL/TSPL2, not ESC/POS.
  // Everything is placed to fit inside ONE physical label: vehicle (lorry/bay)
  // at the top, QR pushed up just below it, then the order details squeezed
  // directly under the QR — all centered. opts: { widthMm, heightMm, gapMm }.
  createLabelCommandsTSPL(orderData, opts = {}) {
    const widthMm = Number(opts.widthMm) || 75;
    const heightMm = Number(opts.heightMm) || 75;
    const gapMm = (opts.gapMm != null && !isNaN(Number(opts.gapMm))) ? Number(opts.gapMm) : 3;
    const dpmm = 8; // 203 dpi ≈ 8 dots/mm
    const widthDots = Math.round(widthMm * dpmm);
    const heightDots = Math.round(heightMm * dpmm);

    // Sanitize text placed inside TSPL double-quoted strings.
    const clean = (s) => String(s == null ? '' : s)
      .replace(/[\r\n]+/g, ' ')
      .replace(/"/g, "'")
      .replace(/\\/g, '/')
      .trim();

    const cmds = [];
    cmds.push(`SIZE ${widthMm} mm,${heightMm} mm`);
    cmds.push(`GAP ${gapMm} mm,0 mm`);
    cmds.push('DIRECTION 1');
    cmds.push('REFERENCE 0,0');
    cmds.push('CLS');

    const margin = 12; // ~1.5mm — pushes the QR up towards the top
    let y = margin;

    // Built-in TSPL fonts are fixed-width, so plain TEXT can be centered by
    // computing X from the string length. Default font uses 16x24 dots for spacing calc.
    // Note: font specification omitted from TSPL TEXT command to use printer's default font,
    // as different printers use different font IDs/names. Printer defaults handle sizing.
    const charW = 16;
    const charH = 24;

    const centerText = (text, mul) => {
      let t = clean(text);
      if (!t) return;
      const maxChars = Math.floor((widthDots - 8) / (charW * mul));
      if (maxChars > 0 && t.length > maxChars) t = t.substring(0, Math.max(1, maxChars - 1)) + '.';
      const lineH = charH * mul + 6;
      if (y + lineH > heightDots) return; // never run off the label
      const textW = t.length * charW * mul;
      const x = Math.max(0, Math.round((widthDots - textW) / 2));
      // Use font 0 (printer default) to ensure TEXT command is recognized correctly
      cmds.push(`TEXT ${x},${y},0,0,${mul},${mul},"${t}"`);
      y += lineH;
    };

    // QR code at top, centered
    const qrData = clean(orderData.orderNumber || 'NO-ORDER');
    const estModules = qrData.length <= 14 ? 21 : qrData.length <= 26 ? 25 : 29;
    let cell = Math.floor((heightDots * 0.35) / estModules); // reduced to fit text below
    if (cell < 3) cell = 3;
    if (cell > 10) cell = 10;
    const qrPix = estModules * cell;
    const qrX = Math.max(0, Math.round((widthDots - qrPix) / 2));
    cmds.push(`QRCODE ${qrX},${y},M,${cell},A,0,"${qrData}"`);
    y += qrPix + 12;

    // Separator line
    const LINE_WIDTH = 24;
    const separator = '-'.repeat(LINE_WIDTH);
    centerText(separator, 1);

    // Lorry and Bay on same line (if present)
    const lorry = orderData.lorry || '';
    const bay = orderData.loadingBy || '';
    if (lorry || bay) centerText(`${lorry} ${bay}`.trim(), 1);

    // Order details (match Epson format)
    centerText(orderData.orderNumber || 'N/A', 1); // order number
    if (orderData.orderDate) centerText(orderData.orderDate, 1);
    if (orderData.accountName) centerText(orderData.accountName, 1);
    if (orderData.picker) centerText(`Picker: ${orderData.picker}`, 1);

    // Separator line
    centerText(separator, 1);

    cmds.push('PRINT 1,1');

    const text = cmds.join('\r\n') + '\r\n';
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xFF;
    return bytes;
  }

  addText(commands, text) {
    for (let i = 0; i < text.length; i++) {
      commands.push(text.charCodeAt(i));
    }
  }

  // Hex preview of up to the first 32 bytes of a printer response, for logging.
  _previewBytes(chunk) {
    try {
      let arr;
      if (chunk instanceof Uint8Array) {
        arr = chunk;
      } else if (typeof chunk === 'string') {
        arr = new Uint8Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) arr[i] = chunk.charCodeAt(i) & 0xFF;
      } else {
        arr = new Uint8Array(chunk);
      }
      const max = Math.min(arr.length, 32);
      let hex = '';
      for (let i = 0; i < max; i++) {
        hex += (arr[i] < 16 ? '0' : '') + arr[i].toString(16);
        if (i < max - 1) hex += ' ';
      }
      return hex + (arr.length > max ? ' …' : '');
    } catch (e) {
      return '(unreadable)';
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

  // Print to IP with detailed step-by-step logging.
  // `addLog(message, type)` receives every step so the on-screen log can trace
  // exactly how far a job got. Unlike the old version this reports a FAILURE
  // when the socket errors or the printer resets the connection, instead of
  // always claiming success once the bytes were handed to the OS.
  async printToIPWithLogs(ipAddress, port, orderData, addLog, options = {}) {
    const log = (msg, type = 'info') => { try { addLog(msg, type); } catch (e) {} };
    const targetPort = port || DEFAULT_PRINTER_PORT;
    const printerType = (options.printerType || 'escpos').toLowerCase() === 'tspl' ? 'tspl' : 'escpos';
    const t0 = Date.now();
    const elapsed = () => `${Date.now() - t0}ms`;

    try {
      log(`Attempting connection to ${ipAddress}:${targetPort}...`, 'info');
      await this.connectToPrinter(ipAddress, targetPort, log);
      log(`Connected to printer successfully (+${elapsed()})`, 'success');

      let commands;
      if (printerType === 'tspl') {
        const lbl = options.label || {};
        const w = Number(lbl.widthMm) || 100;
        const h = Number(lbl.heightMm) || 150;
        const g = (lbl.gapMm != null && !isNaN(Number(lbl.gapMm))) ? Number(lbl.gapMm) : 3;
        log(`Printer language: TSPL (thermal label printer)`, 'info');
        log(`Building TSPL label ${w}x${h} mm, gap ${g} mm...`, 'info');
        commands = this.createLabelCommandsTSPL(orderData, { widthMm: w, heightMm: h, gapMm: g });
      } else {
        log(`Printer language: ESC/POS (Epson / receipt)`, 'info');
        log('Building ESC/POS label commands...', 'info');
        commands = this.createLabelCommands(orderData);
      }
      log(`Print data size: ${commands.length} bytes`, 'info');

      log('Sending data to printer...', 'info');
      await this.sendData(commands, log);
      log(`Data sent to printer (+${elapsed()})`, 'success');

      log('Waiting for printer to process (700ms)...', 'info');
      await new Promise(resolve => setTimeout(resolve, 700));

      // If the printer rejected / reset the connection while (or right after)
      // receiving the data, we already captured it — surface it as a failure.
      if (this._flowError) {
        log(`Printer aborted the connection: ${this._flowError}`, 'error');
        log('The label most likely did NOT print. Check printer model / paper / status.', 'error');
        await this.disconnect(log, false);
        return { success: false, message: `Printer aborted: ${this._flowError}` };
      }

      log('Flushing and disconnecting...', 'info');
      await this.disconnect(log, true);

      // A clean FIN from us can still race a late reset from the printer.
      if (this._flowError) {
        log(`Printer reported an error during close: ${this._flowError}`, 'error');
        return { success: false, message: `Printer error: ${this._flowError}` };
      }

      log(`Print flow finished cleanly (+${elapsed()})`, 'success');
      return { success: true, message: 'Label printed successfully!' };
    } catch (error) {
      log(`Connection/Print error: ${error.message}`, 'error');
      try { await this.disconnect(log, false); } catch (e) {}
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
