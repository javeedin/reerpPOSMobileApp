import axios from 'axios';

// OCR Service for extracting text from images
// Uses OCR.space free API - no API key required for basic usage

const OCR_SPACE_API_URL = 'https://api.ocr.space/parse/image';
const OCR_SPACE_API_KEY = 'K85553320788957'; // Free API key for OCR.space

// Parse batch report from OCR text
export const parseBatchReport = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  const result = {
    storeName: '',
    location: '',
    date: '',
    time: '',
    mid: '',
    tid: '',
    batch: '',
    cardType: '',
    transactions: [],
    grandTotal: {
      count: 0,
      debit: 0,
      credit: 0,
      net: 0,
    },
    settled: false,
    appName: '',
    raw: text,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    const originalLine = lines[i];

    // Store name (usually first line with letters)
    if (i < 3 && !result.storeName && /[A-Z]{3,}/.test(line) &&
        !line.includes('MID') && !line.includes('TID') && !line.includes('BATCH')) {
      result.storeName = originalLine;
      continue;
    }

    // Location (usually contains PORT, LOUIS, or location words)
    if (!result.location && (line.includes('PORT') || line.includes('LOUIS') ||
        line.includes('CITY') || line.includes('CENTRE'))) {
      result.location = originalLine;
    }

    // Date pattern: DD/MM/YY or DD-MM-YY or DD/MM/YYYY
    const dateMatch = originalLine.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
    if (dateMatch && !result.date) {
      result.date = dateMatch[1];
    }

    // Time pattern: HH:MM:SS or HH:MM
    const timeMatch = originalLine.match(/(\d{1,2}:\d{2}(:\d{2})?)\s*(AM|PM)?/i);
    if (timeMatch && !result.time && !line.includes('MID') && !line.includes('TID')) {
      result.time = timeMatch[1] + (timeMatch[3] ? ' ' + timeMatch[3] : '');
    }

    // MID (Merchant ID)
    if (line.includes('MID') || line.includes('M1D') || line.includes('M|D')) {
      const midMatch = originalLine.match(/M[I1|]D[:\s]*(\d+)/i);
      if (midMatch) {
        result.mid = midMatch[1];
      } else {
        // Try to get number after MID text
        const numMatch = originalLine.match(/(\d{6,})/);
        if (numMatch) result.mid = numMatch[1];
      }
    }

    // TID (Terminal ID)
    if (line.includes('TID') || line.includes('T1D') || line.includes('T|D')) {
      const tidMatch = originalLine.match(/T[I1|]D[:\s]*(\d+)/i);
      if (tidMatch) {
        result.tid = tidMatch[1];
      } else {
        const numMatch = originalLine.match(/(\d{6,})/);
        if (numMatch && numMatch[1] !== result.mid) result.tid = numMatch[1];
      }
    }

    // Batch number
    if ((line.includes('BATCH') || line.includes('8ATCH')) && !line.includes('SETTLED')) {
      const batchMatch = originalLine.match(/[B8]ATCH[:\s#]*(\d+)/i);
      if (batchMatch) {
        result.batch = batchMatch[1];
      }
    }

    // Card type (MCB, VISA, MASTERCARD, AMEX, etc.)
    if (line.includes('MCB') || line.includes('VISA') || line.includes('MASTER') ||
        line.includes('AMEX') || line.includes('AMERICAN') || line.includes('CR FCY')) {
      if (!result.cardType || line.includes('GRAND')) {
        result.cardType = originalLine.replace(/NO BUSINESS/gi, '').trim();
      }
    }

    // Grand Total amounts - pattern: COUNT CURRENCY AMOUNT DR/CR
    // Look for patterns like: 0002 MUR 16850.00 DR
    const amountMatch = originalLine.match(/(\d{4})\s+(MUR|USD|EUR|GBP|RS)\s+([\d,]+\.?\d*)\s*(DR|CR)?/i);
    if (amountMatch) {
      const count = parseInt(amountMatch[1]);
      const amount = parseFloat(amountMatch[3].replace(/,/g, ''));
      const type = (amountMatch[4] || 'DR').toUpperCase();

      if (type === 'DR' && amount > result.grandTotal.debit) {
        result.grandTotal.debit = amount;
        result.grandTotal.count = count;
      } else if (type === 'CR') {
        result.grandTotal.credit = amount;
      }
    }

    // Alternative: Look for just amount with DR/CR
    const simpleMatch = originalLine.match(/([\d,]+\.?\d{2})\s*(DR|CR)/i);
    if (simpleMatch && (line.includes('TOTAL') || line.includes('GRAND'))) {
      const amount = parseFloat(simpleMatch[1].replace(/,/g, ''));
      const type = simpleMatch[2].toUpperCase();
      if (type === 'DR' && amount > result.grandTotal.debit) {
        result.grandTotal.debit = amount;
      } else if (type === 'CR') {
        result.grandTotal.credit = amount;
      }
    }

    // Look for standalone large amounts (likely totals)
    if (line.includes('GRAND') || line.includes('TOTAL') || line.includes('NET')) {
      const amountOnly = originalLine.match(/([\d,]+\.\d{2})/);
      if (amountOnly && !result.grandTotal.debit) {
        result.grandTotal.debit = parseFloat(amountOnly[1].replace(/,/g, ''));
      }
    }

    // Check for settled status
    if (line.includes('SETTLED') || line.includes('END OF REPORT') || line.includes('COMPLETE')) {
      result.settled = true;
    }

    // App name
    if (line.includes('APP NAME') || line.includes('APP:')) {
      const appMatch = originalLine.match(/APP\s*(NAME)?[:\s]*(.+)/i);
      if (appMatch) {
        result.appName = appMatch[2].trim();
      }
    }
  }

  // Calculate net
  result.grandTotal.net = result.grandTotal.debit - result.grandTotal.credit;

  // Try to extract count from total if not found
  if (result.grandTotal.count === 0 && result.grandTotal.debit > 0) {
    // Look for transaction count patterns
    const countMatch = text.match(/(\d{1,4})\s*(?:transactions?|trans|txn)/i);
    if (countMatch) {
      result.grandTotal.count = parseInt(countMatch[1]);
    }
  }

  return result;
};

// Extract text using OCR.space API (free tier)
export const extractTextFromImage = async (base64Image) => {
  try {
    // Create form data
    const formData = new FormData();
    formData.append('apikey', OCR_SPACE_API_KEY);
    formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // More accurate engine

    const response = await axios.post(OCR_SPACE_API_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });

    if (response.data && response.data.ParsedResults && response.data.ParsedResults.length > 0) {
      const parsedText = response.data.ParsedResults[0].ParsedText;
      if (parsedText) {
        console.log('OCR extracted text:', parsedText);
        return parsedText;
      }
    }

    // Check for errors
    if (response.data && response.data.ErrorMessage) {
      console.error('OCR Error:', response.data.ErrorMessage);
      throw new Error(response.data.ErrorMessage);
    }

    console.log('OCR response:', response.data);
    return null;
  } catch (error) {
    console.error('OCR Error:', error.message);
    // Return null instead of throwing to allow manual entry
    return null;
  }
};

// Alternative: Extract text using Google Cloud Vision API
export const extractTextWithGoogleVision = async (base64Image, apiKey) => {
  if (!apiKey) {
    throw new Error('Google Cloud Vision API key is required');
  }

  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      },
      { timeout: 30000 }
    );

    const textAnnotation = response.data.responses[0]?.fullTextAnnotation;
    if (textAnnotation) {
      return textAnnotation.text;
    }
    return null;
  } catch (error) {
    console.error('Google Vision OCR Error:', error.message);
    throw new Error('Failed to extract text from image');
  }
};

// Process image and extract batch report data
export const processReceiptImage = async (base64Image) => {
  try {
    // Try OCR.space first
    const text = await extractTextFromImage(base64Image);

    if (text) {
      const parsed = parseBatchReport(text);
      return {
        success: true,
        text,
        data: parsed,
      };
    }

    return {
      success: false,
      error: 'Could not extract text from image',
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
};

export default {
  extractTextFromImage,
  extractTextWithGoogleVision,
  parseBatchReport,
  processReceiptImage,
};
