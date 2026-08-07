const { MongoClient } = require('mongodb');

const uri = "mongodb://sampurnachakrabarty32_db_user:CBTFepGlLQKPcpwl@ac-5uypkfs-shard-00-00.xnve2mp.mongodb.net:27017,ac-5uypkfs-shard-00-01.xnve2mp.mongodb.net:27017,ac-5uypkfs-shard-00-02.xnve2mp.mongodb.net:27017/?ssl=true&replicaSet=atlas-atlvrh-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Clusterboku";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected successfully to server");
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
