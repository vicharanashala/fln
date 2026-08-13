const mongoose = require('mongoose');

async function queryLedger() {
  await mongoose.connect('mongodb://127.0.0.1:27017/fln');
  
  const ledgerSchema = new mongoose.Schema({}, { strict: false });
  const RemediationLedger = mongoose.model('RemediationLedger', ledgerSchema, 'remediationledgers');
  
  const doc = await RemediationLedger.findOne({ id: 'rem_ab957081' });
  console.log("=== LEDGER RECORD IN MONGODB ===");
  console.log(JSON.stringify(doc, null, 2));
  
  // Verify deduplication
  if (doc && doc.get('responses')) {
    const responses = doc.get('responses');
    responses.forEach((r) => {
      console.log(`\nQuestion #${r.questionNumber} (${r.type}):`);
      const questions = r.practiceQuestions.map((pq) => pq.question);
      const uniqueCount = new Set(questions).size;
      console.log(`- Unique questions generated: ${uniqueCount}/5`);
      console.log(`- Generated questions:`, questions);
    });
  }
  
  await mongoose.connection.close();
}

queryLedger().catch(console.error);
