import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { getSecureToken } from '../../src/auth/storage';
import client from '../../src/api/client';

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

  const isHod = user?.role === 'hod';
  const isAdmin = user?.role === 'admin';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}>
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeHeaderRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'Staff Member'}</Text>
          </View>
          <View style={[styles.roleBadge, isHod && styles.roleBadgeHod, isAdmin && styles.roleBadgeAdmin]}>
            <Text style={styles.roleBadgeText}>
              {user?.role ? user.role.toUpperCase() : 'MEMBER'}
            </Text>
          </View>
        </View>
        <Text style={styles.deptText}>
          {user?.department || 'Department'} &bull; ID: {user?.staffId}
        </Text>
      </View>

      {/* Role-Specific Card for HOD */}
      {(isHod || isAdmin) && (
        <View style={styles.hodSection}>
          <View style={styles.hodCard}>
            <View style={styles.hodCardHeader}>
              <View>
                <Text style={styles.hodTitle}>Department Approvals</Text>
                <Text style={styles.hodSub}>Requisitions awaiting your review</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{pendingApprovalsCount}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.hodActionBtn}
              onPress={() => router.push('/(tabs)/approvals')}>
              <Text style={styles.hodActionText}>
                {pendingApprovalsCount > 0 ? `Review ${pendingApprovalsCount} Pending Request(s) \u2192` : 'Open Approvals Queue \u2192'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick Action: New Requisition */}
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => router.push('/(tabs)/new-request')}>
        <Text style={styles.actionButtonText}>+ Create New Requisition</Text>
        <Text style={styles.actionButtonSub}>Order paper, pens, files & stationery</Text>
      </TouchableOpacity>

      {/* Requisition Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Latest Requisition</Text>
        {recentIndent ? (
          <View style={styles.indentCard}>
            <View style={styles.indentRow}>
              <Text style={styles.indentNo}>{recentIndent.indentNo}</Text>
              <View style={[styles.badge, styles['badge_' + recentIndent.status.toLowerCase()]]}>
                <Text style={[styles.badgeStatusText, styles['text_' + recentIndent.status.toLowerCase()]]}>
                  {recentIndent.status}
                </Text>
              </View>
            </View>
            <Text style={styles.indentDate}>{new Date(recentIndent.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.itemsSummary}>
              {recentIndent.items?.map(i => `${i.qtyRequested}x ${i.nameSnapshot}`).join(', ')}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent requisitions placed.</Text>
          </View>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Biometric Paperless System</Text>
        <Text style={styles.infoDesc}>
          Requisitions are digitally authenticated with your phone's fingerprint sensor. Approved items can be collected directly from the central store counter.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 16 },
  welcomeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  welcomeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  greeting: { color: '#94a3b8', fontSize: 13 },
  userName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 },
  roleBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  roleBadgeHod: { backgroundColor: '#78350f', borderWidth: 1, borderColor: '#d97706' },
  roleBadgeAdmin: { backgroundColor: '#1e3a8a', borderWidth: 1, borderColor: '#3b82f6' },
  roleBadgeText: { color: '#f8fafc', fontSize: 11, fontWeight: '700' },
  deptText: { color: '#38bdf8', fontSize: 13, marginTop: 6, fontWeight: '500' },
  hodSection: { marginBottom: 16 },
  hodCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#b45309',
    backgroundColor: '#181e2e'
  },
  hodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  hodTitle: { color: '#fbbf24', fontSize: 16, fontWeight: '700' },
  hodSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  countBadge: {
    backgroundColor: '#b45309',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  countText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hodActionBtn: {
    backgroundColor: '#d97706',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  hodActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionButton: { backgroundColor: '#2563eb', borderRadius: 12, padding: 18, marginBottom: 20 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionButtonSub: { color: '#bfdbfe', fontSize: 12, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  indentCard: { backgroundColor: '#1e293b', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  indentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  indentNo: { color: '#fff', fontWeight: '700', fontSize: 15 },
  indentDate: { color: '#64748b', fontSize: 12, marginVertical: 4 },
  itemsSummary: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeStatusText: { fontSize: 11, fontWeight: '700' },
  badge_requested: { backgroundColor: '#451a03' },
  text_requested: { color: '#fbbf24' },
  badge_approved: { backgroundColor: '#1e3a8a' },
  text_approved: { color: '#60a5fa' },
  badge_issued: { backgroundColor: '#052e16' },
  text_issued: { color: '#4ade80' },
  badge_rejected: { backgroundColor: '#450a0a' },
  text_rejected: { color: '#f87171' },
  badge_cancelled: { backgroundColor: '#1e293b' },
  text_cancelled: { color: '#94a3b8' },
  emptyCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 8, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 13 },
  infoBox: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', padding: 16, borderRadius: 10 },
  infoTitle: { color: '#38bdf8', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  infoDesc: { color: '#94a3b8', fontSize: 12, lineHeight: 18 }
});
