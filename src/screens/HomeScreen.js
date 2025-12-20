import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2;

// Icon mapping based on menu item names
const getMenuIcon = (name) => {
  const lowerName = (name || '').toLowerCase();

  // Sales related
  if (lowerName.includes('sales') || lowerName.includes('sell')) return 'cart';
  if (lowerName.includes('order')) return 'receipt';
  if (lowerName.includes('pos') || lowerName.includes('point of sale')) return 'card';

  // Purchase related
  if (lowerName.includes('purchase') || lowerName.includes('buy')) return 'bag';
  if (lowerName.includes('vendor') || lowerName.includes('supplier')) return 'business';

  // Inventory related
  if (lowerName.includes('inventory') || lowerName.includes('stock')) return 'cube';
  if (lowerName.includes('warehouse')) return 'home';
  if (lowerName.includes('transfer')) return 'swap-horizontal';
  if (lowerName.includes('receiving') || lowerName.includes('receive')) return 'arrow-down-circle';
  if (lowerName.includes('shipping') || lowerName.includes('ship')) return 'airplane';
  if (lowerName.includes('cycle count') || lowerName.includes('count')) return 'sync';
  if (lowerName.includes('adjustment')) return 'create';

  // Customer related
  if (lowerName.includes('customer') || lowerName.includes('client')) return 'people';
  if (lowerName.includes('contact')) return 'call';

  // Financial
  if (lowerName.includes('price') || lowerName.includes('pricing')) return 'pricetag';
  if (lowerName.includes('payment')) return 'wallet';
  if (lowerName.includes('invoice')) return 'document-text';
  if (lowerName.includes('discount')) return 'gift';
  if (lowerName.includes('tax')) return 'calculator';

  // Reports
  if (lowerName.includes('report')) return 'bar-chart';
  if (lowerName.includes('analytics') || lowerName.includes('dashboard')) return 'analytics';
  if (lowerName.includes('summary')) return 'list';

  // Returns
  if (lowerName.includes('return') || lowerName.includes('refund')) return 'return-down-back';

  // Miscellaneous
  if (lowerName.includes('setting')) return 'settings';
  if (lowerName.includes('user') || lowerName.includes('account')) return 'person';
  if (lowerName.includes('search') || lowerName.includes('find')) return 'search';
  if (lowerName.includes('scan') || lowerName.includes('barcode')) return 'barcode';
  if (lowerName.includes('print')) return 'print';
  if (lowerName.includes('notification') || lowerName.includes('alert')) return 'notifications';
  if (lowerName.includes('location')) return 'location';
  if (lowerName.includes('item') || lowerName.includes('product')) return 'cube-outline';
  if (lowerName.includes('category')) return 'folder';
  if (lowerName.includes('lodgment') || lowerName.includes('deposit')) return 'cash';
  if (lowerName.includes('delivery')) return 'car';
  if (lowerName.includes('pick') || lowerName.includes('picking')) return 'hand-left';
  if (lowerName.includes('pack') || lowerName.includes('packing')) return 'archive';

  // Default
  return 'apps';
};

// Module icon mapping
const getModuleIcon = (moduleName) => {
  const lowerName = (moduleName || '').toLowerCase();

  if (lowerName.includes('sales')) return 'cart';
  if (lowerName.includes('purchase')) return 'bag';
  if (lowerName.includes('inventory')) return 'cube';
  if (lowerName.includes('warehouse')) return 'home';
  if (lowerName.includes('customer')) return 'people';
  if (lowerName.includes('report')) return 'bar-chart';
  if (lowerName.includes('setting')) return 'settings';
  if (lowerName.includes('order')) return 'receipt';
  if (lowerName.includes('finance') || lowerName.includes('accounting')) return 'wallet';
  if (lowerName.includes('admin')) return 'shield';

  return 'grid';
};

// KPI Card Component
const KPICard = ({ title, value, icon, color, trend, trendValue }) => (
  <View style={[styles.kpiCard, { borderLeftColor: color }]}>
    <View style={styles.kpiHeader}>
      <View style={[styles.kpiIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trend === 'up' ? colors.accentGreen + '15' : colors.accentRed + '15' }]}>
          <Ionicons
            name={trend === 'up' ? 'trending-up' : 'trending-down'}
            size={14}
            color={trend === 'up' ? colors.accentGreen : colors.accentRed}
          />
          <Text style={[styles.trendText, { color: trend === 'up' ? colors.accentGreen : colors.accentRed }]}>
            {trendValue}
          </Text>
        </View>
      )}
    </View>
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiTitle}>{title}</Text>
  </View>
);

// Module Card Component
const ModuleCard = ({ module, onPress, isExpanded }) => (
  <TouchableOpacity
    style={[styles.moduleCard, isExpanded && styles.moduleCardExpanded]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.moduleContent}>
      <View style={styles.moduleIconContainer}>
        <Ionicons name={getModuleIcon(module.Menu)} size={28} color={colors.accent} />
      </View>
      <View style={styles.moduleInfo}>
        <Text style={styles.moduleName}>{module.Menu}</Text>
        <Text style={styles.moduleCount}>
          {module.SubMenuItems?.length || 0} items
        </Text>
      </View>
      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={24}
        color={colors.textMuted}
      />
    </View>
  </TouchableOpacity>
);

// Menu Item Component
const MenuItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={() => onPress(item)} activeOpacity={0.7}>
    <View style={styles.menuItemContent}>
      <View style={styles.menuItemIconContainer}>
        <Ionicons name={getMenuIcon(item.name)} size={24} color={colors.accent} />
      </View>
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.ordertype && (
          <Text style={styles.menuItemType}>{item.ordertype}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </View>
  </TouchableOpacity>
);

// Quick Links Section
const QuickLinks = ({ menuData, onItemPress }) => {
  const quickLinkItems = [];
  menuData?.forEach(module => {
    module.SubMenuItems?.forEach(item => {
      if (item.quicklink === 'yes' && quickLinkItems.length < 6) {
        quickLinkItems.push({ ...item, moduleName: module.Menu });
      }
    });
  });

  if (quickLinkItems.length === 0) return null;

  return (
    <View style={styles.quickLinksSection}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickLinksContainer}
      >
        {quickLinkItems.map((item, index) => (
          <TouchableOpacity
            key={`quick-${index}`}
            style={styles.quickLinkItem}
            onPress={() => onItemPress(item)}
          >
            <View style={styles.quickLinkIconContainer}>
              <Ionicons name={getMenuIcon(item.name)} size={28} color={colors.accent} />
            </View>
            <Text style={styles.quickLinkName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  const { user, menuData, refreshMenuData } = useAuth();
  const [expandedModule, setExpandedModule] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMenuData();
    setRefreshing(false);
  };

  const handleModulePress = (moduleId) => {
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const handleMenuItemPress = (item) => {
    navigation.navigate('MenuDetail', { item });
  };

  // Sample KPI data
  const kpiData = [
    { title: "Today's Sales", value: '$12,450', icon: 'cart', color: colors.accent, trend: 'up', trendValue: '12%' },
    { title: 'Orders', value: '48', icon: 'receipt', color: colors.accentGreen, trend: 'up', trendValue: '8%' },
    { title: 'Pending', value: '5', icon: 'time', color: colors.accentOrange, trend: 'down', trendValue: '3%' },
    { title: 'Inventory', value: '2,340', icon: 'cube', color: colors.accentPurple },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Blue Header Only */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('AccountDetails')} style={styles.menuButton}>
          <Ionicons name="person-circle" size={32} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.username || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={26} color="#FFFFFF" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationCount}>3</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      {/* White Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* KPI Cards Section */}
        <View style={styles.kpiSection}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <View style={styles.kpiGrid}>
            {kpiData.map((kpi, index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </View>
        </View>

        {/* Quick Links */}
        <QuickLinks menuData={menuData} onItemPress={handleMenuItemPress} />

        {/* Modules Section */}
        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>Modules</Text>
          {menuData && menuData.length > 0 ? (
            menuData.map((module) => (
              <View key={module.Id}>
                <ModuleCard
                  module={module}
                  onPress={() => handleModulePress(module.Id)}
                  isExpanded={expandedModule === module.Id}
                />
                {expandedModule === module.Id && (
                  <View style={styles.menuItemsContainer}>
                    {module.SubMenuItems?.map((item, index) => (
                      <MenuItem
                        key={`${module.Id}-${index}`}
                        item={item}
                        onPress={handleMenuItemPress}
                      />
                    ))}
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>No modules available</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header Styles (Blue)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 20,
  },
  menuButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.accentRed,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Content Styles (White)
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  // KPI Styles
  kpiSection: {
    marginTop: 20,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 12,
  },
  kpiCard: {
    width: cardWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  kpiTitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Quick Links Styles
  quickLinksSection: {
    marginTop: 24,
  },
  quickLinksContainer: {
    paddingHorizontal: 16,
  },
  quickLinkItem: {
    width: 90,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickLinkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLinkName: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  // Modules Styles
  modulesSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  moduleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  moduleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  moduleCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Menu Items Styles
  menuItemsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  menuItemType: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default HomeScreen;
