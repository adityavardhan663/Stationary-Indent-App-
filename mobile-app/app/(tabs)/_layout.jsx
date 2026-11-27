import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { getSecureToken } from '../../src/auth/storage';
import { colors } from '../../src/theme';

export default function TabLayout() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await getSecureToken('userProfile');
        if (stored && mounted) {
          const u = JSON.parse(stored);
          setRole(u.role ? u.role.toLowerCase() : null);
        }
      } catch (e) {
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const isHodOrAdmin = role === 'hod' || role === 'admin';

  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.backgroundElevated },
      headerTintColor: colors.text,
      tabBarStyle: { backgroundColor: colors.backgroundElevated, borderTopColor: colors.border },
      tabBarActiveTintColor: colors.primaryLight,
      tabBarInactiveTintColor: colors.textDim
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
          headerTitle: 'Stationery Portal'
        }} 
      />
      <Tabs.Screen 
        name="approvals" 
        options={{ 
          title: 'Approvals',
          headerTitle: 'Department Approvals',
          href: isHodOrAdmin ? undefined : null
        }} 
      />
      <Tabs.Screen 
        name="new-request" 
        options={{ 
          title: 'Requisition',
          headerTitle: 'Create Requisition'
        }} 
      />
      <Tabs.Screen 
        name="history" 
        options={{ 
          title: 'My Indents',
          headerTitle: 'Requisition History'
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile',
          headerTitle: 'Account Settings'
        }} 
      />
    </Tabs>
  );
}
