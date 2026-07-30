import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let connected = false;

/**
 * Connect to MongoDB in the background.  The server starts immediately
 * regardless of whether MongoDB is reachable; lock operations fall back
 * to db.json until the connection succeeds.
 */
export function connectMongo(): void {
  if (!MONGODB_URI) {
    console.warn('[MongoDB] MONGODB_URI not set — generation locks will fall back to db.json only.');
    return;
  }
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      connected = true;
      console.log('[MongoDB] Connected for generation lock persistence.');
    })
    .catch((err) => {
      console.error('[MongoDB] Connection failed — generation locks will fall back to db.json only.', err);
    });
}

export function isMongoConnected(): boolean {
  return connected;
}
