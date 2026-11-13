import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: '#0f172a' },
      headerTintColor: '#fff',
      tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
      tabBarActiveTintColor: '#38bdf8',
      tabBarInactiveTintColor: '#64748b'
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
          headerTitle: 'Stationery Portal'
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
          headerTitle: 'Faculty Account'
        }} 
      />
    </Tabs>
  );
}
