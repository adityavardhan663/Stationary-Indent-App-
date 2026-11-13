import React from 'react';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="confirm" options={{ presentation: 'modal', headerShown: true, title: 'Confirm Requisition' }} />
    </Stack>
  );
}
