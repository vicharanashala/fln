const { MongoClient } = require('mongodb');
require('dotenv').config();

async function check() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('URI used:', uri);
  if (!uri) {
    console.error('No URI found');
    return;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log('Connected to DB:', db.databaseName);
  
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`Collection: ${col.name} -> Count: ${count}`);
  }
  await client.close();
}

check().catch(console.error);
