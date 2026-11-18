import axios from 'axios';
import { Platform } from 'react-native';
import { getSecureToken } from '../auth/storage';

<<<<<<< HEAD
// In development with physical phones, point to computer's local IP (e.g. http://192.168.1.10:5000)
// For Android emulator, use 10.0.2.2:5000. For iOS simulator/web preview, use localhost:5000.
export const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:5000/api'
  : 'http://localhost:5000/api';
=======
// In development with physical phones, point to computer's local IP (10.156.8.144:5000)
// For emulator, use 10.0.2.2:5000. For web preview, use localhost:5000.
export const LOCAL_DEV_IP = '10.156.8.144';
export const API_BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:5000/api' 
  : `http://${LOCAL_DEV_IP}:5000/api`;
>>>>>>> ad4f4af (Add backend, admin web and mobile app)

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

export default client;
