
import axios from 'axios';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { getSecureToken, deleteSecureToken } from '../auth/storage';

// Your laptop's IP can be configured through EXPO_PUBLIC_DEV_IP.
// The fallback is your previously configured laptop IP.
import Constants from 'expo-constants';

function getDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    null;
  return hostUri ? hostUri.split(':')[0] : null;
}

// Priority: full URL override > auto-detected Metro host > .env IP > localhost
export const LOCAL_DEV_IP = getDevHost() || process.env.EXPO_PUBLIC_DEV_IP || 'localhost';
// Backend API URL
export const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:5000/api'
    : `http://${LOCAL_DEV_IP}:5000/api`;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

client.interceptors.request.use(
  async (config) => {
    const token = await getSecureToken('authToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
          // Ignore storage delete errors
        }

        try {
          router.replace('/login');
        } catch (e) {
          // Ignore navigation errors
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
