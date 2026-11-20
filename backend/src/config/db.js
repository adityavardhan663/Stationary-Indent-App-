const mongoose = require('mongoose');

let mongoConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  // Allow memory mode only when no database URI is configured.
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGO_URI is required in production.');
    }

    console.warn('[Database] No MONGO_URI found. Using development memory mode.');
    mongoConnected = false;
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });

    mongoConnected = true;

    console.log(`[Database] MongoDB Atlas Connected: ${conn.connection.host}`);

    return true;
  } catch (error) {
    mongoConnected = false;

    console.error('[Database Error] MongoDB connection failed.');
    console.error(error.message);

    // Do not silently continue with memory storage.
    throw error;
  }
};

const disconnectDB = async () => {
  if (mongoConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    mongoConnected = false;
    console.log('[Database] MongoDB disconnected.');
  }
};

const isConnected = () => mongoConnected;

module.exports = {
  connectDB,
  disconnectDB,
  isConnected
};
