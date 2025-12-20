import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  Image,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../constants/colors';
import { getMenuItems, getKPIs } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const KPICard = ({ icon, title, value, color, delay }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: delay,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay: delay,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.kpiCard,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <LinearGradient
        colors={[color, `${color}DD`]}
        style={styles.kpiGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.kpiIconContainer}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiTitle}>{title}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

const ModuleCard = ({ module, onMenuPress, delay }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: delay,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay: delay,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const toggleExpand = () => {
    Animated.spring(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const getModuleIcon = (moduleName) => {
    const icons = {
      'Order Management': 'cart-outline',
      'Receivables': 'wallet-outline',
      'Inventory Receipts': 'cube-outline',
      'Reports': 'stats-chart-outline',
      'Settings': 'settings-outline',
    };
    return icons[moduleName] || 'apps-outline';
  };

  const getModuleColor = (moduleName) => {
    const colors = {
      'Order Management': '#FF6B35',
      'Receivables': '#10B981',
      'Inventory Receipts': '#3B82F6',
      'Reports': '#8B5CF6',
      'Settings': '#6B7280',
    };
    return colors[moduleName] || COLORS.primary;
  };

  return (
    <Animated.View
      style={[
        styles.moduleCard,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Module Header */}
      <TouchableOpacity
        style={styles.moduleHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.moduleHeaderLeft}>
          <View
            style={[
              styles.moduleIconContainer,
              { backgroundColor: `${getModuleColor(module.Menu)}20` },
            ]}
          >
            <Ionicons
              name={getModuleIcon(module.Menu)}
              size={24}
              color={getModuleColor(module.Menu)}
            />
          </View>
          <View style={styles.moduleInfo}>
            <Text style={styles.moduleName}>{module.Menu}</Text>
            <Text style={styles.moduleCount}>
              {module.SubMenuItems?.length || 0} items
            </Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <Ionicons name="chevron-down" size={24} color={COLORS.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Menu Items */}
      {isExpanded && (
        <View style={styles.menuItemsContainer}>
          {module.SubMenuItems?.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => onMenuPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                {item.src ? (
                  <Image
                    source={{ uri: item.src }}
                    style={styles.menuItemIcon}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.menuItemIconPlaceholder}>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </View>
                )}
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.menuItemType} numberOfLines={1}>
                    {item.ordertype || item.PageName}
                  </Text>
                </View>
              </View>
              <View style={styles.menuItemRight}>
                {item.quicklink === 'yes' && (
                  <View style={styles.quickLinkBadge}>
                    <Ionicons name="star" size={10} color="#FF6B35" />
                  </View>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.textMuted}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Animated.View>
  );
};

const HomeScreen = ({ navigation }) => {
  const { user, logout, instanceName } = useAuth();
  const [menuData, setMenuData] = useState([]);
  const [kpiData, setKpiData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadData = async () => {
    try {
      const username = user?.username || user?.USERNAME || 'njohar';
      const [menuResponse, kpiResponse] = await Promise.all([
        getMenuItems(username),
        getKPIs(username),
      ]);
      setMenuData(menuResponse || []);
      setKpiData(kpiResponse);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMenuPress = (item) => {
    Alert.alert(
      item.name,
      `Page: ${item.PageName}\nType: ${item.ordertype || 'N/A'}`,
      [{ text: 'OK' }]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          navigation.replace('Login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <Animated.View
          style={[
            styles.headerContent,
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={['#FF6B35', '#FF8B55']}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {(user?.username || user?.USERNAME || 'U').charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>
                  {user?.username || user?.USERNAME || 'User'}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.instanceBadge}>
            <Ionicons name="server-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.instanceText}>{instanceName || 'Default Instance'}</Text>
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.secondary]}
            tintColor={COLORS.secondary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* KPIs Section */}
        <View style={styles.kpiSection}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <View style={styles.kpiGrid}>
            <KPICard
              icon="cash-outline"
              title="Today's Sales"
              value={kpiData?.todaySales || '$0'}
              color="#FF6B35"
              delay={0}
            />
            <KPICard
              icon="receipt-outline"
              title="Orders"
              value={kpiData?.ordersCount || 0}
              color="#10B981"
              delay={100}
            />
            <KPICard
              icon="time-outline"
              title="Pending"
              value={kpiData?.pendingOrders || 0}
              color="#F59E0B"
              delay={200}
            />
            <KPICard
              icon="people-outline"
              title="Customers"
              value={kpiData?.totalCustomers || 0}
              color="#3B82F6"
              delay={300}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionsContainer}
          >
            {menuData[0]?.SubMenuItems?.filter(item => item.quicklink === 'yes').slice(0, 5).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionCard}
                onPress={() => handleMenuPress(item)}
              >
                {item.src ? (
                  <Image
                    source={{ uri: item.src }}
                    style={styles.quickActionIcon}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.quickActionIconPlaceholder}>
                    <Ionicons name="flash-outline" size={24} color={COLORS.secondary} />
                  </View>
                )}
                <Text style={styles.quickActionText} numberOfLines={2}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Modules Section */}
        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>Modules</Text>
          {menuData.map((module, index) => (
            <ModuleCard
              key={module.Id || index}
              module={module}
              onMenuPress={handleMenuPress}
              delay={index * 100}
            />
          ))}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {},
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {},
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  instanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  instanceText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  // KPI Styles
  kpiSection: {
    marginBottom: 25,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: (width - 50) / 2,
    marginHorizontal: 5,
    marginBottom: 10,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  kpiGradient: {
    padding: 20,
  },
  kpiIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  kpiTitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Quick Actions Styles
  quickActionsSection: {
    marginBottom: 25,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
  },
  quickActionCard: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    marginBottom: 10,
  },
  quickActionIconPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: `${COLORS.secondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  // Modules Styles
  modulesSection: {
    paddingHorizontal: 0,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  moduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moduleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  moduleInfo: {},
  moduleName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  moduleCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  menuItemsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
  },
  menuItemIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  menuItemType: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickLinkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: `${COLORS.secondary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bottomSpacing: {
    height: 30,
  },
});

export default HomeScreen;
