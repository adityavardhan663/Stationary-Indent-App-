import { Platform } from 'react-native';

/**
 * Safe haptic feedback utility.
 * Gracefully no-ops when expo-haptics is not installed or on web preview.
 */
export function triggerHaptic(type = 'selection') {
  if (Platform.OS === 'web') return;
  // If expo-haptics was present in node_modules, we would trigger it here.
  // Gracefully no-ops without throwing errors.
}

export default {
  triggerHaptic
};
