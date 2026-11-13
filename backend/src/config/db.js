const mongoose = require('mongoose');

let mongoConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('[Database] No MONGO_URI provided in .env - running in standalone memory store mode.');
    mongoConnected = false;
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000
    });
    mongoConnected = true;
    console.log(`[Database] MongoDB Atlas Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn(`[Database Warning] Could not connect to MongoDB (${uri}): ${error.message}`);
    console.info('[Database Info] Falling back to standalone mock store for instant testing. (To use MongoDB, ensure MongoDB service or Atlas is active).');
    mongoConnected = false;
    return false;
  }
};

const isConnected = () => mongoConnected;

module.exports = { connectDB, isConnected };
