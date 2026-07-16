const { readDb, writeDb, resetDb } = require('../services/dbHelper');

// Get all schools
exports.getSchools = (req, res) => {
  const db = readDb();
  res.json(db.schools || []);
};

// Onboard new school
exports.onboardSchool = (req, res) => {
  const { id, name, stateCode, districtCode, blockCode, strength } = req.body;
  if (!id || !name || !stateCode || !districtCode || !blockCode) {
    return res.status(400).json({ error: 'Missing required school fields.' });
  }

  const db = readDb();
  if (!db.schools) db.schools = [];
  if (db.schools.some(s => s.id.toLowerCase() === id.toLowerCase())) {
    return res.status(400).json({ error: 'School ID already exists.' });
  }

  const newSchool = {
    id: id.toLowerCase(),
    name,
    stateCode: stateCode.toUpperCase(),
    districtCode: districtCode.toUpperCase(),
    blockCode: blockCode.toUpperCase(),
    strength: strength || 'low',
    teachersCount: 0,
    isAccessLocked: false
  };

  db.schools.push(newSchool);

  // Log activity
  if (!db.logbook) db.logbook = [];
  db.logbook.push({
    id: 'log_' + Date.now(),
    timestamp: new Date().toISOString(),
    schoolId: newSchool.id,
    schoolName: newSchool.name,
    userId: 'u1',
    userEmail: 'superadmin@fln.org',
    userRole: 'superadmin',
    activityType: 'verify',
    status: 'Success',
    details: `Superadmin onboarded a new school: ${newSchool.name} (ID: ${newSchool.id})`
  });

  writeDb(db);
  res.json(newSchool);
};

// Get all students
exports.getStudents = (req, res) => {
  const db = readDb();
  // Map fields to match what the frontend expects
  const students = (db.students || []).map(s => {
    const sch = (db.schools || []).find(x => x.id === s.schoolId);
    return {
      ...s,
      rollNumber: s.rollNumber || s.id,
      schoolName: sch ? sch.name : 'Unknown School',
      districtName: sch ? sch.districtCode : 'N/A',
      stateName: sch ? sch.stateCode : 'N/A',
      gender: s.gender || 'Male',
      attendance: s.attendance || 90,
      averageScore: s.averageScore || 75
    };
  });
  res.json(students);
};

// Get all coordinators
exports.getCoordinators = (req, res) => {
  const db = readDb();
  res.json(db.users || []);
};

// Create a new coordinator account
exports.createCoordinator = (req, res) => {
  const { name, email, password, role, stateCode, districtCode, blockCode, schoolId, assignedSchools } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required credentials.' });
  }

  const db = readDb();
  if (!db.users) db.users = [];
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email identifier already exists.' });
  }

  const newUser = {
    id: 'u_' + Date.now(),
    name,
    email: email.toLowerCase(),
    password, // Stored as plain text for development simplicity (per Vicharanashala spec)
    role,
    stateCode: stateCode ? stateCode.toUpperCase() : undefined,
    districtCode: districtCode ? districtCode.toUpperCase() : undefined,
    blockCode: blockCode ? blockCode.toUpperCase() : undefined,
    schoolId: schoolId || undefined,
    assignedSchools: assignedSchools || undefined,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);

  // Log activity
  if (!db.logbook) db.logbook = [];
  db.logbook.push({
    id: 'log_' + Date.now(),
    timestamp: new Date().toISOString(),
    schoolId: schoolId || 'N/A',
    schoolName: schoolId ? 'GPS' : 'N/A',
    userId: 'u1',
    userEmail: 'superadmin@fln.org',
    userRole: 'superadmin',
    activityType: 'verify',
    status: 'Success',
    details: `Superadmin provisioned a new administrative tier account: ${name} (${role})`
  });

  writeDb(db);
  res.json(newUser);
};

// Create a global announcement
exports.createAnnouncement = (req, res) => {
  const { title, message, isUrgent } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Missing required announcement fields.' });
  }

  const db = readDb();
  if (!db.announcements) db.announcements = [];

  const newAnnouncement = {
    id: 'ann_' + Date.now(),
    title,
    message,
    isUrgent: !!isUrgent,
    timestamp: new Date().toISOString()
  };

  db.announcements.push(newAnnouncement);
  writeDb(db);
  res.json(newAnnouncement);
};

// Reset database
exports.resetDatabase = (req, res) => {
  const success = resetDb();
  if (success) {
    res.json({ success: true, message: 'Database reset to fresh seed data.' });
  } else {
    res.status(500).json({ error: 'Failed to reset database.' });
  }
};

// Get geographical analytics
exports.getAnalytics = (req, res) => {
  const db = readDb();
  
  const students = db.students || [];
  const schools = db.schools || [];
  const worksheets = db.worksheets || [];
  const reports = db.evaluationReports || [];

  const stateCodeParam = req.query.stateCode || 'PB';
  const districtCodeParam = req.query.districtCode || 'LDH';
  const blockCodeParam = req.query.blockCode || 'LDH-01';

  const studentsWithGeo = students.map(s => {
    const sch = schools.find(x => x.id === s.schoolId);
    return {
      ...s,
      stateCode: sch ? sch.stateCode : '',
      districtCode: sch ? sch.districtCode : '',
      blockCode: sch ? sch.blockCode : ''
    };
  });

  const getScopeMetrics = (filteredStudents) => {
    const count = filteredStudents.length;
    if (count === 0) {
      return {
        avgLevel: 0,
        certificationRate: 0,
        topicMastery: {
          "Number Sense": 0,
          "Number Operations": 0,
          "Shapes": 0,
          "Fractions": 0,
          "Patterns": 0,
          "Measurement": 0
        },
        levelDistribution: Object.fromEntries(
          Array.from({ length: 15 }, (_, i) => [`Level ${i + 1}`, 0])
            .concat([["Level 16+", 0]])
        )
      };
    }
    const sumLevel = filteredStudents.reduce((acc, s) => acc + (s.currentLevel || 1), 0);
    const avgLevel = Math.round((sumLevel / count) * 10) / 10;
    const certified = filteredStudents.filter(s => (s.currentLevel || 1) >= 5).length;
    const certificationRate = Math.round((certified / count) * 100);

    const avgCurrentLevel = sumLevel / count;
    const topicMastery = {
      "Number Sense": Math.min(100, Math.round(55 + avgCurrentLevel * 8)),
      "Number Operations": Math.min(100, Math.round(45 + avgCurrentLevel * 9)),
      "Shapes": Math.min(100, Math.round(58 + avgCurrentLevel * 7)),
      "Fractions": Math.min(100, Math.round(20 + avgCurrentLevel * 11)),
      "Patterns": Math.min(100, Math.round(38 + avgCurrentLevel * 10)),
      "Measurement": Math.min(100, Math.round(32 + avgCurrentLevel * 10))
    };

    const levelDistribution = {};
    for (let i = 1; i <= 15; i++) {
      levelDistribution[`Level ${i}`] = filteredStudents.filter(s => s.currentLevel === i).length;
    }
    levelDistribution["Level 16+"] = filteredStudents.filter(s => s.currentLevel >= 16).length;

    return {
      avgLevel,
      certificationRate,
      topicMastery,
      levelDistribution
    };
  };

  const national = getScopeMetrics(studentsWithGeo);
  const state = getScopeMetrics(studentsWithGeo.filter(s => s.stateCode === stateCodeParam));
  const district = getScopeMetrics(studentsWithGeo.filter(s => s.districtCode === districtCodeParam));
  const block = getScopeMetrics(studentsWithGeo.filter(s => s.blockCode === blockCodeParam));

  res.json({
    national,
    state,
    district,
    block
  });
};
