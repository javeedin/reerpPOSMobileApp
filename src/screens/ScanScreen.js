import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Camera only available on native platforms
let CameraView = null;
let useCameraPermissions = null;
if (Platform.OS !== 'web') {
  const cameraModule = require('expo-camera');
  CameraView = cameraModule.CameraView;
  useCameraPermissions = cameraModule.useCameraPermissions;
}
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../theme/colors';
import { parseBatchReport, extractTextFromImage } from '../services/ocrService';
import { getTemplates, getDefaultTemplate, setDefaultTemplate, FIELD_TYPES } from '../services/templateService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Focus Indicator Component
const FocusIndicator = ({ x, y, visible }) => {
  const scaleAnim = useRef(new Animated.Value(1.5)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(1.5);
      opacityAnim.setValue(1);

      // Animate focus indicator
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible, x, y]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.focusIndicator,
        {
          left: x - 35,
          top: y - 35,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.focusCorner1} />
      <View style={styles.focusCorner2} />
      <View style={styles.focusCorner3} />
      <View style={styles.focusCorner4} />
    </Animated.View>
  );
};

// Editable Field Component
const EditableField = ({ label, value, onChangeText, keyboardType = 'default', placeholder }) => (
  <View style={styles.fieldRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.fieldInput}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
    />
  </View>
);

// Web fallback hook for camera permissions
const useWebCameraPermissions = () => [{ granted: false }, () => Promise.resolve({ granted: false })];

const ScanScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  // Use actual camera permissions on native, fallback on web
  const [permission, requestPermission] = Platform.OS === 'web'
    ? useWebCameraPermissions()
    : useCameraPermissions();

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedImageUri, setCapturedImageUri] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  // Template state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Text mapping state
  const [showTextMapper, setShowTextMapper] = useState(false);
  const [selectedTextLine, setSelectedTextLine] = useState(null);
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  // Field types for mapping
  const MAPPABLE_FIELDS = [
    { id: 'date', label: 'Date', icon: 'calendar' },
    { id: 'time', label: 'Time', icon: 'time' },
    { id: 'mid', label: 'MID (Merchant ID)', icon: 'business' },
    { id: 'tid', label: 'TID (Terminal ID)', icon: 'hardware-chip' },
    { id: 'batch', label: 'Batch Number', icon: 'layers' },
    { id: 'totalDebit', label: 'Total Debit (DR)', icon: 'arrow-up-circle' },
    { id: 'totalCredit', label: 'Total Credit (CR)', icon: 'arrow-down-circle' },
    { id: 'totalCount', label: 'Transaction Count', icon: 'calculator' },
    { id: 'storeName', label: 'Store Name', icon: 'storefront' },
    { id: 'cardType', label: 'Card Type', icon: 'card' },
  ];

  // Camera controls
  const [flashMode, setFlashMode] = useState('off');
  const [focusPoint, setFocusPoint] = useState({ x: 0, y: 0 });
  const [showFocusIndicator, setShowFocusIndicator] = useState(false);
  const focusTimeoutRef = useRef(null);

  // Load templates on screen focus
  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [])
  );

  const loadTemplates = async () => {
    const loadedTemplates = await getTemplates();
    setTemplates(loadedTemplates);

    // Load default template
    const defaultTemplate = await getDefaultTemplate();
    if (defaultTemplate) {
      setSelectedTemplate(defaultTemplate);
    } else if (loadedTemplates.length > 0) {
      setSelectedTemplate(loadedTemplates[0]);
    }
  };

  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    await setDefaultTemplate(template.id);
    setShowTemplatePicker(false);
  };

  // Batch report fields for manual entry/editing
  const [batchData, setBatchData] = useState({
    storeName: '',
    location: '',
    date: '',
    time: '',
    mid: '',
    tid: '',
    batch: '',
    cardType: '',
    totalCount: '',
    totalDebit: '',
    totalCredit: '',
    settled: false,
  });

  // Handle tap to focus
  const handleTapToFocus = (event) => {
    const { locationX, locationY } = event.nativeEvent;

    // Set focus point
    setFocusPoint({ x: locationX, y: locationY });
    setShowFocusIndicator(true);

    // Clear previous timeout
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Hide focus indicator after animation
    focusTimeoutRef.current = setTimeout(() => {
      setShowFocusIndicator(false);
    }, 1000);
  };

  // Toggle flash
  const toggleFlash = () => {
    setFlashMode(current => current === 'off' ? 'on' : 'off');
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan receipts');
        return;
      }
    }
    setShowCamera(true);
  };

  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        setCapturedImage(photo.uri);
        setShowCamera(false);
        processImage(photo.uri, photo.base64);
      } catch (error) {
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCapturedImage(asset.uri);
      processImage(asset.uri, asset.base64);
    }
  };

  // Compress image to fit within OCR.space 1MB limit
  const compressImage = async (uri) => {
    try {
      // First, resize to a reasonable max dimension (1200px max width/height)
      // Then compress with lower quality for smaller file size
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Resize to max 1200px width
        {
          compress: 0.6, // 60% quality
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      // Check size (base64 is ~33% larger than binary)
      const base64Size = manipulated.base64.length * 0.75; // Approximate binary size
      console.log(`Compressed image size: ${(base64Size / 1024).toFixed(0)} KB`);

      // If still too large, compress more
      if (base64Size > 900000) { // 900KB to leave some margin
        console.log('Image still too large, compressing further...');
        const furtherCompressed = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 800 } }], // Smaller resize
          {
            compress: 0.4, // Lower quality
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );
        return furtherCompressed.base64;
      }

      return manipulated.base64;
    } catch (error) {
      console.error('Image compression error:', error);
      return null;
    }
  };

  // Extract text from a specific region of the image using template
  const extractRegionText = async (uri, region, imageWidth, imageHeight) => {
    try {
      // Convert percentage to pixel coordinates
      const originX = Math.round((region.x / 100) * imageWidth);
      const originY = Math.round((region.y / 100) * imageHeight);
      const width = Math.round((region.width / 100) * imageWidth);
      const height = Math.round((region.height / 100) * imageHeight);

      // Crop the specific region
      const cropped = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Extract text from cropped region
      const text = await extractTextFromImage(cropped.base64);
      return text?.trim() || '';
    } catch (error) {
      console.error(`Error extracting region ${region.fieldType}:`, error);
      return '';
    }
  };

  // Process image using template regions
  const processWithTemplate = async (uri, template) => {
    console.log('Processing with template:', template.name);

    // Get image dimensions
    return new Promise((resolve) => {
      Image.getSize(uri, async (imageWidth, imageHeight) => {
        const extractedFields = {};
        let allText = '';

        for (const region of template.regions) {
          console.log(`Extracting ${region.fieldLabel}...`);
          const text = await extractRegionText(uri, region, imageWidth, imageHeight);
          extractedFields[region.fieldType] = text;
          allText += `${region.fieldLabel}: ${text}\n`;
        }

        resolve({ extractedFields, allText });
      }, () => resolve({ extractedFields: {}, allText: '' }));
    });
  };

  const processImage = async (uri, base64) => {
    setProcessing(true);
    setExtractedData(null);
    setRawText('');
    setCapturedImageUri(uri);

    try {
      let extractedFields = {};
      let allText = '';

      // Check if we have a template selected
      if (selectedTemplate && selectedTemplate.regions?.length > 0) {
        // Use template-based extraction
        const result = await processWithTemplate(uri, selectedTemplate);
        extractedFields = result.extractedFields;
        allText = result.allText;
        setRawText(allText);

        // Populate batch data from template fields
        setBatchData({
          storeName: extractedFields.storeName || '',
          location: '',
          date: extractedFields.date || '',
          time: extractedFields.time || '',
          mid: extractedFields.mid || '',
          tid: extractedFields.tid || '',
          batch: extractedFields.batch || '',
          cardType: extractedFields.cardType || '',
          totalCount: extractedFields.totalCount || '',
          totalDebit: extractedFields.totalDebit || '',
          totalCredit: extractedFields.totalCredit || '',
          settled: false,
        });

        const foundFields = Object.entries(extractedFields)
          .filter(([_, v]) => v)
          .map(([k]) => FIELD_TYPES.find(f => f.id === k)?.label || k);

        Alert.alert(
          'Template Extraction Complete',
          foundFields.length > 0
            ? `Extracted: ${foundFields.join(', ')}\n\nPlease verify the details below.`
            : 'Could not extract fields. Try adjusting template regions.',
          [{ text: 'OK' }]
        );
      } else {
        // Fall back to full image OCR
        console.log('Compressing image for OCR...');
        const compressedBase64 = await compressImage(uri);

        if (!compressedBase64) {
          throw new Error('Failed to compress image');
        }

        console.log('Starting OCR extraction...');
        const text = await extractTextFromImage(compressedBase64);
        console.log('OCR result:', text ? 'Text extracted' : 'No text');

        if (text) {
          setRawText(text);
          const parsed = parseBatchReport(text);
          setExtractedData(parsed);

          const foundFields = [];
          if (parsed.date) foundFields.push('Date');
          if (parsed.mid) foundFields.push('MID');
          if (parsed.tid) foundFields.push('TID');
          if (parsed.batch) foundFields.push('Batch');
          if (parsed.grandTotal.debit > 0) foundFields.push('Amount');

          Alert.alert(
            'OCR Complete',
            foundFields.length > 0
              ? `Extracted: ${foundFields.join(', ')}\n\nPlease verify the details below.\n\nTip: Create a template for better accuracy!`
              : 'Text extracted but could not identify fields. Create a template for better results.',
            [{ text: 'OK' }]
          );

          setBatchData({
            storeName: parsed.storeName || '',
            location: parsed.location || '',
            date: parsed.date || '',
            time: parsed.time || '',
            mid: parsed.mid || '',
            tid: parsed.tid || '',
            batch: parsed.batch || '',
            cardType: parsed.cardType || '',
            totalCount: parsed.grandTotal.count?.toString() || '',
            totalDebit: parsed.grandTotal.debit?.toString() || '',
            totalCredit: parsed.grandTotal.credit?.toString() || '',
            settled: parsed.settled || false,
          });
        } else {
          Alert.alert(
            'Manual Entry',
            'Could not extract text. Create a template for better results or enter details manually.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      Alert.alert(
        'Processing Error',
        'Could not extract text automatically. Please enter details manually.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setBatchData(prev => ({ ...prev, [field]: value }));
  };

  // Parse raw text into lines for mapping
  const getTextLines = () => {
    if (!rawText) return [];
    return rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  // Get list of mapped fields with their values
  const getMappedFields = () => {
    return MAPPABLE_FIELDS
      .filter(field => batchData[field.id] && batchData[field.id].toString().trim() !== '')
      .map(field => ({
        ...field,
        value: batchData[field.id],
      }));
  };

  // Handle tapping on a text line to map it
  const handleTextLineTap = (line) => {
    setSelectedTextLine(line);
    setShowFieldSelector(true);
  };

  // Map selected text to a field
  const handleMapToField = (fieldId) => {
    if (selectedTextLine) {
      // Clean up the value - extract numbers for numeric fields
      let value = selectedTextLine;

      if (['totalDebit', 'totalCredit', 'totalCount'].includes(fieldId)) {
        // Extract numeric value
        const numMatch = value.match(/([\d,]+\.?\d*)/);
        if (numMatch) {
          value = numMatch[1].replace(/,/g, '');
        }
      } else if (fieldId === 'mid' || fieldId === 'tid' || fieldId === 'batch') {
        // Extract ID numbers
        const idMatch = value.match(/(\d+)/);
        if (idMatch) {
          value = idMatch[1];
        }
      } else if (fieldId === 'date') {
        // Try to extract date pattern
        const dateMatch = value.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
        if (dateMatch) {
          value = dateMatch[1];
        }
      } else if (fieldId === 'time') {
        // Try to extract time pattern
        const timeMatch = value.match(/(\d{1,2}[:\s]\d{2}(:\d{2})?)/);
        if (timeMatch) {
          value = timeMatch[1].replace(/\s/g, ':');
        }
      }

      setBatchData(prev => ({ ...prev, [fieldId]: value }));
    }
    setShowFieldSelector(false);
    setSelectedTextLine(null);
  };

  const handleSaveReport = () => {
    // Validate required fields
    if (!batchData.date || !batchData.totalDebit) {
      Alert.alert('Required Fields', 'Please enter at least Date and Total Debit amount');
      return;
    }

    const report = {
      ...batchData,
      totalCount: parseInt(batchData.totalCount) || 0,
      totalDebit: parseFloat(batchData.totalDebit) || 0,
      totalCredit: parseFloat(batchData.totalCredit) || 0,
      netAmount: (parseFloat(batchData.totalDebit) || 0) - (parseFloat(batchData.totalCredit) || 0),
      imageUri: capturedImage,
      scannedAt: new Date().toISOString(),
    };

    // Navigate to reconciliation screen with the report data
    navigation.navigate('BatchReconciliation', { batchReport: report });
  };

  const handleClear = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setRawText('');
    setBatchData({
      storeName: '',
      location: '',
      date: '',
      time: '',
      mid: '',
      tid: '',
      batch: '',
      cardType: '',
      totalCount: '',
      totalDebit: '',
      totalCredit: '',
      settled: false,
    });
  };

  // Camera View
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={flashMode}
          autofocus="on"
        >
          <TouchableWithoutFeedback onPress={handleTapToFocus}>
            <View style={styles.cameraOverlay}>
              {/* Focus Indicator */}
              <FocusIndicator
                x={focusPoint.x}
                y={focusPoint.y}
                visible={showFocusIndicator}
              />

              <View style={styles.cameraHeader}>
                <TouchableOpacity
                  onPress={() => setShowCamera(false)}
                  style={styles.cameraCloseBtn}
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.cameraTitle}>Scan Batch Report</Text>
                <TouchableOpacity
                  onPress={toggleFlash}
                  style={styles.flashBtn}
                >
                  <Ionicons
                    name={flashMode === 'on' ? 'flash' : 'flash-off'}
                    size={24}
                    color={flashMode === 'on' ? '#FFD700' : '#FFFFFF'}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>

              <View style={styles.cameraHintContainer}>
                <Text style={styles.cameraHint}>
                  Position the batch report within the frame
                </Text>
                <Text style={styles.cameraHintSecondary}>
                  Tap anywhere to focus • Flash: {flashMode === 'on' ? 'ON' : 'OFF'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.captureBtn}
                onPress={handleTakePhoto}
              >
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Batch Report</Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Template Selection */}
        {!capturedImage && (
          <View style={styles.templateSection}>
            <View style={styles.templateHeader}>
              <Text style={styles.templateLabel}>OCR Template</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ScanTemplate', { imageUri: null })}
                style={styles.manageTemplatesBtn}
              >
                <Ionicons name="settings-outline" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {templates.length === 0 ? (
              <TouchableOpacity
                style={styles.noTemplateCard}
                onPress={() => {
                  Alert.alert(
                    'Create Template',
                    'Take a photo first, then you can create a template from it.',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Ionicons name="grid-outline" size={24} color={colors.textMuted} />
                <Text style={styles.noTemplateText}>No templates yet</Text>
                <Text style={styles.noTemplateHint}>Scan an image first to create one</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.templateSelector}
                onPress={() => setShowTemplatePicker(true)}
              >
                <View style={styles.templateSelectorLeft}>
                  <View style={[styles.templateIcon, { backgroundColor: colors.accent + '20' }]}>
                    <Ionicons name="grid" size={20} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={styles.templateName}>
                      {selectedTemplate?.name || 'Select Template'}
                    </Text>
                    <Text style={styles.templateFields}>
                      {selectedTemplate?.regions?.length || 0} fields mapped
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Scan Options */}
        {!capturedImage && (
          <View style={styles.scanOptions}>
            <Text style={styles.scanTitle}>Capture Batch Report</Text>
            <Text style={styles.scanSubtitle}>
              Take a photo or select from gallery to extract settlement data
            </Text>

            <View style={styles.optionButtons}>
              <TouchableOpacity style={styles.optionBtn} onPress={handleOpenCamera}>
                <View style={[styles.optionIcon, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name="camera" size={32} color={colors.accent} />
                </View>
                <Text style={styles.optionLabel}>Camera</Text>
                <Text style={styles.optionHint}>Take a photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionBtn} onPress={handlePickImage}>
                <View style={[styles.optionIcon, { backgroundColor: colors.accentPurple + '20' }]}>
                  <Ionicons name="images" size={32} color={colors.accentPurple || '#9C27B0'} />
                </View>
                <Text style={styles.optionLabel}>Gallery</Text>
                <Text style={styles.optionHint}>Select image</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Processing Indicator */}
        {processing && (
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.processingText}>Processing image...</Text>
            <Text style={styles.processingHint}>Extracting text from batch report</Text>
          </View>
        )}

        {/* Captured Image Preview */}
        {capturedImage && !processing && (
          <>
            <View style={styles.imagePreview}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={handleClear}
              >
                <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </View>

            {/* Create/Edit Template Button */}
            <TouchableOpacity
              style={styles.createTemplateBtn}
              onPress={() => navigation.navigate('ScanTemplate', { imageUri: capturedImageUri || capturedImage })}
            >
              <Ionicons name="grid-outline" size={20} color={colors.accent} />
              <Text style={styles.createTemplateBtnText}>
                {templates.length === 0 ? 'Create Template from this Image' : 'Edit or Create Template'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </TouchableOpacity>

            {/* Text Mapping Section */}
            {rawText && (
              <View style={styles.textMappingSection}>
                {/* Mapped Fields Summary */}
                {getMappedFields().length > 0 && (
                  <View style={styles.mappedFieldsCard}>
                    <View style={styles.mappedFieldsHeader}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.accentGreen} />
                      <Text style={styles.mappedFieldsTitle}>
                        Mapped Fields ({getMappedFields().length})
                      </Text>
                    </View>
                    <View style={styles.mappedFieldsList}>
                      {getMappedFields().map((field) => (
                        <View key={field.id} style={styles.mappedFieldItem}>
                          <View style={styles.mappedFieldLeft}>
                            <Ionicons name={field.icon} size={16} color={colors.accent} />
                            <Text style={styles.mappedFieldLabel}>{field.label}:</Text>
                          </View>
                          <Text style={styles.mappedFieldValue} numberOfLines={1}>
                            {field.value}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleFieldChange(field.id, '')}
                            style={styles.mappedFieldClear}
                          >
                            <Ionicons name="close-circle" size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.textMappingHeader}>
                  <TouchableOpacity
                    style={styles.rawTextToggle}
                    onPress={() => setShowRawText(!showRawText)}
                  >
                    <Ionicons
                      name={showRawText ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.accent}
                    />
                    <Text style={styles.rawTextToggleText}>
                      {showRawText ? 'Hide' : 'Show'} Extracted Text ({getTextLines().length} lines)
                    </Text>
                  </TouchableOpacity>
                </View>

                {showRawText && (
                  <View style={styles.rawTextCard}>
                    <Text style={styles.mapInstructions}>
                      Tap on any line below to map it to a field:
                    </Text>
                    <View style={styles.textLinesContainer}>
                      {getTextLines().map((line, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.textLine}
                          onPress={() => handleTextLineTap(line)}
                        >
                          <Text style={styles.textLineText}>{line}</Text>
                          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Editable Fields */}
            <View style={styles.fieldsCard}>
              <Text style={styles.fieldsTitle}>Batch Report Details</Text>
              <Text style={styles.fieldsSubtitle}>
                Verify and edit the extracted information
              </Text>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldSectionTitle}>Terminal Info</Text>
                <EditableField
                  label="Store"
                  value={batchData.storeName}
                  onChangeText={(v) => handleFieldChange('storeName', v)}
                  placeholder="Store name"
                />
                <EditableField
                  label="Location"
                  value={batchData.location}
                  onChangeText={(v) => handleFieldChange('location', v)}
                  placeholder="Location"
                />
                <View style={styles.fieldRowDouble}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={batchData.date}
                      onChangeText={(v) => handleFieldChange('date', v)}
                      placeholder="DD/MM/YY"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Time</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={batchData.time}
                      onChangeText={(v) => handleFieldChange('time', v)}
                      placeholder="HH:MM:SS"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <View style={styles.fieldRowDouble}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>MID</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={batchData.mid}
                      onChangeText={(v) => handleFieldChange('mid', v)}
                      placeholder="Merchant ID"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>TID</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={batchData.tid}
                      onChangeText={(v) => handleFieldChange('tid', v)}
                      placeholder="Terminal ID"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.fieldRowDouble}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Batch #</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={batchData.batch}
                      onChangeText={(v) => handleFieldChange('batch', v)}
                      placeholder="Batch number"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Card Type</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={batchData.cardType}
                      onChangeText={(v) => handleFieldChange('cardType', v)}
                      placeholder="Card type"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldSectionTitle}>Settlement Totals</Text>
                <EditableField
                  label="Transaction Count"
                  value={batchData.totalCount}
                  onChangeText={(v) => handleFieldChange('totalCount', v)}
                  keyboardType="numeric"
                  placeholder="0"
                />
                <EditableField
                  label="Total Debit (DR)"
                  value={batchData.totalDebit}
                  onChangeText={(v) => handleFieldChange('totalDebit', v)}
                  keyboardType="numeric"
                  placeholder="0.00"
                />
                <EditableField
                  label="Total Credit (CR)"
                  value={batchData.totalCredit}
                  onChangeText={(v) => handleFieldChange('totalCredit', v)}
                  keyboardType="numeric"
                  placeholder="0.00"
                />

                {/* Net Amount Display */}
                <View style={styles.netAmountRow}>
                  <Text style={styles.netAmountLabel}>Net Amount</Text>
                  <Text style={styles.netAmountValue}>
                    MUR {((parseFloat(batchData.totalDebit) || 0) - (parseFloat(batchData.totalCredit) || 0)).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Settled Status */}
              <TouchableOpacity
                style={styles.settledToggle}
                onPress={() => handleFieldChange('settled', !batchData.settled)}
              >
                <View style={[styles.checkbox, batchData.settled && styles.checkboxChecked]}>
                  {batchData.settled && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.settledLabel}>Batch Settled</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Action Button */}
      {capturedImage && !processing && (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.reconcileBtn} onPress={handleSaveReport}>
            <Ionicons name="git-compare" size={22} color="#FFFFFF" />
            <Text style={styles.reconcileBtnText}>Reconcile with Orders</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Template Picker Modal */}
      <Modal
        visible={showTemplatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Template</Text>
              <TouchableOpacity onPress={() => setShowTemplatePicker(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.templateList}>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateItem,
                    selectedTemplate?.id === template.id && styles.templateItemSelected,
                  ]}
                  onPress={() => handleSelectTemplate(template)}
                >
                  <View style={styles.templateItemLeft}>
                    <View style={[styles.templateIcon, { backgroundColor: colors.accent + '20' }]}>
                      <Ionicons name="grid" size={20} color={colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.templateItemName}>{template.name}</Text>
                      <Text style={styles.templateItemFields}>
                        {template.regions?.length || 0} fields mapped
                      </Text>
                    </View>
                  </View>
                  {selectedTemplate?.id === template.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                  )}
                </TouchableOpacity>
              ))}

              {/* Option to scan without template */}
              <TouchableOpacity
                style={[
                  styles.templateItem,
                  !selectedTemplate && styles.templateItemSelected,
                ]}
                onPress={() => {
                  setSelectedTemplate(null);
                  setShowTemplatePicker(false);
                }}
              >
                <View style={styles.templateItemLeft}>
                  <View style={[styles.templateIcon, { backgroundColor: colors.textMuted + '20' }]}>
                    <Ionicons name="scan-outline" size={20} color={colors.textMuted} />
                  </View>
                  <View>
                    <Text style={styles.templateItemName}>No Template (Auto OCR)</Text>
                    <Text style={styles.templateItemFields}>
                      Uses automatic text parsing
                    </Text>
                  </View>
                </View>
                {!selectedTemplate && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Field Selector Modal for Text Mapping */}
      <Modal
        visible={showFieldSelector}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowFieldSelector(false);
          setSelectedTextLine(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.fieldSelectorContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Map to Field</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFieldSelector(false);
                  setSelectedTextLine(null);
                }}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Selected Text Preview */}
            <View style={styles.selectedTextPreview}>
              <Text style={styles.selectedTextLabel}>Selected text:</Text>
              <Text style={styles.selectedTextValue} numberOfLines={2}>
                {selectedTextLine}
              </Text>
            </View>

            <Text style={styles.fieldSelectorSubtitle}>Select a field to map this text to:</Text>

            <ScrollView style={styles.fieldSelectorList}>
              {MAPPABLE_FIELDS.map((field) => (
                <TouchableOpacity
                  key={field.id}
                  style={[
                    styles.fieldSelectorItem,
                    batchData[field.id] && styles.fieldSelectorItemFilled,
                  ]}
                  onPress={() => handleMapToField(field.id)}
                >
                  <Ionicons name={field.icon} size={22} color={colors.accent} />
                  <View style={styles.fieldSelectorItemText}>
                    <Text style={styles.fieldSelectorItemLabel}>{field.label}</Text>
                    {batchData[field.id] ? (
                      <Text style={styles.fieldSelectorItemValue} numberOfLines={1}>
                        Current: {batchData[field.id]}
                      </Text>
                    ) : (
                      <Text style={styles.fieldSelectorItemEmpty}>Not set</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clearButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Scan Options
  scanOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  scanTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  scanSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  optionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  optionHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Processing
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
  },
  processingHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  // Image Preview
  imagePreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'contain',
    backgroundColor: colors.surface,
  },
  retakeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  // Raw Text
  rawTextToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  rawTextToggleText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  rawTextCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  rawText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  // Fields
  fieldsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  fieldsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  fieldsSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  fieldSection: {
    marginBottom: 20,
  },
  fieldSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldRowDouble: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  netAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentGreen + '15',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  netAmountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  netAmountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  settledToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  settledLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  // Action Bar
  actionBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reconcileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  reconcileBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Camera Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 40,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  cameraCloseBtn: {
    padding: 8,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scanFrame: {
    width: SCREEN_WIDTH - 60,
    height: SCREEN_WIDTH - 60,
    alignSelf: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  cameraHintContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraHint: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.8,
  },
  cameraHintSecondary: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  flashBtn: {
    padding: 8,
  },
  // Focus Indicator
  focusIndicator: {
    position: 'absolute',
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusCorner1: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#FFD700',
  },
  focusCorner2: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#FFD700',
  },
  focusCorner3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 20,
    height: 20,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#FFD700',
  },
  focusCorner4: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#FFD700',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  // Template Styles
  templateSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  manageTemplatesBtn: {
    padding: 4,
  },
  noTemplateCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noTemplateText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 8,
  },
  noTemplateHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  templateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  templateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  templateFields: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  createTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  createTemplateBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent,
  },
  // Template Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  templateList: {
    padding: 16,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  templateItemSelected: {
    backgroundColor: colors.accent + '15',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  templateItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  templateItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  templateItemFields: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Text Mapping Styles
  textMappingSection: {
    marginBottom: 16,
  },
  // Mapped Fields Card
  mappedFieldsCard: {
    backgroundColor: colors.accentGreen + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.accentGreen + '30',
  },
  mappedFieldsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  mappedFieldsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentGreen,
  },
  mappedFieldsList: {
    gap: 6,
  },
  mappedFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  mappedFieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 120,
  },
  mappedFieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  mappedFieldValue: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginRight: 8,
  },
  mappedFieldClear: {
    padding: 2,
  },
  textMappingHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  mapInstructions: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  textLinesContainer: {
    gap: 6,
  },
  textLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textLineText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    marginRight: 8,
  },
  // Field Selector Modal
  fieldSelectorContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  selectedTextPreview: {
    backgroundColor: colors.accent + '15',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedTextLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  selectedTextValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  fieldSelectorSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  fieldSelectorList: {
    padding: 16,
    paddingTop: 8,
  },
  fieldSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  fieldSelectorItemFilled: {
    backgroundColor: colors.accentGreen + '15',
    borderWidth: 1,
    borderColor: colors.accentGreen + '30',
  },
  fieldSelectorItemText: {
    flex: 1,
  },
  fieldSelectorItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  fieldSelectorItemValue: {
    fontSize: 12,
    color: colors.accentGreen,
    marginTop: 2,
  },
  fieldSelectorItemEmpty: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default ScanScreen;
