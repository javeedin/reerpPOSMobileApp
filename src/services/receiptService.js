import { Platform } from 'react-native';

// Conditionally import native-only modules
let Print = null;
let Sharing = null;

if (Platform.OS !== 'web') {
  Print = require('expo-print');
  Sharing = require('expo-sharing');
}

/**
 * Receipt Service for generating and printing thermal printer receipts
 * Optimized for 80mm (3.15") and 58mm (2.28") thermal paper
 */

// Format number with commas and 2 decimals
const formatNumber = (num) => {
  const value = parseFloat(num) || 0;
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format date for receipt
const formatDate = (dateStr) => {
  const date = new Date(dateStr || new Date());
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Format time for receipt
const formatTime = (dateStr) => {
  const date = new Date(dateStr || new Date());
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Generate receipt HTML for thermal printer (80mm paper = ~48 characters)
const generateReceiptHTML = (order, options = {}) => {
  const {
    companyName = 'GRAYS INC',
    companyAddress = '',
    companyPhone = '',
    companyVAT = '',
    showLogo = false,
    paperWidth = 80, // 80mm or 58mm
  } = options;

  const currency = order.currency || 'MUR';
  const lines = order.lines || [];
  const payments = order.payments || [];
  const customer = order.customer || {};
  const totals = order.totals || {};

  // Calculate totals
  const totalGross = lines.reduce((sum, l) => sum + (parseFloat(l.totalGross) || parseFloat(l.grossTotal) || 0), 0);
  const totalDiscount = lines.reduce((sum, l) => sum + (parseFloat(l.totalDiscount) || parseFloat(l.discountAmount) || 0), 0);
  const totalTax = lines.reduce((sum, l) => sum + (parseFloat(l.totalTax) || parseFloat(l.taxAmount) || 0), 0);
  const totalNet = totals.totalNet || lines.reduce((sum, l) => sum + (parseFloat(l.totalNet) || parseFloat(l.net) || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const change = Math.max(0, totalPaid - totalNet);

  // Paper width styles
  const containerWidth = paperWidth === 58 ? '58mm' : '80mm';
  const fontSize = paperWidth === 58 ? '10px' : '12px';
  const titleSize = paperWidth === 58 ? '14px' : '16px';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: ${containerWidth} auto;
      margin: 0;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      width: ${containerWidth};
      padding: 4mm;
      background: #fff;
      color: #000;
    }

    .receipt {
      width: 100%;
    }

    .header {
      text-align: center;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000;
    }

    .company-name {
      font-size: ${titleSize};
      font-weight: bold;
      margin-bottom: 4px;
    }

    .company-info {
      font-size: 10px;
      color: #333;
    }

    .order-info {
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000;
    }

    .order-number {
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      margin-bottom: 4px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      margin-bottom: 2px;
    }

    .customer-section {
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000;
    }

    .section-title {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .customer-name {
      font-weight: bold;
    }

    .items-section {
      margin-bottom: 8px;
    }

    .items-header {
      display: flex;
      font-weight: bold;
      font-size: 10px;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }

    .items-header .item-name { flex: 2; }
    .items-header .item-qty { flex: 0.5; text-align: center; }
    .items-header .item-price { flex: 1; text-align: right; }
    .items-header .item-total { flex: 1; text-align: right; }

    .item-row {
      margin-bottom: 4px;
      font-size: 11px;
    }

    .item-main {
      display: flex;
    }

    .item-main .item-name {
      flex: 2;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-main .item-qty { flex: 0.5; text-align: center; }
    .item-main .item-price { flex: 1; text-align: right; }
    .item-main .item-total { flex: 1; text-align: right; font-weight: bold; }

    .item-code {
      font-size: 9px;
      color: #666;
      margin-left: 2px;
    }

    .item-discount {
      font-size: 9px;
      color: #333;
      margin-left: 2px;
    }

    .totals-section {
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-bottom: 8px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .total-row.grand {
      font-weight: bold;
      font-size: 14px;
      border-top: 1px solid #000;
      padding-top: 6px;
      margin-top: 6px;
    }

    .total-row.discount {
      color: #333;
    }

    .payments-section {
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-bottom: 8px;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .change-row {
      font-weight: bold;
      font-size: 14px;
      background: #f0f0f0;
      padding: 4px;
      margin-top: 4px;
    }

    .footer {
      text-align: center;
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px dashed #000;
    }

    .footer-message {
      font-size: 11px;
      margin-bottom: 4px;
    }

    .footer-small {
      font-size: 9px;
      color: #666;
    }

    .barcode {
      text-align: center;
      margin: 8px 0;
      font-size: 10px;
      letter-spacing: 2px;
    }

    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div class="header">
      <div class="company-name">${companyName}</div>
      ${companyAddress ? `<div class="company-info">${companyAddress}</div>` : ''}
      ${companyPhone ? `<div class="company-info">Tel: ${companyPhone}</div>` : ''}
      ${companyVAT ? `<div class="company-info">VAT: ${companyVAT}</div>` : ''}
    </div>

    <!-- Order Info -->
    <div class="order-info">
      <div class="order-number">${order.orderNumber || 'N/A'}</div>
      <div class="info-row">
        <span>Date:</span>
        <span>${formatDate(order.createdAt || order.orderDate)}</span>
      </div>
      <div class="info-row">
        <span>Time:</span>
        <span>${formatTime(order.createdAt || order.orderDate)}</span>
      </div>
      ${order.orderType ? `
      <div class="info-row">
        <span>Type:</span>
        <span>${order.orderType}</span>
      </div>
      ` : ''}
      ${order.salesRep ? `
      <div class="info-row">
        <span>Cashier:</span>
        <span>${order.salesRep}</span>
      </div>
      ` : ''}
    </div>

    <!-- Customer -->
    ${customer.name ? `
    <div class="customer-section">
      <div class="section-title">CUSTOMER</div>
      <div class="customer-name">${customer.name}</div>
      ${customer.accountNumber ? `<div class="company-info">Acc: ${customer.accountNumber}</div>` : ''}
    </div>
    ` : ''}

    <!-- Items -->
    <div class="items-section">
      <div class="items-header">
        <span class="item-name">ITEM</span>
        <span class="item-qty">QTY</span>
        <span class="item-price">PRICE</span>
        <span class="item-total">TOTAL</span>
      </div>

      ${lines.map(line => `
        <div class="item-row">
          <div class="item-main">
            <span class="item-name">${(line.itemDesc || line.item_desc || line.name || '').substring(0, 20)}</span>
            <span class="item-qty">${line.quantity || line.qty || 1}</span>
            <span class="item-price">${formatNumber(line.unitPrice || line.sellingPrice || line.base_price || 0)}</span>
            <span class="item-total">${formatNumber(line.totalNet || line.net || line.total || 0)}</span>
          </div>
          ${line.itemNumber || line.item_number ? `<div class="item-code">${line.itemNumber || line.item_number}</div>` : ''}
          ${(line.discountPercent || line.discountPer) > 0 ? `<div class="item-discount">Disc: -${line.discountPercent || line.discountPer}%</div>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Totals -->
    <div class="totals-section">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${currency} ${formatNumber(totalGross)}</span>
      </div>
      ${totalDiscount > 0 ? `
      <div class="total-row discount">
        <span>Discount:</span>
        <span>-${currency} ${formatNumber(totalDiscount)}</span>
      </div>
      ` : ''}
      ${totalTax > 0 ? `
      <div class="total-row">
        <span>VAT:</span>
        <span>${currency} ${formatNumber(totalTax)}</span>
      </div>
      ` : ''}
      <div class="total-row grand">
        <span>TOTAL:</span>
        <span>${currency} ${formatNumber(totalNet)}</span>
      </div>
    </div>

    <!-- Payments -->
    <div class="payments-section">
      <div class="section-title">PAYMENT</div>
      ${payments.map(payment => `
        <div class="payment-row">
          <span>${payment.method || 'Cash'}</span>
          <span>${currency} ${formatNumber(payment.amount)}</span>
        </div>
        ${payment.reference ? `<div class="company-info" style="text-align: right;">Ref: ${payment.reference}</div>` : ''}
      `).join('')}

      ${change > 0 ? `
      <div class="payment-row change-row">
        <span>CHANGE:</span>
        <span>${currency} ${formatNumber(change)}</span>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-message">Thank you for your purchase!</div>
      <div class="footer-small">Please retain this receipt for your records</div>
      <div class="barcode">${order.orderNumber || ''}</div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Print receipt directly to printer
 * @param {Object} order - Order data
 * @param {Object} options - Receipt options
 */
export const printReceipt = async (order, options = {}) => {
  try {
    const html = generateReceiptHTML(order, options);

    if (Platform.OS === 'web') {
      // On web, open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
      return { success: true };
    } else {
      // On mobile, use expo-print
      await Print.printAsync({
        html,
        width: options.paperWidth === 58 ? 165 : 227, // 58mm or 80mm in points
      });
      return { success: true };
    }
  } catch (error) {
    console.error('Print receipt error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate PDF file and share
 * @param {Object} order - Order data
 * @param {Object} options - Receipt options
 */
export const generateAndSharePDF = async (order, options = {}) => {
  try {
    const html = generateReceiptHTML(order, options);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      width: options.paperWidth === 58 ? 165 : 227,
    });

    console.log('PDF generated at:', uri);

    // Check if sharing is available
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Receipt ${order.orderNumber}`,
        UTI: 'com.adobe.pdf',
      });
      return { success: true, uri };
    } else {
      // On web or if sharing not available, just return the URI
      return { success: true, uri };
    }
  } catch (error) {
    console.error('Generate PDF error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get available printers (if supported)
 */
export const getAvailablePrinters = async () => {
  try {
    if (Platform.OS !== 'web') {
      const printers = await Print.selectPrinterAsync();
      return { success: true, printer: printers };
    }
    return { success: false, error: 'Not supported on web' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  printReceipt,
  generateAndSharePDF,
  getAvailablePrinters,
  generateReceiptHTML,
};
