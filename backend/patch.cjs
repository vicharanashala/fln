const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function update() {
  const uri = 'mongodb://sampurnachakrabarty32_db_user:CBTFepGlLQKPcpwl@ac-5uypkfs-shard-00-00.xnve2mp.mongodb.net:27017,ac-5uypkfs-shard-00-01.xnve2mp.mongodb.net:27017,ac-5uypkfs-shard-00-02.xnve2mp.mongodb.net:27017/?ssl=true&replicaSet=atlas-atlvrh-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Clusterboku';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const hash = await bcrypt.hash('AMIBoomkoo5@1', 10);
  await db.collection('users').updateOne({ email: 'amike@gmail.com' }, { $set: { passwordHash: hash } });
  console.log('Updated amike');
  await client.close();
}
update().catch(console.error);
