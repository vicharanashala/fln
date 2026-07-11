import mongoose from 'mongoose';
import { env } from './env.js';

// Kept at module scope so the in-memory server lives for the process lifetime.
let memoryServer: { getUri: (db?: string) => string; stop: () => Promise<boolean> } | null = null;

/**
 * Resolve the Mongo connection URI.
 * If MONGODB_URI is "memory", spin up an embedded MongoDB (mongodb-memory-server)
 * so the app runs with zero external database — ideal for local dev / demos or
 * when a network blocks Atlas SRV DNS lookups.
 */
async function resolveUri(): Promise<string> {
  if (env.mongoUri.trim().toLowerCase() === 'memory') {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    console.log('  Using in-memory MongoDB (MONGODB_URI=memory)');
    return memoryServer.getUri('fln');
  }
  return env.mongoUri;
}

/** Connect to MongoDB. Fails fast so we don't boot a half-working server. */
export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  try {
    const uri = await resolveUri();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
    const { host, name } = mongoose.connection;
    console.log(`  MongoDB connected → ${host}/${name}`);
  } catch (err) {
    console.error('  MongoDB connection failed:', (err as Error).message);
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
