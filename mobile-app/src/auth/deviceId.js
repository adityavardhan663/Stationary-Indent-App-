import { getSecureToken, saveSecureToken } from './storage';

const DEVICE_ID_KEY = 'stationary_app_device_id';

/**
 * Retrieves the persistent random device ID generated for this installation,
 * or generates and securely stores a new unique ID if one does not exist.
 *
 * This ensures the device ID is decoupled from the user's staffId, persistent
 * across user logins on the same device, and generated once per app install.
 */
export async function getInstallationDeviceId() {
  try {
    let deviceId = await getSecureToken(DEVICE_ID_KEY);
    if (!deviceId) {
      const randPart1 = Math.random().toString(36).substring(2, 10);
      const randPart2 = Math.random().toString(36).substring(2, 10);
      const timestamp = Date.now().toString(36);
      deviceId = `dev-${timestamp}-${randPart1}${randPart2}`;
      await saveSecureToken(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (err) {
    return 'dev-default-mobile';
  }
}
