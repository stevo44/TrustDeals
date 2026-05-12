/**
 * config/database.js
 * -------------------
 * MongoDB connection via Mongoose.
 */

import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME || 'trustdeals',
  });

  isConnected = true;
  console.log(`[DB] Connected to MongoDB: ${mongoose.connection.host}`);

  mongoose.connection.on('error', (err) => {
    console.error('[DB] Connection error:', err);
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] Disconnected from MongoDB');
    isConnected = false;
  });
}

export async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[DB] Disconnected from MongoDB');
}
