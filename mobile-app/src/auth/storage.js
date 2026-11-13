import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const MEM_STORE = {};

export async function saveSecureToken(key, value) {
  try {
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    MEM_STORE[key] = value;
  }
}

export async function getSecureToken(key) {
  try {
    if (Platform.OS !== 'web') {
      return await SecureStore.getItemAsync(key);
    } else {
      return localStorage.getItem(key);
    }
  } catch (err) {
    return MEM_STORE[key] || null;
  }
}

export async function deleteSecureToken(key) {
  try {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(key);
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    delete MEM_STORE[key];
  }
}
