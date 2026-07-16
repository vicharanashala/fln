import type {
  State,
  District,
  Block,
  School,
  Teacher,
  Student,
  Assessment,
  AuditLog,
  User,
} from "../types";

function rid(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export const SCHOOLS_MOCK: School[] = [
  {
    id: 'gps-mt-001',
    udiseId: 'UDISE001',
    name: 'GPS Model Town',
    stateId: 'PB',
    stateName: 'Punjab',
    districtId: 'LDH',
    districtName: 'Ludhiana',
    blockId: 'LDH-01',
    blockName: 'Ludhiana Block',
    cluster: 'Cluster I',
    type: 'Government',
    principal: 'Principal A',
    teacherCount: 8,
    studentCount: 200,
    averageScore: 75,
    status: 'Active',
    stateCode: 'PB',
    districtCode: 'LDH',
    blockCode: 'LDH-01',
    strength: 'standard',
    isAccessLocked: false,
  },
  {
    id: 'gps-vl-002',
    udiseId: 'UDISE002',
    name: 'GPS Village Lohara',
    stateId: 'PB',
    stateName: 'Punjab',
    districtId: 'MOG',
    districtName: 'Moga',
    blockId: 'MOG-01',
    blockName: 'Moga Block',
    cluster: 'Cluster II',
    type: 'Government',
    principal: 'Principal B',
    teacherCount: 2,
    studentCount: 80,
    averageScore: 68,
    status: 'Active',
    stateCode: 'PB',
    districtCode: 'MOG',
    blockCode: 'MOG-01',
    strength: 'standard',
    isAccessLocked: false,
  },
];

export const STATES: State[] = [
  { id: "AN", name: "Andhra Pradesh", code: "AP", type: "State", districtCount: 13, blockCount: 243, schoolCount: 45213, teacherCount: 198456, studentCount: 4218000, averageScore: 68.4, literacyScore: 71.2, numeracyScore: 65.6, center: [78.5, 16.5] },
  { id: "AR", name: "Arunachal Pradesh", code: "AR", type: "State", districtCount: 25, blockCount: 86, schoolCount: 3786, teacherCount: 14230, studentCount: 318000, averageScore: 54.8, literacyScore: 58.4, numeracyScore: 51.2, center: [94.7, 27.8] },
  { id: "AS", name: "Assam", code: "AS", type: "State", districtCount: 35, blockCount: 219, schoolCount: 59821, teacherCount: 198432, studentCount: 4621000, averageScore: 59.3, literacyScore: 63.1, numeracyScore: 55.5, center: [92.9, 26.2] },
  { id: "BR", name: "Bihar", code: "BR", type: "State", districtCount: 38, blockCount: 534, schoolCount: 72589, teacherCount: 312543, studentCount: 9412000, averageScore: 48.7, literacyScore: 52.3, numeracyScore: 45.1, center: [85.3, 25.8] },
  { id: "CG", name: "Chhattisgarh", code: "CG", type: "State", districtCount: 33, blockCount: 146, schoolCount: 43521, teacherCount: 156320, studentCount: 3245000, averageScore: 58.2, literacyScore: 61.7, numeracyScore: 54.7, center: [81.9, 21.3] },
  { id: "DL", name: "Delhi", code: "DL", type: "Union Territory", districtCount: 11, blockCount: 33, schoolCount: 5821, teacherCount: 48732, studentCount: 1843000, averageScore: 76.4, literacyScore: 79.8, numeracyScore: 73.0, center: [77.1, 28.7] },
  { id: "GA", name: "Goa", code: "GA", type: "State", districtCount: 2, blockCount: 12, schoolCount: 1482, teacherCount: 9430, studentCount: 145000, averageScore: 78.9, literacyScore: 82.3, numeracyScore: 75.5, center: [73.8, 15.3] },
  { id: "GJ", name: "Gujarat", code: "GJ", type: "State", districtCount: 33, blockCount: 248, schoolCount: 54182, teacherCount: 234567, studentCount: 5843000, averageScore: 71.5, literacyScore: 74.2, numeracyScore: 68.8, center: [71.2, 22.3] },
  { id: "HR", name: "Haryana", code: "HR", type: "State", districtCount: 22, blockCount: 143, schoolCount: 29843, teacherCount: 124560, studentCount: 3241000, averageScore: 73.4, literacyScore: 76.1, numeracyScore: 70.7, center: [76.4, 29.2] },
  { id: "HP", name: "Himachal Pradesh", code: "HP", type: "State", districtCount: 12, blockCount: 78, schoolCount: 18234, teacherCount: 67834, studentCount: 945000, averageScore: 74.1, literacyScore: 77.4, numeracyScore: 70.8, center: [77.2, 31.7] },
  { id: "JK", name: "Jammu and Kashmir", code: "JK", type: "Union Territory", districtCount: 20, blockCount: 119, schoolCount: 24321, teacherCount: 98230, studentCount: 1845000, averageScore: 61.3, literacyScore: 64.7, numeracyScore: 57.9, center: [75.4, 33.8] },
  { id: "JH", name: "Jharkhand", code: "JH", type: "State", districtCount: 24, blockCount: 264, schoolCount: 38543, teacherCount: 143210, studentCount: 4123000, averageScore: 51.2, literacyScore: 54.8, numeracyScore: 47.6, center: [85.3, 23.6] },
  { id: "KA", name: "Karnataka", code: "KA", type: "State", districtCount: 31, blockCount: 227, schoolCount: 62841, teacherCount: 287654, studentCount: 6342000, averageScore: 70.8, literacyScore: 73.5, numeracyScore: 68.1, center: [75.7, 14.8] },
  { id: "KL", name: "Kerala", code: "KL", type: "State", districtCount: 14, blockCount: 152, schoolCount: 12843, teacherCount: 87342, studentCount: 1987000, averageScore: 81.2, literacyScore: 84.6, numeracyScore: 77.8, center: [76.3, 10.5] },
  { id: "MP", name: "Madhya Pradesh", code: "MP", type: "State", districtCount: 55, blockCount: 313, schoolCount: 102321, teacherCount: 423210, studentCount: 9123000, averageScore: 56.4, literacyScore: 59.7, numeracyScore: 53.1, center: [78.7, 22.9] },
  { id: "MH", name: "Maharashtra", code: "MH", type: "State", districtCount: 36, blockCount: 358, schoolCount: 105432, teacherCount: 487650, studentCount: 10345000, averageScore: 72.1, literacyScore: 75.2, numeracyScore: 69.0, center: [75.7, 19.7] },
  { id: "OD", name: "Odisha", code: "OD", type: "State", districtCount: 30, blockCount: 314, schoolCount: 51243, teacherCount: 198430, studentCount: 4521000, averageScore: 62.7, literacyScore: 66.2, numeracyScore: 59.2, center: [84.5, 20.4] },
  { id: "PB", name: "Punjab", code: "PB", type: "State", districtCount: 23, blockCount: 153, schoolCount: 27134, teacherCount: 121320, studentCount: 2934000, averageScore: 75.8, literacyScore: 78.9, numeracyScore: 72.7, center: [75.3, 30.8] },
  { id: "RJ", name: "Rajasthan", code: "RJ", type: "State", districtCount: 33, blockCount: 295, schoolCount: 78654, teacherCount: 312430, studentCount: 8234000, averageScore: 60.5, literacyScore: 63.8, numeracyScore: 57.2, center: [74.2, 26.8] },
  { id: "TN", name: "Tamil Nadu", code: "TN", type: "State", districtCount: 38, blockCount: 388, schoolCount: 59234, teacherCount: 287654, studentCount: 6145000, averageScore: 76.4, literacyScore: 79.5, numeracyScore: 73.3, center: [78.7, 11.2] },
  { id: "TS", name: "Telangana", code: "TS", type: "State", districtCount: 33, blockCount: 213, schoolCount: 42156, teacherCount: 187432, studentCount: 3921000, averageScore: 67.3, literacyScore: 70.4, numeracyScore: 64.2, center: [79.0, 17.9] },
  { id: "UP", name: "Uttar Pradesh", code: "UP", type: "State", districtCount: 75, blockCount: 947, schoolCount: 198542, teacherCount: 723450, studentCount: 19421000, averageScore: 52.6, literacyScore: 56.1, numeracyScore: 49.1, center: [80.5, 27.0] },
  { id: "UK", name: "Uttarakhand", code: "UK", type: "State", districtCount: 13, blockCount: 95, schoolCount: 17432, teacherCount: 72310, studentCount: 1423000, averageScore: 67.2, literacyScore: 70.3, numeracyScore: 64.1, center: [79.5, 30.0] },
  { id: "WB", name: "West Bengal", code: "WB", type: "State", districtCount: 23, blockCount: 343, schoolCount: 84321, teacherCount: 312450, studentCount: 8934000, averageScore: 64.8, literacyScore: 68.1, numeracyScore: 61.5, center: [87.9, 23.2] },
];

export const NATIONAL = {
  totalStates: STATES.filter((s) => s.type === "State").length,
  totalUTs: STATES.filter((s) => s.type === "Union Territory").length,
  totalDistricts: STATES.reduce((a, b) => a + b.districtCount, 0),
  totalBlocks: STATES.reduce((a, b) => a + b.blockCount, 0),
  totalSchools: STATES.reduce((a, b) => a + b.schoolCount, 0),
  totalTeachers: STATES.reduce((a, b) => a + b.teacherCount, 0),
  totalStudents: STATES.reduce((a, b) => a + b.studentCount, 0),
  totalAssessments: 4382,
  totalScripts: 1284637,
  aiTemplates: 1284,
  averageScore: +(STATES.reduce((a, b) => a + b.averageScore, 0) / STATES.length).toFixed(1),
  completionRate: 87.3,
};

export const MONTHLY_ASSESSMENTS = [
  { month: "Apr", count: 248 },
  { month: "May", count: 312 },
  { month: "Jun", count: 421 },
  { month: "Jul", count: 358 },
  { month: "Aug", count: 487 },
  { month: "Sep", count: 543 },
  { month: "Oct", count: 612 },
  { month: "Nov", count: 489 },
  { month: "Dec", count: 358 },
  { month: "Jan", count: 287 },
  { month: "Feb", count: 192 },
  { month: "Mar", count: 75 },
];

export const LITERACY_VS_NUMERACY = [
  { name: "Class 1", literacy: 52, numeracy: 48 },
  { name: "Class 2", literacy: 58, numeracy: 54 },
  { name: "Class 3", literacy: 64, numeracy: 61 },
  { name: "Class 4", literacy: 69, numeracy: 66 },
  { name: "Class 5", literacy: 74, numeracy: 71 },
  { name: "Class 6", literacy: 78, numeracy: 75 },
  { name: "Class 7", literacy: 81, numeracy: 78 },
  { name: "Class 8", literacy: 84, numeracy: 81 },
];

export const CLASS_PERFORMANCE = LITERACY_VS_NUMERACY;

const districtNames = ["Central", "North", "South", "East", "West", "Rural East", "Rural West"];
const blockNames = ["Block A", "Block B", "Block C", "Block D", "Block E"];
const clusters = ["Cluster I", "Cluster II", "Cluster III", "Cluster IV"];
const types: School["type"][] = ["Government", "Aided", "Private", "Central"];
const designations = ["PRT", "TGT", "PGT", "Head Teacher"];
const subjectsList = ["English", "Hindi", "Mathematics", "EVS", "Science"];
const classesList = ["1", "2", "3", "4", "5", "6", "7", "8"];
const firstNames = ["Rajesh", "Priya", "Amit", "Anita", "Sunil", "Kavita", "Ravi", "Sneha", "Anil", "Meera", "Vikas", "Pooja", "Deepak", "Rekha", "Manoj", "Asha"];
const lastNames = ["Kumar", "Singh", "Sharma", "Verma", "Gupta", "Reddy", "Nair", "Patel", "Rao", "Iyer", "Das", "Khan"];

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateDistricts(): District[] {
  const districts: District[] = [];
  STATES.forEach((state, i) => {
    for (let d = 0; d < Math.min(state.districtCount, 5); d++) {
      districts.push({
        id: rid("D", i * 10 + d),
        name: `${state.name} ${districtNames[d % districtNames.length]}`,
        stateId: state.id,
        stateName: state.name,
        blockCount: state.blockCount / state.districtCount,
        schoolCount: state.schoolCount / state.districtCount,
        teacherCount: state.teacherCount / state.districtCount,
        studentCount: state.studentCount / state.districtCount,
        averageScore: +(state.averageScore + rndInt(-5, 5)).toFixed(1),
        code: `${state.code}-${d + 1}`,
      });
    }
  });
  return districts;
}

function generateBlocks(): Block[] {
  const blocks: Block[] = [];
  generateDistricts().forEach((d, i) => {
    for (let b = 0; b < 2; b++) {
      blocks.push({
        id: rid("B", i * 10 + b),
        name: `${d.name} ${blockNames[b]}`,
        districtId: d.id,
        districtName: d.name,
        stateName: d.stateName,
        schoolCount: d.schoolCount / 4,
      });
    }
  });
  return blocks;
}

function generateSchools(): School[] {
  const schools: School[] = [];
  const districts = generateDistricts();
  districts.forEach((d, i) => {
    for (let s = 0; s < 4; s++) {
      const type = rnd(types);
      schools.push({
        id: rid("S", i * 10 + s),
        udiseId: `UDISE${rndInt(10000000, 99999999)}`,
        name: `Govt. Higher Primary School ${d.name.split(" ").slice(-1)[0]} ${s + 1}`,
        stateId: d.stateId,
        stateName: d.stateName,
        districtId: d.id,
        districtName: d.name,
        blockId: rid("B", i * 10 + (s % 2)),
        blockName: `${d.name} Block`,
        cluster: rnd(clusters),
        type,
        principal: `${rnd(firstNames)} ${rnd(lastNames)}`,
        teacherCount: rndInt(8, 28),
        studentCount: rndInt(180, 720),
        averageScore: +(d.averageScore + rndInt(-8, 8)).toFixed(1),
        status: Math.random() > 0.05 ? "Active" : "Inactive",
      });
    }
  });
  return schools;
}

function generateTeachers(): Teacher[] {
  const teachers: Teacher[] = [];
  const schools = generateSchools().slice(0, 100);
  schools.forEach((s, i) => {
    for (let t = 0; t < 2; t++) {
      teachers.push({
        id: rid("T", i * 10 + t),
        employeeId: `TCH${rndInt(100000, 999999)}`,
        name: `${rnd(firstNames)} ${rnd(lastNames)}`,
        schoolId: s.id,
        schoolName: s.name,
        stateName: s.stateName,
        districtName: s.districtName,
        designation: rnd(designations),
        subjects: [rnd(subjectsList), rnd(subjectsList)].filter((v, i, a) => a.indexOf(v) === i),
        classes: [rnd(classesList), rnd(classesList)].filter((v, i, a) => a.indexOf(v) === i),
        studentCount: rndInt(40, 180),
        assessmentsConducted: rndInt(2, 24),
        status: rnd(["Active", "Active", "Active", "On Leave", "Inactive"]),
      });
    }
  });
  return teachers;
}

function generateStudents(): Student[] {
  const students: Student[] = [];
  const teachers = generateTeachers();
  teachers.forEach((t, i) => {
    for (let s = 0; s < 3; s++) {
      const lvl = rndInt(4, 48);
      students.push({
        id: rid("STU", i * 10 + s),
        rollNumber: `R${rndInt(100, 999)}`,
        name: `${rnd(firstNames)} ${rnd(lastNames)}`,
        class: rnd(classesList),
        classGroup: rnd(classesList),
        section: rnd(['A', 'B', 'C']),
        age: rndInt(6, 12),
        schoolId: t.schoolId,
        schoolName: t.schoolName,
        districtName: t.districtName,
        stateName: t.stateName,
        gender: rnd(["Male", "Female", "Male", "Female"]),
        attendance: rndInt(72, 99),
        averageScore: +(t.studentCount % 30 + 50 + rndInt(-5, 10)).toFixed(1),
        latestAssessment: "FLN Q3 2025-26",
        currentLevel: lvl,
        targetLevel: Math.min(lvl + rndInt(1, 4), 59),
        aadharMasked: `XXXX-XXXX-${rndInt(1000, 9999)}`,
        levelHistory: [{ level: lvl, date: '2025-08-01', reason: 'Baseline' }],
        streak: rndInt(0, 7),
      });
    }
  });
  return students;
}


export const DISTRICTS = generateDistricts();
export const BLOCKS = generateBlocks();
export const SCHOOLS = generateSchools();
export const TEACHERS = generateTeachers();
export const STUDENTS = generateStudents();

export const ASSESSMENTS: Assessment[] = [
  { id: "A-001", name: "FLN Baseline Assessment 2025-26", type: "Diagnostic", subject: "Both", grade: "Class 3", language: "English", academicYear: "2025-26", totalMarks: 50, duration: 90, status: "Completed", templateStatus: "Approved", questionCount: 25, createdAt: "2025-07-12", publishedAt: "2025-07-15" },
  { id: "A-002", name: "Numeracy Mid-Term 2025-26", type: "Formative", subject: "Numeracy", grade: "Class 4", language: "Hindi", academicYear: "2025-26", totalMarks: 40, duration: 60, status: "Active", templateStatus: "Approved", questionCount: 20, createdAt: "2025-09-01", publishedAt: "2025-09-10" },
  { id: "A-003", name: "Literacy Quarterly Check Q3", type: "Formative", subject: "Literacy", grade: "Class 5", language: "English", academicYear: "2025-26", totalMarks: 30, duration: 45, status: "Active", templateStatus: "Approved", questionCount: 15, createdAt: "2025-10-12", publishedAt: "2025-10-15" },
  { id: "A-004", name: "FLN Annual Summative 2025-26", type: "Summative", subject: "Both", grade: "Class 3-5", language: "Multi", academicYear: "2025-26", totalMarks: 100, duration: 180, status: "Scheduled", templateStatus: "Processing", questionCount: 50, createdAt: "2025-11-01" },
  { id: "A-005", name: "Reading Fluency Practice Test", type: "Practice", subject: "Literacy", grade: "Class 2", language: "Hindi", academicYear: "2025-26", totalMarks: 20, duration: 30, status: "Draft", templateStatus: "Not Generated", questionCount: 0, createdAt: "2025-12-05" },
  { id: "A-006", name: "Arithmetic Diagnostic Q4", type: "Diagnostic", subject: "Numeracy", grade: "Class 6", language: "English", academicYear: "2025-26", totalMarks: 60, duration: 90, status: "Completed", templateStatus: "Approved", questionCount: 30, createdAt: "2025-12-12", publishedAt: "2025-12-15" },
  { id: "A-007", name: "EVS Practice Worksheet", type: "Practice", subject: "Literacy", grade: "Class 4", language: "Tamil", academicYear: "2025-26", totalMarks: 25, duration: 40, status: "Archived", templateStatus: "Approved", questionCount: 12, createdAt: "2024-08-12", publishedAt: "2024-09-01" },
];

export const AUDIT_LOGS: AuditLog[] = Array.from({ length: 40 }).map((_, i) => ({
  id: `L-${String(i + 1).padStart(5, "0")}`,
  userId: `U-${rndInt(1, 50)}`,
  userName: `${rnd(firstNames)} ${rnd(lastNames)}`,
  module: rnd(["Users", "Schools", "Assessments", "Templates", "Reports"]),
  action: rnd(["Created", "Updated", "Deleted", "Login", "Export"]),
  timestamp: new Date(Date.now() - rndInt(0, 86400000 * 30)).toISOString(),
  ipAddress: `${rndInt(10, 250)}.${rndInt(0, 255)}.${rndInt(0, 255)}.${rndInt(1, 254)}`,
  status: Math.random() > 0.08 ? "Success" : "Failure",
}));

export const USERS: User[] = Array.from({ length: 24 }).map((_, i) => ({
  id: `U-${String(i + 1).padStart(4, "0")}`,
  firstName: rnd(firstNames),
  lastName: rnd(lastNames),
  email: `user${i + 1}@fln.org`,
  phone: `+91${rndInt(7000000000, 9999999999)}`,
  role: rnd(["superadmin", "state_admin", "district_admin", "school", "teacher"]) as User["role"],
  isActive: Math.random() > 0.15,
  createdAt: new Date(Date.now() - rndInt(86400000, 86400000 * 365)).toISOString(),
}));

export const ACADEMIC_YEARS = ["2024-25", "2025-26", "2026-27"];
export const GRADES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8"];
export const SUBJECTS = ["Literacy", "Numeracy", "Both"];
export const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu"];
export const ASSESSMENT_TYPES: Assessment["type"][] = ["Diagnostic", "Formative", "Summative", "Practice"];
export const STATUSES: Assessment["status"][] = ["Draft", "Scheduled", "Active", "Completed", "Archived"];
