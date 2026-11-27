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
  TextInput,
  RefreshControl
} from 'react-native';
import client from '../../src/api/client';
import { getSecureToken } from '../../src/auth/storage';
import { parseIndentDetails } from '../../src/utils/indentDetails';
import StatusTimeline from '../../src/components/StatusTimeline';
import StatusBadge from '../../src/components/StatusBadge';
import Card from '../../src/components/Card';
import ScreenHeader from '../../src/components/ScreenHeader';
import EmptyState from '../../src/components/EmptyState';
import LoadingState from '../../src/components/LoadingState';
import ErrorState from '../../src/components/ErrorState';
import PrimaryButton from '../../src/components/PrimaryButton';
import { colors, radii, spacing, typography, layout } from '../../src/theme';

export default function ApprovalsScreen() {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'decided'
  const [pendingIndents, setPendingIndents] = useState([]);
  const [decidedIndents, setDecidedIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchDepartmentIndents = async () => {
    const token = await getSecureToken('authToken');
    if (!token) return;

    setError(null);
    try {
      const storedUser = await getSecureToken('userProfile');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      const res = await client.get('/indents');
      const all = res.data?.data || [];
      setPendingIndents(all.filter((i) => i.status === 'REQUESTED'));
      setDecidedIndents(all.filter((i) => i.status !== 'REQUESTED'));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load department requisitions. Please check connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDepartmentIndents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDepartmentIndents();
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => ({
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

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LoadingState skeleton count={3} />
      </View>
    );
  }

  if (error && pendingIndents.length === 0 && decidedIndents.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Could Not Load Approvals"
          message={error}
          onRetry={fetchDepartmentIndents}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Department Header */}
      <ScreenHeader
        title={user?.department || 'Department Approvals'}
        subtitle="Department Head Review & Authorization"
        rightElement={
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>
              {pendingIndents.length} PENDING
            </Text>
          </View>
        }
      />

      {/* Segmented Tab Controls */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pending')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending Approvals ({pendingIndents.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'decided' && styles.tabButtonActive]}
          onPress={() => setActiveTab('decided')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, activeTab === 'decided' && styles.tabTextActive]}>
            Decided History ({decidedIndents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {actionLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator color={colors.primaryLight} size="small" />
          <Text style={styles.loadingBannerText}>Updating requisition status...</Text>
        </View>
      )}

      <FlatList
        data={currentList}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
          />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon={activeTab === 'pending' ? '🎉' : '📂'}
            title={activeTab === 'pending' ? 'Queue is Clear' : 'No Decided Records'}
            description={
              activeTab === 'pending'
                ? `No pending requisitions awaiting your HOD approval in ${user?.department || 'your department'}.`
                : 'No past approved or rejected requisitions found for your department.'
            }
          />
        }
        renderItem={({ item }) => {
          const details = parseIndentDetails(item);
          const isUrgent = details.urgency?.toLowerCase() === 'urgent';
          const isExpanded = !!expandedIds[item._id];
          const isPending = item.status === 'REQUESTED';

          return (
            <Card
              style={styles.card}
              activeBorder={isUrgent ? colors.dangerBorder : null}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.indentNo}>{item.indentNo}</Text>
                  <Text style={styles.requesterInfo}>
                    {item.requester?.name || 'Staff Member'} ({item.requester?.staffId || 'ID'})
                  </Text>
                </View>

                <View style={styles.badgeRow}>
                  {details.urgency ? (
                    <View
                      style={[
                        styles.urgencyBadge,
                        isUrgent ? styles.urgencyBadgeUrgent : styles.urgencyBadgeNormal
                      ]}>
                      <Text
                        style={[
                          styles.urgencyText,
                          isUrgent ? styles.urgencyTextUrgent : styles.urgencyTextNormal
                        ]}>
                        {isUrgent ? '⚠️ URGENT' : details.urgency.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}

                  <StatusBadge status={item.status} />
                </View>
              </View>

              <Text style={styles.timestamp}>
                Requested: {new Date(item.createdAt).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </Text>

              {details.neededBy ? (
                <View style={styles.neededByBanner}>
                  <Text style={styles.neededByLabel}>📅 Needed By:</Text>
                  <Text style={styles.neededByDate}>{details.neededBy}</Text>
                </View>
              ) : null}

              {/* Items Section */}
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

              {/* Purpose & Notes */}
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
                  🔒 Verified via {item.confirmation?.method || 'biometric'} on {item.confirmation?.deviceId || 'device'}
                </Text>
              </View>

              {/* Action Buttons for Pending Items */}
              {isPending && (
                <View style={styles.actionsRow}>
                  <PrimaryButton
                    title="Reject"
                    variant="danger"
                    onPress={() => openRejectModal(item)}
                    disabled={actionLoading}
                    style={styles.actionBtnReject}
                  />

                  <PrimaryButton
                    title="Approve Indent"
                    variant="success"
                    onPress={() => handleApprove(item)}
                    disabled={actionLoading}
                    style={styles.actionBtnApprove}
                  />
                </View>
              )}

              {/* Collapsible Track Request Status Timeline */}
              <TouchableOpacity
                style={styles.trackToggleBtn}
                onPress={() => toggleExpand(item._id)}
                activeOpacity={0.7}
                accessibilityLabel="Toggle request timeline">
                <Text style={styles.trackToggleText}>
                  {isExpanded ? '▴ Hide Request Timeline' : '▾ Track Request Status'}
                </Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.timelineWrapper}>
                  <StatusTimeline indent={item} />
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Reject Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Requisition</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a clear reason for rejecting indent {selectedIndent?.indentNo}:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Existing department stock available / exceeds semester quota"
              placeholderTextColor={colors.textDim}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => setRejectModalVisible(false)}
                style={styles.modalBtnCancel}
              />

              <PrimaryButton
                title="Confirm Rejection"
                variant="danger"
                onPress={handleConfirmReject}
                loading={actionLoading}
                style={styles.modalBtnReject}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md
  },
  listContainer: {
    paddingBottom: spacing.xxxl
  },
  pendingBadge: {
    backgroundColor: colors.warningSubtle,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.xs
  },
  pendingBadgeText: {
    color: colors.warningLight,
    fontSize: typography.xs,
    fontWeight: '800'
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  tabButton: {
    flex: 1,
    minHeight: layout.minTouchTarget - 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm
  },
  tabButtonActive: {
    backgroundColor: colors.primary
  },
  tabText: {
    color: colors.textMuted,
    fontSize: typography.xs + 1,
    fontWeight: '600'
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    justifyContent: 'center'
  },
  loadingBannerText: {
    color: colors.primaryLight,
    fontSize: typography.sm
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  indentNo: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700'
  },
  requesterInfo: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    marginTop: 2,
    fontWeight: '500'
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center'
  },
  urgencyBadge: {
    paddingHorizontal: spacing.sm - 1,
    paddingVertical: spacing.xxs,
    borderRadius: radii.xs,
    borderWidth: 1
  },
  urgencyBadgeUrgent: {
    backgroundColor: colors.dangerSubtle,
    borderColor: colors.dangerBorder
  },
  urgencyBadgeNormal: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderFocus
  },
  urgencyText: {
    fontSize: typography.xs - 1,
    fontWeight: '700'
  },
  urgencyTextUrgent: {
    color: colors.dangerLight
  },
  urgencyTextNormal: {
    color: colors.primaryLight
  },
  timestamp: {
    color: colors.textDim,
    fontSize: typography.xs,
    marginBottom: spacing.sm
  },
  neededByBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight
  },
  neededByLabel: {
    color: colors.textMuted,
    fontSize: typography.xs
  },
  neededByDate: {
    color: colors.primaryLight,
    fontSize: typography.xs,
    fontWeight: '700'
  },
  itemsSection: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '600',
    marginBottom: spacing.xs
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  itemName: {
    color: colors.textSecondary,
    fontSize: typography.sm
  },
  itemQty: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '700'
  },
  detailsBox: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight
  },
  purposeBoxUrgent: {
    borderLeftColor: colors.danger,
    backgroundColor: colors.dangerSubtle
  },
  detailsLabel: {
    color: colors.textMuted,
    fontSize: typography.xs - 1,
    fontWeight: '700',
    marginBottom: 2
  },
  detailsText: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    lineHeight: 16
  },
  biometricBadge: {
    marginVertical: spacing.xs
  },
  biometricText: {
    color: colors.successLight,
    fontSize: typography.xs,
    fontStyle: 'italic'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md
  },
  actionBtnReject: {
    flex: 1
  },
  actionBtnApprove: {
    flex: 1.5
  },
  trackToggleBtn: {
    marginTop: spacing.md,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  trackToggleText: {
    color: colors.primaryLight,
    fontSize: typography.xs + 1,
    fontWeight: '700'
  },
  timelineWrapper: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  modalCard: {
    width: '100%',
    padding: spacing.xl,
    borderRadius: radii.xl
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '700',
    marginBottom: spacing.xxs
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginBottom: spacing.md
  },
  modalInput: {
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    fontSize: typography.sm,
    minHeight: 80,
    marginBottom: spacing.lg
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end'
  },
  modalBtnCancel: {
    minWidth: 100
  },
  modalBtnReject: {
    minWidth: 140
  }
});
