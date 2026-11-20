require('dotenv').config();
const test = require('node:test');
const assert = require('assert');
const request = require('supertest');
const app = require('../app');

test('Multi-User Authentication & Authorization Scenario Verification', async (t) => {
  let adminToken = '';
  let skToken = '';
  let hodToken = '';
  let facToken = '';

  await t.test('Scenario 6 & 7: Invalid Login Handling (Staff ID and Password)', async () => {
    // Missing Staff ID
    const emptyIdRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: '', password: 'Password@123' });
    assert.strictEqual(emptyIdRes.statusCode, 400);
    assert.ok(emptyIdRes.body.message);

    // Missing Password
    const emptyPassRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'SK001', password: '' });
    assert.strictEqual(emptyPassRes.statusCode, 400);
    assert.ok(emptyPassRes.body.message);

    // Invalid non-existent Staff ID
    const badIdRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'INVALID_ID_999', password: 'Password@123' });
    assert.strictEqual(badIdRes.statusCode, 401);
    assert.strictEqual(badIdRes.body.message, 'Invalid Staff ID or password');

    // Valid Staff ID but invalid password
    const badPassRes = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'SK001', password: 'IncorrectPassword' });
    assert.strictEqual(badPassRes.statusCode, 401);
    assert.strictEqual(badPassRes.body.message, 'Invalid Staff ID or password');
  });

  await t.test('Scenario 2: Valid Admin credentials authenticate and return ADMIN role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'EMP001', password: 'Password@123' });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.token);
    assert.strictEqual(res.body.data.user.staffId, 'EMP001');
    assert.strictEqual(res.body.data.user.role, 'admin');
    assert.strictEqual(res.body.data.user.passwordHash, undefined, 'passwordHash must never be returned');
    adminToken = res.body.data.token;
  });

  await t.test('Scenario 3: Valid Storekeeper credentials authenticate and return STOREKEEPER role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'SK001', password: 'Password@123' });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.token);
    assert.strictEqual(res.body.data.user.staffId, 'SK001');
    assert.strictEqual(res.body.data.user.role, 'storekeeper');
    assert.strictEqual(res.body.data.user.passwordHash, undefined);
    skToken = res.body.data.token;
  });

  await t.test('Scenario 4: Valid HOD credentials authenticate and return HOD role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'HOD01', password: 'Password@123' });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.token);
    assert.strictEqual(res.body.data.user.staffId, 'HOD01');
    assert.strictEqual(res.body.data.user.role, 'hod');
    assert.strictEqual(res.body.data.user.department, 'Computer Science');
    assert.strictEqual(res.body.data.user.passwordHash, undefined);
    hodToken = res.body.data.token;
  });

  await t.test('Scenario 5: Valid Faculty credentials authenticate and return FACULTY role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ staffId: 'FAC101', password: 'Password@123' });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.token);
    assert.strictEqual(res.body.data.user.staffId, 'FAC101');
    assert.strictEqual(res.body.data.user.role, 'faculty');
    assert.strictEqual(res.body.data.user.passwordHash, undefined);
    facToken = res.body.data.token;
  });

  await t.test('Scenario 9: Browser refresh session preservation via /api/me', async () => {
    // When browser refreshes with valid token, /api/me restores authenticated user without passwordHash
    const refreshRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${facToken}`);

    assert.strictEqual(refreshRes.statusCode, 200);
    assert.strictEqual(refreshRes.body.data.staffId, 'FAC101');
    assert.strictEqual(refreshRes.body.data.role, 'faculty');
    assert.strictEqual(refreshRes.body.data.passwordHash, undefined);
  });

  await t.test('Scenario 8 & 10: Accessing protected endpoints without or with cleared token', async () => {
    // Simulating logout / unauthenticated user: no token
    const noTokenMe = await request(app).get('/api/me');
    assert.strictEqual(noTokenMe.statusCode, 401);

    const noTokenItems = await request(app).get('/api/items');
    assert.strictEqual(noTokenItems.statusCode, 401);

    const noTokenIndents = await request(app).get('/api/indents');
    assert.strictEqual(noTokenIndents.statusCode, 401);
  });

  await t.test('Scenario 11: Backend authorization prevents privilege escalation', async () => {
    // Faculty trying to access Admin Users endpoint
    const facAdminAttempt = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${facToken}`);
    assert.strictEqual(facAdminAttempt.statusCode, 403, 'Faculty must be forbidden from accessing admin users');

    // Faculty trying to access Admin Audit trail
    const facAuditAttempt = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${facToken}`);
    assert.strictEqual(facAuditAttempt.statusCode, 403, 'Faculty must be forbidden from audit logs');

    // Storekeeper trying to access Admin Users
    const skUserAttempt = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${skToken}`);
    assert.strictEqual(skUserAttempt.statusCode, 403, 'Storekeeper must be forbidden from user administration');

    // HOD trying to access Stock-in goods receipt
    const hodStockAttempt = await request(app)
      .post('/api/stock/in')
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ itemId: 'i001', quantity: 5 });
    assert.strictEqual(hodStockAttempt.statusCode, 403, 'HOD must be forbidden from stock-in operations');
  });
});
