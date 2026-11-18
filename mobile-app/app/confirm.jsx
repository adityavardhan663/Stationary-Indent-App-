import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import client from '../src/api/client';
import { authenticateBiometrics } from '../src/biometrics/confirm';

export default function ConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  const parsedItems = params.items ? JSON.parse(params.items) : [];
  const remarks = params.remarks || '';

  const handleBiometricConfirm = async () => {
    setLoading(true);
    try {
      const authResult = await authenticateBiometrics('Touch fingerprint sensor to confirm your stationery indent');

      if (!authResult.success) {
        Alert.alert('Verification Failed', 'Biometric authentication was cancelled or could not be verified.');
        setLoading(false);
        return;
      }

      const payload = {
        items: parsedItems.map(i => ({ itemId: i.itemId, quantity: i.qty })),
        confirmation: {
          method: authResult.method || 'biometric',
          deviceId: 'dev-phone-app'
        },
        remarks
      };

      const res = await client.post('/indents', payload);
      if (res.data?.data) {
        Alert.alert(
          'Requisition Confirmed!',
          `Indent No: ${res.data.data.indentNo}\nPlease collect items from the central stationery counter.`,
          [{ text: 'View History', onPress: () => router.replace('/(tabs)/history') }]
        );
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Review Requisition</Text>
        <Text style={styles.subtitle}>Verify items before signing with biometrics</Text>

        <View style={styles.itemsList}>
          {parsedItems.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemQty}>{it.qty} {it.unit || 'units'}</Text>
            </View>
          ))}
        </View>

        {remarks ? (
          <View style={styles.remarksBox}>
            <Text style={styles.remarksLabel}>Purpose / Remarks:</Text>
            <Text style={styles.remarksText}>{remarks}</Text>
          </View>
        ) : null}

        <View style={styles.authBox}>
          <Text style={styles.authNotice}>
            Pressing below activates your device fingerprint sensor or screen lock to create an encrypted digital signature.
          </Text>

          <TouchableOpacity
            style={[styles.confirmBtn, loading && styles.btnDisabled]}
            onPress={handleBiometricConfirm}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>Touch Fingerprint to Sign</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
            disabled={loading}>
            <Text style={styles.cancelBtnText}>Back / Modify Items</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 16, justifyContent: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#334155' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 4, marginBottom: 16 },
  itemsList: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12, marginBottom: 16 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemName: { color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
  itemQty: { color: '#38bdf8', fontSize: 14, fontWeight: '700' },
  remarksBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 16 },
  remarksLabel: { color: '#64748b', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  remarksText: { color: '#e2e8f0', fontSize: 13 },
  authBox: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 16 },
  authNotice: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  confirmBtn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnDisabled: { opacity: 0.7 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { padding: 10, alignItems: 'center' },
  cancelBtnText: { color: '#94a3b8', fontSize: 13 }
});
