import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { getSecureToken, deleteSecureToken } from '../src/auth/storage';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const token = await getSecureToken('authToken');
        const userProfileStr = await getSecureToken('userProfile');
        if (!isMounted) return;

        let userRole = null;
        if (userProfileStr) {
          try {
            const parsed = JSON.parse(userProfileStr);
            userRole = parsed?.role?.toLowerCase();
          } catch (e) {}
        }

        // Storekeepers must use web dashboard only
        if (token && userRole === 'storekeeper') {
          await deleteSecureToken('authToken');
          await deleteSecureToken('userProfile');
          Alert.alert(
            'Access Restricted',
            'Storekeepers must use the web dashboard. Please access the portal from the counter computer.'
          );
          router.replace('/login');
          return;
        }

        const inAuthGroup = segments[0] === 'login';

        if (!token && !inAuthGroup) {
          router.replace('/login');
        } else if (token && inAuthGroup) {
          router.replace('/(tabs)');
        }
      } catch (err) {
        if (!isMounted) return;
        if (segments[0] !== 'login') {
          router.replace('/login');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="confirm"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Confirm Requisition',
          headerStyle: { backgroundColor: colors.backgroundElevated },
          headerTintColor: colors.text
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
