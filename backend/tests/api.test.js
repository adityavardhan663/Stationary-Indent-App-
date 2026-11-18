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
    facultyToken = res.body.data.token;
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

    const devRes = await request(app)
      .post('/api/me/devices')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ deviceId: 'dev-phone-new-test', label: 'Samsung Test Device' });

    assert.strictEqual(devRes.statusCode, 200);
    assert.ok(devRes.body.data.device);
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
});
