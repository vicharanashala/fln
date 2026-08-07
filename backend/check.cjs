const { MongoClient } = require('mongodb');

async function check() {
  const uri = 'mongodb://sampurnachakrabarty32_db_user:CBTFepGlLQKPcpwl@ac-5uypkfs-shard-00-00.xnve2mp.mongodb.net:27017,ac-5uypkfs-shard-00-01.xnve2mp.mongodb.net:27017,ac-5uypkfs-shard-00-02.xnve2mp.mongodb.net:27017/?ssl=true&replicaSet=atlas-atlvrh-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Clusterboku';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const user = await db.collection('users').findOne({ email: { $regex: /amike@gmail.com/i } });
  const teacher = await db.collection('teachers').findOne({ email: { $regex: /amike@gmail.com/i } });
  console.log('User:', user);
  console.log('Teacher:', teacher);
  await client.close();
}
check().catch(console.error);
