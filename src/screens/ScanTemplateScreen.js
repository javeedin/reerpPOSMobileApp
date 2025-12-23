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
  Dimensions,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { FIELD_TYPES, saveTemplate, updateTemplate } from '../services/templateService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_PADDING = 16;
const IMAGE_WIDTH = SCREEN_WIDTH - (IMAGE_PADDING * 2);

const ScanTemplateScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { imageUri, existingTemplate } = route.params || {};

  const [templateName, setTemplateName] = useState(existingTemplate?.name || '');
  const [regions, setRegions] = useState(existingTemplate?.regions || []);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [selectedFieldType, setSelectedFieldType] = useState(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);

  const imageRef = useRef(null);

  // Calculate image dimensions maintaining aspect ratio
  const [imageDimensions, setImageDimensions] = useState({ width: IMAGE_WIDTH, height: 300 });

  useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (width, height) => {
        const aspectRatio = width / height;
        const displayWidth = IMAGE_WIDTH;
        const displayHeight = displayWidth / aspectRatio;
        setImageDimensions({ width: displayWidth, height: displayHeight });
      }, (error) => {
        console.error('Error getting image size:', error);
      });
    }
  }, [imageUri]);

  // Pan responder for drawing regions
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setIsDrawing(true);
        setDrawStart({ x: locationX, y: locationY });
        setCurrentRegion({
          x: locationX,
          y: locationY,
          width: 0,
          height: 0,
        });
      },
      onPanResponderMove: (evt) => {
        if (drawStart) {
          const { locationX, locationY } = evt.nativeEvent;
          const x = Math.min(drawStart.x, locationX);
          const y = Math.min(drawStart.y, locationY);
          const width = Math.abs(locationX - drawStart.x);
          const height = Math.abs(locationY - drawStart.y);
          setCurrentRegion({ x, y, width, height });
        }
      },
      onPanResponderRelease: () => {
        setIsDrawing(false);
        if (currentRegion && currentRegion.width > 20 && currentRegion.height > 10) {
          // Show field type picker
          setShowFieldPicker(true);
        } else {
          setCurrentRegion(null);
        }
        setDrawStart(null);
      },
    })
  ).current;

  const handleSelectFieldType = (fieldType) => {
    if (currentRegion) {
      // Convert pixel coordinates to percentages for template portability
      const regionPercent = {
        x: (currentRegion.x / imageDimensions.width) * 100,
        y: (currentRegion.y / imageDimensions.height) * 100,
        width: (currentRegion.width / imageDimensions.width) * 100,
        height: (currentRegion.height / imageDimensions.height) * 100,
        fieldType: fieldType.id,
        fieldLabel: fieldType.label,
        fieldColor: fieldType.color,
      };

      // Remove existing region with same field type
      const filteredRegions = regions.filter(r => r.fieldType !== fieldType.id);
      setRegions([...filteredRegions, regionPercent]);
    }
    setCurrentRegion(null);
    setShowFieldPicker(false);
  };

  const handleDeleteRegion = (fieldType) => {
    setRegions(regions.filter(r => r.fieldType !== fieldType));
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Template Name Required', 'Please enter a name for this template');
      return;
    }

    if (regions.length === 0) {
      Alert.alert('No Regions Defined', 'Please draw at least one region on the image');
      return;
    }

    try {
      const templateData = {
        name: templateName.trim(),
        regions,
        imageWidth: imageDimensions.width,
        imageHeight: imageDimensions.height,
      };

      if (existingTemplate?.id) {
        await updateTemplate(existingTemplate.id, templateData);
        Alert.alert('Success', 'Template updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        await saveTemplate(templateData);
        Alert.alert('Success', 'Template saved successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save template');
    }
  };

  // Convert percentage back to pixels for display
  const getPixelRegion = (region) => ({
    x: (region.x / 100) * imageDimensions.width,
    y: (region.y / 100) * imageDimensions.height,
    width: (region.width / 100) * imageDimensions.width,
    height: (region.height / 100) * imageDimensions.height,
  });

  const getUsedFieldTypes = () => regions.map(r => r.fieldType);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existingTemplate ? 'Edit Template' : 'Create Template'}
        </Text>
        <TouchableOpacity onPress={handleSaveTemplate} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Template Name */}
        <View style={styles.nameSection}>
          <Text style={styles.label}>Template Name</Text>
          <TextInput
            style={styles.nameInput}
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="e.g., MCB POS Terminal"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Ionicons name="finger-print" size={24} color={colors.accent} />
          <View style={styles.instructionText}>
            <Text style={styles.instructionTitle}>Draw Regions</Text>
            <Text style={styles.instructionDesc}>
              Draw a rectangle around each field you want to extract (date, amount, etc.)
            </Text>
          </View>
        </View>

        {/* Image with Regions */}
        <View style={styles.imageContainer}>
          <View
            style={[styles.imageWrapper, { height: imageDimensions.height }]}
            {...panResponder.panHandlers}
          >
            <Image
              ref={imageRef}
              source={{ uri: imageUri }}
              style={[styles.templateImage, { height: imageDimensions.height }]}
              resizeMode="contain"
            />

            {/* Existing Regions */}
            {regions.map((region, index) => {
              const pixelRegion = getPixelRegion(region);
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.regionBox,
                    {
                      left: pixelRegion.x,
                      top: pixelRegion.y,
                      width: pixelRegion.width,
                      height: pixelRegion.height,
                      borderColor: region.fieldColor,
                      backgroundColor: region.fieldColor + '30',
                    },
                  ]}
                  onLongPress={() => handleDeleteRegion(region.fieldType)}
                >
                  <Text style={[styles.regionLabel, { backgroundColor: region.fieldColor }]}>
                    {region.fieldLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Current Drawing Region */}
            {currentRegion && currentRegion.width > 0 && (
              <View
                style={[
                  styles.regionBox,
                  styles.drawingRegion,
                  {
                    left: currentRegion.x,
                    top: currentRegion.y,
                    width: currentRegion.width,
                    height: currentRegion.height,
                  },
                ]}
              />
            )}
          </View>
        </View>

        {/* Mapped Fields Summary */}
        <View style={styles.mappedFieldsCard}>
          <Text style={styles.mappedFieldsTitle}>Mapped Fields</Text>
          {regions.length === 0 ? (
            <Text style={styles.noFieldsText}>
              No fields mapped yet. Draw on the image above.
            </Text>
          ) : (
            <View style={styles.fieldsList}>
              {regions.map((region, index) => (
                <View key={index} style={styles.fieldItem}>
                  <View style={[styles.fieldDot, { backgroundColor: region.fieldColor }]} />
                  <Text style={styles.fieldName}>{region.fieldLabel}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteRegion(region.fieldType)}
                    style={styles.deleteFieldBtn}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Available Fields Reference */}
        <View style={styles.availableFieldsCard}>
          <Text style={styles.availableFieldsTitle}>Available Fields</Text>
          <View style={styles.availableFieldsList}>
            {FIELD_TYPES.map((field) => {
              const isUsed = getUsedFieldTypes().includes(field.id);
              return (
                <View
                  key={field.id}
                  style={[
                    styles.availableFieldItem,
                    isUsed && styles.availableFieldItemUsed,
                  ]}
                >
                  <View style={[styles.fieldDot, { backgroundColor: field.color }]} />
                  <Text style={[
                    styles.availableFieldName,
                    isUsed && styles.availableFieldNameUsed,
                  ]}>
                    {field.label}
                  </Text>
                  {isUsed && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.accentGreen} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Field Type Picker Modal */}
      <Modal
        visible={showFieldPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowFieldPicker(false);
          setCurrentRegion(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Field Type</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFieldPicker(false);
                  setCurrentRegion(null);
                }}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.fieldTypeList}>
              {FIELD_TYPES.map((field) => {
                const isUsed = getUsedFieldTypes().includes(field.id);
                return (
                  <TouchableOpacity
                    key={field.id}
                    style={[
                      styles.fieldTypeItem,
                      isUsed && styles.fieldTypeItemUsed,
                    ]}
                    onPress={() => handleSelectFieldType(field)}
                  >
                    <View style={[styles.fieldTypeColor, { backgroundColor: field.color }]} />
                    <Text style={styles.fieldTypeLabel}>{field.label}</Text>
                    {isUsed && (
                      <Text style={styles.fieldTypeReplace}>Replace</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: IMAGE_PADDING,
  },
  nameSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  instructionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  imageContainer: {
    marginBottom: 16,
  },
  imageWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  templateImage: {
    width: '100%',
  },
  regionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  drawingRegion: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderStyle: 'dashed',
  },
  regionLabel: {
    position: 'absolute',
    top: -20,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  mappedFieldsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  mappedFieldsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  noFieldsText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  fieldsList: {
    gap: 8,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  fieldDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  fieldName: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  deleteFieldBtn: {
    padding: 4,
  },
  availableFieldsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  availableFieldsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  availableFieldsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availableFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 6,
  },
  availableFieldItemUsed: {
    backgroundColor: colors.accentGreen + '20',
  },
  availableFieldName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  availableFieldNameUsed: {
    color: colors.accentGreen,
    fontWeight: '500',
  },
  // Modal Styles
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
  fieldTypeList: {
    padding: 16,
  },
  fieldTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  fieldTypeItemUsed: {
    backgroundColor: colors.warning + '15',
  },
  fieldTypeColor: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  fieldTypeLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  fieldTypeReplace: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '500',
  },
});

export default ScanTemplateScreen;
