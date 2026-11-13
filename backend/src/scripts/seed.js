require('dotenv').config();
const { connectDB, isConnected } = require('../config/db');
const { initSeed } = require('../services/store');

async function run() {
  console.log('[Seed Script] Connecting to database...');
  await connectDB();
  console.log('[Seed Script] Seeding data...');
  await initSeed();
  console.log('[Seed Script] Seeding completed.');
  process.exit(0);
}

run();
