import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../theme/colors';
import {
  getRequisitions,
  confirmRequisition,
  cancelRequisition,
  deleteRequisition,
  REQUISITION_STATUS,
} from '../services/stockRequisitionService';

const getStatusColor = (status) => {
  switch (status) {
    case REQUISITION_STATUS.CONFIRMED:
      return colors.accentGreen || '#4CAF50';
    case REQUISITION_STATUS.DRAFT:
      return colors.accentOrange;
    case REQUISITION_STATUS.SUBMITTED:
      return colors.accent;
    case REQUISITION_STATUS.CANCELLED:
      return colors.accentRed || '#E53935';
    default:
      return colors.textMuted;
  }
};

const RequisitionCard = ({ requisition, onPress, onConfirm, onCancel, onDelete }) => {
  const formattedDate = requisition.requestDate
    ? new Date(requisition.requestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <TouchableOpacity style={styles.reqCard} activeOpacity={0.7} onPress={() => onPress(requisition)}>
      <View style={styles.reqHeader}>
        <Text style={styles.reqNumber}>{requisition.seqNo}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(requisition.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(requisition.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(requisition.status) }]}>{requisition.status}</Text>
        </View>
      </View>

      <View style={styles.reqBody}>
        <View style={styles.reqInfo}>
          <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.reqInfoText}>
            From: {requisition.sourceOrg} / {requisition.sourceSubinventory}
          </Text>
        </View>
        <View style={styles.reqInfo}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.reqInfoText}>
            To: {requisition.destOrg} / {requisition.destSubinventory}
          </Text>
        </View>
        <View style={styles.reqInfo}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.reqInfoText}>{formattedDate}</Text>
        </View>
        <View style={styles.reqInfo}>
          <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.reqInfoText}>{requisition.lines?.length || 0} items</Text>
        </View>
      </View>

      {requisition.status === REQUISITION_STATUS.DRAFT && (
        <View style={styles.reqActions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(requisition)}>
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(requisition)}>
            <Ionicons name="close-circle" size={18} color={colors.accentRed || '#E53935'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(requisition)}>
            <Ionicons name="trash" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const StoreRequestsScreen = ({ navigation }) => {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadRequisitions = async () => {
    try {
      const data = await getRequisitions();
      setRequisitions(data || []);
    } catch (error) {
      console.error('Load requisitions error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRequisitions();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadRequisitions();
  };

  const handleReqPress = (req) => {
    setSelectedReq(req);
    setShowDetailModal(true);
  };

  const handleConfirm = async (req) => {
    Alert.alert(
      'Confirm Requisition',
      `Are you sure you want to confirm requisition ${req.seqNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const result = await confirmRequisition(req.id);
            if (result.success) {
              Alert.alert('Success', 'Requisition confirmed');
              loadRequisitions();
            } else {
              Alert.alert('Error', result.error || 'Failed to confirm');
            }
          },
        },
      ]
    );
  };

  const handleCancel = async (req) => {
    Alert.alert(
      'Cancel Requisition',
      `Are you sure you want to cancel requisition ${req.seqNo}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const result = await cancelRequisition(req.id);
            if (result.success) {
              Alert.alert('Success', 'Requisition cancelled');
              loadRequisitions();
            } else {
              Alert.alert('Error', result.error || 'Failed to cancel');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (req) => {
    Alert.alert(
      'Delete Requisition',
      `Are you sure you want to delete requisition ${req.seqNo}? This cannot be undone.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteRequisition(req.id);
            if (result.success) {
              Alert.alert('Success', 'Requisition deleted');
              loadRequisitions();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Requisition Details</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedReq && (
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Header</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Seq No:</Text>
                    <Text style={styles.detailValue}>{selectedReq.seqNo}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text style={[styles.detailValue, { color: getStatusColor(selectedReq.status) }]}>
                      {selectedReq.status}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Request Date:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedReq.requestDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Source:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReq.sourceOrg} / {selectedReq.sourceSubinventory}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Destination:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReq.destOrg} / {selectedReq.destSubinventory}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Lines ({selectedReq.lines?.length || 0})</Text>
                  {selectedReq.lines?.map((line, index) => (
                    <View key={index} style={styles.lineItem}>
                      <View style={styles.lineHeader}>
                        <Text style={styles.lineNo}>{line.lineNo}</Text>
                        <Text style={styles.lineQty}>{line.requestedQty} {line.uom}</Text>
                      </View>
                      <Text style={styles.lineDesc}>{line.itemDescription}</Text>
                      <Text style={styles.lineCode}>{line.itemNumber}</Text>
                      <Text style={styles.lineLot}>Lot: {line.lotNumber}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Requests</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading requisitions...</Text>
          </View>
        ) : requisitions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={80} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Store Requests</Text>
            <Text style={styles.emptyText}>
              Create stock requests from DP Store or GPH Store in the Inventory screen.
            </Text>
          </View>
        ) : (
          <FlatList
            data={requisitions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RequisitionCard
                requisition={item}
                onPress={handleReqPress}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                onDelete={handleDelete}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
            }
          />
        )}
      </View>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  reqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reqNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reqBody: {
    gap: 8,
  },
  reqInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reqInfoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reqActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGreen || '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accentRed || '#E53935',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface || '#F5F5F5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  detailSection: {
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  lineItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lineNo: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  lineQty: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lineDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  lineCode: {
    fontSize: 11,
    color: colors.textMuted,
  },
  lineLot: {
    fontSize: 11,
    color: colors.accentPurple,
  },
});

export default StoreRequestsScreen;
