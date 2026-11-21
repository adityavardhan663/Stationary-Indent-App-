import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../src/api/client';
import { saveSecureToken } from '../src/auth/storage';
import { getInstallationDeviceId } from '../src/auth/deviceId';

export default function LoginScreen() {
  const router = useRouter();
  const [staffId, setStaffId] = useState('FAC101');
  const [password, setPassword] = useState('Password@123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!staffId || !password) {
      Alert.alert('Required', 'Please enter your Staff ID and Password');
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
        Alert.alert('Login Failed', 'Invalid credentials');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Stationery Indent</Text>
        <Text style={styles.subtitle}>Faculty & Staff Requisition Portal</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Staff ID</Text>
          <TextInput
            style={styles.input}
            value={staffId}
            onChangeText={setStaffId}
            placeholder="e.g. FAC101"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log In with College ID</Text>
          )}
        </TouchableOpacity>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo Credentials:</Text>
          <Text style={styles.demoText}>Faculty: FAC101 / Password@123</Text>
          <Text style={styles.demoText}>HOD: HOD01 / Password@123</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#38bdf8',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
    fontWeight: '500'
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    fontSize: 15
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },
  demoBox: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#090d16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  demoTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  demoText: {
    color: '#cbd5e1',
    fontSize: 12
  }
});
