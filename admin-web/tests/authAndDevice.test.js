import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNAUTHORIZED_MESSAGE,
  isAllowedDashboardRole,
  getAllowedTabIds,
  getDefaultTabId,
  resolveTabForUrl
} from '../src/utils/authAccess.js';
import { updateDeviceApproval, getDeviceActionKey } from '../src/utils/deviceApi.js';

test('Phase 4 Admin Dashboard Authorization & Navigation', async (t) => {
  await t.test('1. Permits only admin and storekeeper roles', () => {
    assert.equal(isAllowedDashboardRole('admin'), true);
    assert.equal(isAllowedDashboardRole('ADMIN'), true);
    assert.equal(isAllowedDashboardRole('storekeeper'), true);
    assert.equal(isAllowedDashboardRole('Storekeeper'), true);

    assert.equal(isAllowedDashboardRole('faculty'), false);
    assert.equal(isAllowedDashboardRole('staff'), false);
    assert.equal(isAllowedDashboardRole('hod'), false);
    assert.equal(isAllowedDashboardRole('guest'), false);
    assert.equal(isAllowedDashboardRole(''), false);
    assert.equal(isAllowedDashboardRole(null), false);
    assert.equal(isAllowedDashboardRole(undefined), false);

    assert.equal(UNAUTHORIZED_MESSAGE, 'Access denied: please use the mobile app');
  });

  await t.test('2. Removes Phone App Simulator and enforces role-based tabs', () => {
    const adminTabs = getAllowedTabIds('admin');
    assert.equal(adminTabs.includes('mobile-sim'), false);
    assert.equal(adminTabs.includes('users'), true);
    assert.equal(adminTabs.includes('audit'), true);
    assert.equal(adminTabs.includes('queue'), true);
    assert.equal(adminTabs.includes('dashboard'), true);

    const skTabs = getAllowedTabIds('storekeeper');
    assert.equal(skTabs.includes('mobile-sim'), false);
    assert.equal(skTabs.includes('users'), false);
    assert.equal(skTabs.includes('audit'), false);
    assert.equal(skTabs.includes('queue'), true);
    assert.equal(skTabs.includes('reports'), true);

    assert.deepEqual(getAllowedTabIds('faculty'), []);
    assert.deepEqual(getAllowedTabIds('staff'), []);
    assert.deepEqual(getAllowedTabIds('hod'), []);
  });

  await t.test('3. Direct URL resolution guards unauthorized paths and removed simulator', () => {
    assert.equal(getDefaultTabId('admin'), 'dashboard');
    assert.equal(getDefaultTabId('storekeeper'), 'queue');
    assert.equal(getDefaultTabId('faculty'), null);

    // Admin direct URLs
    assert.equal(resolveTabForUrl('/users', 'admin'), 'users');
    assert.equal(resolveTabForUrl('/mobile-sim', 'admin'), 'dashboard');
    assert.equal(resolveTabForUrl('/unknown-route', 'admin'), 'dashboard');

    // Storekeeper direct URLs (cannot access /users or /audit or /mobile-sim)
    assert.equal(resolveTabForUrl('/items', 'storekeeper'), 'items');
    assert.equal(resolveTabForUrl('/users', 'storekeeper'), 'queue');
    assert.equal(resolveTabForUrl('/audit', 'storekeeper'), 'queue');
    assert.equal(resolveTabForUrl('/mobile-sim', 'storekeeper'), 'queue');

    // Denied roles cannot resolve any dashboard tab
    assert.equal(resolveTabForUrl('/dashboard', 'faculty'), null);
    assert.equal(resolveTabForUrl('/queue', 'hod'), null);
    assert.equal(resolveTabForUrl('/users', 'staff'), null);
  });
});

test('Phase 4 Device Approval & Revocation Integration', async (t) => {
  await t.test('1. Admin approval sends PATCH /api/users/:id/devices/:deviceId/approve with { approved: true }', async () => {
    let capturedUrl = '';
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            message: 'Device approved',
            device: { deviceId: 'dev-1', label: 'Pixel', approved: true }
          }
        })
      };
    };

    const result = await updateDeviceApproval({
      apiBase: '/api',
      fetchFn: mockFetch,
      currentUserRole: 'admin',
      userId: 'u004',
      deviceId: 'dev-1',
      approved: true,
      inFlightKeys: new Set()
    });

    assert.equal(capturedUrl, '/api/users/u004/devices/dev-1/approve');
    assert.equal(capturedOptions.method, 'PATCH');
    assert.deepEqual(JSON.parse(capturedOptions.body), { approved: true });
    assert.equal(result.skipped, false);
    assert.equal(result.device.approved, true);
  });

  await t.test('2. Admin revocation sends { approved: false }', async () => {
    let capturedBody = null;

    const mockFetch = async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            message: 'Device revoked',
            device: { deviceId: 'dev-1', label: 'Pixel', approved: false }
          }
        })
      };
    };

    const result = await updateDeviceApproval({
      apiBase: '/api',
      fetchFn: mockFetch,
      currentUserRole: 'admin',
      userId: 'u004',
      deviceId: 'dev-1',
      approved: false,
      inFlightKeys: new Set()
    });

    assert.deepEqual(capturedBody, { approved: false });
    assert.equal(result.device.approved, false);
  });

  await t.test('3. Storekeeper and non-admin roles cannot perform device approval or revocation', async () => {
    let fetchCalled = false;
    const mockFetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({}) };
    };

    await assert.rejects(
      () => updateDeviceApproval({
        fetchFn: mockFetch,
        currentUserRole: 'storekeeper',
        userId: 'u004',
        deviceId: 'dev-1',
        approved: true
      }),
      /Only administrators/
    );
    assert.equal(fetchCalled, false);
  });

  await t.test('4. Duplicate in-flight submissions are prevented', async () => {
    const inFlightKeys = new Set([getDeviceActionKey('u004', 'dev-1')]);
    let fetchCalled = false;

    const result = await updateDeviceApproval({
      fetchFn: async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({}) };
      },
      currentUserRole: 'admin',
      userId: 'u004',
      deviceId: 'dev-1',
      approved: true,
      inFlightKeys
    });

    assert.equal(result.skipped, true);
    assert.equal(fetchCalled, false);
  });

  await t.test('5. Handles 404/error responses safely without leaving lock stuck', async () => {
    const inFlightKeys = new Set();

    await assert.rejects(
      () => updateDeviceApproval({
        fetchFn: async () => ({
          ok: false,
          status: 404,
          json: async () => ({ message: 'Device not found on user record' })
        }),
        currentUserRole: 'admin',
        userId: 'u004',
        deviceId: 'missing-dev',
        approved: true,
        inFlightKeys
      }),
      /Device not found on user record/
    );

    assert.equal(inFlightKeys.has(getDeviceActionKey('u004', 'missing-dev')), false);
  });
});
