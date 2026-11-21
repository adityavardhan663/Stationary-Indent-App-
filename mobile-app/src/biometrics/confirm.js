import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Performs biometric / screen lock authentication using device hardware.
 *
 * Rules:
 * - Only result.success === true from authenticateAsync counts as confirmed.
 * - 'user_fallback' is NOT treated as success.
 * - Device PIN/passcode is allowed via OS prompt (disableDeviceFallback: false).
 * - Reports method honestly: 'biometric' or 'pin' based on authenticated enrolled level.
 * - If device has no screen lock or biometrics enrolled, blocks submission with a clear message.
 * - Handles web preview gracefully.
 */
export async function authenticateBiometrics(promptReason = 'Confirm your stationery requisition') {
  if (Platform.OS === 'web') {
    return {
      success: true,
      method: 'biometric',
      web: true,
      message: 'Web preview: Hardware biometrics simulated successfully.'
    };
  }

  try {
    // 1. Reset any lingering native biometric prompt sessions on Android
    if (Platform.OS === 'android' && typeof LocalAuthentication.cancelAuthenticate === 'function') {
      try {
        await LocalAuthentication.cancelAuthenticate();
      } catch (e) {}
    }

    // 2. Hardware and enrollment checks
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    let enrolledLevel = LocalAuthentication.SecurityLevel.NONE;
    try {
      enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
    } catch (e) {}

    // If device has no screen lock or biometrics enrolled, block submission
    if (!isEnrolled || enrolledLevel === LocalAuthentication.SecurityLevel.NONE) {
      return {
        success: false,
        blocked: true,
        error: 'Device Security Required: No screen lock or biometrics enrolled. Please set up a screen lock (PIN, pattern, password, or fingerprint) in your device Settings to submit requisitions.'
      };
    }

    // 3. Trigger fresh authentication prompt
    // Keep device PIN/passcode fallback enabled in OS prompt
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptReason,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Device PIN',
      disableDeviceFallback: false
    });

    // 4. Strictly evaluate authentication result
    // ONLY result.success === true counts as confirmed
    if (result.success === true) {
      const method = (enrolledLevel === LocalAuthentication.SecurityLevel.SECRET) ? 'pin' : 'biometric';
      return {
        success: true,
        method
      };
    }

    // 5. Handle failure/cancel/lockout cases
    switch (result.error) {
      case 'user_fallback':
        // User pressed fallback button but did not complete OS authentication
        return {
          success: false,
          cancelled: true,
          error: 'Device PIN/passcode entry was not completed.'
        };

      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
        return {
          success: false,
          cancelled: true,
          error: 'Authentication was cancelled by user.'
        };

      case 'lockout':
        return {
          success: false,
          lockout: true,
          error: 'Biometric sensor is temporarily locked due to too many failed attempts. Please unlock with your phone passcode or wait 30 seconds.'
        };

      case 'not_enrolled':
      case 'not_available':
        return {
          success: false,
          blocked: true,
          error: 'Device Security Required: Please configure a screen lock or fingerprint in your device Settings.'
        };

      case 'authentication_failed':
        return {
          success: false,
          error: 'Biometric verification failed. Fingerprint was not recognized.'
        };

      default:
        return {
          success: false,
          error: result.error ? `Verification failed: ${result.error}` : 'Biometric authentication could not be completed.'
        };
    }
  } catch (err) {
    return {
      success: false,
      error: err.message || 'An unexpected biometric error occurred.'
    };
  } finally {
    // 6. Ensure native hardware listeners are released on Android
    if (Platform.OS === 'android' && typeof LocalAuthentication.cancelAuthenticate === 'function') {
      try {
        await LocalAuthentication.cancelAuthenticate();
      } catch (e) {}
    }
  }
}
