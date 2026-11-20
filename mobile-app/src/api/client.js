
import axios from 'axios';
import { Platform } from 'react-native';
import { getSecureToken } from '../auth/storage';

// Your laptop's IPv4 address
export const LOCAL_DEV_IP = '172.15.13.66';

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

export default client;
