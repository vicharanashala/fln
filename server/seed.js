require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const School = require('./models/School');
const Class = require('./models/Class');
const Student = require('./models/Student');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      School.deleteMany({}),
      Class.deleteMany({}),
      Student.deleteMany({})
    ]);

    // Create Superadmin
    const superadmin = await User.create({
      email: 'superadmin@fln.org',
      password: 'Super@123',
      name: 'Super Admin',
      role: 'superadmin'
    });
    console.log('Superadmin created:', superadmin.email);

    // Create Admin (Punjab)
    const admin = await User.create({
      email: 'admin.pb@fln.org',
      password: 'Admin@123',
      name: 'Punjab Admin',
      role: 'admin',
      state: 'Punjab'
    });
    console.log('Admin created:', admin.email);

    // Create District Admin
    const districtAdmin = await User.create({
      email: 'district.ldh@fln.org',
      password: 'District@123',
      name: 'Ludhiana District Admin',
      role: 'district_admin',
      state: 'Punjab',
      district: 'Ludhiana'
    });
    console.log('District Admin created:', districtAdmin.email);

    // Create Block Admin
    const blockAdmin = await User.create({
      email: 'block.ldh-01@fln.org',
      password: 'Block@123',
      name: 'Ludhiana Block 1 Admin',
      role: 'block_admin',
      state: 'Punjab',
      district: 'Ludhiana',
      block: 'Ludhiana-01'
    });
    console.log('Block Admin created:', blockAdmin.email);

    // Create School
    const school = await School.create({
      schoolId: 'gps-mt-001',
      name: 'Government Primary School, Model Town',
      state: 'Punjab',
      district: 'Ludhiana',
      block: 'Ludhiana-01',
      address: 'Model Town, Ludhiana',
      studentStrength: 'high',
      hasInternet: true
    });
    console.log('School created:', school.schoolId);

    // Create Teacher
    const teacher = await User.create({
      email: 'gps-mt-001.t01@fln.org',
      password: 'Teacher@123',
      name: 'Rajesh Kumar',
      role: 'teacher',
      school: school._id,
      state: 'Punjab',
      district: 'Ludhiana',
      block: 'Ludhiana-01'
    });
    console.log('Teacher created:', teacher.email);

    // Create Volunteer
    const volunteer = await User.create({
      email: 'vol.rahul@fln.org',
      password: 'Volunteer@123',
      name: 'Rahul Sharma',
      role: 'volunteer',
      state: 'Punjab',
      district: 'Ludhiana',
      block: 'Ludhiana-01',
      assignedSchools: [school._id]
    });
    console.log('Volunteer created:', volunteer.email);

    // Create Classes
    const class3A = await Class.create({
      name: 'Class 3',
      section: 'A',
      grade: 3,
      school: school._id,
      teacher: teacher._id
    });
    teacher.assignedClasses = [class3A._id];
    await teacher.save();

    const class4A = await Class.create({
      name: 'Class 4',
      section: 'A',
      grade: 4,
      school: school._id,
      teacher: teacher._id
    });
    teacher.assignedClasses.push(class4A._id);
    await teacher.save();

    console.log('Classes created');

    // Create Students
    const students = [
      { name: 'Aarav Singh', age: 8, class: class3A._id, section: 'A', identityType: 'aadhar', identityNumber: '123456789012', currentLevel: 'Level3' },
      { name: 'Priya Sharma', age: 8, class: class3A._id, section: 'A', identityType: 'aadhar', identityNumber: '234567890123', currentLevel: 'Level2' },
      { name: 'Arjun Patel', age: 9, class: class3A._id, section: 'A', identityType: 'aadhar', identityNumber: '345678901234', currentLevel: 'Level4' },
      { name: 'Sanya Gupta', age: 8, class: class3A._id, section: 'A', identityType: 'birth_certificate', identityNumber: 'BC-2020-001', currentLevel: 'Level1' },
      { name: 'Rohit Verma', age: 9, class: class3A._id, section: 'A', identityType: 'aadhar', identityNumber: '456789012345', currentLevel: 'Level3' },
      { name: 'Neha Joshi', age: 10, class: class4A._id, section: 'A', identityType: 'aadhar', identityNumber: '567890123456', currentLevel: 'Level5' },
      { name: 'Karan Mehta', age: 10, class: class4A._id, section: 'A', identityType: 'aadhar', identityNumber: '678901234567', currentLevel: 'Level4' },
      { name: 'Ishita Kapoor', age: 9, class: class4A._id, section: 'A', identityType: 'birth_certificate', identityNumber: 'BC-2019-002', currentLevel: 'Level3' },
      { name: 'Vikram Singh', age: 10, class: class4A._id, section: 'A', identityType: 'aadhar', identityNumber: '789012345678', currentLevel: 'Level6' },
      { name: 'Ananya Reddy', age: 9, class: class4A._id, section: 'A', identityType: 'aadhar', identityNumber: '890123456789', currentLevel: 'Level4' }
    ];

    for (const s of students) {
      const studentId = `STU-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const student = await Student.create({
        studentId,
        name: s.name,
        age: s.age,
        class: s.class,
        school: school._id,
        section: s.section,
        identityType: s.identityType,
        identityNumber: s.identityNumber,
        currentLevel: s.currentLevel,
        levelHistory: [{ level: s.currentLevel, assessedAt: new Date(), assessmentCycle: 'baseline' }]
      });
      console.log(`Student created: ${student.name} (${student.studentId}) - Level ${student.currentLevel}`);
    }

    console.log('\n✅ Seeding complete!');
    console.log('\nLogin Credentials:');
    console.log('  Superadmin:     superadmin@fln.org / Super@123');
    console.log('  Admin:          admin.pb@fln.org / Admin@123');
    console.log('  District Admin: district.ldh@fln.org / District@123');
    console.log('  Block Admin:    block.ldh-01@fln.org / Block@123');
    console.log('  Teacher:        gps-mt-001.t01@fln.org / Teacher@123');
    console.log('  Volunteer:      vol.rahul@fln.org / Volunteer@123');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Seed error:', error);
    await mongoose.disconnect();
  }
}

seed();
