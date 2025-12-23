import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import colors from '../theme/colors';
import { parseBatchReport, extractTextFromImage } from '../services/ocrService';

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

const ScanScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  // Camera controls
  const [flashMode, setFlashMode] = useState('off');
  const [focusPoint, setFocusPoint] = useState({ x: 0, y: 0 });
  const [showFocusIndicator, setShowFocusIndicator] = useState(false);
  const focusTimeoutRef = useRef(null);

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

  const processImage = async (uri, base64) => {
    setProcessing(true);
    setExtractedData(null);
    setRawText('');

    try {
      // Try OCR extraction
      console.log('Starting OCR extraction...');
      const text = await extractTextFromImage(base64);
      console.log('OCR result:', text ? 'Text extracted' : 'No text');

      if (text) {
        setRawText(text);
        const parsed = parseBatchReport(text);
        setExtractedData(parsed);

        // Show success message with extracted info
        const foundFields = [];
        if (parsed.date) foundFields.push('Date');
        if (parsed.mid) foundFields.push('MID');
        if (parsed.tid) foundFields.push('TID');
        if (parsed.batch) foundFields.push('Batch');
        if (parsed.grandTotal.debit > 0) foundFields.push('Amount');

        Alert.alert(
          'OCR Complete',
          foundFields.length > 0
            ? `Extracted: ${foundFields.join(', ')}\n\nPlease verify the details below.`
            : 'Text extracted but could not identify fields. Please enter details manually.',
          [{ text: 'OK' }]
        );

        // Populate editable fields
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
        // No OCR available - manual entry mode
        Alert.alert(
          'Manual Entry',
          'OCR is not configured. Please enter the batch report details manually.',
          [{ text: 'OK' }]
        );
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

            {/* Raw Text Toggle */}
            {rawText && (
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
                  {showRawText ? 'Hide' : 'Show'} Extracted Text
                </Text>
              </TouchableOpacity>
            )}

            {showRawText && rawText && (
              <View style={styles.rawTextCard}>
                <Text style={styles.rawText}>{rawText}</Text>
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
});

export default ScanScreen;
