require('dotenv').config();
const request = require('supertest');
const assert = require('assert');
const test = require('node:test');
const app = require('../app');

test('Stationery Indent Backend API - End-to-End Suite', async (t) => {
  let facultyToken = '';
  let storekeeperToken = '';
  let createdIndentId = '';
  let testItemId = 'i001'; // A4 paper

  await t.test('1. Health check endpoint', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
  });

  await t.test('2. Authentication - Faculty Login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'FAC101', password: 'Password@123' });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.token, 'Token must be returned');
    assert.strictEqual(res.body.data.user.staffId, 'FAC101');
    assert.strictEqual(res.body.data.user.role, 'faculty');
    assert.strictEqual(res.body.data.user.passwordHash, undefined, 'passwordHash must not be exposed on login');
    facultyToken = res.body.data.token;
  });

  await t.test('2b. Authentication - Invalid Login Handling', async () => {
    // Missing credentials
    const missingRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'FAC101' });
    assert.strictEqual(missingRes.statusCode, 400);

    // Non-existent user
    const noUserRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'NONEXISTENT', password: 'Password@123' });
    assert.strictEqual(noUserRes.statusCode, 401);

    // Wrong password
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'FAC101', password: 'WrongPassword' });
    assert.strictEqual(wrongPassRes.statusCode, 401);
  });

  await t.test('3. Authentication - Storekeeper Login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'SK001', password: 'Password@123' });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.user.role, 'storekeeper');
    storekeeperToken = res.body.data.token;
  });

  await t.test('4. Catalog - Fetch items list', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${facultyToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 10);
  });

  await t.test('5. Requisition - Faculty creates indent with biometric confirmation', async () => {
    const res = await request(app)
      .post('/api/indents')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        items: [
          { itemId: testItemId, quantity: 2 }
        ],
        confirmation: {
          method: 'biometric',
          deviceId: 'dev-phone-aditya'
        },
        remarks: 'Exam sheets and handouts'
      });

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.data.indentNo.startsWith('IND-'));
    assert.strictEqual(res.body.data.status, 'REQUESTED');
    assert.strictEqual(res.body.data.confirmation.method, 'biometric');
    createdIndentId = res.body.data._id;
  });

  await t.test('6. Requisition - Faculty views own indents', async () => {
    const res = await request(app)
      .get('/api/indents/mine')
      .set('Authorization', `Bearer ${facultyToken}`);

    assert.strictEqual(res.statusCode, 200);
    const found = res.body.data.find(i => i._id === createdIndentId);
    assert.ok(found, 'Created indent should appear in requester history');
  });

  await t.test('7. Storekeeper Issues Indent (Atomic Stock Deduction & Ledger)', async () => {
    // Check initial stock
    const itemsResBefore = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${storekeeperToken}`);
    const itemBefore = itemsResBefore.body.data.find(i => i._id === testItemId);
    const stockBefore = itemBefore.stock;

    // Issue
    const issueRes = await request(app)
      .patch(`/api/indents/${createdIndentId}/issue`)
      .set('Authorization', `Bearer ${storekeeperToken}`)
      .send({ remarks: 'Handed over 2 reams of A4 paper to faculty' });

    assert.strictEqual(issueRes.statusCode, 200);
    assert.strictEqual(issueRes.body.data.indent.status, 'ISSUED');

    // Check updated stock has reduced by 2
    const itemsResAfter = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${storekeeperToken}`);
    const itemAfter = itemsResAfter.body.data.find(i => i._id === testItemId);
    assert.strictEqual(itemAfter.stock, stockBefore - 2);
  });

  await t.test('8. Reports - Low stock items', async () => {
    const res = await request(app)
      .get('/api/reports/low-stock')
      .set('Authorization', `Bearer ${storekeeperToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  await t.test('9. User Profile & Device Registration (/api/me)', async () => {
    const meRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${facultyToken}`);

    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(meRes.body.data.staffId, 'FAC101');
    assert.strictEqual(meRes.body.data.passwordHash, undefined, 'passwordHash must never be returned');

    // Missing deviceId -> 400
    const invalidDevRes = await request(app)
      .post('/api/me/devices')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ label: 'No Device ID' });
    assert.strictEqual(invalidDevRes.statusCode, 400);

    // Valid device registration
    const devRes = await request(app)
      .post('/api/me/devices')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ deviceId: 'dev-phone-new-test', label: 'Samsung Test Device' });

    assert.strictEqual(devRes.statusCode, 200);
    assert.ok(devRes.body.data.device);

    // Duplicate device registration returns existing without duplication
    const dupDevRes = await request(app)
      .post('/api/me/devices')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ deviceId: 'dev-phone-new-test', label: 'Samsung Test Device' });

    assert.strictEqual(dupDevRes.statusCode, 200);
    assert.strictEqual(dupDevRes.body.data.message, 'Device already registered');
  });

  await t.test('9b. Authentication - Change Password Flow', async () => {
    // Missing fields
    const missingRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ oldPassword: 'Password@123' });
    assert.strictEqual(missingRes.statusCode, 400);

    // New password too short (< 8 chars)
    const shortPassRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ oldPassword: 'Password@123', newPassword: '123' });
    assert.strictEqual(shortPassRes.statusCode, 400);

    // Wrong current password
    const wrongCurrentRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ oldPassword: 'IncorrectPassword', newPassword: 'BrandNewPassword@2026' });
    assert.strictEqual(wrongCurrentRes.statusCode, 400);

    // Successful change
    const successRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ oldPassword: 'Password@123', newPassword: 'BrandNewPassword@2026' });
    assert.strictEqual(successRes.statusCode, 200);

    // Verify login with new password
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'FAC101', password: 'BrandNewPassword@2026' });
    assert.strictEqual(newLoginRes.statusCode, 200);
    assert.ok(newLoginRes.body.data.token);

    // Reset password back to Password@123 for subsequent tests
    const resetBackRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${newLoginRes.body.data.token}`)
      .send({ oldPassword: 'BrandNewPassword@2026', newPassword: 'Password@123' });
    assert.strictEqual(resetBackRes.statusCode, 200);
  });

  await t.test('10. Reports - Monthly Summary with Month Filter', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const res = await request(app)
      .get(`/api/reports/monthly?month=${currentMonth}`)
      .set('Authorization', `Bearer ${storekeeperToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.totalIndentsIssued >= 1);
    assert.ok(res.body.data.byDepartment);
  });

  await t.test('11. Admin - Staff and Device Management', async () => {
    // Admin login
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'EMP001', password: 'Password@123' });
    assert.strictEqual(adminLoginRes.statusCode, 200);
    const adminToken = adminLoginRes.body.data.token;

    // Fetch users
    const usersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(usersRes.statusCode, 200);
    assert.ok(Array.isArray(usersRes.body.data));

    // Create staff member
    const newStaffRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        staffId: 'STF999',
        name: 'Anita Roy',
        department: 'Library',
        role: 'staff',
        email: 'anita.r@college.edu'
      });
    assert.strictEqual(newStaffRes.statusCode, 201);
    assert.strictEqual(newStaffRes.body.data.staffId, 'STF999');

    // Reset password
    const resetRes = await request(app)
      .post(`/api/users/${newStaffRes.body.data._id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tempPassword: 'NewPassword@123' });
    assert.strictEqual(resetRes.statusCode, 200);
  });

  await t.test('12. Inventory Integrity - Abort transaction on insufficient stock', async () => {
    // Attempt indent with quantity far exceeding available stock
    const badIndentRes = await request(app)
      .post('/api/indents')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        items: [
          { itemId: testItemId, quantity: 1 } // valid
        ],
        confirmation: { method: 'biometric', deviceId: 'dev-phone-aditya' },
        remarks: 'Overdraft test'
      });
    assert.strictEqual(badIndentRes.statusCode, 201);
    const overdraftIndentId = badIndentRes.body.data._id;

    // Check current stock
    const itemsBefore = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${storekeeperToken}`);
    const beforeStock = itemsBefore.body.data.find(i => i._id === testItemId).stock;

    // Storekeeper attempts to issue an exorbitant quantity (e.g. 999999)
    const issueFailRes = await request(app)
      .patch(`/api/indents/${overdraftIndentId}/issue`)
      .set('Authorization', `Bearer ${storekeeperToken}`)
      .send({
        itemsIssued: [{ itemId: testItemId, qtyIssued: 999999 }]
      });
    assert.strictEqual(issueFailRes.statusCode, 400);

    // Verify stock is untouched
    const itemsAfter = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${storekeeperToken}`);
    const afterStock = itemsAfter.body.data.find(i => i._id === testItemId).stock;
    assert.strictEqual(afterStock, beforeStock, 'Stock must not change when issue fails');
  });

  await t.test('13. Reports - CSV Export', async () => {
    const res = await request(app)
      .get('/api/reports/export.csv')
      .set('Authorization', `Bearer ${storekeeperToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.text.includes('IndentNo,RequesterName,StaffID'));
  });

  await t.test('14. Authentication - Individual User Logins for All Roles', async () => {
    // 14a: Admin Login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'EMP001', password: 'Password@123' });
    assert.strictEqual(adminRes.statusCode, 200);
    assert.strictEqual(adminRes.body.data.user.role, 'admin');
    assert.strictEqual(adminRes.body.data.user.staffId, 'EMP001');

    // 14b: Storekeeper Login
    const skRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'SK001', password: 'Password@123' });
    assert.strictEqual(skRes.statusCode, 200);
    assert.strictEqual(skRes.body.data.user.role, 'storekeeper');
    assert.strictEqual(skRes.body.data.user.staffId, 'SK001');

    // 14c: HOD Login
    const hodRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'HOD01', password: 'Password@123' });
    assert.strictEqual(hodRes.statusCode, 200);
    assert.strictEqual(hodRes.body.data.user.role, 'hod');
    assert.strictEqual(hodRes.body.data.user.staffId, 'HOD01');

    // 14d: Faculty Login
    const facRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'FAC101', password: 'Password@123' });
    assert.strictEqual(facRes.statusCode, 200);
    assert.strictEqual(facRes.body.data.user.role, 'faculty');
    assert.strictEqual(facRes.body.data.user.staffId, 'FAC101');

    // 14e: Second Faculty Login
    const fac2Res = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'FAC102', password: 'Password@123' });
    assert.strictEqual(fac2Res.statusCode, 200);
    assert.strictEqual(fac2Res.body.data.user.role, 'faculty');
    assert.strictEqual(fac2Res.body.data.user.staffId, 'FAC102');
  });

  await t.test('15. Authentication & Token Verification - /api/me', async () => {
    // Unauthenticated request should fail with 401
    const unauthRes = await request(app).get('/api/me');
    assert.strictEqual(unauthRes.statusCode, 401);

    // Request with invalid token should fail with 401
    const badTokenRes = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer invalid-token-xyz');
    assert.strictEqual(badTokenRes.statusCode, 401);

    // Request with valid faculty token returns user profile without passwordHash
    const meRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${facultyToken}`);
    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(meRes.body.data.staffId, 'FAC101');
    assert.strictEqual(meRes.body.data.passwordHash, undefined);
  });

  await t.test('16. Authorization Enforcement - Role Permission Boundaries', async () => {
    // Faculty cannot access Admin users list (403 Forbidden)
    const facUsersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${facultyToken}`);
    assert.strictEqual(facUsersRes.statusCode, 403);

    // Faculty cannot issue indents (403 Forbidden)
    const facIssueRes = await request(app)
      .patch(`/api/indents/${createdIndentId}/issue`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ remarks: 'Unauthorized' });
    assert.strictEqual(facIssueRes.statusCode, 403);

    // Storekeeper cannot access Admin audit trail (403 Forbidden)
    const skAuditRes = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${storekeeperToken}`);
    assert.strictEqual(skAuditRes.statusCode, 403);

    // Storekeeper cannot access Admin users list (403 Forbidden)
    const skUsersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${storekeeperToken}`);
    assert.strictEqual(skUsersRes.statusCode, 403);
  });

  await t.test('17. HOD Workflow - Department Indent Approval and Rejection', async () => {
    // 17a: Log in as HOD
    const hodLogin = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'HOD01', password: 'Password@123' });
    const hodToken = hodLogin.body.data.token;

    // 17b: Faculty submits a new indent for testing HOD approval
    const newIndentRes = await request(app)
      .post('/api/indents')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        items: [{ itemId: testItemId, quantity: 1 }],
        confirmation: { method: 'biometric', deviceId: 'dev-phone-aditya' },
        remarks: 'HOD Approval Test Indent'
      });
    assert.strictEqual(newIndentRes.statusCode, 201);
    const testHodIndentId = newIndentRes.body.data._id;

    // 17c: HOD approves the indent
    const approveRes = await request(app)
      .patch(`/api/indents/${testHodIndentId}/approve`)
      .set('Authorization', `Bearer ${hodToken}`);
    assert.strictEqual(approveRes.statusCode, 200);
    assert.strictEqual(approveRes.body.data.indent.status, 'APPROVED');

    // 17d: Faculty submits another indent for testing HOD rejection
    const rejectIndentRes = await request(app)
      .post('/api/indents')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        items: [{ itemId: testItemId, quantity: 1 }],
        confirmation: { method: 'biometric', deviceId: 'dev-phone-aditya' },
        remarks: 'HOD Rejection Test Indent'
      });
    assert.strictEqual(rejectIndentRes.statusCode, 201);
    const testRejectIndentId = rejectIndentRes.body.data._id;

    // 17e: HOD rejects the indent
    const rejectRes = await request(app)
      .patch(`/api/indents/${testRejectIndentId}/reject`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ remarks: 'Budget limit exceeded for this quarter' });
    assert.strictEqual(rejectRes.statusCode, 200);
    assert.strictEqual(rejectRes.body.data.indent.status, 'REJECTED');

    // 17f: Storekeeper cannot issue a REJECTED indent (400 Bad Request)
    const issueRejectedRes = await request(app)
      .patch(`/api/indents/${testRejectIndentId}/issue`)
      .set('Authorization', `Bearer ${storekeeperToken}`)
      .send({ remarks: 'Attempt to issue rejected' });
    assert.strictEqual(issueRejectedRes.statusCode, 400);
  });
});
