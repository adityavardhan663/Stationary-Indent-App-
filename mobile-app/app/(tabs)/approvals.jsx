import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import client from '../../src/api/client';
import { getSecureToken } from '../../src/auth/storage';
import { parseIndentDetails } from '../../src/utils/indentDetails';
import StatusTimeline from '../../src/components/StatusTimeline';

export default function ApprovalsScreen() {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'decided'
  const [pendingIndents, setPendingIndents] = useState([]);
  const [decidedIndents, setDecidedIndents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchDepartmentIndents = async () => {
    const token = await getSecureToken('authToken');
    if (!token) return;

    setLoading(true);
    try {
      const storedUser = await getSecureToken('userProfile');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      // Fetch all department indents
      const res = await client.get('/indents');
      const all = res.data?.data || [];
      setPendingIndents(all.filter(i => i.status === 'REQUESTED'));
      setDecidedIndents(all.filter(i => i.status !== 'REQUESTED'));
    } catch (err) {
      console.warn('Failed to load approvals:', err.message);
      Alert.alert('Error', err.response?.data?.message || 'Could not load department requisitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentIndents();
  }, []);

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleApprove = async (indent) => {
    Alert.alert(
      'Approve Requisition',
      `Approve indent ${indent.indentNo} submitted by ${indent.requester?.name || 'Faculty'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await client.patch(`/indents/${indent._id}/approve`);
              if (res.data?.data) {
                Alert.alert('Approved', `Indent ${indent.indentNo} has been approved.`);
                fetchDepartmentIndents();
              }
            } catch (err) {
              Alert.alert('Approval Failed', err.response?.data?.message || err.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const openRejectModal = (indent) => {
    setSelectedIndent(indent);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedIndent) return;

    setActionLoading(true);
    try {
      const res = await client.patch(`/indents/${selectedIndent._id}/reject`, {
        remarks: rejectReason.trim() || 'Rejected by Department Head'
      });
      if (res.data?.data) {
        setRejectModalVisible(false);
        setSelectedIndent(null);
        Alert.alert('Rejected', `Indent ${selectedIndent.indentNo} has been rejected.`);
        fetchDepartmentIndents();
      }
    } catch (err) {
      Alert.alert('Rejection Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const currentList = activeTab === 'pending' ? pendingIndents : decidedIndents;

  return (
    <View style={styles.container}>
      {/* Department Info Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerDept}>
          Department: <Text style={styles.deptHighlight}>{user?.department || 'My Department'}</Text>
        </Text>
        <Text style={styles.headerCount}>{pendingIndents.length} Pending</Text>
      </View>

      {/* Segmented Tab Bar: Pending vs Decided */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending Approvals ({pendingIndents.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'decided' && styles.tabButtonActive]}
          onPress={() => setActiveTab('decided')}>
          <Text style={[styles.tabText, activeTab === 'decided' && styles.tabTextActive]}>
            Decided History ({decidedIndents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {actionLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator color="#38bdf8" size="small" />
          <Text style={styles.loadingBannerText}>Updating requisition status...</Text>
        </View>
      )}

      <FlatList
        data={currentList}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={fetchDepartmentIndents}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'Queue is Clear' : 'No Decided Records'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending'
                ? `No pending requisitions awaiting your HOD approval in ${user?.department || 'your department'}.`
                : 'No past approved or rejected requisitions found for your department.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const details = parseIndentDetails(item);
          const isUrgent = details.urgency?.toLowerCase() === 'urgent';
          const isExpanded = !!expandedIds[item._id];
          const isPending = item.status === 'REQUESTED';

          return (
            <View style={[styles.card, isUrgent && styles.cardUrgentBorder]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.indentNo}>{item.indentNo}</Text>
                  <Text style={styles.requesterInfo}>
                    {item.requester?.name || 'Staff Member'} ({item.requester?.staffId || 'ID'})
                  </Text>
                </View>

                <View style={styles.badgeRow}>
                  {details.urgency ? (
                    <View style={[
                      styles.urgencyBadge,
                      isUrgent ? styles.urgencyBadgeUrgent : styles.urgencyBadgeNormal
                    ]}>
                      <Text style={[
                        styles.urgencyText,
                        isUrgent ? styles.urgencyTextUrgent : styles.urgencyTextNormal
                      ]}>
                        {isUrgent ? '⚠️ URGENT' : details.urgency.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.badge, styles['badge_' + item.status?.toLowerCase()]]}>
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.timestamp}>
                Requested: {new Date(item.createdAt).toLocaleString()}
              </Text>

              {details.neededBy ? (
                <View style={styles.neededByBanner}>
                  <Text style={styles.neededByLabel}>📅 Needed By:</Text>
                  <Text style={styles.neededByDate}>{details.neededBy}</Text>
                </View>
              ) : null}

              <View style={styles.itemsSection}>
                <Text style={styles.sectionSubtitle}>Requested Items:</Text>
                {item.items?.map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>&bull; {it.nameSnapshot}</Text>
                    <Text style={styles.itemQty}>
                      {it.qtyRequested} {it.unit}
                      {it.qtyIssued > 0 && ` (Issued: ${it.qtyIssued})`}
                    </Text>
                  </View>
                ))}
              </View>

              {details.purpose ? (
                <View style={[styles.detailsBox, isUrgent && styles.purposeBoxUrgent]}>
                  <Text style={styles.detailsLabel}>Purpose / Reason:</Text>
                  <Text style={styles.detailsText}>{details.purpose}</Text>
                </View>
              ) : null}

              {details.notes ? (
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsLabel}>Special Instructions / Notes:</Text>
                  <Text style={styles.detailsText}>{details.notes}</Text>
                </View>
              ) : null}

              {details.displayRemarks ? (
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsLabel}>Remarks / Decision Note:</Text>
                  <Text style={styles.detailsText}>{details.displayRemarks}</Text>
                </View>
              ) : null}

              <View style={styles.biometricBadge}>
                <Text style={styles.biometricText}>
                  🔒 Verified via {item.confirmation?.method || 'biometric'} on {item.confirmation?.deviceId || 'registered device'}
                </Text>
              </View>

              {/* Action Buttons for Pending Requisitions */}
              {isPending && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.rejectBtn]}
                    onPress={() => openRejectModal(item)}
                    disabled={actionLoading}>
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.approveBtn]}
                    onPress={() => handleApprove(item)}
                    disabled={actionLoading}>
                    <Text style={styles.approveBtnText}>Approve Indent</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Collapsible Track Request Status Timeline */}
              <TouchableOpacity
                style={styles.trackToggleBtn}
                onPress={() => toggleExpand(item._id)}
                activeOpacity={0.7}>
                <Text style={styles.trackToggleText}>
                  {isExpanded ? '▴ Hide Request Timeline' : '▾ Track Request Status'}
                </Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.timelineWrapper}>
                  <StatusTimeline indent={item} />
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Requisition</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejecting indent {selectedIndent?.indentNo}:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Existing department stock available / exceeds semester quota"
              placeholderTextColor="#64748b"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmRejectBtn]}
                onPress={handleConfirmReject}
                disabled={actionLoading}>
                <Text style={styles.modalConfirmRejectText}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 14 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  headerDept: { color: '#94a3b8', fontSize: 13 },
  deptHighlight: { color: '#38bdf8', fontWeight: '700' },
  headerCount: { color: '#fbbf24', fontSize: 13, fontWeight: '700' },

  // Segmented Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6
  },
  tabButtonActive: {
    backgroundColor: '#2563eb'
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700'
  },

  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    justifyContent: 'center'
  },
  loadingBannerText: { color: '#38bdf8', fontSize: 13 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardUrgentBorder: {
    borderColor: '#b91c1c'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  indentNo: { color: '#fff', fontSize: 16, fontWeight: '700' },
  requesterInfo: { color: '#cbd5e1', fontSize: 13, marginTop: 2, fontWeight: '500' },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center'
  },
  urgencyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4
  },
  urgencyBadgeUrgent: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  urgencyBadgeNormal: {
    backgroundColor: '#0c4a6e',
    borderWidth: 1,
    borderColor: '#0284c7'
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700'
  },
  urgencyTextUrgent: {
    color: '#f87171'
  },
  urgencyTextNormal: {
    color: '#38bdf8'
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  badge_requested: {
    backgroundColor: '#451a03',
    borderColor: '#b45309'
  },
  'badge_requested Text': {
    color: '#fbbf24'
  },
  badge_approved: {
    backgroundColor: '#0c4a6e',
    borderColor: '#0284c7'
  },
  badge_issued: {
    backgroundColor: '#052e16',
    borderColor: '#16a34a'
  },
  badge_rejected: {
    backgroundColor: '#450a0a',
    borderColor: '#dc2626'
  },
  badge_cancelled: {
    backgroundColor: '#1e293b',
    borderColor: '#475569'
  },
  timestamp: { color: '#64748b', fontSize: 12, marginBottom: 8 },
  neededByBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8'
  },
  neededByLabel: {
    color: '#94a3b8',
    fontSize: 12
  },
  neededByDate: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  itemsSection: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  sectionSubtitle: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  itemName: { color: '#e2e8f0', fontSize: 13 },
  itemQty: { color: '#38bdf8', fontSize: 13, fontWeight: '700' },
  detailsBox: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8'
  },
  purposeBoxUrgent: {
    borderLeftColor: '#ef4444',
    backgroundColor: '#1c1917'
  },
  detailsLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  detailsText: { color: '#cbd5e1', fontSize: 12, lineHeight: 16 },
  biometricBadge: { marginVertical: 6 },
  biometricText: { color: '#4ade80', fontSize: 11, fontStyle: 'italic' },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12
  },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  approveBtn: { backgroundColor: '#16a34a' },
  approveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rejectBtn: { backgroundColor: '#334155', borderWidth: 1, borderColor: '#ef4444' },
  rejectBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  trackToggleBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  trackToggleText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  timelineWrapper: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  emptyContainer: { padding: 48, alignItems: 'center' },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  modalInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
    fontSize: 13,
    marginBottom: 16
  },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  modalCancelBtn: { backgroundColor: '#334155' },
  modalCancelText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  modalConfirmRejectBtn: { backgroundColor: '#dc2626' },
  modalConfirmRejectText: { color: '#fff', fontSize: 13, fontWeight: '600' }
});
