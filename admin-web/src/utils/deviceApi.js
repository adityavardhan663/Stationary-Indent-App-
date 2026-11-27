import { normalizeRole } from './authAccess.js';

export function getDeviceActionKey(userId, deviceId) {
  return `${String(userId || '')}:${String(deviceId || '')}`;
}

export async function updateDeviceApproval({
  apiBase = '/api',
  fetchFn,
  currentUserRole,
  userId,
  deviceId,
  approved,
  inFlightKeys
}) {
  if (normalizeRole(currentUserRole) !== 'admin') {
    throw new Error('Only administrators can approve or revoke devices.');
  }

  if (!userId || !deviceId) {
    throw new Error('User ID and Device ID are required.');
  }

  if (typeof approved !== 'boolean') {
    throw new Error('Explicit boolean approval value is required.');
  }

  const actionKey = getDeviceActionKey(userId, deviceId);
  if (inFlightKeys && inFlightKeys.has(actionKey)) {
    return { skipped: true };
  }

  if (inFlightKeys) {
    inFlightKeys.add(actionKey);
  }

  try {
    const url = `${apiBase}/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/approve`;
    const res = await fetchFn(url, {
      method: 'PATCH',
      body: JSON.stringify({ approved })
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      throw new Error(json?.message || `Device update failed (HTTP ${res.status})`);
    }

    if (!json?.data?.device) {
      throw new Error('Malformed server response for device update.');
    }

    return {
      skipped: false,
      message: json.data.message || (approved ? 'Device approved' : 'Device revoked'),
      device: json.data.device
    };
  } finally {
    if (inFlightKeys) {
      inFlightKeys.delete(actionKey);
    }
  }
}
