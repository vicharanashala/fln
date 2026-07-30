import { MongoClient } from 'mongodb';

const uri = 'mongodb://vanshikaag0204_db_user:vanshi7185@ac-oyczhe1-shard-00-00.yr29uns.mongodb.net:27017,ac-oyczhe1-shard-00-01.yr29uns.mongodb.net:27017,ac-oyczhe1-shard-00-02.yr29uns.mongodb.net:27017/fln?authSource=admin&replicaSet=atlas-ngl9pe-shard-0&ssl=true&retryWrites=true&w=majority&appName=Cluster0';

async function test() {
  console.log('Attempting to connect with non-SRV replica set URI...');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000
  });
  try {
    await client.connect();
    console.log('Connection SUCCESSFUL!');
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
  } catch (err) {
    console.error('Connection FAILED:', err);
  } finally {
    await client.close();
  }
}

test();
