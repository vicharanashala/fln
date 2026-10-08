// Domain types: identity and organisational actors.

export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  DISTRICT_ADMIN = 'district_admin',
  BLOCK_ADMIN = 'block_admin',
  SCHOOL = 'school',
  TEACHER = 'teacher',
  VOLUNTEER = 'volunteer'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash?: string; // bcrypt hash; verified at login. Never sent to clients.
  phoneNumber?: string;
  stateCode?: string;
  districtCode?: string;
  blockCode?: string;
  schoolId?: string;
  assignedSchools?: string[]; // for Volunteers
  delayedAttemptsCount?: number;
  isBanned?: boolean;
}

export interface School {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength: 'high' | 'low'; // High-strength vs. Low-strength (§1.2)
  teachersCount: number;
  isAccessLocked?: boolean;
  udiseCode?: string;
  governmentSchoolCode?: string;
  villageCity?: string;
  principalId?: string;
  addressLine1?:string;
  addressLine2?: string;
  landmark?: string;
  pinCode?: string;
  schoolType?: string;
  managementType?: string;
  email?: string;
  phone?: string;
  establishmentYear?: number;
  initialClasses?: string[];
  status?: 'active' | 'pending' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  className: string; // e.g. "Class 2", "Class 3", "Class 4"
  section: string; // e.g. "A", "B"
  teacherId: string;
}

