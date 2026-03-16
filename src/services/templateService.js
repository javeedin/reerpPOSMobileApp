import AsyncStorage from '@react-native-async-storage/async-storage';

const TEMPLATES_KEY = '@ocr_templates';

// Available field types for mapping
export const FIELD_TYPES = [
  { id: 'date', label: 'Date', color: '#4CAF50' },
  { id: 'time', label: 'Time', color: '#2196F3' },
  { id: 'mid', label: 'MID', color: '#9C27B0' },
  { id: 'tid', label: 'TID', color: '#FF9800' },
  { id: 'batch', label: 'Batch #', color: '#E91E63' },
  { id: 'totalDebit', label: 'Total Debit', color: '#F44336' },
  { id: 'totalCredit', label: 'Total Credit', color: '#00BCD4' },
  { id: 'totalCount', label: 'Trans Count', color: '#795548' },
  { id: 'storeName', label: 'Store Name', color: '#607D8B' },
  { id: 'cardType', label: 'Card Type', color: '#3F51B5' },
];

// Get all saved templates
export const getTemplates = async () => {
  try {
    const data = await AsyncStorage.getItem(TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
};

// Save a new template
export const saveTemplate = async (template) => {
  try {
    const templates = await getTemplates();
    const newTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    templates.push(newTemplate);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    return newTemplate;
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
};

// Update an existing template
export const updateTemplate = async (templateId, updates) => {
  try {
    const templates = await getTemplates();
    const index = templates.findIndex(t => t.id === templateId);
    if (index !== -1) {
      templates[index] = { ...templates[index], ...updates, updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
      return templates[index];
    }
    throw new Error('Template not found');
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
};

// Delete a template
export const deleteTemplate = async (templateId) => {
  try {
    const templates = await getTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

// Get template by ID
export const getTemplateById = async (templateId) => {
  try {
    const templates = await getTemplates();
    return templates.find(t => t.id === templateId) || null;
  } catch (error) {
    console.error('Error getting template:', error);
    return null;
  }
};

// Set default template
export const setDefaultTemplate = async (templateId) => {
  try {
    await AsyncStorage.setItem('@default_ocr_template', templateId);
  } catch (error) {
    console.error('Error setting default template:', error);
  }
};

// Get default template
export const getDefaultTemplate = async () => {
  try {
    const templateId = await AsyncStorage.getItem('@default_ocr_template');
    if (templateId) {
      return await getTemplateById(templateId);
    }
    return null;
  } catch (error) {
    console.error('Error getting default template:', error);
    return null;
  }
};

export default {
  FIELD_TYPES,
  getTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateById,
  setDefaultTemplate,
  getDefaultTemplate,
};
