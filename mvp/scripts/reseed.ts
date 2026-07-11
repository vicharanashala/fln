import { dbStore } from '../server/db.ts';

async function main() {
  await dbStore.init();
  await dbStore.reset();
  const data = (dbStore as any).data;
  console.log('Fresh seed written. users:', data.users.length, 'students:', data.students.length, 'questions:', data.questions.length);
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });