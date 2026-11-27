const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const {
  isLocalMongoUri,
  validateSeedEnvironment,
  seedDemoStaffAccount,
  DEMO_STAFF_DEFAULTS
} = require('../src/scripts/seedDemoStaff');

test('Phase 5B - Development Demo Staff Account Seeding with Host Safety', async (t) => {
  await t.test('1. Environment guards strictly reject production or non-development environments', () => {
    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'production',
        ALLOW_DEMO_SEED: 'true',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!',
        MONGO_URI: 'mongodb://localhost:27017/stationery_dev'
      }),
      /forbidden in production/i
    );

    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'test',
        ALLOW_DEMO_SEED: 'true',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!',
        MONGO_URI: 'mongodb://localhost:27017/stationery_dev'
      }),
      /requires NODE_ENV=development/i
    );

    assert.throws(
      () => validateSeedEnvironment({
        ALLOW_DEMO_SEED: 'true',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!',
        MONGO_URI: 'mongodb://localhost:27017/stationery_dev'
      }),
      /requires NODE_ENV=development/i
    );
  });

  await t.test('2. Environment guards require explicit opt-in guard ALLOW_DEMO_SEED=true', () => {
    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'development',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!',
        MONGO_URI: 'mongodb://localhost:27017/stationery_dev'
      }),
      /requires explicit opt-in guard: ALLOW_DEMO_SEED=true/i
    );

    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'false',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!',
        MONGO_URI: 'mongodb://localhost:27017/stationery_dev'
      }),
      /requires explicit opt-in guard: ALLOW_DEMO_SEED=true/i
    );
  });

  await t.test('3. Environment guards require non-empty DEMO_STAFF_PASSWORD', () => {
    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        MONGO_URI: 'mongodb://localhost:27017/stationery_dev'
      }),
      /DEMO_STAFF_PASSWORD environment variable must be provided/i
    );

    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        DEMO_STAFF_PASSWORD: '   ',
        MONGO_URI: 'mongodb://localhost:27017/stationery_dev'
      }),
      /DEMO_STAFF_PASSWORD environment variable must be provided/i
    );
  });

  await t.test('4. Environment guards require MONGO_URI and refuse in-memory fallback', () => {
    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!'
      }),
      /MONGO_URI environment variable is required\. In-memory fallback is refused/i
    );

    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!',
        MONGO_URI: '   '
      }),
      /MONGO_URI environment variable is required\. In-memory fallback is refused/i
    );
  });

  await t.test('5. isLocalMongoUri strictly verifies local targets and rejects non-local schemes/hosts', () => {
    // REFUSED cases
    assert.equal(isLocalMongoUri('mongodb+srv://user:pw@cluster.mongodb.net/localhost'), false);
    assert.equal(isLocalMongoUri('mongodb://localhost@evil.example.com/db'), false);
    assert.equal(isLocalMongoUri('mongodb://localhost:27017,remote.example.com:27017/db'), false);
    assert.equal(isLocalMongoUri('mongodb://localhost.evil.com/db'), false);
    assert.equal(isLocalMongoUri('mongodb+srv://localhost/db'), false);
    assert.equal(isLocalMongoUri('mongodb://user:p@ss@evil.example.com/db'), false);

    // ACCEPTED cases
    assert.equal(isLocalMongoUri('mongodb://localhost:27017/dev'), true);
    assert.equal(isLocalMongoUri('mongodb://127.0.0.1:27017/dev'), true);
    assert.equal(isLocalMongoUri('mongodb://[::1]:27017/dev'), true);

    // Additional edge cases
    assert.equal(isLocalMongoUri('mongodb://user:pass@127.0.0.1:27017/dev'), true);
    assert.equal(isLocalMongoUri('mongodb://[::1]/dev'), true);
    assert.equal(isLocalMongoUri(null), false);
    assert.equal(isLocalMongoUri(''), false);
  });

  await t.test('6. Host safety: refuses non-localhost/127.0.0.1 URI unless ALLOW_REMOTE_DEMO_SEED=true', () => {
    // Remote URI without ALLOW_REMOTE_DEMO_SEED must throw
    assert.throws(
      () => validateSeedEnvironment({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
        DEMO_STAFF_PASSWORD: 'ValidPassword123!',
        MONGO_URI: 'mongodb+srv://cluster0.mongodb.net/myDb'
      }),
      /Target database is not localhost\/127\.0\.0\.1\. Seeding remote databases is refused/i
    );

    // Remote URI WITH ALLOW_REMOTE_DEMO_SEED=true is permitted
    const validatedRemote = validateSeedEnvironment({
      NODE_ENV: 'development',
      ALLOW_DEMO_SEED: 'true',
      ALLOW_REMOTE_DEMO_SEED: 'true',
      DEMO_STAFF_PASSWORD: 'RemotePassword123!',
      MONGO_URI: 'mongodb+srv://cluster0.mongodb.net/myDb'
    });
    assert.equal(validatedRemote, 'RemotePassword123!');

    // Local URI succeeds without ALLOW_REMOTE_DEMO_SEED
    const validatedLocal = validateSeedEnvironment({
      NODE_ENV: 'development',
      ALLOW_DEMO_SEED: 'true',
      DEMO_STAFF_PASSWORD: 'LocalPassword123!',
      MONGO_URI: 'mongodb://127.0.0.1:27017/stationery_dev'
    });
    assert.equal(validatedLocal, 'LocalPassword123!');
  });

  await t.test('7. Creates demo staff user when absent and hashes password with bcrypt', async () => {
    const memoryDb = new Map();

    const MockUser = {
      async findOne({ staffId }) {
        return memoryDb.get(staffId) || null;
      },
      async create(doc) {
        if (memoryDb.has(doc.staffId)) {
          const err = new Error(`E11000 duplicate key error collection: index: staffId_1 dup key: { staffId: "${doc.staffId}" }`);
          err.code = 11000;
          throw err;
        }
        const created = { ...doc, _id: 'mock_id_001' };
        memoryDb.set(doc.staffId, created);
        return created;
      }
    };

    const res = await seedDemoStaffAccount({
      UserModel: MockUser,
      password: 'DemoStaffPassword123'
    });

    assert.equal(res.created, true);
    assert.equal(res.skipped, false);
    assert.equal(res.user.staffId, 'STAFF001');
    assert.equal(res.user.role, 'staff');
    assert.equal(res.user.department, 'General Staff');
    assert.equal(res.user.active, true);
    assert.equal(res.user.mustChangePassword, false);

    assert.ok(res.user.passwordHash.startsWith('$2'));
    const isPasswordValid = await bcrypt.compare('DemoStaffPassword123', res.user.passwordHash);
    assert.equal(isPasswordValid, true);

    const isWrongPasswordValid = await bcrypt.compare('WrongPassword', res.user.passwordHash);
    assert.equal(isWrongPasswordValid, false);
  });

  await t.test('8. Idempotent: Never overwrites existing account, password, role, or user details (treats as skipped)', async () => {
    const existingOriginal = {
      _id: 'existing_001',
      staffId: 'STAFF001',
      name: 'Original Existing Staff',
      role: 'staff',
      department: 'Custom Department',
      passwordHash: '$2a$10$originalExistingHashDoNotTouch',
      email: 'original@college.edu',
      phone: '+91 9999999999',
      active: true
    };

    const memoryDb = new Map([['STAFF001', existingOriginal]]);

    const MockUser = {
      async findOne({ staffId }) {
        return memoryDb.get(staffId) || null;
      },
      async create() {
        throw new Error('create() should not be called when account exists!');
      }
    };

    const res = await seedDemoStaffAccount({
      UserModel: MockUser,
      password: 'NewAttemptedPassword'
    });

    assert.equal(res.created, false);
    assert.equal(res.skipped, true);
    assert.equal(res.user.name, 'Original Existing Staff');
    assert.equal(res.user.passwordHash, '$2a$10$originalExistingHashDoNotTouch');
    assert.equal(res.user.department, 'Custom Department');
    assert.match(res.message, /already exists/i);
  });

  await t.test('9. Concurrency / race condition duplicate-key error (11000) is handled safely as skipped', async () => {
    let callCount = 0;
    const concurrentExisting = {
      _id: 'concurrent_id_999',
      staffId: 'STAFF001',
      name: 'Concurrently Created Staff',
      passwordHash: '$2a$10$concurrentHash'
    };

    const MockUser = {
      async findOne({ staffId }) {
        callCount++;
        if (callCount === 1) return null;
        return concurrentExisting;
      },
      async create(doc) {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      }
    };

    const res = await seedDemoStaffAccount({
      UserModel: MockUser,
      password: 'ConcurrentPassword123'
    });

    assert.equal(res.created, false);
    assert.equal(res.skipped, true);
    assert.equal(res.user._id, 'concurrent_id_999');
    assert.match(res.message, /created concurrently/i);
  });
});
