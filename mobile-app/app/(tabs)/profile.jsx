import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getSecureToken, deleteSecureToken } from '../../src/auth/storage';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const stored = await getSecureToken('userProfile');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    })();
  }, []);

  const handleLogout = async () => {
    await deleteSecureToken('authToken');
    await deleteSecureToken('userProfile');
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Staff Member'}</Text>
        <Text style={styles.dept}>{user?.department}</Text>
        <Text style={styles.staffId}>College Staff ID: {user?.staffId}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Security & Biometrics</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Biometric Status</Text>
          <Text style={styles.infoValue}>Device Fingerprint Enabled</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Device Binding</Text>
          <Text style={styles.infoValue}>Approved for Requests</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { color: '#fff', fontSize: 18, fontWeight: '700' },
  dept: { color: '#94a3b8', fontSize: 14, marginTop: 2 },
  staffId: { color: '#38bdf8', fontSize: 12, marginTop: 4, fontWeight: '600' },
  section: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 24 },
  sectionTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  infoLabel: { color: '#94a3b8', fontSize: 13 },
  infoValue: { color: '#4ade80', fontSize: 13, fontWeight: '500' },
  logoutBtn: { backgroundColor: '#dc2626', borderRadius: 10, padding: 14, alignItems: 'center' },
  logoutBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
