import axios from 'axios';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { getSecureToken, deleteSecureToken } from '../auth/storage';

// In development with physical phones, point to computer's local IP (check the "Metro: exp://..." line in the Expo terminal)
// For emulator, use 10.0.2.2:5000. For web preview, use localhost:5000.
export const LOCAL_DEV_IP = process.env.EXPO_PUBLIC_DEV_IP || 'localhost';
export const API_BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:5000/api'
  : `http://${LOCAL_DEV_IP}:5000/api`;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

client.interceptors.request.use(async (config) => {
  const token = await getSecureToken('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

let isRedirectingToLogin = false;

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      const isLoginRequest = url.includes('/auth/login');

      if (!isLoginRequest && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        try {
          await deleteSecureToken('authToken');
          await deleteSecureToken('userProfile');
        } catch (e) {
          // ignore storage delete errors
        }
        try {
          router.replace('/login');
        } catch (e) {
          // ignore navigation errors
        } finally {
          setTimeout(() => {
            isRedirectingToLogin = false;
          }, 1000);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default client;
