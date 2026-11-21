import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import client from '../../src/api/client';
import { getSecureToken } from '../../src/auth/storage';
import { parseIndentDetails } from '../../src/utils/indentDetails';

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
        renderItem={({ item }) => {
          const details = parseIndentDetails(item);
          const isUrgent = details.urgency?.toLowerCase() === 'urgent';

          return (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.indentNo}>{item.indentNo}</Text>
                  <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>

                <View style={styles.badgesCol}>
                  {details.urgency ? (
                    <View style={[
                      styles.urgencyBadge,
                      isUrgent ? styles.urgencyBadgeUrgent : styles.urgencyBadgeNormal
                    ]}>
                      <Text style={[
                        styles.urgencyBadgeText,
                        isUrgent ? styles.urgencyTextUrgent : styles.urgencyTextNormal
                      ]}>
                        {details.urgency.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.badge, styles['badge_' + item.status.toLowerCase()]]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              {details.neededBy ? (
                <View style={styles.neededByRow}>
                  <Text style={styles.neededByLabel}>📅 Needed by:</Text>
                  <Text style={styles.neededByValue}>{details.neededBy}</Text>
                </View>
              ) : null}

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

              <View style={styles.footerRow}>
                <Text style={styles.confirmMethod}>
                  Confirmed: {item.confirmation?.method || 'biometric'}
                </Text>
                {item.status === 'ISSUED' && (
                  <Text style={styles.issuedText}>Collected</Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 14 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  indentNo: { color: '#fff', fontSize: 16, fontWeight: '700' },
  date: { color: '#64748b', fontSize: 11, marginTop: 2 },
  badgesCol: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center'
  },
  urgencyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  urgencyBadgeUrgent: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#b91c1c'
  },
  urgencyBadgeNormal: {
    backgroundColor: '#0c4a6e',
    borderWidth: 1,
    borderColor: '#0284c7'
  },
  urgencyBadgeText: {
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
    fontSize: 11,
    fontWeight: '700'
  },
  badge_requested: { backgroundColor: '#451a03', color: '#fbbf24' },
  badge_approved: { backgroundColor: '#0c4a6e', color: '#38bdf8' },
  badge_issued: { backgroundColor: '#052e16', color: '#4ade80' },
  badge_cancelled: { backgroundColor: '#1e293b', color: '#94a3b8' },
  badge_rejected: { backgroundColor: '#450a0a', color: '#f87171' },
  neededByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8
  },
  neededByLabel: {
    color: '#94a3b8',
    fontSize: 12
  },
  neededByValue: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 6
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  itemName: { color: '#cbd5e1', fontSize: 13 },
  itemIssued: { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  metaBox: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8'
  },
  metaLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  metaText: { color: '#e2e8f0', fontSize: 12, marginTop: 2 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  confirmMethod: { color: '#94a3b8', fontSize: 11 },
  issuedText: { color: '#4ade80', fontSize: 11, fontWeight: '700' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 }
});
