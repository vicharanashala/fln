import mongoose from 'mongoose';
import { env } from './environment';

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => {
    const { host, port, name } = mongoose.connection;
    console.log(`✅ MongoDB Connected — Host: ${host}, Port: ${port}, Database: ${name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB runtime error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ MongoDB connection failed:', message);
    console.warn('⚠️  Server will start without database. Only non-DB routes will work.');
  }
}
