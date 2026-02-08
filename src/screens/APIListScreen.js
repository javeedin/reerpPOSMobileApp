import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getInstance, getFusionBaseUrl } from '../services/api';

// API Documentation organized by Module and Page
const API_DOCUMENTATION = [
  {
    module: 'Login & Authentication',
    icon: 'key-outline',
    color: '#4CAF50',
    pages: [
      {
        page: 'Login Screen',
        apis: [
          {
            name: 'User Login',
            endpoint: '/LOGIN/user/',
            method: 'GET',
            params: 'username, password',
            description: 'Validate user credentials',
          },
        ],
      },
      {
        page: 'Menu Loading',
        apis: [
          {
            name: 'Get Menu Options',
            endpoint: '/APPMENU/MENU/{username}',
            method: 'GET',
            params: 'username (path)',
            description: 'Fetch user menu options',
          },
        ],
      },
    ],
  },
  {
    module: 'Sync Data',
    icon: 'sync-outline',
    color: '#2196F3',
    pages: [
      {
        page: 'Sync Customers',
        apis: [
          {
            name: 'All Customers',
            endpoint: '/ALLCUSTOMERS/ALL',
            method: 'GET',
            params: 'start_row, end_row',
            description: 'Fetch all customers with pagination',
          },
        ],
      },
      {
        page: 'Sync Items',
        apis: [
          {
            name: 'All Items',
            endpoint: '/ALLITEMS/ALL',
            method: 'GET',
            params: 'start_row, end_row',
            description: 'Fetch all items with pagination',
          },
        ],
      },
      {
        page: 'Sync Agents',
        apis: [
          {
            name: 'All Agents',
            endpoint: '/ALLAGENTS/ALL',
            method: 'GET',
            params: 'start_row, end_row',
            description: 'Fetch all sales agents',
          },
        ],
      },
      {
        page: 'Sync Price Lists',
        apis: [
          {
            name: 'Price List Names',
            endpoint: '/SYNCPRICELIST/LIST',
            method: 'GET',
            params: 'SALESREP_NUMBER',
            description: 'Get price list names for user',
          },
          {
            name: 'Price List Items',
            endpoint: '/pricelist/onlypricelist',
            method: 'GET',
            params: 'p_list_name, p_start_row, p_end_row',
            description: 'Fetch price list items with pagination (10,000 per page)',
          },
        ],
      },
      {
        page: 'Sync BOGO Promotions',
        apis: [
          {
            name: 'BOGO Promotions',
            endpoint: '/ARMODULE/BOGO',
            method: 'GET',
            params: 'none',
            description: 'Fetch Buy-One-Get-One promotions',
          },
        ],
      },
      {
        page: 'Sync Payment Methods',
        apis: [
          {
            name: 'Payment Methods',
            endpoint: '/ARMODULE/PAYMENTMETHODS',
            method: 'GET',
            params: 'none',
            description: 'Fetch available payment methods',
          },
        ],
      },
      {
        page: 'Sync Onhand (Fusion)',
        apis: [
          {
            name: 'Inventory Onhand Balances',
            endpoint: '/inventoryOnhandBalances',
            method: 'GET',
            params: 'OrganizationCode, SubinventoryCode, limit, offset',
            description: 'Fusion Cloud API - Fetch inventory onhand balances',
            baseUrl: 'Fusion Cloud',
          },
          {
            name: 'Lot Details',
            endpoint: '/lots (dynamic href)',
            method: 'GET',
            params: 'from parent onhand item',
            description: 'Fusion Cloud API - Fetch lot details for item',
            baseUrl: 'Fusion Cloud',
          },
        ],
      },
    ],
  },
  {
    module: 'Orders',
    icon: 'cart-outline',
    color: '#FF9800',
    pages: [
      {
        page: 'Order History',
        apis: [
          {
            name: 'Query Historical Orders',
            endpoint: '/ORDERCRATION/QueryOrders',
            method: 'GET',
            params: 'source_order_number, from_date, to_date, salesrep_number, location_name',
            description: 'Query historical orders with filters',
          },
        ],
      },
    ],
  },
  {
    module: 'WMS (Warehouse Management)',
    icon: 'cube-outline',
    color: '#9C27B0',
    pages: [
      {
        page: 'WMS Home',
        apis: [
          {
            name: 'Shipments Summary',
            endpoint: '/WAREHOUSEMANAGEMENT/SHIPMENTSSUMMARYFORAPP',
            method: 'GET',
            params: 'pickerName, P_fromDate, P_todate, pickConfirmStatus',
            description: 'Fetch shipments summary for picker',
          },
        ],
      },
      {
        page: 'WMS Order Details',
        apis: [
          {
            name: 'Shipment Lines',
            endpoint: '/WAREHOUSEMANAGEMENT/SHIPMENTLINESFORAPP',
            method: 'GET',
            params: 'p_SOURCE_ORDER_NUMBER',
            description: 'Fetch shipment lines for an order',
          },
          {
            name: 'Confirm Pick',
            endpoint: '/WAREHOUSEMANAGEMENT/CONFIRMPICK',
            method: 'POST',
            params: 'delivery_detail_id, picked_qty, pick_confirm_status, picker_name, pick_confirm_date',
            description: 'Confirm pick for a shipment line',
          },
        ],
      },
      {
        page: 'WMS Picker Stats',
        apis: [
          {
            name: 'Picker Performance',
            endpoint: '/WAREHOUSEMANAGEMENT/PICKERPERFORMANCE',
            method: 'GET',
            params: 'pickerName, P_fromDate, P_todate, pickConfirmStatus',
            description: 'Fetch picker performance metrics',
          },
        ],
      },
      {
        page: 'WMS Lot Search (Fusion)',
        apis: [
          {
            name: 'Item Onhand',
            endpoint: '/inventoryOnhandBalances',
            method: 'GET',
            params: 'OrganizationCode, SubinventoryCode, ItemNumber',
            description: 'Fusion Cloud API - Search item onhand for lot lookup',
            baseUrl: 'Fusion Cloud',
          },
          {
            name: 'Item Lots',
            endpoint: '/lots (dynamic href)',
            method: 'GET',
            params: 'from parent onhand item',
            description: 'Fusion Cloud API - Fetch available lots',
            baseUrl: 'Fusion Cloud',
          },
        ],
      },
    ],
  },
  {
    module: 'Trip Management',
    icon: 'car-outline',
    color: '#1B5E20',
    pages: [
      {
        page: 'Trip Query',
        apis: [
          {
            name: 'Fetch Trips',
            endpoint: '/WAREHOUSEMANAGEMENT/appTripdetailsall',
            method: 'GET',
            params: 'from_date, to_date',
            description: 'Fetch all trips for date range',
          },
        ],
      },
      {
        page: 'Trip Order Details',
        apis: [
          {
            name: 'Order Line Details',
            endpoint: '/TRIPMANAGEMENT/trips/orders/getlotdetails/{orderNumber}',
            method: 'GET',
            params: 'orderNumber (path)',
            description: 'Fetch order line/lot details',
          },
        ],
      },
    ],
  },
  {
    module: 'Version Control',
    icon: 'cloud-download-outline',
    color: '#607D8B',
    pages: [
      {
        page: 'App Update Check',
        apis: [
          {
            name: 'Version Info',
            endpoint: '/version.json',
            method: 'GET',
            params: 'none',
            description: 'GitHub raw file - Check for app updates',
            baseUrl: 'GitHub',
          },
        ],
      },
    ],
  },
];

// Method color coding
const getMethodColor = (method) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#4CAF50';
    case 'POST':
      return '#2196F3';
    case 'PUT':
      return '#FF9800';
    case 'DELETE':
      return '#F44336';
    case 'PATCH':
      return '#9C27B0';
    default:
      return '#666666';
  }
};

// API Card Component
const APICard = ({ api }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.apiCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.apiHeader}>
        <View style={[styles.methodBadge, { backgroundColor: getMethodColor(api.method) }]}>
          <Text style={styles.methodText}>{api.method}</Text>
        </View>
        <View style={styles.apiNameContainer}>
          <Text style={styles.apiName}>{api.name}</Text>
          {api.baseUrl && (
            <View style={styles.baseUrlBadge}>
              <Text style={styles.baseUrlText}>{api.baseUrl}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#999999"
        />
      </View>

      <Text style={styles.apiEndpoint} numberOfLines={expanded ? undefined : 1}>
        {api.endpoint}
      </Text>

      {expanded && (
        <View style={styles.apiDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Parameters:</Text>
            <Text style={styles.detailValue}>{api.params}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description:</Text>
            <Text style={styles.detailValue}>{api.description}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Page Section Component
const PageSection = ({ page }) => {
  return (
    <View style={styles.pageSection}>
      <Text style={styles.pageName}>{page.page}</Text>
      {page.apis.map((api, index) => (
        <APICard key={index} api={api} />
      ))}
    </View>
  );
};

// Module Section Component
const ModuleSection = ({ module, isExpanded, onToggle }) => {
  return (
    <View style={styles.moduleSection}>
      <TouchableOpacity style={styles.moduleHeader} onPress={onToggle}>
        <View style={[styles.moduleIcon, { backgroundColor: module.color + '20' }]}>
          <Ionicons name={module.icon} size={22} color={module.color} />
        </View>
        <Text style={styles.moduleName}>{module.module}</Text>
        <View style={styles.moduleStats}>
          <Text style={styles.moduleStatsText}>
            {module.pages.reduce((sum, p) => sum + p.apis.length, 0)} APIs
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#666666"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.moduleContent}>
          {module.pages.map((page, index) => (
            <PageSection key={index} page={page} />
          ))}
        </View>
      )}
    </View>
  );
};

const APIListScreen = ({ navigation }) => {
  const [expandedModules, setExpandedModules] = useState({});
  const [currentInstance, setCurrentInstance] = useState('TEST');
  const [fusionUrl, setFusionUrl] = useState('');

  useEffect(() => {
    const loadInstance = async () => {
      const inst = await getInstance();
      setCurrentInstance(inst);
      setFusionUrl(getFusionBaseUrl(inst));
    };
    loadInstance();
  }, []);

  const toggleModule = (moduleName) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }));
  };

  // Count total APIs
  const totalAPIs = API_DOCUMENTATION.reduce(
    (sum, module) => sum + module.pages.reduce((pSum, p) => pSum + p.apis.length, 0),
    0
  );

  // Count by method
  const methodCounts = {};
  API_DOCUMENTATION.forEach(module => {
    module.pages.forEach(page => {
      page.apis.forEach(api => {
        methodCounts[api.method] = (methodCounts[api.method] || 0) + 1;
      });
    });
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      <LinearGradient colors={['#1A1A2E', '#16213E']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>API Documentation</Text>
            <Text style={styles.headerSubtitle}>
              {totalAPIs} APIs across {API_DOCUMENTATION.length} modules
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Method Summary */}
      <View style={styles.summaryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.entries(methodCounts).map(([method, count]) => (
            <View key={method} style={styles.summaryItem}>
              <View style={[styles.summaryBadge, { backgroundColor: getMethodColor(method) }]}>
                <Text style={styles.summaryMethod}>{method}</Text>
              </View>
              <Text style={styles.summaryCount}>{count}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {API_DOCUMENTATION.map((module, index) => (
          <ModuleSection
            key={index}
            module={module}
            isExpanded={expandedModules[module.module]}
            onToggle={() => toggleModule(module.module)}
          />
        ))}

        {/* Base URLs Reference */}
        <View style={styles.baseUrlsSection}>
          <Text style={styles.baseUrlsTitle}>Base URLs</Text>
          <View style={styles.baseUrlRow}>
            <Text style={styles.baseUrlLabel}>Instance:</Text>
            <View style={styles.instanceBadgeRow}>
              <View style={[styles.instanceBadge, { backgroundColor: currentInstance === 'PROD' ? '#4CAF50' : '#FF9800' }]}>
                <Text style={styles.instanceBadgeText}>{currentInstance}</Text>
              </View>
            </View>
          </View>
          <View style={styles.baseUrlRow}>
            <Text style={styles.baseUrlLabel}>ORDS / Apex (Oracle REST):</Text>
            <Text style={styles.baseUrlValue} numberOfLines={2}>
              https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP
            </Text>
          </View>
          <View style={styles.baseUrlRow}>
            <Text style={styles.baseUrlLabel}>Fusion Cloud ({currentInstance}):</Text>
            <Text style={styles.baseUrlValue} numberOfLines={2}>
              {fusionUrl || 'Loading...'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  summaryMethod: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  moduleSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moduleName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  moduleStats: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  moduleStatsText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666666',
  },
  moduleContent: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 16,
  },
  pageSection: {
    marginBottom: 16,
  },
  pageName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    paddingLeft: 4,
  },
  apiCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  apiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  methodText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  apiNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  apiName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  baseUrlBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  baseUrlText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#2196F3',
  },
  apiEndpoint: {
    fontSize: 11,
    color: '#666666',
    marginTop: 6,
    fontFamily: 'monospace',
    backgroundColor: '#EEEEEE',
    padding: 6,
    borderRadius: 4,
  },
  apiDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  detailRow: {
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 12,
    color: '#1A1A1A',
  },
  baseUrlsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  baseUrlsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  baseUrlRow: {
    marginBottom: 12,
  },
  baseUrlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  baseUrlValue: {
    fontSize: 11,
    color: '#2196F3',
    fontFamily: 'monospace',
  },
  instanceBadgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  instanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  instanceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default APIListScreen;
