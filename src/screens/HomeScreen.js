import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2;

// KPI Card Component
const KPICard = ({ title, value, icon, color, trend, trendValue }) => (
  <View style={[styles.kpiCard, { borderLeftColor: color }]}>
    <View style={styles.kpiHeader}>
      <View style={[styles.kpiIconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trend === 'up' ? colors.accentGreen + '20' : colors.accentRed + '20' }]}>
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
    <LinearGradient
      colors={[colors.surfaceLight, colors.surface]}
      style={styles.moduleGradient}
    >
      <View style={styles.moduleHeader}>
        <View style={styles.moduleIconContainer}>
          <Ionicons name="grid" size={28} color={colors.accent} />
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
          color={colors.textSecondary}
        />
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

// Menu Item Component
const MenuItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={() => onPress(item)} activeOpacity={0.7}>
    <View style={styles.menuItemContent}>
      {item.src ? (
        <Image source={{ uri: item.src }} style={styles.menuItemImage} />
      ) : (
        <View style={styles.menuItemIconFallback}>
          <Ionicons name="document-text" size={24} color={colors.accent} />
        </View>
      )}
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
            {item.src ? (
              <Image source={{ uri: item.src }} style={styles.quickLinkImage} />
            ) : (
              <View style={styles.quickLinkIconFallback}>
                <Ionicons name="flash" size={28} color={colors.accent} />
              </View>
            )}
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
    // Navigate to the appropriate screen based on PageName
    navigation.navigate('MenuDetail', { item });
  };

  // Sample KPI data - can be replaced with real data from API
  const kpiData = [
    { title: "Today's Sales", value: '$12,450', icon: 'cart', color: colors.accent, trend: 'up', trendValue: '12%' },
    { title: 'Orders', value: '48', icon: 'receipt', color: colors.accentGreen, trend: 'up', trendValue: '8%' },
    { title: 'Pending', value: '5', icon: 'time', color: colors.accentOrange, trend: 'down', trendValue: '3%' },
    { title: 'Inventory', value: '2,340', icon: 'cube', color: colors.accentPurple },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.primaryDark, colors.background]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.username || 'User'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={26} color={colors.textPrimary} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

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
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
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
    marginTop: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 12,
  },
  kpiCard: {
    width: cardWidth,
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
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
    gap: 12,
  },
  quickLinkItem: {
    width: 90,
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
  },
  quickLinkImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginBottom: 8,
  },
  quickLinkIconFallback: {
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
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  moduleCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  moduleGradient: {
    padding: 16,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moduleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.backgroundCard,
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
    backgroundColor: colors.backgroundCard,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 12,
    paddingVertical: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 14,
  },
  menuItemIconFallback: {
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
