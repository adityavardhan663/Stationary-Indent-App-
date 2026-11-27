export const ALLOWED_DASHBOARD_ROLES = ['admin', 'storekeeper'];

export const UNAUTHORIZED_MESSAGE = 'Access denied: please use the mobile app';

export function normalizeRole(role) {
  return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

export function isAllowedDashboardRole(role) {
  return ALLOWED_DASHBOARD_ROLES.includes(normalizeRole(role));
}

export function getAllowedTabIds(role) {
  const r = normalizeRole(role);
  if (r === 'admin') {
    return ['dashboard', 'queue', 'items', 'stockin', 'history', 'reports', 'users', 'audit'];
  }
  if (r === 'storekeeper') {
    return ['queue', 'dashboard', 'items', 'stockin', 'history', 'reports'];
  }
  return [];
}

export function getDefaultTabId(role) {
  const r = normalizeRole(role);
  if (r === 'admin') return 'dashboard';
  if (r === 'storekeeper') return 'queue';
  return null;
}

export function resolveTabForUrl(pathname, role) {
  const allowedTabs = getAllowedTabIds(role);
  const defaultTab = getDefaultTabId(role);
  if (!defaultTab || allowedTabs.length === 0) {
    return null;
  }

  const cleanPath = typeof pathname === 'string'
    ? pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
    : '';

  if (!cleanPath || cleanPath === 'login') {
    return defaultTab;
  }

  if (allowedTabs.includes(cleanPath)) {
    return cleanPath;
  }

  return defaultTab;
}
