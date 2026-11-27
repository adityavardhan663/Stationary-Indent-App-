require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

const DEMO_STAFF_DEFAULTS = {
  staffId: 'STAFF001',
  name: 'Demo Staff Member',
  department: 'General Staff',
  role: 'staff',
  mustChangePassword: false,
  email: 'staff.demo@college.edu',
  phone: '+91 9876543230',
  devices: [],
  active: true
};

/**
 * Checks if a MongoDB URI points exclusively to a local host (localhost, 127.0.0.1, or bracketed/plain ::1).
 * Rules:
 * 1. mongodb+srv:// is never local (always DNS SRV to remote clusters).
 * 2. Only standard mongodb:// scheme is allowed.
 * 3. Correctly handles userinfo containing '@' and bracketed IPv6 (e.g., [::1]:27017).
 * 4. Rejects hostnames that merely contain or end with localhost (e.g., localhost.evil.com).
 * 5. All hosts in a multi-host replica set list must be strictly local.
 * Never prints or returns the URI or host.
 */
function isLocalMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return false;
  try {
    const trimmed = rawUri.trim();
    // mongodb+srv:// is NEVER local
    if (/^mongodb\+srv:\/\//i.test(trimmed)) {
      return false;
    }

    // Must start with mongodb://
    if (!/^mongodb:\/\//i.test(trimmed)) {
      return false;
    }

    // Strip scheme
    const withoutScheme = trimmed.slice('mongodb://'.length);

    // Extract authority part before any '/', '?', or '#'
    const authorityEndIndex = withoutScheme.search(/[/?#]/);
    const authority = authorityEndIndex === -1 ? withoutScheme : withoutScheme.slice(0, authorityEndIndex);
    if (!authority) return false;

    // Remove userinfo (everything before the last '@')
    const lastAtIndex = authority.lastIndexOf('@');
    const hostListPart = lastAtIndex === -1 ? authority : authority.slice(lastAtIndex + 1);
    if (!hostListPart) return false;

    // Host list may be comma-separated: host1:port,host2:port
    // Be careful with bracketed IPv6: [::1]:27017
    const hostTokens = [];
    let current = '';
    let inBracket = false;

    for (let i = 0; i < hostListPart.length; i++) {
      const char = hostListPart[i];
      if (char === '[') inBracket = true;
      else if (char === ']') inBracket = false;

      if (char === ',' && !inBracket) {
        if (current.trim()) hostTokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) hostTokens.push(current.trim());

    if (hostTokens.length === 0) return false;

    for (const token of hostTokens) {
      let hostname = token.toLowerCase();

      if (hostname.startsWith('[')) {
        const closeIdx = hostname.indexOf(']');
        if (closeIdx === -1) return false;
        const ipv6 = hostname.slice(1, closeIdx);
        const remainder = hostname.slice(closeIdx + 1);
        if (remainder && !remainder.startsWith(':')) return false;
        if (remainder.startsWith(':')) {
          const port = remainder.slice(1);
          if (!/^\d+$/.test(port)) return false;
        }
        if (ipv6 !== '::1') return false;
      } else {
        // May have :port
        const colonIdx = hostname.indexOf(':');
        if (colonIdx !== -1) {
          const port = hostname.slice(colonIdx + 1);
          if (!/^\d+$/.test(port)) return false;
          hostname = hostname.slice(0, colonIdx);
        }

        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates runtime guards before performing development demo staff seeding.
 * Throws an Error if requirements are violated.
 * Never prints or logs the URI, host, or password.
 */
function validateSeedEnvironment(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('[Seed Refused] Demo staff seeding is forbidden in production environment.');
  }

  if (env.NODE_ENV !== 'development') {
    throw new Error('[Seed Refused] Demo staff seeding requires NODE_ENV=development.');
  }

  if (env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('[Seed Refused] Demo staff seeding requires explicit opt-in guard: ALLOW_DEMO_SEED=true.');
  }

  const rawPassword = env.DEMO_STAFF_PASSWORD;
  if (!rawPassword || typeof rawPassword !== 'string' || !rawPassword.trim()) {
    throw new Error('[Seed Refused] DEMO_STAFF_PASSWORD environment variable must be provided.');
  }

  const rawUri = env.MONGO_URI;
  if (!rawUri || typeof rawUri !== 'string' || !rawUri.trim()) {
    throw new Error('[Seed Refused] MONGO_URI environment variable is required. In-memory fallback is refused.');
  }

  const isLocal = isLocalMongoUri(rawUri);
  const allowRemote = env.ALLOW_REMOTE_DEMO_SEED === 'true';

  if (!isLocal && !allowRemote) {
    throw new Error(
      '[Seed Refused] Target database is not localhost/127.0.0.1. Seeding remote databases is refused unless ALLOW_REMOTE_DEMO_SEED=true is set.'
    );
  }

  return rawPassword.trim();
}

/**
 * Core idempotent creation logic for demo staff.
 * Designed to work with Mongoose User model (or an injected mock for unit tests).
 *
 * @param {object} options
 * @param {object} [options.UserModel=User]
 * @param {string} options.password
 * @param {object} [options.overrides]
 * @returns {Promise<{ created: boolean, skipped: boolean, user: object, message: string }>}
 */
async function seedDemoStaffAccount({
  UserModel = User,
  password,
  overrides = {}
} = {}) {
  if (!password || typeof password !== 'string' || !password.trim()) {
    throw new Error('A valid password string is required for demo staff account.');
  }

  const staffData = {
    ...DEMO_STAFF_DEFAULTS,
    ...overrides
  };

  const normalizedStaffId = staffData.staffId.trim().toUpperCase();

  // Check if account already exists
  const existingUser = await UserModel.findOne({ staffId: normalizedStaffId });
  if (existingUser) {
    return {
      created: false,
      skipped: true,
      user: existingUser,
      message: `User with staffId '${normalizedStaffId}' already exists. Preserving existing account without modification.`
    };
  }

  // Hash password using bcryptjs (cost factor 10)
  const passwordHash = await bcrypt.hash(password.trim(), 10);

  const newUserData = {
    ...staffData,
    staffId: normalizedStaffId,
    passwordHash
  };

  try {
    const createdUser = await UserModel.create(newUserData);
    return {
      created: true,
      skipped: false,
      user: createdUser,
      message: `Demo staff user '${normalizedStaffId}' successfully created.`
    };
  } catch (err) {
    // Handle concurrent execution / race condition where duplicate key (11000) occurred
    if (err && (err.code === 11000 || (err.message && err.message.includes('E11000')))) {
      const concurrentUser = await UserModel.findOne({ staffId: normalizedStaffId });
      return {
        created: false,
        skipped: true,
        user: concurrentUser,
        message: `User with staffId '${normalizedStaffId}' was created concurrently. Preserved existing record.`
      };
    }
    throw err;
  }
}

/**
 * CLI Runner for standalone invocation (node src/scripts/seedDemoStaff.js)
 */
async function run() {
  try {
    const password = validateSeedEnvironment(process.env);

    console.log('[Seed Demo Staff] Environment validated.');
    console.log('[Seed Demo Staff] Connecting to database...');

    let conn;
    try {
      conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
      });
    } catch {
      throw new Error('Database connection failed.');
    }

    if (!conn || mongoose.connection.readyState !== 1) {
      throw new Error('Database connection failed.');
    }

    const result = await seedDemoStaffAccount({ password });
    console.log(`[Seed Demo Staff] ${result.message}`);
  } catch (err) {
    console.error(`[Seed Demo Staff Error] ${err.message}`);
    process.exitCode = 1;
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch {
      console.error('[Seed Demo Staff] Error disconnecting from database.');
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  isLocalMongoUri,
  validateSeedEnvironment,
  seedDemoStaffAccount,
  DEMO_STAFF_DEFAULTS
};
