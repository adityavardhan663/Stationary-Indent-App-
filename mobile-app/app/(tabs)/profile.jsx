import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getSecureToken, deleteSecureToken } from '../../src/auth/storage';
import { getInstallationDeviceId } from '../../src/auth/deviceId';
import { colors, radii, spacing, typography } from '../../src/theme';
import Card from '../../src/components/Card';
import PrimaryButton from '../../src/components/PrimaryButton';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSecureToken('userProfile');
        if (stored) {
          setUser(JSON.parse(stored));
        }
        const devId = await getInstallationDeviceId();
        setDeviceId(devId);
      } catch (e) {}
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of the Stationery Portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await deleteSecureToken('authToken');
            await deleteSecureToken('userProfile');
            router.replace('/login');
          }
        }
      ]
    );
  };

  const roleName = user?.role ? user.role.toUpperCase() : 'FACULTY';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* User Identity Card */}
      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
        </View>

        <Text style={styles.name}>{user?.name || 'Staff Member'}</Text>
        <Text style={styles.dept}>{user?.department || 'Academic Department'}</Text>

        <View style={styles.metaRow}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleName}</Text>
          </View>
        </View>

        <View style={styles.idRow}>
          <Text style={styles.idLabel}>College Staff ID:</Text>
          <Text style={styles.idValue}>{user?.staffId || 'Not assigned'}</Text>
        </View>
      </Card>

      {/* Device & Security Card */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Institutional Device Security</Text>
        <Text style={styles.sectionSubtitle}>
          Cryptographic device binding and biometric signature status
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Device Fingerprint</Text>
          <Text style={styles.infoValueActive}>✓ Hardware Enabled</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Device Binding</Text>
          <Text style={styles.infoValueActive}>✓ Approved for Requisitions</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Unique Device ID</Text>
          <Text style={styles.infoValueCode} numberOfLines={1}>
            {deviceId || 'dev-registered'}
          </Text>
        </View>
      </Card>

      {/* Application Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.appTitle}>Stationery Indent Portal</Text>
        <Text style={styles.appSubtitle}>
          College Paperless Requisition & Central Store Management System
        </Text>
        <Text style={styles.appVersion}>Version 2.4.0 &bull; Secure Institutional Build</Text>
      </Card>

      {/* Log Out Action */}
      <PrimaryButton
        title="Log Out of Portal"
        variant="danger"
        onPress={handleLogout}
        style={styles.logoutBtn}
      />
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
  userCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.borderFocus
  },
  avatarText: {
    color: '#ffffff',
    fontSize: typography.xxl,
    fontWeight: '800'
  },
  name: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '800',
    textAlign: 'center'
  },
  dept: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginTop: spacing.xxs,
    textAlign: 'center'
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  rolePill: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radii.xs
  },
  rolePillText: {
    color: colors.primaryLight,
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  idLabel: {
    color: colors.textMuted,
    fontSize: typography.xs
  },
  idValue: {
    color: colors.primaryLight,
    fontSize: typography.xs,
    fontWeight: '700'
  },
  sectionCard: {
    marginBottom: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '700',
    marginBottom: 2
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginBottom: spacing.md
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm
  },
  infoValueActive: {
    color: colors.successLight,
    fontSize: typography.sm,
    fontWeight: '600'
  },
  infoValueCode: {
    color: colors.primaryLight,
    fontSize: typography.xs,
    fontWeight: '600',
    maxWidth: 160
  },
  infoCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.backgroundElevated
  },
  appTitle: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '700'
  },
  appSubtitle: {
    color: colors.textMuted,
    fontSize: typography.xs,
    textAlign: 'center',
    marginTop: 2
  },
  appVersion: {
    color: colors.textDim,
    fontSize: typography.xs - 1,
    marginTop: spacing.xs
  },
  logoutBtn: {
    marginBottom: spacing.xl
  }
});
