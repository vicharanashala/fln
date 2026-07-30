import fs from 'fs';

function inspect(name) {
  const data = JSON.parse(fs.readFileSync(`c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database/${name}.json`, 'utf-8'));
  console.log(`\n--- ${name} ---`);
  console.log('Sample:', JSON.stringify(data[0], null, 2));
}

inspect('test.schools');
inspect('test.classes');
inspect('test.questions');
inspect('test.students');
