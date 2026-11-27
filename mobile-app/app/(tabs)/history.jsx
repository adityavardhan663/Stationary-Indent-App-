import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import client from '../../src/api/client';
import { getSecureToken } from '../../src/auth/storage';
import { parseIndentDetails } from '../../src/utils/indentDetails';
import StatusTimeline from '../../src/components/StatusTimeline';
import StatusBadge from '../../src/components/StatusBadge';
import Card from '../../src/components/Card';
import EmptyState from '../../src/components/EmptyState';
import LoadingState from '../../src/components/LoadingState';
import ErrorState from '../../src/components/ErrorState';
import { colors, radii, spacing, typography, layout } from '../../src/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  const fetchHistory = async () => {
    const token = await getSecureToken('authToken');
    if (!token) return;

    setError(null);
    try {
      const res = await client.get('/indents/mine');
      setIndents(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your requisition history. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LoadingState skeleton count={4} />
      </View>
    );
  }

  if (error && indents.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Could Not Load History"
          message={error}
          onRetry={fetchHistory}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={indents}
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
            icon="📋"
            title="No Requisitions Yet"
            description="You have not submitted any stationery indents. Create your first requisition in seconds."
            actionLabel="+ Create Requisition"
            onAction={() => router.push('/(tabs)/new-request')}
          />
        }
        renderItem={({ item }) => {
          const details = parseIndentDetails(item);
          const isUrgent = details.urgency?.toLowerCase() === 'urgent';
          const isExpanded = !!expandedIds[item._id];

          return (
            <Card
              style={styles.card}
              activeBorder={isUrgent ? colors.dangerBorder : null}>
              {/* Card Header: Indent No & Status */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.indentNo}>{item.indentNo}</Text>
                  <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>

                <View style={styles.badgesCol}>
                  {details.urgency ? (
                    <View
                      style={[
                        styles.urgencyBadge,
                        isUrgent ? styles.urgencyBadgeUrgent : styles.urgencyBadgeNormal
                      ]}>
                      <Text
                        style={[
                          styles.urgencyBadgeText,
                          isUrgent ? styles.urgencyTextUrgent : styles.urgencyTextNormal
                        ]}>
                        {details.urgency.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                  <StatusBadge status={item.status} />
                </View>
              </View>

              {/* Needed By Banner */}
              {details.neededBy ? (
                <View style={styles.neededByRow}>
                  <Text style={styles.neededByLabel}>📅 Needed by:</Text>
                  <Text style={styles.neededByValue}>{details.neededBy}</Text>
                </View>
              ) : null}

              {/* Items List */}
              <View style={styles.itemsList}>
                {item.items?.map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>&bull; {it.qtyRequested}x {it.nameSnapshot}</Text>
                    {it.qtyIssued > 0 && (
                      <Text style={styles.itemIssued}>(Issued: {it.qtyIssued})</Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Purpose & Notes */}
              {details.purpose ? (
                <View style={styles.metaBox}>
                  <Text style={styles.metaLabel}>Purpose / Reason:</Text>
                  <Text style={styles.metaText}>{details.purpose}</Text>
                </View>
              ) : null}

              {details.notes ? (
                <View style={styles.metaBox}>
                  <Text style={styles.metaLabel}>Notes:</Text>
                  <Text style={styles.metaText}>{details.notes}</Text>
                </View>
              ) : null}

              {details.displayRemarks ? (
                <View style={styles.metaBox}>
                  <Text style={styles.metaLabel}>Remarks:</Text>
                  <Text style={styles.metaText}>{details.displayRemarks}</Text>
                </View>
              ) : null}

              {/* Footer Row */}
              <View style={styles.footerRow}>
                <Text style={styles.confirmMethod}>
                  🔒 Authenticated via {item.confirmation?.method || 'biometric'}
                </Text>
                {item.status === 'ISSUED' && (
                  <Text style={styles.issuedText}>✓ Collected at Counter</Text>
                )}
              </View>

              {/* Collapsible Track Request Section */}
              <TouchableOpacity
                style={styles.trackToggleBtn}
                onPress={() => toggleExpand(item._id)}
                activeOpacity={0.7}
                accessibilityLabel={isExpanded ? 'Hide request timeline' : 'Track request timeline'}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  listContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  indentNo: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700'
  },
  date: {
    color: colors.textDim,
    fontSize: typography.xs,
    marginTop: 2
  },
  badgesCol: {
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
  urgencyBadgeText: {
    fontSize: typography.xs - 1,
    fontWeight: '700'
  },
  urgencyTextUrgent: {
    color: colors.dangerLight
  },
  urgencyTextNormal: {
    color: colors.primaryLight
  },
  neededByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm
  },
  neededByLabel: {
    color: colors.textMuted,
    fontSize: typography.xs
  },
  neededByValue: {
    color: colors.primaryLight,
    fontSize: typography.xs,
    fontWeight: '700'
  },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
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
  itemIssued: {
    color: colors.successLight,
    fontSize: typography.xs,
    fontWeight: '600'
  },
  metaBox: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: typography.xs - 1,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  metaText: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    marginTop: spacing.xxs
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  confirmMethod: {
    color: colors.textMuted,
    fontSize: typography.xs
  },
  issuedText: {
    color: colors.successLight,
    fontSize: typography.xs,
    fontWeight: '700'
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
  }
});
