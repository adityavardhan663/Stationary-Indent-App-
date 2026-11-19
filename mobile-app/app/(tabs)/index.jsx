import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { getSecureToken } from '../../src/auth/storage';
import client from '../../src/api/client';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [recentIndent, setRecentIndent] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await getSecureToken('authToken');
      if (!token) return;

      const stored = await getSecureToken('userProfile');
      if (stored) {
        setUser(JSON.parse(stored));
      }

      try {
        const res = await client.get('/indents/mine');
        if (res.data?.data?.length > 0) {
          setRecentIndent(res.data.data[0]);
        }
      } catch (err) {
        console.warn('Could not load indents:', err.message);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.welcomeCard}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.name || 'Faculty Member'}</Text>
        <Text style={styles.deptText}>{user?.department || 'Department'} &bull; {user?.staffId}</Text>
      </View>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => router.push('/(tabs)/new-request')}>
        <Text style={styles.actionButtonText}>+ Create New Requisition</Text>
        <Text style={styles.actionButtonSub}>Order paper, pens, files & supplies</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest Requisition Status</Text>
        {recentIndent ? (
          <View style={styles.indentCard}>
            <View style={styles.indentRow}>
              <Text style={styles.indentNo}>{recentIndent.indentNo}</Text>
              <Text style={[styles.badge, styles['badge_' + recentIndent.status.toLowerCase()]]}>
                {recentIndent.status}
              </Text>
            </View>
            <Text style={styles.indentDate}>{new Date(recentIndent.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.itemsSummary}>
              {recentIndent.items.map(i => `${i.qtyRequested}x ${i.nameSnapshot}`).join(', ')}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent requisitions placed.</Text>
          </View>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Biometric Digital Signature</Text>
        <Text style={styles.infoDesc}>
          Every indent is authenticated using your phone's fingerprint sensor or screen lock. No physical register signatures needed.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 16 },
  welcomeCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 20, marginBottom: 16 },
  greeting: { color: '#94a3b8', fontSize: 13 },
  userName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 },
  deptText: { color: '#38bdf8', fontSize: 13, marginTop: 4 },
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
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: 11, fontWeight: '700' },
  badge_requested: { backgroundColor: '#451a03', color: '#fbbf24' },
  badge_issued: { backgroundColor: '#052e16', color: '#4ade80' },
  badge_cancelled: { backgroundColor: '#1e293b', color: '#94a3b8' },
  emptyCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 8, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 13 },
  infoBox: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', padding: 16, borderRadius: 10 },
  infoTitle: { color: '#38bdf8', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  infoDesc: { color: '#94a3b8', fontSize: 12, lineHeight: 18 }
});
