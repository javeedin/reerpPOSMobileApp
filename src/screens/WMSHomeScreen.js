import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
  fetchShipmentsSummary,
  calculateWMSKPIs,
  groupOrdersByLorry,
  groupOrdersByDate,
  filterByTransactionType,
  filterPendingOrders,
  clearWMSCache,
} from '../services/wmsService';
import { getInstance } from '../services/api';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');

// Transaction type filter options - Updated to use Store Transfers
const FILTER_OPTIONS = [
  { id: 'All', label: 'All', icon: 'apps-outline' },
  { id: 'Sales Orders', label: 'Sales', icon: 'cart-outline' },
  { id: 'Store Transfers', label: 'Store', icon: 'swap-horizontal-outline' },
  { id: 'Order Returns', label: 'Returns', icon: 'return-down-back-outline' },
];

// View mode options
const VIEW_MODES = [
  { id: 'grouped', icon: 'car-outline', label: 'By Lorry' },
  { id: 'date', icon: 'calendar-outline', label: 'By Date' },
  { id: 'list', icon: 'list-outline', label: 'List' },
];

// Format date for API
const formatDateForAPI = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Overview Card Component for Sales and Store Transactions
const OverviewCard = ({ title, icon, color, kpis, onPress }) => (
  <TouchableOpacity
    style={[styles.overviewCard, { borderLeftColor: color }]}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.overviewCardHeader}>
      <View style={[styles.overviewIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.overviewCardTitleContainer}>
        <Text style={styles.overviewCardTitle}>{title}</Text>
        <Text style={[styles.overviewOrderCount, { color }]}>{kpis.orders} orders</Text>
      </View>
    </View>
    <View style={styles.overviewCardStats}>
      <View style={styles.overviewStatItem}>
        <Text style={[styles.overviewStatValue, { color: '#FF9800' }]}>{kpis.pendingLines}</Text>
        <Text style={styles.overviewStatLabel}>Pending</Text>
      </View>
      <View style={styles.overviewStatDivider} />
      <View style={styles.overviewStatItem}>
        <Text style={[styles.overviewStatValue, { color: '#4CAF50' }]}>{kpis.pickedLines}</Text>
        <Text style={styles.overviewStatLabel}>Picked</Text>
      </View>
      <View style={styles.overviewStatDivider} />
      <View style={styles.overviewStatItem}>
        <Text style={[styles.overviewStatValue, { color: '#9C27B0' }]}>{kpis.shippedLines}</Text>
        <Text style={styles.overviewStatLabel}>Shipped</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// Order Card Component
const OrderCard = ({ order, onPress }) => {
  const isPicked = order.pick_confirm_status === 'YES';
  const isShipped = order.shipped_status === 'YES';

  let statusColor = '#FF9800'; // Pending
  let statusText = 'Pending';
  let statusIcon = 'time-outline';

  if (isShipped) {
    statusColor = '#9C27B0';
    statusText = 'Shipped';
    statusIcon = 'checkmark-done-circle-outline';
  } else if (isPicked) {
    statusColor = '#4CAF50';
    statusText = 'Picked';
    statusIcon = 'checkmark-circle-outline';
  }

  // Format assignment date
  const assignDate = order.assignment_date
    ? new Date(order.assignment_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    : '';

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderHeader}>
        <View style={styles.orderNumberContainer}>
          <Text style={styles.orderNumber}>{order.source_order_number}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
            <Ionicons name={statusIcon} size={12} color={statusColor} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        <View style={styles.orderRightInfo}>
          {assignDate && <Text style={styles.orderDate}>{assignDate}</Text>}
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityText}>P{order.order_priority || '-'}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.accountName} numberOfLines={1}>
        {order.account_name || 'Unknown Customer'}
      </Text>

      <View style={styles.orderMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={14} color="#666" />
          <Text style={styles.metaText}>{order.picker_name || '-'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="layers-outline" size={14} color="#666" />
          <Text style={styles.metaText}>{order.no_of_lines || 0} lines</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="pricetag-outline" size={14} color="#666" />
          <Text style={styles.metaText}>{order.transaction_type || '-'}</Text>
        </View>
        {order.instance_name ? (
          <View style={[styles.metaItem, { backgroundColor: (order.instance_name || '').toUpperCase() === 'PROD' ? '#E8F5E9' : '#FFF3E0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }]}>
            <Ionicons name="server-outline" size={12} color={(order.instance_name || '').toUpperCase() === 'PROD' ? '#2E7D32' : '#E65100'} />
            <Text style={[styles.metaText, { color: (order.instance_name || '').toUpperCase() === 'PROD' ? '#2E7D32' : '#E65100', fontWeight: '600', fontSize: 11 }]}>{(order.instance_name || '').toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {/* Ship Confirm Ready badge - Sales Orders that are picked but not shipped */}
      {isPicked && !isShipped && !(order.transaction_type || '').toLowerCase().includes('store') && (
        <View style={styles.shipConfirmReadyBanner}>
          <Ionicons name="airplane" size={14} color="#7B1FA2" />
          <Text style={styles.shipConfirmReadyText}>Ready for Ship Confirm</Text>
          <Ionicons name="chevron-forward" size={14} color="#7B1FA2" />
        </View>
      )}

      <View style={styles.orderFooter}>
        <View style={styles.tagContainer}>
          {order.lorry_number && (
            <View style={styles.tag}>
              <Ionicons name="car-outline" size={12} color="#1976D2" />
              <Text style={styles.tagText}>{order.lorry_number}</Text>
            </View>
          )}
          {order.loading_bay && (
            <View style={styles.tag}>
              <Ionicons name="location-outline" size={12} color="#388E3C" />
              <Text style={styles.tagText}>{order.loading_bay}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </View>
    </TouchableOpacity>
  );
};

// Lorry Group Component
const LorryGroup = ({ lorryData, onOrderPress, expandedLorries, toggleLorry }) => {
  const isExpanded = expandedLorries.includes(lorryData.lorry_number);

  return (
    <View style={styles.lorryGroup}>
      <TouchableOpacity
        style={styles.lorryHeader}
        onPress={() => toggleLorry(lorryData.lorry_number)}
      >
        <View style={styles.lorryInfo}>
          <View style={styles.lorryIconContainer}>
            <Ionicons name="car-sport" size={24} color="#1976D2" />
          </View>
          <View>
            <Text style={styles.lorryNumber}>{lorryData.lorry_number}</Text>
            <Text style={styles.lorryStats}>
              {lorryData.orderCount} orders | {lorryData.totalLines} lines
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#666"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.lorryContent}>
          {lorryData.loading_bays.map((bayData, bayIndex) => (
            <View key={bayIndex} style={styles.bayGroup}>
              <View style={styles.bayHeader}>
                <Ionicons name="location" size={16} color="#388E3C" />
                <Text style={styles.bayName}>{bayData.loading_bay}</Text>
                <Text style={styles.bayCount}>{bayData.orderCount} orders</Text>
              </View>

              {bayData.priorities.map((priorityData, priorityIndex) => (
                <View key={priorityIndex} style={styles.priorityGroup}>
                  {priorityData.orders.map((order, orderIndex) => (
                    <OrderCard
                      key={`lorry-${lorryData.lorry_number}-${bayIndex}-${priorityIndex}-${orderIndex}`}
                      order={order}
                      onPress={() => onOrderPress(order)}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Date Group Component
const DateGroup = ({ dateData, onOrderPress, expandedDates, toggleDate }) => {
  const isExpanded = expandedDates.includes(dateData.date);
  const isToday = dateData.date === formatDateForAPI(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = dateData.date === formatDateForAPI(yesterday);

  let dateLabel = dateData.displayDate;
  if (isToday) dateLabel = 'Today';
  if (isYesterday) dateLabel = 'Yesterday';

  return (
    <View style={styles.dateGroup}>
      <TouchableOpacity
        style={[styles.dateHeader, isToday && styles.dateHeaderToday]}
        onPress={() => toggleDate(dateData.date)}
      >
        <View style={styles.dateInfo}>
          <View style={[styles.dateIconContainer, isToday && styles.dateIconToday]}>
            <Ionicons name="calendar" size={24} color={isToday ? '#FFF' : '#1976D2'} />
          </View>
          <View>
            <Text style={[styles.dateName, isToday && styles.dateNameToday]}>{dateLabel}</Text>
            <Text style={styles.dateStats}>
              {dateData.orders.length} orders | {dateData.totalLines} lines
            </Text>
          </View>
        </View>
        <View style={styles.dateStatusSummary}>
          {dateData.pendingCount > 0 && (
            <View style={[styles.miniStatusBadge, { backgroundColor: '#FF9800' }]}>
              <Text style={styles.miniStatusText}>{dateData.pendingCount}</Text>
            </View>
          )}
          {dateData.pickedCount > 0 && (
            <View style={[styles.miniStatusBadge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.miniStatusText}>{dateData.pickedCount}</Text>
            </View>
          )}
          {dateData.shippedCount > 0 && (
            <View style={[styles.miniStatusBadge, { backgroundColor: '#9C27B0' }]}>
              <Text style={styles.miniStatusText}>{dateData.shippedCount}</Text>
            </View>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.dateContent}>
          {dateData.orders.map((order, orderIndex) => (
            <OrderCard
              key={`date-${dateData.date}-${orderIndex}`}
              order={order}
              onPress={() => onOrderPress(order)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// Query Modal Component
const QueryModal = ({ visible, onClose, onQuery, initialFromDate, initialToDate }) => {
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Query Orders</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>From Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="2026-01-01"
            />

            <Text style={styles.inputLabel}>To Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={toDate}
              onChangeText={setToDate}
              placeholder="2026-01-09"
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalButtonCancel} onPress={onClose}>
              <Text style={styles.modalButtonCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonQuery}
              onPress={() => onQuery(fromDate, toDate)}
            >
              <Ionicons name="search" size={18} color="#FFF" />
              <Text style={styles.modalButtonQueryText}>Query</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Bottom Toolbar Component
const BottomToolbar = ({ onHome, onRefresh, onReports, onPerformance, onQuery, onProfile, isRefreshing, isPicker, bottomInset }) => (
  <View style={[styles.bottomToolbar, { paddingBottom: Math.max(bottomInset, 8) + 8 }]}>
    {isPicker ? (
      // PICKER users get Profile/Me button instead of Home
      <TouchableOpacity style={styles.toolbarButton} onPress={onProfile}>
        <Ionicons name="person-circle" size={24} color="#E91E63" />
        <Text style={styles.toolbarButtonText}>Me</Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity style={styles.toolbarButton} onPress={onHome}>
        <Ionicons name="home" size={24} color="#1565C0" />
        <Text style={styles.toolbarButtonText}>Home</Text>
      </TouchableOpacity>
    )}

    <TouchableOpacity style={styles.toolbarButton} onPress={onRefresh} disabled={isRefreshing}>
      {isRefreshing ? (
        <ActivityIndicator size="small" color="#1565C0" />
      ) : (
        <Ionicons name="refresh" size={24} color="#1565C0" />
      )}
      <Text style={styles.toolbarButtonText}>Refresh</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.toolbarButton} onPress={onQuery}>
      <Ionicons name="search" size={24} color="#FF9800" />
      <Text style={styles.toolbarButtonText}>Query</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.toolbarButton} onPress={onReports}>
      <Ionicons name="bar-chart" size={24} color="#4CAF50" />
      <Text style={styles.toolbarButtonText}>Reports</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.toolbarButton} onPress={onPerformance}>
      <Ionicons name="trophy" size={24} color="#9C27B0" />
      <Text style={styles.toolbarButtonText}>My Stats</Text>
    </TouchableOpacity>
  </View>
);

// Reports Modal Component
const ReportsModal = ({ visible, onClose, shipments, kpis }) => {
  const dateGroups = groupOrdersByDate(shipments);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reports by Date</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.reportsContent}>
            {/* Summary */}
            <View style={styles.reportSummary}>
              <Text style={styles.reportSummaryTitle}>Overall Summary</Text>
              <View style={styles.reportSummaryRow}>
                <View style={styles.reportSummaryItem}>
                  <Text style={styles.reportSummaryValue}>{kpis.totalOrders || 0}</Text>
                  <Text style={styles.reportSummaryLabel}>Total Orders</Text>
                </View>
                <View style={styles.reportSummaryItem}>
                  <Text style={styles.reportSummaryValue}>{kpis.pendingPick || 0}</Text>
                  <Text style={styles.reportSummaryLabel}>Pending</Text>
                </View>
                <View style={styles.reportSummaryItem}>
                  <Text style={styles.reportSummaryValue}>{kpis.pickedOrders || 0}</Text>
                  <Text style={styles.reportSummaryLabel}>Picked</Text>
                </View>
                <View style={styles.reportSummaryItem}>
                  <Text style={styles.reportSummaryValue}>{kpis.shippedOrders || 0}</Text>
                  <Text style={styles.reportSummaryLabel}>Shipped</Text>
                </View>
              </View>
            </View>

            {/* By Date */}
            <Text style={styles.reportSectionTitle}>By Date</Text>
            {dateGroups.map((dateData, index) => (
              <View key={index} style={styles.reportDateRow}>
                <Text style={styles.reportDateLabel}>{dateData.displayDate}</Text>
                <View style={styles.reportDateStats}>
                  <View style={styles.reportDateStat}>
                    <Text style={styles.reportDateStatValue}>{dateData.orders.length}</Text>
                    <Text style={styles.reportDateStatLabel}>Orders</Text>
                  </View>
                  <View style={[styles.reportDateStat, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={[styles.reportDateStatValue, { color: '#FF9800' }]}>{dateData.pendingCount}</Text>
                    <Text style={styles.reportDateStatLabel}>Pending</Text>
                  </View>
                  <View style={[styles.reportDateStat, { backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.reportDateStatValue, { color: '#4CAF50' }]}>{dateData.pickedCount}</Text>
                    <Text style={styles.reportDateStatLabel}>Picked</Text>
                  </View>
                  <View style={[styles.reportDateStat, { backgroundColor: '#F3E5F5' }]}>
                    <Text style={[styles.reportDateStatValue, { color: '#9C27B0' }]}>{dateData.shippedCount}</Text>
                    <Text style={styles.reportDateStatLabel}>Shipped</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* By Transaction Type */}
            <Text style={styles.reportSectionTitle}>By Transaction Type</Text>
            {Object.entries(kpis.byTransactionType || {}).map(([type, count], index) => (
              <View key={index} style={styles.reportTypeRow}>
                <Text style={styles.reportTypeLabel}>{type}</Text>
                <Text style={styles.reportTypeValue}>{count}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Performance Modal Component
const PerformanceModal = ({ visible, onClose, shipments, pickerName }) => {
  // Calculate picker-specific stats
  const pickerOrders = shipments.filter(s => s.picker_name === pickerName);
  const totalPicked = pickerOrders.filter(s => s.pick_confirm_status === 'YES').length;
  const totalShipped = pickerOrders.filter(s => s.shipped_status === 'YES').length;
  const totalLines = pickerOrders.reduce((sum, s) => sum + (parseInt(s.no_of_lines) || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Performance</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.performanceContent}>
            <View style={styles.performanceHeader}>
              <Ionicons name="person-circle" size={60} color="#1565C0" />
              <Text style={styles.performanceName}>{pickerName || 'Unknown'}</Text>
            </View>

            <View style={styles.performanceStats}>
              <View style={styles.performanceStatItem}>
                <Text style={styles.performanceStatValue}>{pickerOrders.length}</Text>
                <Text style={styles.performanceStatLabel}>Assigned</Text>
              </View>
              <View style={styles.performanceStatItem}>
                <Text style={[styles.performanceStatValue, { color: '#4CAF50' }]}>{totalPicked}</Text>
                <Text style={styles.performanceStatLabel}>Picked</Text>
              </View>
              <View style={styles.performanceStatItem}>
                <Text style={[styles.performanceStatValue, { color: '#9C27B0' }]}>{totalShipped}</Text>
                <Text style={styles.performanceStatLabel}>Shipped</Text>
              </View>
              <View style={styles.performanceStatItem}>
                <Text style={[styles.performanceStatValue, { color: '#FF9800' }]}>{totalLines}</Text>
                <Text style={styles.performanceStatLabel}>Lines</Text>
              </View>
            </View>

            {pickerOrders.length > 0 && (
              <View style={styles.performanceProgress}>
                <Text style={styles.performanceProgressLabel}>Completion Rate</Text>
                <View style={styles.performanceProgressBar}>
                  <View
                    style={[
                      styles.performanceProgressFill,
                      { width: `${(totalPicked / pickerOrders.length) * 100}%` }
                    ]}
                  />
                </View>
                <Text style={styles.performanceProgressText}>
                  {Math.round((totalPicked / pickerOrders.length) * 100)}%
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Profile Modal Component for PICKER users
const ProfileModal = ({ visible, onClose, user, onLogout }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileContent}>
            {/* User Avatar */}
            <View style={styles.profileAvatarContainer}>
              <LinearGradient
                colors={['#1565C0', '#0D47A1']}
                style={styles.profileAvatar}
              >
                <Ionicons name="person" size={50} color="#FFF" />
              </LinearGradient>
            </View>

            {/* User Details */}
            <View style={styles.profileDetails}>
              <View style={styles.profileDetailRow}>
                <Ionicons name="person-outline" size={20} color="#666" />
                <View style={styles.profileDetailContent}>
                  <Text style={styles.profileDetailLabel}>Username</Text>
                  <Text style={styles.profileDetailValue}>{user?.username || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.profileDetailRow}>
                <Ionicons name="briefcase-outline" size={20} color="#666" />
                <View style={styles.profileDetailContent}>
                  <Text style={styles.profileDetailLabel}>User Type</Text>
                  <Text style={styles.profileDetailValue}>{user?.userType || 'PICKER'}</Text>
                </View>
              </View>

              <View style={styles.profileDetailRow}>
                <Ionicons name="cube-outline" size={20} color="#666" />
                <View style={styles.profileDetailContent}>
                  <Text style={styles.profileDetailLabel}>Picker Name</Text>
                  <Text style={styles.profileDetailValue}>
                    {user?.PICKER_NAME || user?.picker_name || user?.username || 'N/A'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileDetailRow}>
                <Ionicons name="business-outline" size={20} color="#666" />
                <View style={styles.profileDetailContent}>
                  <Text style={styles.profileDetailLabel}>Warehouse</Text>
                  <Text style={styles.profileDetailValue}>{user?.warehouse || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.profileDetailRow}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <View style={styles.profileDetailContent}>
                  <Text style={styles.profileDetailLabel}>Login Time</Text>
                  <Text style={styles.profileDetailValue}>{formatDate(user?.loginTime)}</Text>
                </View>
              </View>
            </View>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={22} color="#FFF" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const WMSHomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [kpis, setKpis] = useState({});
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedLorries, setExpandedLorries] = useState([]);
  const [expandedDates, setExpandedDates] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'grouped', 'date', or 'list'
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date()); // Single date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showOverview, setShowOverview] = useState(false); // Overview collapsed by default
  const [searchText, setSearchText] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(true); // Default to Pending

  const [currentInstance, setCurrentInstance] = useState('');

  // Get picker name from user data
  const pickerName = user?.PICKER_NAME || user?.picker_name || user?.username || '';

  // Load current instance
  useEffect(() => {
    getInstance().then(inst => setCurrentInstance((inst || 'TEST').toUpperCase()));
  }, []);

  // Check if user is a PICKER
  const isPicker = (user?.userType || '').toUpperCase() === 'PICKER';

  // Handle logout
  const handleLogout = async () => {
    setShowProfileModal(false);
    await logout();
  };

  const loadData = useCallback(async (showLoading = true, date = null) => {
    if (showLoading) setLoading(true);

    try {
      // Use provided date or default to selectedDate
      const queryDate = date || selectedDate;

      const result = await fetchShipmentsSummary(pickerName, queryDate, queryDate, null);

      if (result.success && result.data?.items) {
        setShipments(result.data.items);
        setKpis(calculateWMSKPIs(result.data.items));

        // Auto-expand first group
        const grouped = groupOrdersByLorry(result.data.items);
        if (grouped.length > 0 && expandedLorries.length === 0) {
          setExpandedLorries([grouped[0].lorry_number]);
        }

        const dateGroups = groupOrdersByDate(result.data.items);
        if (dateGroups.length > 0 && expandedDates.length === 0) {
          setExpandedDates([dateGroups[0].date]);
        }
      } else {
        setShipments([]);
        setKpis({});
      }
    } catch (error) {
      console.error('[WMSHome] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pickerName, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await clearWMSCache();
    loadData(false);
  };

  const handleDateChange = async (newDate) => {
    setSelectedDate(newDate);
    setShowDatePicker(false);
    await clearWMSCache(); // Clear cache to force fresh data fetch
    loadData(true, newDate);
  };

  const handleQuery = (fromDate, toDate) => {
    setShowQueryModal(false);
    const from = new Date(fromDate);
    setSelectedDate(from);
    loadData(true, from);
  };

  const toggleLorry = (lorryNumber) => {
    setExpandedLorries(prev =>
      prev.includes(lorryNumber)
        ? prev.filter(l => l !== lorryNumber)
        : [...prev, lorryNumber]
    );
  };

  const toggleDate = (date) => {
    setExpandedDates(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const handleOrderPress = (order) => {
    navigation.navigate('WMSOrderDetails', { order });
  };

  // Filter shipments
  const getFilteredShipments = () => {
    let filtered = [...shipments];

    // Filter by pending only switch (orders not picked and not shipped)
    if (showPendingOnly) {
      filtered = filtered.filter(s => s.pick_confirm_status !== 'YES' && s.shipped_status !== 'YES');
    }

    // Filter by search text (customer name or order number)
    if (searchText.trim()) {
      const search = searchText.toLowerCase().trim();
      filtered = filtered.filter(s => {
        const orderNum = (s.source_order_number || '').toLowerCase();
        const customer = (s.account_name || s.customer_name || '').toLowerCase();
        return orderNum.includes(search) || customer.includes(search);
      });
    }

    // Filter by transaction type
    if (selectedFilter !== 'All') {
      filtered = filterByTransactionType(filtered, selectedFilter);
    }

    // Filter by status
    if (selectedStatus === 'pending') {
      filtered = filtered.filter(s => s.pick_confirm_status !== 'YES');
    } else if (selectedStatus === 'picked') {
      filtered = filtered.filter(s => s.pick_confirm_status === 'YES' && s.shipped_status !== 'YES');
    } else if (selectedStatus === 'shipped') {
      filtered = filtered.filter(s => s.shipped_status === 'YES');
    }

    return filtered;
  };

  const filteredShipments = getFilteredShipments();
  const groupedShipments = groupOrdersByLorry(filteredShipments);
  const dateGroupedShipments = groupOrdersByDate(filteredShipments);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />

      {/* Header */}
      <LinearGradient colors={['#1565C0', '#0D47A1']} style={styles.header}>
        <View style={styles.headerContent}>
          {!isPicker && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <View style={styles.headerText}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>WMS 1.0.3</Text>
              {currentInstance ? (
                <View style={[styles.instanceBadge, currentInstance === 'PROD' ? styles.instanceBadgeProd : styles.instanceBadgeTest]}>
                  <Text style={styles.instanceBadgeText}>{currentInstance}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.headerSubtitle}>
              {pickerName || 'Not Set'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('APIList')} style={styles.headerProfileButton}>
            <Ionicons name="code-slash-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          {isPicker && (
            <TouchableOpacity onPress={() => setShowProfileModal(true)} style={styles.headerProfileButton}>
              <Ionicons name="person-circle-outline" size={28} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Query Modal */}
      <QueryModal
        visible={showQueryModal}
        onClose={() => setShowQueryModal(false)}
        onQuery={handleQuery}
        initialFromDate={formatDateForAPI(selectedDate)}
        initialToDate={formatDateForAPI(selectedDate)}
      />

      {/* Reports Modal */}
      <ReportsModal
        visible={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        shipments={shipments}
        kpis={kpis}
      />

      {/* Performance Modal */}
      <PerformanceModal
        visible={showPerformanceModal}
        onClose={() => setShowPerformanceModal(false)}
        shipments={shipments}
        pickerName={pickerName}
      />

      {/* Profile Modal for PICKER users */}
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        onLogout={handleLogout}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Loading shipments...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1565C0']} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Date Picker Section */}
          <View style={styles.datePickerSection}>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <Ionicons name="calendar" size={20} color="#1565C0" />
              <Text style={styles.datePickerText}>
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
            </TouchableOpacity>

            {/* Quick Date Buttons */}
            <View style={styles.quickDateButtons}>
              <TouchableOpacity
                style={[
                  styles.quickDateBtn,
                  formatDateForAPI(selectedDate) === formatDateForAPI(new Date(Date.now() - 86400000)) && styles.quickDateBtnActive
                ]}
                onPress={() => handleDateChange(new Date(Date.now() - 86400000))}
              >
                <Text style={[
                  styles.quickDateBtnText,
                  formatDateForAPI(selectedDate) === formatDateForAPI(new Date(Date.now() - 86400000)) && styles.quickDateBtnTextActive
                ]}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickDateBtn,
                  formatDateForAPI(selectedDate) === formatDateForAPI(new Date()) && styles.quickDateBtnActive
                ]}
                onPress={() => handleDateChange(new Date())}
              >
                <Text style={[
                  styles.quickDateBtnText,
                  formatDateForAPI(selectedDate) === formatDateForAPI(new Date()) && styles.quickDateBtnTextActive
                ]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickDateBtn,
                  formatDateForAPI(selectedDate) === formatDateForAPI(new Date(Date.now() + 86400000)) && styles.quickDateBtnActive
                ]}
                onPress={() => handleDateChange(new Date(Date.now() + 86400000))}
              >
                <Text style={[
                  styles.quickDateBtnText,
                  formatDateForAPI(selectedDate) === formatDateForAPI(new Date(Date.now() + 86400000)) && styles.quickDateBtnTextActive
                ]}>Tomorrow</Text>
              </TouchableOpacity>
            </View>

            {/* Date Picker Dropdown */}
            {showDatePicker && (
              <View style={styles.datePickerDropdown}>
                <View style={styles.datePickerInputRow}>
                  <Text style={styles.datePickerLabel}>Select Date:</Text>
                  <TextInput
                    style={styles.datePickerInput}
                    value={formatDateForAPI(selectedDate)}
                    onChangeText={(text) => {
                      const parsed = new Date(text);
                      if (!isNaN(parsed.getTime())) {
                        setSelectedDate(parsed);
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <TouchableOpacity
                  style={styles.datePickerApplyBtn}
                  onPress={() => {
                    setShowDatePicker(false);
                    loadData(true, selectedDate);
                  }}
                >
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.datePickerApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Overview Cards - Sales and Store Transactions (Collapsible) */}
          <View style={styles.overviewSection}>
            <TouchableOpacity
              style={styles.overviewHeader}
              onPress={() => setShowOverview(!showOverview)}
            >
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.overviewHeaderRight}>
                <Text style={styles.overviewSummaryText}>
                  {(kpis.salesKPIs?.orders || 0) + (kpis.storeKPIs?.orders || 0)} orders
                </Text>
                <Ionicons
                  name={showOverview ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>
            {showOverview && (
              <View style={styles.overviewCardsContainer}>
                <OverviewCard
                  title="Sales"
                  icon="cart"
                  color="#2196F3"
                  kpis={kpis.salesKPIs || { orders: 0, pendingLines: 0, pickedLines: 0, shippedLines: 0 }}
                  onPress={() => setSelectedFilter('Sales Orders')}
                />
                <OverviewCard
                  title="Store Transfers"
                  icon="swap-horizontal"
                  color="#FF9800"
                  kpis={kpis.storeKPIs || { orders: 0, pendingLines: 0, pickedLines: 0, shippedLines: 0 }}
                  onPress={() => setSelectedFilter('Store Transfers')}
                />
              </View>
            )}
          </View>

          {/* Search Filter */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by customer or order number..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')} style={styles.searchClearBtn}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Transaction Type Filter */}
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {FILTER_OPTIONS.map(filter => (
                  <TouchableOpacity
                    key={filter.id}
                    style={[
                      styles.filterChip,
                      selectedFilter === filter.id && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedFilter(filter.id)}
                  >
                    <Ionicons
                      name={filter.icon}
                      size={18}
                      color={selectedFilter === filter.id ? '#FFF' : '#666'}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedFilter === filter.id && styles.filterChipTextActive,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Pending/All Switch and View Mode Toggle */}
          <View style={styles.viewModeSection}>
            <Text style={styles.resultCount}>
              {filteredShipments.length} orders
            </Text>

            {/* Pending/All Switch */}
            <View style={styles.pendingSwitch}>
              <TouchableOpacity
                style={[
                  styles.pendingSwitchOption,
                  !showPendingOnly && styles.pendingSwitchOptionActive
                ]}
                onPress={() => setShowPendingOnly(false)}
              >
                <Text style={[
                  styles.pendingSwitchText,
                  !showPendingOnly && styles.pendingSwitchTextActive
                ]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pendingSwitchOption,
                  showPendingOnly && styles.pendingSwitchOptionActivePending
                ]}
                onPress={() => setShowPendingOnly(true)}
              >
                <Text style={[
                  styles.pendingSwitchText,
                  showPendingOnly && styles.pendingSwitchTextActive
                ]}>Pending</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.viewModeToggle}>
              {VIEW_MODES.map(mode => (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.viewModeButton, viewMode === mode.id && styles.viewModeButtonActive]}
                  onPress={() => setViewMode(mode.id)}
                >
                  <Ionicons
                    name={mode.icon}
                    size={18}
                    color={viewMode === mode.id ? '#FFF' : '#666'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Orders List */}
          {filteredShipments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={60} color="#CCC" />
              <Text style={styles.emptyStateText}>No orders found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try adjusting your filters or query different dates
              </Text>
            </View>
          ) : viewMode === 'grouped' ? (
            <View style={styles.ordersSection}>
              {groupedShipments.map((lorryData, index) => (
                <LorryGroup
                  key={index}
                  lorryData={lorryData}
                  onOrderPress={handleOrderPress}
                  expandedLorries={expandedLorries}
                  toggleLorry={toggleLorry}
                />
              ))}
            </View>
          ) : viewMode === 'date' ? (
            <View style={styles.ordersSection}>
              {dateGroupedShipments.map((dateData, index) => (
                <DateGroup
                  key={index}
                  dateData={dateData}
                  onOrderPress={handleOrderPress}
                  expandedDates={expandedDates}
                  toggleDate={toggleDate}
                />
              ))}
            </View>
          ) : (
            <View style={styles.ordersSection}>
              {filteredShipments.map((order, index) => (
                <OrderCard
                  key={`list-${index}`}
                  order={order}
                  onPress={() => handleOrderPress(order)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom Toolbar */}
      <BottomToolbar
        onHome={() => navigation.navigate('MainTabs')}
        onRefresh={onRefresh}
        onReports={() => navigation.navigate('WMSReports')}
        onPerformance={() => navigation.navigate('WMSPickerStats')}
        onQuery={() => setShowQueryModal(true)}
        onProfile={() => setShowProfileModal(true)}
        isRefreshing={refreshing}
        isPicker={isPicker}
        bottomInset={insets.bottom}
      />
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
  headerProfileButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerText: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  instanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  instanceBadgeProd: {
    backgroundColor: '#D32F2F',
  },
  instanceBadgeTest: {
    backgroundColor: '#FF9800',
  },
  instanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  // Overview Section with Sales and Store Cards
  // Date Picker Section
  datePickerSection: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  datePickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 10,
  },
  quickDateButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  quickDateBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  quickDateBtnActive: {
    backgroundColor: '#1565C0',
  },
  quickDateBtnText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  quickDateBtnTextActive: {
    color: '#FFF',
  },
  datePickerDropdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  datePickerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  datePickerLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 10,
  },
  datePickerInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  datePickerApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  datePickerApplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  overviewSection: {
    marginTop: 16,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  overviewHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overviewSummaryText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  overviewCardsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  overviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  overviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  overviewCardTitleContainer: {
    flex: 1,
  },
  overviewCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  overviewOrderCount: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  overviewCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  overviewStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  overviewStatValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  overviewStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  overviewStatDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 10,
  },
  searchClearBtn: {
    padding: 4,
  },
  // Filter Section
  filterSection: {
    marginTop: 16,
    paddingHorizontal: 12,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#1565C0',
    borderColor: '#1565C0',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  // View Mode
  viewModeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  resultCount: {
    fontSize: 13,
    color: '#666',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#1565C0',
  },
  // Pending/All Switch
  pendingSwitch: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 2,
    marginRight: 12,
  },
  pendingSwitchOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  pendingSwitchOptionActive: {
    backgroundColor: '#1565C0',
  },
  pendingSwitchOptionActivePending: {
    backgroundColor: '#FF9800',
  },
  pendingSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  pendingSwitchTextActive: {
    color: '#FFF',
  },
  // Orders Section
  ordersSection: {
    paddingHorizontal: 16,
  },
  // Lorry Group
  lorryGroup: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  lorryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#E3F2FD',
  },
  lorryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lorryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lorryNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565C0',
  },
  lorryStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  lorryContent: {
    padding: 12,
  },
  // Date Group
  dateGroup: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  dateHeaderToday: {
    backgroundColor: '#E8F5E9',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateIconToday: {
    backgroundColor: '#4CAF50',
  },
  dateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  dateNameToday: {
    color: '#2E7D32',
  },
  dateStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  dateStatusSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  miniStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  dateContent: {
    padding: 12,
  },
  // Bay Group
  bayGroup: {
    marginBottom: 12,
  },
  bayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 8,
  },
  bayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#388E3C',
    marginLeft: 8,
    flex: 1,
  },
  bayCount: {
    fontSize: 12,
    color: '#999',
  },
  priorityGroup: {},
  // Order Card
  orderCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNumberContainer: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  orderRightInfo: {
    alignItems: 'flex-end',
  },
  orderDate: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  priorityBadge: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9800',
  },
  accountName: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
  },
  orderMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  shipConfirmReadyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 6,
  },
  shipConfirmReadyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#7B1FA2',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 8,
  },
  tagContainer: {
    flexDirection: 'row',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Bottom Toolbar
  bottomToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  toolbarButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  toolbarButtonText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: width - 40,
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalButtonCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalButtonQuery: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1565C0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonQueryText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalCloseButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#1565C0',
    fontWeight: '600',
  },
  // Reports Modal
  reportsContent: {
    maxHeight: 400,
    padding: 16,
  },
  reportSummary: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reportSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  reportSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportSummaryItem: {
    alignItems: 'center',
  },
  reportSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  reportSummaryLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  reportSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  reportDateRow: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  reportDateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reportDateStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportDateStat: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  reportDateStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  reportDateStatLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  reportTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reportTypeLabel: {
    fontSize: 13,
    color: '#333',
  },
  reportTypeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
  },
  // Performance Modal
  performanceContent: {
    padding: 24,
    alignItems: 'center',
  },
  performanceHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  performanceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
  },
  performanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  performanceStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  performanceStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  performanceStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  performanceProgress: {
    width: '100%',
  },
  performanceProgressLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  performanceProgressBar: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  performanceProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  performanceProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 8,
    textAlign: 'center',
  },
  // Profile Modal Styles
  profileContent: {
    padding: 24,
    alignItems: 'center',
  },
  profileAvatarContainer: {
    marginBottom: 24,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileDetails: {
    width: '100%',
    marginBottom: 24,
  },
  profileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  profileDetailContent: {
    marginLeft: 12,
    flex: 1,
  },
  profileDetailLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  profileDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#F44336',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default WMSHomeScreen;
