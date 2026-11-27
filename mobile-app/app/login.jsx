import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import client from '../src/api/client';
import { saveSecureToken } from '../src/auth/storage';
import { getInstallationDeviceId } from '../src/auth/deviceId';
import { colors, radii, spacing, typography, layout } from '../src/theme';
import PrimaryButton from '../src/components/PrimaryButton';
import Card from '../src/components/Card';

export default function LoginScreen() {
  const router = useRouter();
  const [staffId, setStaffId] = useState('FAC101');
  const [password, setPassword] = useState('Password@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    if (!staffId.trim() || !password) {
      setErrorMessage('Please enter both Staff ID and Password.');
      return;
    }

    setLoading(true);
    try {
      const deviceId = await getInstallationDeviceId();
      const res = await client.post('/auth/login', {
        staffId: staffId.trim().toUpperCase(),
        password,
        deviceId
      });

      if (res.data?.data?.token) {
        const user = res.data.data.user;
        if (user?.role === 'storekeeper') {
          Alert.alert(
            'Access Restricted',
            'Storekeepers must use the web dashboard. Please access the stationery store portal on your counter computer.'
          );
          return;
        }

        await saveSecureToken('authToken', res.data.data.token);
        await saveSecureToken('userProfile', JSON.stringify(user));
        router.replace('/(tabs)');
      } else {
        setErrorMessage('Invalid credentials. Please verify your Staff ID and password.');
      }
    } catch (err) {
      if (err.response) {
        setErrorMessage(err.response.data?.message || 'Invalid Staff ID or password. Please try again.');
      } else {
        setErrorMessage('Cannot reach the server. Check Wi-Fi and that the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.brandIconCircle}>
            <Text style={styles.brandIcon}>📦</Text>
          </View>
          <Text style={styles.title}>Stationery Indent</Text>
          <Text style={styles.subtitle}>Faculty & Staff Requisition Portal</Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>College Staff ID</Text>
            <TextInput
              style={styles.input}
              value={staffId}
              onChangeText={(val) => {
                setStaffId(val);
                setErrorMessage('');
              }}
              placeholder="e.g. FAC101"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  setErrorMessage('');
                }}
                placeholder="Enter password"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                <Text style={styles.passwordToggleText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <PrimaryButton
            title="Log In with College ID"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo Sign-in Credentials:</Text>
            <TouchableOpacity
              onPress={() => {
                setStaffId('FAC101');
                setPassword('Password@123');
              }}>
              <Text style={styles.demoLink}>Faculty: FAC101 / Password@123</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setStaffId('HOD01');
                setPassword('Password@123');
              }}>
              <Text style={styles.demoLink}>HOD (Approver): HOD01 / Password@123</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl
  },
  card: {
    padding: spacing.xxl,
    borderRadius: radii.xl
  },
  brandIconCircle: {
    width: 54,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primarySubtle,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderFocus
  },
  brandIcon: {
    fontSize: 26
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.primaryLight,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xxs
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  errorIcon: {
    marginRight: spacing.sm,
    fontSize: 16
  },
  errorText: {
    flex: 1,
    color: colors.dangerLight,
    fontSize: typography.sm,
    lineHeight: 18
  },
  inputGroup: {
    marginBottom: spacing.lg
  },
  label: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600'
  },
  input: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.md,
    minHeight: layout.minTouchTarget
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center'
  },
  passwordInput: {
    paddingRight: 60
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing.md,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  passwordToggleText: {
    color: colors.primaryLight,
    fontSize: typography.sm,
    fontWeight: '700'
  },
  loginBtn: {
    marginTop: spacing.sm
  },
  demoBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  demoTitle: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs
  },
  demoLink: {
    color: colors.primaryLight,
    fontSize: typography.xs,
    paddingVertical: 2
  }
});
