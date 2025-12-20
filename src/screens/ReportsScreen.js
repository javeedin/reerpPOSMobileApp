import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');

const ReportCard = ({ title, icon, value, subtitle, color, onPress }) => (
  <TouchableOpacity style={styles.reportCard} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.reportIconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={28} color={color} />
    </View>
    <Text style={styles.reportTitle}>{title}</Text>
    {value && <Text style={styles.reportValue}>{value}</Text>}
    {subtitle && <Text style={styles.reportSubtitle}>{subtitle}</Text>}
  </TouchableOpacity>
);

const QuickStatCard = ({ title, value, change, isPositive }) => (
  <View style={styles.quickStatCard}>
    <Text style={styles.quickStatTitle}>{title}</Text>
    <Text style={styles.quickStatValue}>{value}</Text>
    <View style={styles.changeContainer}>
      <Ionicons
        name={isPositive ? 'arrow-up' : 'arrow-down'}
        size={14}
        color={isPositive ? colors.accentGreen : colors.accentRed}
      />
      <Text style={[styles.changeText, { color: isPositive ? colors.accentGreen : colors.accentRed }]}>
        {change}
      </Text>
    </View>
  </View>
);

const ReportsScreen = ({ navigation }) => {
  const reportTypes = [
    { title: 'Sales Report', icon: 'trending-up', color: colors.accent, value: '$45,230', subtitle: 'This Month' },
    { title: 'Inventory Report', icon: 'cube', color: colors.accentPurple, value: '2,340', subtitle: 'Items' },
    { title: 'Customer Report', icon: 'people', color: colors.accentGreen, value: '856', subtitle: 'Active' },
    { title: 'Lodgment Report', icon: 'receipt', color: colors.accentOrange, value: '124', subtitle: 'Pending' },
    { title: 'Daily Summary', icon: 'today', color: colors.secondary, value: '$3,450', subtitle: 'Today' },
    { title: 'Tax Report', icon: 'document-text', color: colors.accentRed, value: '$890', subtitle: 'VAT Collected' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Blue Header Only */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('AccountDetails')} style={styles.menuButton}>
          <Ionicons name="person-circle" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* White Content Area */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          <TouchableOpacity style={styles.dateRangeButton}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <Text style={styles.dateRangeText}>Jan 1 - Jan 31, 2024</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsContainer}>
          <QuickStatCard title="Revenue" value="$45.2K" change="12%" isPositive={true} />
          <QuickStatCard title="Orders" value="328" change="8%" isPositive={true} />
          <QuickStatCard title="Returns" value="12" change="3%" isPositive={false} />
        </View>

        {/* Report Types Grid */}
        <Text style={styles.sectionTitle}>Reports</Text>
        <View style={styles.reportsGrid}>
          {reportTypes.map((report, index) => (
            <ReportCard
              key={index}
              title={report.title}
              icon={report.icon}
              value={report.value}
              subtitle={report.subtitle}
              color={report.color}
              onPress={() => {}}
            />
          ))}
        </View>

        {/* Recent Reports */}
        <Text style={styles.sectionTitle}>Recent Reports</Text>
        <View style={styles.recentReportsContainer}>
          {['Sales Report - Jan 15', 'Inventory Audit - Jan 14', 'Daily Summary - Jan 13'].map((report, index) => (
            <TouchableOpacity key={index} style={styles.recentReportItem}>
              <View style={styles.recentReportLeft}>
                <Ionicons name="document-text-outline" size={22} color={colors.accent} />
                <Text style={styles.recentReportText}>{report}</Text>
              </View>
              <Ionicons name="download-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingBottom: 20,
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  filterButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dateRangeContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dateRangeText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 24,
    gap: 8,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickStatTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 24,
  },
  reportCard: {
    width: (width - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  reportIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  reportValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
  },
  reportSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  recentReportsContainer: {
    paddingHorizontal: 16,
  },
  recentReportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  recentReportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentReportText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  bottomSpacer: {
    height: 100,
  },
});

export default ReportsScreen;
