import fs from 'fs';

try {
  const users = JSON.parse(fs.readFileSync('c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database/test.users.json', 'utf-8'));
  console.log('Total users:', users.length);

  const schools = JSON.parse(fs.readFileSync('c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database/test.schools.json', 'utf-8'));
  console.log('Total schools:', schools.length);

  const classes = JSON.parse(fs.readFileSync('c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database/test.classes.json', 'utf-8'));
  console.log('Total classes:', classes.length);

  const questions = JSON.parse(fs.readFileSync('c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database/test.questions.json', 'utf-8'));
  console.log('Total questions:', questions.length);

  // Let's check students without reading the whole file into memory at once if possible, or read it since node handles 45MB easily.
  console.log('Reading students...');
  const students = JSON.parse(fs.readFileSync('c:/Users/avans/OneDrive/Desktop/FLN PHASE 2/fln-phase-2/Database/test.students.json', 'utf-8'));
  console.log('Total students:', students.length);
  
  // Count by state
  const schoolsByState = {};
  schools.forEach(s => {
    schoolsByState[s.stateCode] = (schoolsByState[s.stateCode] || 0) + 1;
  });
  console.log('Schools by state:', schoolsByState);

} catch (e) {
  console.error('Error:', e);
}
