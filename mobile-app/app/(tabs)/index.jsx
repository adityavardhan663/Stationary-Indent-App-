import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { getSecureToken } from '../../src/auth/storage';
import client from '../../src/api/client';
import { colors, radii, spacing, typography } from '../../src/theme';
import Card from '../../src/components/Card';
import StatusBadge from '../../src/components/StatusBadge';
import PrimaryButton from '../../src/components/PrimaryButton';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [recentIndent, setRecentIndent] = useState(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadHomeData = async () => {
    const token = await getSecureToken('authToken');
    if (!token) return;

    try {
      const stored = await getSecureToken('userProfile');
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);

        // If HOD or Admin, fetch pending department approvals count
        if (u.role === 'hod' || u.role === 'admin') {
          try {
            const approvalsRes = await client.get('/indents?status=REQUESTED');
            if (approvalsRes.data?.data) {
              setPendingApprovalsCount(approvalsRes.data.data.length);
            }
          } catch (e) {
            console.warn('Could not fetch approvals count:', e.message);
          }
        }
      }

      // Fetch user's own latest indent
      const res = await client.get('/indents/mine');
      if (res.data?.data?.length > 0) {
        setRecentIndent(res.data.data[0]);
      } else {
        setRecentIndent(null);
      }
    } catch (err) {
      console.warn('Could not load indents:', err.message);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

  const isHod = user?.role === 'hod';
  const isAdmin = user?.role === 'admin';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primaryLight}
        />
      }>
      {/* Welcome Card */}
      <Card style={styles.welcomeCard}>
        <View style={styles.welcomeHeaderRow}>
          <View style={styles.welcomeTextGroup}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Staff Member'}</Text>
          </View>
          <View
            style={[
              styles.roleBadge,
              isHod && styles.roleBadgeHod,
              isAdmin && styles.roleBadgeAdmin
            ]}>
            <Text style={styles.roleBadgeText}>
              {user?.role ? user.role.toUpperCase() : 'MEMBER'}
            </Text>
          </View>
        </View>

        <View style={styles.deptRow}>
          <Text style={styles.deptIcon}>🏛️</Text>
          <Text style={styles.deptText}>
            {user?.department || 'Department'} &bull; Staff ID: {user?.staffId || 'N/A'}
          </Text>
        </View>
      </Card>

      {/* Role-Specific HOD Pending Approvals Banner */}
      {(isHod || isAdmin) && (
        <Card
          style={styles.hodCard}
          activeBorder={pendingApprovalsCount > 0 ? colors.warning : colors.border}
          onPress={() => router.push('/(tabs)/approvals')}>
          <View style={styles.hodCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hodTitle}>Department Approvals</Text>
              <Text style={styles.hodSub}>Requisitions awaiting your review</Text>
            </View>
            <View style={[styles.countBadge, pendingApprovalsCount > 0 && styles.countBadgeActive]}>
              <Text style={styles.countText}>{pendingApprovalsCount}</Text>
            </View>
          </View>

          <View style={styles.hodLinkRow}>
            <Text style={styles.hodActionText}>
              {pendingApprovalsCount > 0
                ? `Review ${pendingApprovalsCount} Pending Request(s) →`
                : 'Open Approvals Queue →'}
            </Text>
          </View>
        </Card>
      )}

      {/* Quick Action: New Requisition */}
      <Card
        style={styles.actionCard}
        onPress={() => router.push('/(tabs)/new-request')}>
        <View style={styles.actionCardRow}>
          <View style={styles.actionIconCircle}>
            <Text style={styles.actionIconText}>✍️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Create New Requisition</Text>
            <Text style={styles.actionSubtitle}>
              Request paper, pens, files, lab stationery & supplies
            </Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </View>
      </Card>

      {/* Requisition Status Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Latest Requisition</Text>
          {recentIndent && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentIndent ? (
          <Card
            style={styles.indentCard}
            onPress={() => router.push('/(tabs)/history')}>
            <View style={styles.indentHeaderRow}>
              <View>
                <Text style={styles.indentNo}>{recentIndent.indentNo}</Text>
                <Text style={styles.indentDate}>
                  {new Date(recentIndent.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </View>
              <StatusBadge status={recentIndent.status} />
            </View>

            <View style={styles.itemsSummaryBox}>
              <Text style={styles.itemsSummaryLabel}>Requested Items:</Text>
              <Text style={styles.itemsSummaryText} numberOfLines={2}>
                {recentIndent.items?.map((i) => `${i.qtyRequested}x ${i.nameSnapshot}`).join(', ') || 'No items listed'}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No recent requisitions placed.</Text>
            <PrimaryButton
              title="+ Place First Requisition"
              onPress={() => router.push('/(tabs)/new-request')}
              variant="outline"
              style={styles.emptyActionBtn}
            />
          </Card>
        )}
      </View>

      {/* Urgent Request Hint Banner */}
      <Card style={styles.urgentHintCard}>
        <View style={styles.urgentHintRow}>
          <Text style={styles.urgentHintIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.urgentHintTitle}>Need Supplies Urgently?</Text>
            <Text style={styles.urgentHintDesc}>
              For emergency examinations or laboratory sessions, select Urgent in Step 2 of the requisition form. Urgent requests receive express priority review.
            </Text>
          </View>
        </View>
      </Card>

      {/* System Security Notice */}
      <View style={styles.securityBox}>
        <Text style={styles.securityText}>
          🔒 Institutional Device Security: All submissions are authenticated with your hardware screen lock or biometric fingerprint.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  welcomeCard: {
    padding: spacing.xl,
    marginBottom: spacing.md
  },
  welcomeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  welcomeTextGroup: {
    flex: 1
  },
  greeting: {
    color: colors.textMuted,
    fontSize: typography.sm
  },
  userName: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '800',
    marginTop: spacing.xxs
  },
  roleBadge: {
    backgroundColor: colors.cardHover,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border
  },
  roleBadgeHod: {
    backgroundColor: colors.warningSubtle,
    borderColor: colors.warningBorder
  },
  roleBadgeAdmin: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary
  },
  roleBadgeText: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: '700'
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md
  },
  deptIcon: {
    fontSize: 14,
    marginRight: spacing.xs
  },
  deptText: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '600'
  },

  // HOD card
  hodCard: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.warningBorder,
    marginBottom: spacing.md
  },
  hodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  hodTitle: {
    color: colors.warningLight,
    fontSize: typography.md,
    fontWeight: '700'
  },
  hodSub: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginTop: 2
  },
  countBadge: {
    backgroundColor: colors.border,
    minWidth: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  countBadgeActive: {
    backgroundColor: colors.warning
  },
  countText: {
    color: '#ffffff',
    fontSize: typography.sm,
    fontWeight: '800'
  },
  hodLinkRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle
  },
  hodActionText: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '600'
  },

  // Action card
  actionCard: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
    marginBottom: spacing.lg
  },
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  actionIconText: {
    fontSize: 20
  },
  actionTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700'
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    marginTop: 2
  },
  actionArrow: {
    color: colors.primaryLight,
    fontSize: typography.xl,
    fontWeight: '700',
    marginLeft: spacing.sm
  },

  // Section
  section: {
    marginBottom: spacing.lg
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700'
  },
  viewAllText: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  indentCard: {
    marginBottom: 0
  },
  indentHeaderRow: {
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
  indentDate: {
    color: colors.textDim,
    fontSize: typography.xs,
    marginTop: 2
  },
  itemsSummaryBox: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: spacing.xs
  },
  itemsSummaryLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '600',
    marginBottom: 2
  },
  itemsSummaryText: {
    color: colors.textSecondary,
    fontSize: typography.sm
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.xs
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginBottom: spacing.md
  },
  emptyActionBtn: {
    minWidth: 190
  },

  // Urgent hint card
  urgentHintCard: {
    backgroundColor: colors.dangerSubtle,
    borderColor: colors.dangerBorder,
    marginBottom: spacing.md
  },
  urgentHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  urgentHintIcon: {
    fontSize: 22,
    marginRight: spacing.md,
    marginTop: 2
  },
  urgentHintTitle: {
    color: colors.dangerLight,
    fontSize: typography.sm,
    fontWeight: '700',
    marginBottom: 2
  },
  urgentHintDesc: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    lineHeight: 16
  },

  // Security Box
  securityBox: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs
  },
  securityText: {
    color: colors.textDim,
    fontSize: typography.xs,
    textAlign: 'center',
    lineHeight: 16
  }
});
