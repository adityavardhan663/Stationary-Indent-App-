import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import client from '../src/api/client';
import { authenticateBiometrics } from '../src/biometrics/confirm';
import { getInstallationDeviceId } from '../src/auth/deviceId';
import { colors, spacing, radii, radius } from '../src/theme';
import PrimaryButton from '../src/components/PrimaryButton';

export default function ConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  const parsedItems = params.items ? JSON.parse(params.items) : [];
  const remarks = params.remarks || '';

  const handleBiometricConfirm = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Fingerprint confirmation is only available in the mobile app');
      return;
    }
    setLoading(true);
    try {
      const authResult = await authenticateBiometrics('Touch fingerprint sensor to confirm your stationery indent');

      if (!authResult.success) {
        if (authResult.blocked) {
          Alert.alert('Screen Lock Required', authResult.error);
        } else if (authResult.cancelled) {
          Alert.alert('Verification Cancelled', 'Requisition was not submitted. You can try again when ready.');
        } else {
          Alert.alert('Verification Failed', authResult.error || 'Authentication could not be verified.');
        }
        return;
      }

      // Resolve persistent installation deviceId
      const deviceId = await getInstallationDeviceId();

      const payload = {
        items: parsedItems.map(i => ({ itemId: i.itemId, quantity: i.qty })),
        confirmation: {
          method: authResult.method || 'biometric',
          deviceId
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
            {Platform.OS === 'web'
              ? 'Fingerprint confirmation is only available in the mobile app'
              : 'Pressing below activates your device fingerprint sensor or screen lock to create an encrypted digital signature.'}
          </Text>

          <PrimaryButton
            title="Touch Fingerprint to Sign"
            variant="success"
            onPress={handleBiometricConfirm}
            loading={loading}
            disabled={Platform.OS === 'web' || loading}
            style={{ marginBottom: spacing.md }}
          />

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
            disabled={loading}
            accessibilityRole="button">
            <Text style={styles.cancelBtnText}>Back / Modify Items</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  itemsList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginBottom: spacing.lg },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  itemQty: { color: colors.primaryLight, fontSize: 14, fontWeight: '700' },
  remarksBox: { backgroundColor: colors.backgroundElevated, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.lg },
  remarksLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  remarksText: { color: colors.text, fontSize: 13 },
  authBox: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  authNotice: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: spacing.lg },
  cancelBtn: { padding: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  cancelBtnText: { color: colors.textMuted, fontSize: 13 }
});
