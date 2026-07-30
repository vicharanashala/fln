import fs from 'fs';

try {
  const users = JSON.parse(fs.readFileSync('c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database/test.users.json', 'utf-8'));
  console.log('Total users in test.users.json:', users.length);
  
  const haryanaTeachers = users.filter(u => u.email && u.email.includes('teacher.hr'));
  console.log('Haryana Teachers in test.users.json:', haryanaTeachers.slice(0, 10).map(u => u.email));
  
  const targetUser = users.find(u => u.email && u.email.includes('teacher.hr_amb_amb_01_01_01.c2'));
  console.log('Target User in test.users.json:', targetUser);
} catch (e) {
  console.error('Error:', e);
}

try {
  const db = JSON.parse(fs.readFileSync('c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/backend/data/db.json', 'utf-8'));
  console.log('Total users in db.json:', db.users ? db.users.length : 0);
  const targetUserDb = db.users ? db.users.find(u => u.email && u.email.includes('teacher')) : null;
  console.log('A teacher in db.json:', targetUserDb);
} catch (e) {
  console.error('Error in db.json check:', e);
}
