import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { UserRole } from './db';

// ============================================================
// NAME POOLS — 250+ realistic Indian names
// ============================================================

const MALE_FIRST_NAMES: string[] = [
  'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Reyansh', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Aarush', 'Vihaan', 'Arnav',
  'Aayush', 'Dhruv', 'Kiaan', 'Anirudh', 'Rohit', 'Suresh', 'Rajesh',
  'Amit', 'Sanjay', 'Vikram', 'Manoj', 'Ravi', 'Deepak', 'Ajay', 'Vijay',
  'Mohit', 'Nikhil', 'Harsh', 'Varun', 'Karan', 'Tushar', 'Siddharth',
  'Rahul', 'Gaurav', 'Ankit', 'Nishant', 'Piyush', 'Yash', 'Kartik',
  'Prakash', 'Ramesh', 'Mahesh', 'Dinesh', 'Paresh', 'Ganesh', 'Mukesh',
  'Umesh', 'Yogesh', 'Bhavesh', 'Kalpesh', 'Hitesh', 'Jignesh', 'Nimesh',
  'Raghav', 'Naman', 'Tarun', 'Aakash', 'Karthik', 'Prashant', 'Anuj',
  'Kapil', 'Pawan', 'Nitin', 'Chetan', 'Abhishek', 'Abhinav', 'Sachin',
  'Sameer', 'Arvind', 'Ashok', 'Raju', 'Rajan', 'Prem', 'Rakesh', 'Saurabh',
  'Shantanu', 'Sagar', 'Vikas', 'Naveen', 'Manu', 'Rajat', 'Gagan', 'Chirag',
  'Hemant', 'Satish', 'Raghunath', 'Subodh', 'Sushil', 'Jagdish', 'Dilip',
  'Kishore', 'Ashish', 'Girish', 'Sunil', 'Manish', 'Naveen', 'Kamal',
  'Ram', 'Shyam', 'Mohan', 'Sohan', 'Lalu', 'Nitish', 'Tej', 'Brijesh',
  'Durgesh', 'Pankaj', 'Alok', 'Vikrant', 'Sushil', 'Pradeep', 'Raghvendra',
  'Himanshu', 'Jatin', 'Gopal', 'Madhav', 'Narayan', 'Praveen', 'Rupesh',
];

const FEMALE_FIRST_NAMES: string[] = [
  'Aanya', 'Diya', 'Myra', 'Sara', 'Anvi', 'Aadhya', 'Pari', 'Anaya',
  'Nisha', 'Riya', 'Priya', 'Neha', 'Sneha', 'Kavya', 'Tanvi', 'Divya',
  'Kavita', 'Meena', 'Ritu', 'Simran', 'Gurpreet', 'Harpreet', 'Manpreet',
  'Jaspreet', 'Ramandeep', 'Navneet', 'Navdeep', 'Dilpreet', 'Parminder',
  'Harman', 'Navjot', 'Amrit', 'Raman', 'Gagandeep', 'Kulwinder', 'Balwinder',
  'Sukhbir', 'Tejpal', 'Ranjit', 'Gurmail', 'Mohini', 'Sunita', 'Sarita',
  'Anita', 'Rekha', 'Sushma', 'Usha', 'Savita', 'Asha', 'Geeta', 'Suman',
  'Mamta', 'Kusum', 'Vimla', 'Kamla', 'Shanti', 'Padma', 'Indira', 'Savitri',
  'Leela', 'Parvathi', 'Lakshmi', 'Durga', 'Radha', 'Sita', 'Gita', 'Reena',
  'Veena', 'Pooja', 'Jyoti', 'Shalini', 'Alka', 'Babita', 'Sangeeta', 'Sudha',
  'Chhaya', 'Pratibha', 'Kiran', 'Manorama', 'Saroja', 'Vijaya', 'Sumitra',
  'Deepa', 'Revathi', 'Sumathi', 'Geetha', 'Sujatha', 'Padmavathi', 'Sridevi',
  'Jayalakshmi', 'Meenakshi', 'Ambika', 'Mangala', 'Kamala', 'Vasantha',
  'Pushpa', 'Vaidehi', 'Suchitra', 'Jayashree', 'Bharathi', 'Ratna', 'Shobha',
  'Chandrakala', 'Malathi', 'Ankita', 'Moumita', 'Saswati', 'Manasi',
  'Shreya', 'Sagarika', 'Pallavi', 'Meghana', 'Swathi', 'Keerthi', 'Prathima',
  'Vidya', 'Hema', 'Jaya', 'Lalitha', 'Sunitha', 'Vani', 'Aruna', 'Padmaja',
  'Shivani', 'Poojitha', 'Rachana', 'Soumya', 'Trupti', 'Vathsala', 'Yamuna',
];

const LAST_NAMES: string[] = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Yadav', 'Patel', 'Reddy',
  'Nair', 'Iyer', 'Deshmukh', 'Joshi', 'Mishra', 'Pandey', 'Tiwari', 'Dubey',
  'Chaturvedi', 'Chaudhary', 'Thakur', 'Malhotra', 'Bhatia', 'Saxena', 'Khanna',
  'Chopra', 'Mehra', 'Kaur', 'Gill', 'Sidhu', 'Brar', 'Dhillon', 'Sandhu',
  'Ahluwalia', 'Puri', 'Kapoor', 'Sethi', 'Goel', 'Bansal', 'Singhal', 'Mittal',
  'Goyal', 'Taneja', 'Saini', 'Jangra', 'Dalal', 'Malik', 'Khan', 'Sheikh',
  'Ansari', 'Mohammed', 'Ali', 'Das', 'Banerjee', 'Bose', 'Mukherjee', 'Ghosh',
  'Sen', 'Chakraborty', 'Datta', 'Roy', 'Barman', 'Nath', 'Sarma', 'Kalita',
  'Saikia', 'Borgohain', 'Deka', 'Bora', 'Hazarika', 'Phukan', 'Patil', 'Jadhav',
  'Shinde', 'Pawar', 'Rao', 'Naik', 'Shetty', 'Gowda', 'Hegde', 'Prasad',
  'Chauhan', 'Rathore', 'Solanki', 'Vyas', 'Mehta', 'Shah', 'Gandhi', 'Desai',
  'Kulkarni', 'Deshpande', 'Pathak', 'Tripathi', 'Chandra', 'Srivastava',
  'Awasthi', 'Pandit', 'Kushwaha', 'Maurya', 'Yadav', 'Korva', 'Lakda',
  'Topno', 'Munda', 'Oraon', 'Tirkey', 'Ekka', 'Birsa', 'Hasda', 'Marandi',
  'Hembram', 'Soren', 'Besra', 'Tudu', 'Murmu', 'Devi', 'Poddar', 'Sinha',
];

// ============================================================
// STATE & UT DATA — 28 States + 8 Union Territories
// ============================================================

interface DistrictInfo {
  code: string;
  name: string;
}

interface StateInfo {
  code: string;
  name: string;
  districts: DistrictInfo[];
}

const STATES_UTS: StateInfo[] = [
  // ── 28 STATES ──
  {
    code: 'AP', name: 'Andhra Pradesh',
    districts: [
      { code: 'GNT', name: 'Guntur' },
      { code: 'VSK', name: 'Visakhapatnam' },
    ],
  },
  {
    code: 'AR', name: 'Arunachal Pradesh',
    districts: [
      { code: 'TWG', name: 'Tawang' },
      { code: 'PPR', name: 'Papum Pare' },
    ],
  },
  {
    code: 'AS', name: 'Assam',
    districts: [
      { code: 'KMR', name: 'Kamrup' },
      { code: 'NGN', name: 'Nagaon' },
    ],
  },
  {
    code: 'BR', name: 'Bihar',
    districts: [
      { code: 'PTN', name: 'Patna' },
      { code: 'GYA', name: 'Gaya' },
    ],
  },
  {
    code: 'CG', name: 'Chhattisgarh',
    districts: [
      { code: 'RPR', name: 'Raipur' },
      { code: 'BSP', name: 'Bilaspur' },
    ],
  },
  {
    code: 'GA', name: 'Goa',
    districts: [
      { code: 'NGO', name: 'North Goa' },
      { code: 'SGO', name: 'South Goa' },
    ],
  },
  {
    code: 'GJ', name: 'Gujarat',
    districts: [
      { code: 'AMD', name: 'Ahmedabad' },
      { code: 'SRT', name: 'Surat' },
    ],
  },
  {
    code: 'HR', name: 'Haryana',
    districts: [
      { code: 'AMB', name: 'Ambala' },
      { code: 'PKL', name: 'Panchkula' },
    ],
  },
  {
    code: 'HP', name: 'Himachal Pradesh',
    districts: [
      { code: 'SHL', name: 'Shimla' },
      { code: 'KNG', name: 'Kangra' },
    ],
  },
  {
    code: 'JH', name: 'Jharkhand',
    districts: [
      { code: 'RNC', name: 'Ranchi' },
      { code: 'DHD', name: 'Dhanbad' },
    ],
  },
  {
    code: 'KA', name: 'Karnataka',
    districts: [
      { code: 'BNG', name: 'Bangalore' },
      { code: 'MYS', name: 'Mysore' },
    ],
  },
  {
    code: 'KL', name: 'Kerala',
    districts: [
      { code: 'TVM', name: 'Thiruvananthapuram' },
      { code: 'EKM', name: 'Ernakulam' },
    ],
  },
  {
    code: 'MP', name: 'Madhya Pradesh',
    districts: [
      { code: 'BPL', name: 'Bhopal' },
      { code: 'IND', name: 'Indore' },
    ],
  },
  {
    code: 'MH', name: 'Maharashtra',
    districts: [
      { code: 'MUM', name: 'Mumbai' },
      { code: 'PUN', name: 'Pune' },
    ],
  },
  {
    code: 'MN', name: 'Manipur',
    districts: [
      { code: 'IMW', name: 'Imphal West' },
      { code: 'IME', name: 'Imphal East' },
    ],
  },
  {
    code: 'ML', name: 'Meghalaya',
    districts: [
      { code: 'EKH', name: 'East Khasi Hills' },
      { code: 'WJH', name: 'West Jaintia Hills' },
    ],
  },
  {
    code: 'MZ', name: 'Mizoram',
    districts: [
      { code: 'AIZ', name: 'Aizawl' },
      { code: 'CMP', name: 'Champhai' },
    ],
  },
  {
    code: 'NL', name: 'Nagaland',
    districts: [
      { code: 'KOH', name: 'Kohima' },
      { code: 'DIM', name: 'Dimapur' },
    ],
  },
  {
    code: 'OD', name: 'Odisha',
    districts: [
      { code: 'BBS', name: 'Bhubaneswar' },
      { code: 'CTC', name: 'Cuttack' },
    ],
  },
  {
    code: 'PB', name: 'Punjab',
    districts: [
      { code: 'LDH', name: 'Ludhiana' },
      { code: 'ASR', name: 'Amritsar' },
    ],
  },
  {
    code: 'RJ', name: 'Rajasthan',
    districts: [
      { code: 'JAI', name: 'Jaipur' },
      { code: 'JDP', name: 'Jodhpur' },
    ],
  },
  {
    code: 'SK', name: 'Sikkim',
    districts: [
      { code: 'ESK', name: 'East Sikkim' },
      { code: 'WSK', name: 'West Sikkim' },
    ],
  },
  {
    code: 'TN', name: 'Tamil Nadu',
    districts: [
      { code: 'CHN', name: 'Chennai' },
      { code: 'CBE', name: 'Coimbatore' },
    ],
  },
  {
    code: 'TS', name: 'Telangana',
    districts: [
      { code: 'HYD', name: 'Hyderabad' },
      { code: 'WGL', name: 'Warangal' },
    ],
  },
  {
    code: 'TR', name: 'Tripura',
    districts: [
      { code: 'WTR', name: 'West Tripura' },
      { code: 'SPJ', name: 'Sepahijala' },
    ],
  },
  {
    code: 'UK', name: 'Uttarakhand',
    districts: [
      { code: 'DDN', name: 'Dehradun' },
      { code: 'HRW', name: 'Haridwar' },
    ],
  },
  {
    code: 'UP', name: 'Uttar Pradesh',
    districts: [
      { code: 'LKO', name: 'Lucknow' },
      { code: 'KNP', name: 'Kanpur' },
    ],
  },
  {
    code: 'WB', name: 'West Bengal',
    districts: [
      { code: 'KOL', name: 'Kolkata' },
      { code: 'HWR', name: 'Howrah' },
    ],
  },
  // ── 8 UNION TERRITORIES ──
  {
    code: 'AN', name: 'Andaman and Nicobar Islands',
    districts: [
      { code: 'SAN', name: 'South Andaman' },
      { code: 'NMA', name: 'North and Middle Andaman' },
    ],
  },
  {
    code: 'CH', name: 'Chandigarh',
    districts: [
      { code: 'CHU', name: 'Chandigarh Urban' },
      { code: 'CHR', name: 'Chandigarh Rural' },
    ],
  },
  {
    code: 'DN', name: 'Dadra and Nagar Haveli',
    districts: [
      { code: 'SLS', name: 'Silvassa' },
      { code: 'DDR', name: 'Dadra' },
    ],
  },
  {
    code: 'DD', name: 'Daman and Diu',
    districts: [
      { code: 'DMA', name: 'Daman' },
      { code: 'DIU', name: 'Diu' },
    ],
  },
  {
    code: 'DL', name: 'Delhi',
    districts: [
      { code: 'NDL', name: 'North Delhi' },
      { code: 'SDL', name: 'South Delhi' },
    ],
  },
  {
    code: 'JK', name: 'Jammu and Kashmir',
    districts: [
      { code: 'SRN', name: 'Srinagar' },
      { code: 'JMU', name: 'Jammu' },
    ],
  },
  {
    code: 'LA', name: 'Ladakh',
    districts: [
      { code: 'LEH', name: 'Leh' },
      { code: 'KGL', name: 'Kargil' },
    ],
  },
  {
    code: 'PY', name: 'Puducherry',
    districts: [
      { code: 'PUD', name: 'Puducherry' },
      { code: 'KAL', name: 'Karaikal' },
    ],
  },
];

// ============================================================
// SCHOOL AREA NAMES — used in "GPS <Area> <City>" format
// ============================================================

const AREA_NAMES: string[] = [
  'Central', 'Model Town', 'Civil Lines', 'Rajpur', 'Green Park',
  'New Colony', 'Station Road', 'Main Bazaar', 'Temple Road', 'Market Area',
  'Gandhi Nagar', 'Nehru Colony', 'Shanti Nagar', 'Pratap Nagar',
  'Rajiv Colony', 'Ambedkar Nagar', 'Lakshmi Nagar', 'Saraswati Vihar',
  'Ganga Nagar', 'Yamuna Colony',
];

// ============================================================
// SEED QUESTIONS — 12 questions (6 levels × 2 each)
// ============================================================

const SEED_QUESTIONS = [
  {
    question_id: 'L1_Q1',
    question: 'Count the apples in the picture. How many apples are there?',
    answer: '5',
    answer_type: 'number' as const,
    topic: 'Number Sense',
    subtopic: 'Counting',
    difficulty: 'easy' as const,
    source_level: 1,
    svgAsset: 'fruits',
  },
  {
    question_id: 'L1_Q2',
    question: 'Count the circles and write the total number.',
    answer: '3',
    answer_type: 'number' as const,
    topic: 'Shapes',
    subtopic: 'Recognition',
    difficulty: 'easy' as const,
    source_level: 1,
    svgAsset: 'shapes',
  },
  {
    question_id: 'L2_Q1',
    question: 'Calculate: 3 + 4 = ?',
    answer: '7',
    answer_type: 'number' as const,
    topic: 'Number Operations',
    subtopic: 'Addition',
    difficulty: 'easy' as const,
    source_level: 2,
    svgAsset: 'numbers',
  },
  {
    question_id: 'L2_Q2',
    question: 'Complete the pattern: Red Circle, Blue Circle, Red Circle, ?',
    answer: 'Blue Circle',
    answer_type: 'choice' as const,
    choices: ['Red Circle', 'Blue Circle', 'Green Circle'],
    topic: 'Patterns',
    subtopic: 'Completing Patterns',
    difficulty: 'medium' as const,
    source_level: 2,
    svgAsset: 'shapes',
  },
  {
    question_id: 'L3_Q1',
    question: 'If a pencil is 8 centimeters long and we cut 3 centimeters off, how long is it now?',
    answer: '5',
    answer_type: 'number' as const,
    topic: 'Measurement',
    subtopic: 'Length Subtraction',
    difficulty: 'medium' as const,
    source_level: 3,
    svgAsset: 'tracing',
  },
  {
    question_id: 'L3_Q2',
    question: 'Look at the clock. If the short hand points to 3 and the long hand points to 12, what hour is it?',
    answer: '3',
    answer_type: 'number' as const,
    topic: 'Calendar and Time',
    subtopic: 'Reading Hours',
    difficulty: 'easy' as const,
    source_level: 3,
    svgAsset: 'numbers',
  },
  {
    question_id: 'L4_Q1',
    question: 'Ramu has a pizza cut into 4 equal slices. He eats 1 slice. What fraction of the pizza is left?',
    answer: '3/4',
    answer_type: 'choice' as const,
    choices: ['1/4', '2/4', '3/4', '4/4'],
    topic: 'Fractions',
    subtopic: 'Fraction Representation',
    difficulty: 'medium' as const,
    source_level: 4,
    svgAsset: 'shapes',
  },
  {
    question_id: 'L4_Q2',
    question: 'You buy a toy for 15 rupees and give the shopkeeper a 50-rupee note. How many rupees do you get back?',
    answer: '35',
    answer_type: 'number' as const,
    topic: 'Money',
    subtopic: 'Transaction Change',
    difficulty: 'hard' as const,
    source_level: 4,
    svgAsset: 'numbers',
  },
  {
    question_id: 'L5_Q1',
    question: 'Multiply: 12 x 5 = ?',
    answer: '60',
    answer_type: 'number' as const,
    topic: 'Number Operations',
    subtopic: 'Multiplication',
    difficulty: 'easy' as const,
    source_level: 5,
    svgAsset: 'numbers',
  },
  {
    question_id: 'L5_Q2',
    question: 'In a class there are 5 benches. Each bench holds 4 students. How many students can sit in total?',
    answer: '20',
    answer_type: 'number' as const,
    topic: 'Data Handling',
    subtopic: 'Simple Arithmetic Multiplication',
    difficulty: 'medium' as const,
    source_level: 5,
    svgAsset: 'animals',
  },
  {
    question_id: 'L6_Q1',
    question: 'Divide: 48 / 6 = ?',
    answer: '8',
    answer_type: 'number' as const,
    topic: 'Number Operations',
    subtopic: 'Division',
    difficulty: 'medium' as const,
    source_level: 6,
    svgAsset: 'numbers',
  },
  {
    question_id: 'L6_Q2',
    question: 'If July 1st is a Monday, what day of the week is July 8th?',
    answer: 'Monday',
    answer_type: 'choice' as const,
    choices: ['Monday', 'Tuesday', 'Sunday', 'Wednesday'],
    topic: 'Calendar and Time',
    subtopic: 'Calendar Arithmetic',
    difficulty: 'hard' as const,
    source_level: 6,
    svgAsset: 'numbers',
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

let nameCursor = 0;

function nextName(): string {
  const isMale = nameCursor % 2 === 0;
  const firstName = isMale
    ? MALE_FIRST_NAMES[nameCursor % MALE_FIRST_NAMES.length]
    : FEMALE_FIRST_NAMES[nameCursor % FEMALE_FIRST_NAMES.length];
  const lastName = LAST_NAMES[nameCursor % LAST_NAMES.length];
  nameCursor++;
  return `${firstName} ${lastName}`;
}

function randomLevel(): number {
  return Math.floor(Math.random() * 15) + 1;
}

function randomSubLevel(): number {
  return Math.floor(Math.random() * 3);
}

function randomAge(classIndex: number): number {
  const base = 7 + classIndex;
  return base + Math.floor(Math.random() * 2);
}

function randomStreak(): number {
  return Math.floor(Math.random() * 20);
}

function generateAadhaar(): string {
  const last4 = String(Math.floor(Math.random() * 9000) + 1000);
  return `XXXX-XXXX-${last4}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log(`Connected to database: ${db.databaseName}`);

  // ── Drop all existing collections ──
  const existingCollections = await db.listCollections().toArray();
  for (const col of existingCollections) {
    await db.dropCollection(col.name);
  }
  console.log(`Dropped ${existingCollections.length} existing collections`);

  // ── Accumulate all documents ──
  const allUsers: Record<string, any>[] = [];
  const allSchools: Record<string, any>[] = [];
  const allClasses: Record<string, any>[] = [];
  const allStudents: Record<string, any>[] = [];

  // ════════════════════════════════════════════
  // 1. SUPERADMINS (5)
  // ════════════════════════════════════════════
  const superadmins = [
    { id: 'u_sup_01', email: 'superadmin@fln.org', name: 'Jinal Gupta', role: UserRole.SUPERADMIN, password: 'Fln@2026' },
    { id: 'u_sup_02', email: 'superadmin2@fln.org', name: 'Ravi Mehta', role: UserRole.SUPERADMIN, password: 'Fln@2026' },
    { id: 'u_sup_03', email: 'superadmin3@fln.org', name: 'Priya Deshmukh', role: UserRole.SUPERADMIN, password: 'Fln@2026' },
    { id: 'u_sup_04', email: 'superadmin4@fln.org', name: 'Amit Singh', role: UserRole.SUPERADMIN, password: 'Fln@2026' },
    { id: 'u_sup_05', email: 'superadmin5@fln.org', name: 'Kavita Reddy', role: UserRole.SUPERADMIN, password: 'Fln@2026' },
  ];
  allUsers.push(...superadmins);

  // ════════════════════════════════════════════
  // 2. STATES / UTs → Districts → Blocks → Schools → Classes → Students
  // ════════════════════════════════════════════
  const CLASSES = ['Class 2', 'Class 3', 'Class 4'];
  const CLASS_SHORTS = ['C2', 'C3', 'C4'];

  for (const state of STATES_UTS) {
    const sc = state.code.toLowerCase();

    // ── State Admin ──
    allUsers.push({
      id: `u_admin_${state.code}`,
      email: `admin.${sc}@fln.org`,
      name: `${state.name} State Coordinator`,
      role: UserRole.ADMIN,
      stateCode: state.code,
      password: 'Fln@2026',
    });

    for (let dIdx = 0; dIdx < state.districts.length; dIdx++) {
      const district = state.districts[dIdx];
      const dc = district.code.toLowerCase();

      // ── District Admin ──
      allUsers.push({
        id: `u_dist_${state.code}_${district.code}`,
        email: `district.${dc}@fln.org`,
        name: `${district.name} District Officer`,
        role: UserRole.DISTRICT_ADMIN,
        stateCode: state.code,
        districtCode: district.code,
        password: 'Fln@2026',
      });

      for (let bIdx = 0; bIdx < 2; bIdx++) {
        const blockNum = bIdx + 1;
        const blockCode = `${district.code}_${pad2(blockNum)}`;
        const bc = blockCode.toLowerCase();

        // ── Block Admin ──
        allUsers.push({
          id: `u_blk_${state.code}_${district.code}_${pad2(blockNum)}`,
          email: `block.${bc}@fln.org`,
          name: `${district.name} Block ${blockNum} Admin`,
          role: UserRole.BLOCK_ADMIN,
          stateCode: state.code,
          districtCode: district.code,
          blockCode: blockCode,
          password: 'Fln@2026',
        });

        for (let sIdx = 0; sIdx < 10; sIdx++) {
          const schoolNum = sIdx + 1;
          const schoolId = `${state.code}_${district.code}_${blockCode}_${pad2(schoolNum)}`;
          const schoolIdLower = schoolId.toLowerCase();
          const isLowStrength = schoolNum % 3 === 0;
          const areaIdx = (bIdx * 10 + sIdx) % AREA_NAMES.length;
          const areaName = AREA_NAMES[areaIdx];

          // ── School ──
          allSchools.push({
            id: schoolId,
            name: `GPS ${areaName} ${district.name}`,
            stateCode: state.code,
            districtCode: district.code,
            blockCode: blockCode,
            strength: isLowStrength ? 'low' : 'high',
            teachersCount: 3,
          });

          // ── Principal (School role) ──
          allUsers.push({
            id: `u_prn_${schoolId}`,
            email: `school.${schoolIdLower}@fln.org`,
            name: `${district.name} ${areaName} Principal`,
            role: UserRole.SCHOOL,
            schoolId: schoolId,
            password: 'Fln@2026',
          });

          // ── 3 Teachers (one per class) ──
          const teacherIds: string[] = [];
          for (let cIdx = 0; cIdx < 3; cIdx++) {
            const classShort = CLASS_SHORTS[cIdx];
            const teacherId = `u_tch_${schoolId}_${classShort}`;
            teacherIds.push(teacherId);

            allUsers.push({
              id: teacherId,
              email: `teacher.${schoolIdLower}.${classShort.toLowerCase()}@fln.org`,
              name: `${nextName()} (Teacher)`,
              role: UserRole.TEACHER,
              schoolId: schoolId,
              password: 'Fln@2026',
            });
          }

          // ── Volunteer for low-strength schools ──
          if (isLowStrength) {
            allUsers.push({
              id: `u_vol_${schoolId}`,
              email: `vol.${schoolIdLower}@fln.org`,
              name: `${nextName()} (Volunteer)`,
              role: UserRole.VOLUNTEER,
              assignedSchools: [schoolId],
              password: 'Fln@2026',
            });
          }

          // ── 3 Classes (Class 2, 3, 4) ──
          for (let cIdx = 0; cIdx < 3; cIdx++) {
            const className = CLASSES[cIdx];
            const classShort = CLASS_SHORTS[cIdx];
            const classId = `c_${schoolId}_${classShort}`;

            allClasses.push({
              id: classId,
              schoolId: schoolId,
              className: className,
              section: 'A',
              teacherId: teacherIds[cIdx],
            });

            // ── 20 Students per class ──
            for (let stIdx = 0; stIdx < 20; stIdx++) {
              const studentNum = stIdx + 1;
              const studentId = `s_${schoolId}_${classShort}_${pad2(studentNum)}`;
              const currentLevel = randomLevel();

              allStudents.push({
                id: studentId,
                name: nextName(),
                age: randomAge(cIdx),
                classGroup: className,
                section: 'A',
                schoolId: schoolId,
                teacherId: teacherIds[cIdx],
                currentLevel: currentLevel,
                currentSubLevel: randomSubLevel(),
                targetLevel: Math.min(currentLevel + 1, 59),
                aadharMasked: generateAadhaar(),
                levelHistory: [
                  {
                    level: currentLevel,
                    date: '2026-04-10',
                    reason: 'Onboarding Diagnostic Placement',
                  },
                ],
                streak: randomStreak(),
              });
            }
          }
        }
      }
    }
  }

  // ════════════════════════════════════════════
  // 3. INSERT INTO MONGODB
  // ════════════════════════════════════════════
  console.log('\nInserting data into collections...');

  const usersResult = await db.collection('users').insertMany(allUsers);
  console.log(`  users:          ${usersResult.insertedCount} inserted`);

  const schoolsResult = await db.collection('schools').insertMany(allSchools);
  console.log(`  schools:        ${schoolsResult.insertedCount} inserted`);

  const classesResult = await db.collection('classes').insertMany(allClasses);
  console.log(`  classes:        ${classesResult.insertedCount} inserted`);

  const studentsResult = await db.collection('students').insertMany(allStudents);
  console.log(`  students:       ${studentsResult.insertedCount} inserted`);

  const questionsResult = await db.collection('questions').insertMany(SEED_QUESTIONS);
  console.log(`  questions:      ${questionsResult.insertedCount} inserted`);

  // ════════════════════════════════════════════
  // 4. SUMMARY
  // ════════════════════════════════════════════
  console.log('\n========================================');
  console.log('  SEED COMPLETE');
  console.log('========================================');
  console.log(`  States/UTs:     ${STATES_UTS.length}`);
  console.log(`  Districts:      ${STATES_UTS.length * 2}`);
  console.log(`  Blocks:         ${STATES_UTS.length * 2 * 2}`);
  console.log(`  Schools:        ${allSchools.length}`);
  console.log(`  Classes:        ${allClasses.length}`);
  console.log(`  Students:       ${allStudents.length}`);
  console.log(`  Users:          ${allUsers.length}`);
  console.log(`    Superadmins:  ${superadmins.length}`);
  console.log(`    State Admins: ${STATES_UTS.length}`);
  console.log(`    Dist Admins:  ${STATES_UTS.length * 2}`);
  console.log(`    Block Admins: ${STATES_UTS.length * 2 * 2}`);
  console.log(`    Principals:   ${allSchools.length}`);
  console.log(`    Teachers:     ${allClasses.length}`);
  console.log(`    Volunteers:   ${allUsers.filter((u) => u.role === UserRole.VOLUNTEER).length}`);
  console.log(`  Questions:      ${SEED_QUESTIONS.length}`);
  console.log('========================================\n');

  await client.close();
  console.log('MongoDB connection closed');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
