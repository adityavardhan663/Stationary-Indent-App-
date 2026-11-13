import axios from 'axios';
import { getSecureToken } from '../auth/storage';

// In development with physical phones, point to computer's local IP (e.g. http://192.168.1.10:5000)
// For emulator, use 10.0.2.2:5000. For web preview, use localhost:5000.
export const API_BASE_URL = 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

client.interceptors.request.async = true;
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
