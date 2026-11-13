import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export async function authenticateBiometrics(promptReason = 'Confirm your stationery requisition') {
  if (Platform.OS === 'web') {
    // In web simulator mode, simulate instant biometric confirmation
    return { success: true, method: 'biometric' };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { success: true, method: 'pin', fallback: true };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { success: true, method: 'pin', fallback: true };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptReason,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false
    });

    if (result.success) {
      return { success: true, method: 'biometric' };
    } else {
      return { success: false, error: result.error };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}
