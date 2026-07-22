import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { connectDB, dbStore } from '../db';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Teacher } from '../models/teacher.model';
import { UserRole } from '../interfaces/user.interface';

const DEFAULT_PASSWORD = 'Fln@2026';

const ADMIN_ACCOUNTS = [
  { userId: 'u_1', email: 'superadmin@fln.org', name: 'Super Admin', role: UserRole.SUPERADMIN },
  { userId: 'u_2', email: 'admin.pb@fln.org', name: 'Punjab Admin', role: UserRole.ADMIN, stateCode: 'PB' },
  { userId: 'u_3', email: 'admin.hr@fln.org', name: 'Haryana Admin', role: UserRole.ADMIN, stateCode: 'HR' },
  { userId: 'u_4', email: 'admin.up@fln.org', name: 'UP Admin', role: UserRole.ADMIN, stateCode: 'UP' },
  { userId: 'u_5', email: 'admin.rj@fln.org', name: 'Rajasthan Admin', role: UserRole.ADMIN, stateCode: 'RJ' },
  { userId: 'u_6', email: 'district.ldh@fln.org', name: 'Ludhiana Dist Admin', role: UserRole.DISTRICT_ADMIN, districtCode: 'LDH' },
  { userId: 'u_7', email: 'district.amb@fln.org', name: 'Ambala Dist Admin', role: UserRole.DISTRICT_ADMIN, districtCode: 'AMB' },
  { userId: 'u_8', email: 'block.ldh-01@fln.org', name: 'Ludhiana Block Admin', role: UserRole.BLOCK_ADMIN, blockCode: 'LDH-01' },
  { userId: 'u_9', email: 'gps-asr-021@fln.org', name: 'Punjab Principal', role: UserRole.SCHOOL, schoolId: 'gps-asr-021' },
  { userId: 'u_10', email: 'vol.rahul@fln.org', name: 'Punjab Volunteer', role: UserRole.VOLUNTEER },
  { userId: 'u_11', email: 'vol.hr.vipin@fln.org', name: 'Haryana Volunteer', role: UserRole.VOLUNTEER },
];

const TEACHER_ACCOUNT = {
  teacherId: 't_1',
  firstName: 'Haryana',
  lastName: 'Teacher',
  email: 'gps-amb-003.t01@fln.org',
  phoneNumber: '9999999999',
  password: DEFAULT_PASSWORD,
  // We need a valid ObjectId for school, we'll fetch one or create a dummy one
};

async function seedAuth() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB');

  // 1. Clear existing generic users to avoid duplicates
  await User.deleteMany({});
  console.log('Cleared existing users');

  // 2. Insert Admin/Volunteer Accounts
  for (const account of ADMIN_ACCOUNTS) {
    const user = new User({ ...account, password: DEFAULT_PASSWORD });
    await user.save();
    console.log(`Created user: ${account.email}`);
  }

  // 3. Handle the Teacher Account
  // Delete existing to avoid duplicates
  await Teacher.deleteOne({ email: TEACHER_ACCOUNT.email });
  
  // Find a school to link the teacher to (Teacher schema requires a valid ObjectId for school)
  const db = mongoose.connection.db;
  const school = await db?.collection('schools').findOne({});
  
  if (school) {
    const teacher = new Teacher({
      ...TEACHER_ACCOUNT,
      school: school._id,
    });
    await teacher.save();
    console.log(`Created teacher: ${TEACHER_ACCOUNT.email}`);
  } else {
    console.log('No schools found in database, skipping teacher creation.');
  }

  console.log('Auth Seed Complete!');
  process.exit(0);
}

seedAuth().catch((err) => {
  console.error(err);
  process.exit(1);
});
