import axios from 'axios';

// OCR Service for extracting text from images
// Uses Google Cloud Vision API - you'll need to set up your own API key

const GOOGLE_VISION_API_KEY = ''; // Set your API key here or in environment

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

    // Store name (usually first line)
    if (i === 0 && !line.includes('MID') && !line.includes('TID')) {
      result.storeName = originalLine;
    }

    // Location (usually second line)
    if (i === 1 && !line.includes('MID') && !line.includes('TID')) {
      result.location = originalLine;
    }

    // Date pattern: DD/MM/YY or DD-MM-YY or DD/MM/YYYY
    const dateMatch = originalLine.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch && !result.date) {
      result.date = dateMatch[1];
    }

    // Time pattern: HH:MM:SS or HH:MM
    const timeMatch = originalLine.match(/(\d{1,2}:\d{2}(:\d{2})?)/);
    if (timeMatch && !result.time && !line.includes('MID') && !line.includes('TID')) {
      result.time = timeMatch[1];
    }

    // MID (Merchant ID)
    if (line.includes('MID')) {
      const midMatch = originalLine.match(/MID[:\s]*(\d+)/i);
      if (midMatch) {
        result.mid = midMatch[1];
      }
    }

    // TID (Terminal ID)
    if (line.includes('TID')) {
      const tidMatch = originalLine.match(/TID[:\s]*(\d+)/i);
      if (tidMatch) {
        result.tid = tidMatch[1];
      }
    }

    // Batch number
    if (line.includes('BATCH') && !line.includes('SETTLED')) {
      const batchMatch = originalLine.match(/BATCH[:\s]*(\d+)/i);
      if (batchMatch) {
        result.batch = batchMatch[1];
      }
    }

    // Card type (MCB, VISA, MASTERCARD, AMEX, etc.)
    if (line.includes('MCB') || line.includes('VISA') || line.includes('MASTER') ||
        line.includes('AMEX') || line.includes('AMERICAN')) {
      if (!result.cardType) {
        result.cardType = originalLine;
      }
    }

    // Grand Total amounts - pattern: COUNT CURRENCY AMOUNT DR/CR
    const amountMatch = originalLine.match(/(\d{4})\s+(MUR|USD|EUR|GBP)\s+([\d,]+\.?\d*)\s*(DR|CR)?/i);
    if (amountMatch && line.includes('GRAND') || (i > 0 && lines[i-1]?.toUpperCase().includes('GRAND'))) {
      const count = parseInt(amountMatch[1]);
      const amount = parseFloat(amountMatch[3].replace(',', ''));
      const type = amountMatch[4]?.toUpperCase();

      if (type === 'DR') {
        result.grandTotal.debit = amount;
        result.grandTotal.count = count;
      } else if (type === 'CR') {
        result.grandTotal.credit = amount;
      }
    }

    // Alternative amount pattern without count
    const simpleAmountMatch = originalLine.match(/(MUR|USD|EUR|GBP)\s+([\d,]+\.?\d*)\s*(DR|CR)/i);
    if (simpleAmountMatch && line.includes('TOTAL')) {
      const amount = parseFloat(simpleAmountMatch[2].replace(',', ''));
      const type = simpleAmountMatch[3].toUpperCase();

      if (type === 'DR') {
        result.grandTotal.debit = amount;
      } else if (type === 'CR') {
        result.grandTotal.credit = amount;
      }
    }

    // Check for settled status
    if (line.includes('SETTLED') || line.includes('END OF REPORT')) {
      result.settled = true;
    }

    // App name
    if (line.includes('APP NAME')) {
      const appMatch = originalLine.match(/APP NAME[:\s]*(.+)/i);
      if (appMatch) {
        result.appName = appMatch[1].trim();
      }
    }
  }

  // Calculate net
  result.grandTotal.net = result.grandTotal.debit - result.grandTotal.credit;

  return result;
};

// Extract text using Google Cloud Vision API
export const extractTextFromImage = async (base64Image) => {
  if (!GOOGLE_VISION_API_KEY) {
    // If no API key, return a simulated result for testing
    console.log('No Google Vision API key configured - using manual mode');
    return null;
  }

  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
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
      }
    );

    const textAnnotation = response.data.responses[0]?.fullTextAnnotation;
    if (textAnnotation) {
      return textAnnotation.text;
    }
    return null;
  } catch (error) {
    console.error('OCR Error:', error.message);
    throw new Error('Failed to extract text from image');
  }
};

// Manual text extraction patterns for batch reports
export const extractBatchDataManually = (imageUri) => {
  // This returns a template that the user can fill in
  return {
    storeName: '',
    location: '',
    date: '',
    time: '',
    mid: '',
    tid: '',
    batch: '',
    cardType: '',
    grandTotal: {
      count: 0,
      debit: 0,
      credit: 0,
      net: 0,
    },
    settled: false,
    imageUri,
  };
};

export default {
  extractTextFromImage,
  parseBatchReport,
  extractBatchDataManually,
};
