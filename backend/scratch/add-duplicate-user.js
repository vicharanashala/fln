import fs from 'fs';

const DB_FILE = 'c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/backend/data/db.json';

try {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  console.log('Original users count:', db.users.length);

  const baseUser = db.users.find(u => u.email === 'teacher.hr_amb_amb_01_01.c2@fln.org');
  if (baseUser) {
    console.log('Found base user:', baseUser);
    
    // Check if duplicate user already exists
    const duplicateUser = db.users.find(u => u.email === 'teacher.hr_amb_amb_01_01_01.c2@fln.org');
    if (!duplicateUser) {
      const newUser = {
        ...baseUser,
        id: baseUser.id + '_dup',
        email: 'teacher.hr_amb_amb_01_01_01.c2@fln.org'
      };
      db.users.push(newUser);
      console.log('Added duplicate user with email:', newUser.email);
      
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      console.log('Database saved successfully.');
    } else {
      console.log('Duplicate user already exists.');
    }
  } else {
    console.log('Base user teacher.hr_amb_amb_01_01.c2@fln.org not found.');
  }
} catch (e) {
  console.error('Error:', e);
}
