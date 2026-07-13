/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, School, Ticket, Announcement, LogEntry } from './types';

export const FLN_STRANDS = [
  'Number Sense (One-to-One Correspondence)',
  'Number Operations',
  'Money',
  'Measurement',
  'Shapes',
  'Fractions',
  'Patterns',
  'Data Handling',
  'Calendar & Time'
];

export const STATES_DATA = [
  { id: 'pb', name: 'Punjab', districtsCount: 23, enrolled: 245000, certified: 159250 },
  { id: 'hr', name: 'Haryana', districtsCount: 22, enrolled: 198000, certified: 128700 },
  { id: 'rj', name: 'Rajasthan', districtsCount: 33, enrolled: 382000, certified: 191000 },
  { id: 'up', name: 'Uttar Pradesh', districtsCount: 75, enrolled: 520000, certified: 286000 },
  { id: 'hp', name: 'Himachal Pradesh', districtsCount: 12, enrolled: 84000, certified: 63840 },
  { id: 'ut', name: 'Uttarakhand', districtsCount: 13, enrolled: 95000, certified: 68400 }
];

export const DISTRICTS_DATA: Record<string, { id: string; name: string; blocksCount: number; avgScore: number; lagging: boolean }[]> = {
  pb: [
    { id: 'ldh', name: 'Ludhiana', blocksCount: 14, avgScore: 78, lagging: false },
    { id: 'jal', name: 'Jalandhar', blocksCount: 11, avgScore: 74, lagging: false },
    { id: 'asr', name: 'Amritsar', blocksCount: 9, avgScore: 68, lagging: false },
    { id: 'bth', name: 'Bathinda', blocksCount: 8, avgScore: 38, lagging: true },
    { id: 'pat', name: 'Patiala', blocksCount: 10, avgScore: 61, lagging: false },
    { id: 'mog', name: 'Moga', blocksCount: 6, avgScore: 52, lagging: false }
  ],
  hr: [
    { id: 'amb', name: 'Ambala', blocksCount: 8, avgScore: 71, lagging: false },
    { id: 'pkl', name: 'Panchkula', blocksCount: 5, avgScore: 79, lagging: false },
    { id: 'krn', name: 'Karnal', blocksCount: 7, avgScore: 63, lagging: false }
  ],
  rj: [
    { id: 'jpr', name: 'Jaipur', blocksCount: 15, avgScore: 72, lagging: false },
    { id: 'jod', name: 'Jodhpur', blocksCount: 12, avgScore: 54, lagging: false },
    { id: 'uda', name: 'Udaipur', blocksCount: 11, avgScore: 35, lagging: true },
    { id: 'ajm', name: 'Ajmer', blocksCount: 8, avgScore: 39, lagging: true }
  ],
  up: [
    { id: 'lko', name: 'Lucknow', blocksCount: 12, avgScore: 65, lagging: false },
    { id: 'knp', name: 'Kanpur', blocksCount: 10, avgScore: 44, lagging: true },
    { id: 'var', name: 'Varanasi', blocksCount: 9, avgScore: 58, lagging: false }
  ]
};

export const BLOCKS_DATA: Record<string, { id: string; name: string; districtId: string; avgScore: number }[]> = {
  'ldh': [
    { id: 'LDH-01', name: 'Ludhiana Block 1', districtId: 'ldh', avgScore: 78 },
    { id: 'LDH-02', name: 'Ludhiana Block 2', districtId: 'ldh', avgScore: 65 }
  ],
  'bth': [
    { id: 'BTH-01', name: 'Bathinda Block 1', districtId: 'bth', avgScore: 38 }
  ],
  'asr': [
    { id: 'ASR-01', name: 'Amritsar Block 1', districtId: 'asr', avgScore: 68 }
  ],
  'mog': [
    { id: 'MOG-02', name: 'Moga Block 2', districtId: 'mog', avgScore: 52 }
  ],
  'amb': [
    { id: 'AMB-01', name: 'Ambala Block 1', districtId: 'amb', avgScore: 71 },
    { id: 'AMB-02', name: 'Ambala Block 2', districtId: 'amb', avgScore: 68 }
  ],
  'pkl': [
    { id: 'PKL-01', name: 'Panchkula Block 1', districtId: 'pkl', avgScore: 79 }
  ],
  'jpr': [
    { id: 'JAI-01', name: 'Jaipur Block A', districtId: 'jpr', avgScore: 72 },
    { id: 'JAI-02', name: 'Jaipur Block B', districtId: 'jpr', avgScore: 65 }
  ],
  'uda': [
    { id: 'UDA-01', name: 'Udaipur Block 1', districtId: 'uda', avgScore: 35 }
  ],
  'lko': [
    { id: 'LKO-01', name: 'Lucknow Block 1', districtId: 'lko', avgScore: 65 },
    { id: 'LKO-02', name: 'Lucknow Block 2', districtId: 'lko', avgScore: 58 }
  ],
  'knp': [
    { id: 'KNP-01', name: 'Kanpur Block 1', districtId: 'knp', avgScore: 44 }
  ]
};

// Auto-generate 59 detailed FLN levels
export const FLN_LEVELS: any[] = (() => {
  const levels: any[] = [];
  const strandRotation = [
    'Number Sense (One-to-One Correspondence)',
    'Number Operations',
    'Shapes',
    'Measurement',
    'Patterns',
    'Money',
    'Calendar & Time',
    'Fractions',
    'Data Handling'
  ];

  const outcomesByStrand: Record<string, string[]> = {
    'Number Sense (One-to-One Correspondence)': [
      'Counting objects up to 10 with 1-to-1 matching',
      'Comparing sizes of groups (more, less, equal)',
      'Identifying position on a number line 1-10',
      'Reading and writing numerals up to 20',
      'Understanding place value up to 50 (tens and ones)',
      'Understanding place value up to 100',
      'Comparing 2-digit numbers using <, >, =',
      'Understanding numbers up to 1000'
    ],
    'Number Operations': [
      'Single-digit addition using visual aids',
      'Single-digit subtraction using visual objects',
      'Addition and subtraction of numbers up to 20 without carrying',
      'Double-digit addition without carrying',
      'Double-digit subtraction without borrowing',
      'Addition with carrying (2-digit)',
      'Subtraction with borrowing (2-digit)',
      'Basic multiplication tables of 2, 5, 10',
      'Introductory division as equal sharing',
      '3-digit addition and subtraction operations'
    ],
    'Shapes': [
      'Identifying basic shapes: Circle, Triangle, Square',
      'Recognizing shapes in real-world objects',
      'Differentiating 2D vs 3D shapes (Sphere, Cube)',
      'Understanding properties of shapes (corners, sides)',
      'Symmetry and spatial arrangements'
    ],
    'Measurement': [
      'Comparing length and height of objects (tall, short)',
      'Measuring length using non-standard units (handspan)',
      'Comparing weight of objects (heavy, light)',
      'Measuring volume using capacity containers',
      'Standard measurement units (cm, m, grams, ml)'
    ],
    'Patterns': [
      'Identifying simple repeating shape patterns (AB, AABB)',
      'Completing numeric skip counting patterns by 2s and 5s',
      'Creating custom sequential patterns',
      'Advanced numeric patterns (backwards, skip 10s)'
    ],
    'Money': [
      'Identifying 1, 2, 5, 10 rupee coins',
      'Understanding currency notes: 10, 20, 50, 100 rupees',
      'Adding simple monetary transactions (total price)',
      'Making change for a transaction (rupee notes)'
    ],
    'Calendar & Time': [
      'Identifying morning, afternoon, night routines',
      'Sequencing days of the week',
      'Telling time in full hours on analog clock',
      'Reading months of the year',
      'Telling time in half-hours and quarter-hours'
    ],
    'Fractions': [
      'Concept of whole vs. half (1/2)',
      'Concept of quarter (1/4)',
      'Comparing 1/2, 1/4 and whole visually',
      'Concept of three-quarters (3/4) and simple fractions'
    ],
    'Data Handling': [
      'Sorting objects into visual groups',
      'Creating simple tally charts',
      'Reading and interpreting bar pictographs',
      'Basic multi-variable tables'
    ]
  };

  for (let i = 1; i <= 59; i++) {
    const classLevel = i <= 15 ? 1 : i <= 32 ? 2 : i <= 48 ? 3 : 4;
    const strand = strandRotation[(i - 1) % strandRotation.length];
    const outcomes = outcomesByStrand[strand] || ['Demonstrates competency in foundational math concepts'];
    const outcome = outcomes[(i - 1) % outcomes.length];

    levels.push({
      levelNumber: i,
      strand,
      topic: `${strand.split(' ')[0]} - Phase ${Math.ceil(i / 10)}`,
      learningOutcome: outcome,
      classLevel,
      subLevels: {
        mastery: `Evaluates capability in ${outcome.toLowerCase()} under standard conditions.`,
        easier: `Simplified questions focusing on visual recognition and matching of ${outcome.toLowerCase()}.`,
        remedial: `Remedial intervention addressing fundamental prerequisite concepts for ${outcome.toLowerCase()}.`
      }
    });
  }

  return levels;
})();

export const INITIAL_SCHOOLS: any[] = [
  {
    id: 'gps-mt-001',
    name: 'Primary School, Mattewal-3',
    district: 'Ludhiana',
    block: 'Ludhiana Block-1',
    state: 'Punjab',
    type: 'standard',
    avgScore: 78,
    enrolledStudents: 142,
    certifiedStudents: 110,
    defaultingTeachersCount: 0
  },
  {
    id: 'gps-sh-002',
    name: 'Primary School, Sirhind-1',
    district: 'Bathinda',
    block: 'Bathinda Block-2',
    state: 'Punjab',
    type: 'standard',
    avgScore: 35,
    enrolledStudents: 18,
    certifiedStudents: 4,
    defaultingTeachersCount: 1
  },
  {
    id: 'gps-jp-003',
    name: 'Primary School, Jaipur Rural-5',
    district: 'Jaipur',
    block: 'Jaipur Block-A',
    state: 'Rajasthan',
    type: 'standard',
    avgScore: 71,
    enrolledStudents: 220,
    certifiedStudents: 140,
    defaultingTeachersCount: 0
  },
  {
    id: 'gps-ud-004',
    name: 'Primary School, Udaipur Tribal-2',
    district: 'Udaipur',
    block: 'Udaipur Block-B',
    state: 'Rajasthan',
    type: 'standard',
    avgScore: 32,
    enrolledStudents: 14,
    certifiedStudents: 2,
    defaultingTeachersCount: 2 // Defaulter lock
  }
];

export const INITIAL_CLASSES: any[] = [
  {
    id: 'cls-3b',
    name: 'Class 3B',
    grade: 3,
    averageScore: 72,
    studentCount: 6,
    generationLocked: false,
    conceptSuggestions: ['Multiplication Tables of 5 and 10', 'Measuring using ruler scale (cm)'],
  },
  {
    id: 'cls-2a',
    name: 'Class 2A',
    grade: 2,
    averageScore: 61,
    studentCount: 4,
    generationLocked: false,
    conceptSuggestions: ['Place Value (tens and ones)', 'Simple Subtraction within 20'],
  },
  {
    id: 'cls-4a',
    name: 'Class 4A',
    grade: 4,
    averageScore: 82,
    studentCount: 5,
    generationLocked: true, // Lock example
    lockedBy: 'School Principal (Priya Patel)',
    lockedAt: '2026-07-04 10:30 AM',
    conceptSuggestions: ['Fractions visual comparisons', 'Reading analog clocks'],
  }
];

export const INITIAL_STUDENTS: any[] = [
  // Class 3B (Teacher Aarav Gupta's class)
  {
    id: 'stu-001',
    name: 'Aarav Kumar',
    age: 8,
    gender: 'Boy',
    classNum: 3,
    level: 7, // Level 7
    status: 'On Track',
    score: 75,
    aadharMasked: 'XXXX-XXXX-4921',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-04',
    history: [
      {
        id: 'h-01a',
        assessmentCycle: 'Baseline',
        date: '2026-07-04',
        score: 75,
        levelAssigned: 7,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '19', isCorrect: true },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '10', isCorrect: false },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'square', isCorrect: true },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '9', isCorrect: false }
        ],
        narrativeReport: 'Aarav shows great focus on basic numbers, but requires reinforcement in simple subtraction calculations and pattern deduction. Recommending skip counting activities.'
      }
    ]
  },
  {
    id: 'stu-002',
    name: 'Aisha Patel',
    age: 9,
    gender: 'Girl',
    classNum: 3,
    level: 15,
    status: 'Advanced',
    score: 88,
    aadharMasked: 'XXXX-XXXX-9831',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-03',
    history: [
      {
        id: 'h-02a',
        assessmentCycle: 'Baseline',
        date: '2026-07-03',
        score: 88,
        levelAssigned: 15,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '19', isCorrect: true },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'circle', isCorrect: false },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '10', isCorrect: true }
        ],
        narrativeReport: 'Outstanding operational accuracy! Aisha demonstrates near-mastery of Grade 3 objectives, having successfully completed double-digit carries. She only missed a geometric query.'
      }
    ]
  },
  {
    id: 'stu-003',
    name: 'Simran Preet',
    age: 8,
    gender: 'Girl',
    classNum: 3,
    level: 4,
    status: 'At Risk',
    score: 52,
    aadharMasked: 'XXXX-XXXX-1120',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-01',
    history: [
      {
        id: 'h-03a',
        assessmentCycle: 'Baseline',
        date: '2026-07-01',
        score: 52,
        levelAssigned: 4,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '2', isCorrect: false },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'tens', isCorrect: false },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '15', isCorrect: false },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'square', isCorrect: true },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '10', isCorrect: true }
        ],
        narrativeReport: 'Simran struggles significantly with basic place value designations (confused ones & tens) and counting matches. Needs foundational level practice sheets.'
      }
    ]
  },
  {
    id: 'stu-004',
    name: 'Rohit Singh',
    age: 9,
    gender: 'Boy',
    classNum: 3,
    level: 2,
    status: 'Intervention',
    score: 38,
    aadharMasked: 'XXXX-XXXX-2831',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-04',
    history: [
      {
        id: 'h-04a',
        assessmentCycle: 'Baseline',
        date: '2026-07-04',
        score: 38,
        levelAssigned: 2,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '5', isCorrect: false },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'tens', isCorrect: false },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '11', isCorrect: false },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '2', isCorrect: false },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'square', isCorrect: true },
          { qId: 'q-pat-01', text: 'Complete counting skip pattern: 2, 4, 6, 8, __', expectedAnswer: '10', studentAnswer: '10', isCorrect: true }
        ],
        narrativeReport: 'Critical foundational gaps in operation arithmetic. Rohit requires extensive block-based active material practice before skip-counting tests.'
      }
    ]
  },
  {
    id: 'stu-005',
    name: 'Kabir Mehta',
    age: 8,
    gender: 'Boy',
    classNum: 3,
    level: 1,
    status: 'New',
    score: 0,
    aadharMasked: 'XXXX-XXXX-5821',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: 'N/A'
  },
  {
    id: 'stu-006',
    name: 'Meera Nair',
    age: 8,
    gender: 'Girl',
    classNum: 3,
    level: 1,
    status: 'New',
    score: 0,
    aadharMasked: 'XXXX-XXXX-1932',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: 'N/A'
  },
  // Class 2A
  {
    id: 'stu-007',
    name: 'Yash Vardhan',
    age: 7,
    gender: 'Boy',
    classNum: 2,
    level: 4,
    status: 'On Track',
    score: 65,
    aadharMasked: 'XXXX-XXXX-7721',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-06-30',
    history: [
      {
        id: 'h-07a',
        assessmentCycle: 'Baseline',
        date: '2026-06-30',
        score: 65,
        levelAssigned: 4,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '12', isCorrect: false },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'circle', isCorrect: false }
        ],
        narrativeReport: 'Yash has general understanding but requires visual guides for spatial shapes and geometric properties.'
      }
    ]
  },
  {
    id: 'stu-008',
    name: 'Diya Sharma',
    age: 7,
    gender: 'Girl',
    classNum: 2,
    level: 8,
    status: 'Advanced',
    score: 84,
    aadharMasked: 'XXXX-XXXX-3382',
    teacherId: 'gps-mt-001.t01@fln.org',
    schoolId: 'gps-mt-001',
    lastAssessed: '2026-07-02',
    history: [
      {
        id: 'h-08a',
        assessmentCycle: 'Baseline',
        date: '2026-07-02',
        score: 84,
        levelAssigned: 8,
        questions: [
          { qId: 'q-num-01', text: 'Write digit shown in base block', expectedAnswer: '4', studentAnswer: '4', isCorrect: true },
          { qId: 'q-num-02', text: 'Identify position on a number line 1-10', expectedAnswer: 'ones', studentAnswer: 'ones', isCorrect: true },
          { qId: 'q-op-01', text: 'Double digit addition without carrying', expectedAnswer: '19', studentAnswer: '19', isCorrect: true },
          { qId: 'q-op-02', text: 'Double digit subtraction without borrowing', expectedAnswer: '7', studentAnswer: '7', isCorrect: true },
          { qId: 'q-shape-01', text: 'Identify properties of a square', expectedAnswer: 'square', studentAnswer: 'circle', isCorrect: false }
        ],
        narrativeReport: 'Excellent capability in calculations! Diya is eager and performs operations quickly and cleanly.'
      }
    ]
  }
];

export const INITIAL_ANNOUNCEMENTS: any[] = [
  {
    id: 'ann-001',
    title: 'Baseline Assessment Cycle Set to Start on July 10, 2026',
    body: 'Attention all School Principals and Teachers: The fixed Baseline Assessment Cycle for academic year 2026-27 will officially open on July 10, 2026. Make sure all class student rosters are fully updated and verified prior to generation.',
    urgency: 'high',
    postedAt: '2026-07-04 09:00 AM',
    emailEscalation: true
  },
  {
    id: 'ann-002',
    title: 'Revised Standard SVG Asset Library Released',
    body: 'The central curriculum team has completed the annual visual style refresh. The category-based SVG asset library now includes 150+ child-friendly, high-contrast monochrome line arts. If a generation task requests a missing illustration, same-category substitution will handle it automatically.',
    urgency: 'medium',
    postedAt: '2026-07-02 02:00 PM',
    emailEscalation: false
  },
  {
    id: 'ann-003',
    title: 'FLN Numeracy Benchmark Standards Updated',
    body: 'Revised NCERT-aligned sub-level descriptions have been populated for FLN levels 1 to 59. No action required; the auto-level evaluation pipeline incorporates these immediately.',
    urgency: 'low',
    postedAt: '2026-06-28 11:30 AM',
    emailEscalation: false
  }
];

export const INITIAL_TICKETS: any[] = [
  {
    id: 'tkt-101',
    title: 'Inconsistency in Level 12 Shapes categorization',
    description: 'The learning outcomes in Level 12 description seem to suggest 3D shapes, but some worksheets include basic 2D triangles. Please review if it maps to Level 11 shape prerequisites instead.',
    type: 'curriculum',
    status: 'open',
    submittedBy: 'Aarav Gupta (Teacher)',
    role: 'teacher',
    submittedAt: '2026-07-04 04:30 PM'
  },
  {
    id: 'tkt-102',
    title: 'Delayed attempt false alarm warning',
    description: 'Due to severe power outages on July 3,Mattewal-3 submitted scans 10 minutes past the submission window. We received a delayed attempt alert. Can this be whitelisted?',
    type: 'process',
    status: 'in-progress',
    submittedBy: 'Priya Patel (Principal)',
    role: 'school',
    submittedAt: '2026-07-03 06:15 PM'
  },
  {
    id: 'tkt-103',
    title: 'Missing regional coin SVG for Money strand',
    description: 'We require standard regional currency line illustrations for Punjab local worksheets. Category-based fallback is currently using general rupee coin vectors.',
    type: 'content',
    status: 'resolved',
    submittedBy: 'Rajesh Sharma (State Admin)',
    role: 'admin',
    submittedAt: '2026-06-25 10:00 AM'
  }
];

export const INITIAL_NOTIFICATIONS: any[] = [
  {
    id: 'notif-001',
    title: 'Urgent Announcement',
    message: 'Baseline Assessment Cycle officially starts July 10, 2026.',
    type: 'announcement',
    date: '2026-07-04',
    read: false
  },
  {
    id: 'notif-002',
    title: 'Delayed Attempt Warning',
    message: 'Mattewal-3 Class 3B logged 1 delayed attempt. You have 2 attempts remaining.',
    type: 'delayed',
    date: '2026-07-03',
    read: false
  },
  {
    id: 'notif-003',
    title: 'Evaluation Complete',
    message: 'Student Aarav Kumar evaluated successfully. Placed at Level 7.',
    type: 'evaluation',
    date: '2026-07-04',
    read: true
  }
];

export const MOCK_QUESTIONS_BANK = [
  {
    id: 'q-num-01',
    text: 'How many triangles are there in the box? Count them and write the number.',
    expectedAnswer: '4',
    strand: 'Number Sense (One-to-One Correspondence)',
    level: 4,
    illustration: 'triangle_group_4.svg',
    difficulty: 'easy'
  },
  {
    id: 'q-num-02',
    text: 'Write the place value of the underlined digit: 4_3_ (tens or ones?)',
    expectedAnswer: 'tens',
    strand: 'Number Sense (One-to-One Correspondence)',
    level: 7,
    illustration: 'tens_ones_blocks.svg',
    difficulty: 'medium'
  },
  {
    id: 'q-op-01',
    text: 'Solve: 14 + 5 = ?',
    expectedAnswer: '19',
    strand: 'Number Operations',
    level: 15,
    illustration: 'apple_addition_group.svg',
    difficulty: 'easy'
  },
  {
    id: 'q-op-02',
    text: 'If there are 3 birds on one branch and 5 birds on another branch, how many birds are there in total?',
    expectedAnswer: '8',
    strand: 'Number Operations',
    level: 7,
    illustration: 'birds_branch.svg',
    difficulty: 'medium'
  },
  {
    id: 'q-shape-01',
    text: 'Which shape has 4 equal sides and 4 corners?',
    expectedAnswer: 'square',
    strand: 'Shapes',
    level: 3,
    illustration: 'shapes_geometric.svg',
    difficulty: 'easy'
  },
  {
    id: 'q-pat-01',
    text: 'Complete the pattern: 2, 4, 6, 8, __',
    expectedAnswer: '10',
    strand: 'Patterns',
    level: 10,
    illustration: 'numbers_pattern.svg',
    difficulty: 'medium'
  }
];

export const INITIAL_LOGS: any[] = [
  {
    id: 'log-001',
    time: '2026-07-06 09:30 AM',
    type: 'Core Security',
    details: 'Global parameter synchronization finalized for National Database.',
    level: 'superadmin'
  },
  {
    id: 'log-002',
    time: '2026-07-05 04:00 PM',
    type: 'Access Review',
    details: 'Security credentials audit completed for 28 state admins.',
    level: 'superadmin'
  },
  {
    id: 'log-003',
    time: '2026-07-05 11:15 AM',
    type: 'State Allocation',
    details: 'Resource allocation limits whitelisted for Ludhiana and Amritsar blocks.',
    level: 'admin',
    scope: 'Punjab'
  },
  {
    id: 'log-004',
    time: '2026-07-04 02:00 PM',
    type: 'Baseline Schedule',
    details: 'Punjab state FLN testing schedule approved.',
    level: 'admin',
    scope: 'Punjab'
  },
  {
    id: 'log-005',
    time: '2026-07-05 03:20 PM',
    type: 'District Sync',
    details: 'Ingestion status reports aggregated for Amritsar district.',
    level: 'district_admin',
    scope: 'Amritsar'
  },
  {
    id: 'log-006',
    time: '2026-07-04 05:00 PM',
    type: 'District Rank Update',
    details: 'District-wide class 3 and 4 score matrices updated.',
    level: 'district_admin',
    scope: 'Ludhiana'
  },
  {
    id: 'log-007',
    time: '2026-07-05 01:10 PM',
    type: 'Block Inspection',
    details: 'Manual inspection scheduled for 4 schools with low scores.',
    level: 'block_admin',
    scope: 'Sirhind'
  },
  {
    id: 'log-008',
    time: '2026-07-04 10:45 AM',
    type: 'Volunteer Registration',
    details: 'Approved registration for 3 new student mentors in Mattewal block.',
    level: 'block_admin',
    scope: 'Mattewal'
  },
  {
    id: 'log-009',
    time: '2026-07-05 09:15 AM',
    type: 'School Roll Call',
    details: 'All class registers synchronized for GPS Mattewal-3.',
    level: 'school',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-010',
    time: '2026-07-04 11:30 AM',
    type: 'Lock Applied',
    details: 'Class 4A testing results frozen by School Principal.',
    level: 'school',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-011',
    time: '2026-07-05 10:15 AM',
    type: 'ICR Ingest',
    details: 'Evaluated Class 3B answer sheets and pushed to student history logs.',
    level: 'teacher',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-012',
    time: '2026-07-04 03:40 PM',
    type: 'Exam Created',
    details: 'New practice assessment sheets published for 2D Shapes recognition.',
    level: 'teacher',
    scope: 'gps-mt-001'
  },
  {
    id: 'log-013',
    time: '2026-07-05 08:30 AM',
    type: 'Worksheets Printed',
    details: 'Offline diagnostic materials printed for Sirhind school.',
    level: 'volunteer',
    scope: 'gps-sh-002'
  },
  {
    id: 'log-014',
    time: '2026-07-04 11:30 AM',
    type: 'Student Enrolled',
    details: 'Collected and enrolled details for Aarav Gupta with masked Aadhar.',
    level: 'volunteer',
    scope: 'gps-mt-001'
  }
];

