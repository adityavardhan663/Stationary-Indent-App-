require('dotenv').config();
const { connectDB, disconnectDB, isConnected } = require('../config/db');
const { seedDatabase } = require('../services/store');

async function run() {
  try {
    console.log('[Seed Script] Connecting to database...');
    const connected = await connectDB();
    if (!connected || !isConnected()) {
      throw new Error('Database connection could not be established.');
    }

    console.log('[Seed Script] Seeding data into MongoDB...');
    const summary = await seedDatabase();

    console.log('[Seed Script] Seeding completed successfully.');
    console.log(`[Seed Script] Users - Created: ${summary.usersCreated}, Skipped: ${summary.usersSkipped}`);
    console.log(`[Seed Script] Items - Created: ${summary.itemsCreated}, Skipped: ${summary.itemsSkipped}`);
  } catch (err) {
    console.error('[Seed Script Error] Seeding process failed:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch (disconnectErr) {
      console.error('[Seed Script Error] Failed to disconnect cleanly:', disconnectErr.message);
    }
  }
}

run();
