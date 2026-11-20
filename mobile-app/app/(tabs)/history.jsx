import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import client from '../../src/api/client';
import { getSecureToken } from '../../src/auth/storage';

export default function HistoryScreen() {
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    const token = await getSecureToken('authToken');
    if (!token) return;

    setLoading(true);
    try {
      const res = await client.get('/indents/mine');
      setIndents(res.data?.data || []);
    } catch (err) {
      Alert.alert('Error', 'Could not load your indent history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={indents}
        keyExtractor={item => item._id}
        refreshing={loading}
        onRefresh={fetchHistory}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You haven't submitted any indents yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.indentNo}>{item.indentNo}</Text>
              <Text style={[styles.badge, styles['badge_' + item.status.toLowerCase()]]}>
                {item.status}
              </Text>
            </View>

            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>

            <View style={styles.itemsList}>
              {item.items.map((it, idx) => (
                <Text key={idx} style={styles.itemLine}>
                  &bull; {it.qtyRequested}x {it.nameSnapshot} {it.qtyIssued > 0 ? `(Issued: ${it.qtyIssued})` : ''}
                </Text>
              ))}
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.confirmMethod}>
                Confirmed: {item.confirmation?.method || 'biometric'}
              </Text>
              {item.status === 'ISSUED' && (
                <Text style={styles.issuedText}>Collected</Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 14 },
  card: { backgroundColor: '#1e293b', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  indentNo: { color: '#fff', fontSize: 16, fontWeight: '700' },
  date: { color: '#64748b', fontSize: 12, marginTop: 4, marginBottom: 8 },
  itemsList: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 4 },
  itemLine: { color: '#cbd5e1', fontSize: 13, marginBottom: 2 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#334155' },
  confirmMethod: { color: '#94a3b8', fontSize: 11 },
  issuedText: { color: '#4ade80', fontSize: 11, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: 11, fontWeight: '700' },
  badge_requested: { backgroundColor: '#451a03', color: '#fbbf24' },
  badge_issued: { backgroundColor: '#052e16', color: '#4ade80' },
  badge_cancelled: { backgroundColor: '#1e293b', color: '#94a3b8' },
  badge_rejected: { backgroundColor: '#450a0a', color: '#f87171' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 }
});
