import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AnalyticsPanel, getTotalSchoolsCount } from './AnalyticsPanel';
import { User, UserRole, School, Student } from '../../types';

describe('AnalyticsPanel Total Schools Card & States (#695)', () => {
  const mockPrincipalUser: User = {
    id: 'user_p1',
    name: 'Principal User',
    role: UserRole.SCHOOL,
    email: 'principal@school.edu',
    schoolId: 'sch_001',
  };

  const mockAdminUser: User = {
    id: 'user_admin',
    name: 'State Admin',
    role: UserRole.ADMIN,
    email: 'admin@gov.in',
    stateCode: 'AP',
  };

  const mockDistrictAdmin: User = {
    id: 'user_da',
    name: 'District Admin',
    role: UserRole.DISTRICT_ADMIN,
    email: 'da@gov.in',
    districtCode: 'GTR',
  };

  const mockBlockAdmin: User = {
    id: 'user_ba',
    name: 'Block Admin',
    role: UserRole.BLOCK_ADMIN,
    email: 'ba@gov.in',
    blockCode: 'GTR-01',
  };

  const mockSchools: School[] = [
    {
      id: 'sch_001',
      name: 'GPS Central Guntur',
      districtCode: 'GTR',
      blockCode: 'GTR-01',
      stateCode: 'AP',
      teachersCount: 5,
    },
    {
      id: 'sch_002',
      name: 'GPS North Guntur',
      districtCode: 'GTR',
      blockCode: 'GTR-01',
      stateCode: 'AP',
      teachersCount: 4,
    },
  ];

  const mockStudents: Student[] = [
    {
      id: 'std_1',
      name: 'Aarav Kumar',
      schoolId: 'sch_001',
      currentLevel: 4,
      currentSubLevel: 1,
    } as Student,
  ];

  const mockGetDistrictStats = vi.fn().mockReturnValue([
    { code: 'GTR', name: 'Guntur', state: 'AP', schools: 2, students: 100, certifiedRate: 75 },
  ]);

  const mockGetBlockStats = vi.fn().mockReturnValue([
    { code: 'GTR-01', name: 'Guntur Urban', district: 'GTR', schools: 2, students: 100, certifiedRate: 75 },
  ]);

  describe('getTotalSchoolsCount unit tests', () => {
    it('returns "—" when schoolsLoading is true', () => {
      expect(getTotalSchoolsCount(true, 1, 2, true, null)).toBe('—');
      expect(getTotalSchoolsCount(false, 2, 2, true, null)).toBe('—');
    });

    it('returns "—" when schoolsError is present', () => {
      expect(getTotalSchoolsCount(true, 1, 2, false, 'Failed to fetch')).toBe('—');
      expect(getTotalSchoolsCount(false, 2, 2, false, 'Internal Server Error')).toBe('—');
    });

    it('returns 0 for principal when data list is empty', () => {
      expect(getTotalSchoolsCount(true, 0, 0, false, null)).toBe(0);
    });

    it('returns 1 for principal when assigned school data is loaded', () => {
      expect(getTotalSchoolsCount(true, 1, 2, false, null)).toBe(1);
    });

    it('returns schools.length for admin roles (state, district, block) when data is loaded', () => {
      expect(getTotalSchoolsCount(false, 1, 2, false, null)).toBe(2);
      expect(getTotalSchoolsCount(false, 5, 5, false, null)).toBe(5);
    });
  });

  describe('AnalyticsPanel component rendering with renderToString', () => {
    it('1. Principal during loading shows "—" in Total Schools card and spinner message', () => {
      const html = renderToString(
        <AnalyticsPanel
          currentUser={mockPrincipalUser}
          schools={[]}
          students={[]}
          getDistrictStats={mockGetDistrictStats}
          getBlockStats={mockGetBlockStats}
          schoolsLoading={true}
          schoolsError={null}
        />
      );

      expect(html).toContain('Total Schools');
      expect(html).toContain('—');
      expect(html).toContain('Assigned facility');
      expect(html).toContain('Loading school performance data...');
    });

    it('2. Principal when /api/schools fails shows "—" in Total Schools card and Retry Request button', () => {
      const html = renderToString(
        <AnalyticsPanel
          currentUser={mockPrincipalUser}
          schools={[]}
          students={[]}
          getDistrictStats={mockGetDistrictStats}
          getBlockStats={mockGetBlockStats}
          schoolsLoading={false}
          schoolsError="HTTP 500: Internal Server Error"
          onRetrySchools={() => {}}
        />
      );

      expect(html).toContain('Total Schools');
      expect(html).toContain('—');
      expect(html).toContain('Assigned facility');
      expect(html).toContain('Failed to load school analytics');
      expect(html).toContain('HTTP 500: Internal Server Error');
      expect(html).toContain('Retry Request');
    });

    it('3. Principal with empty /api/schools response shows 0 in Total Schools card and empty state message', () => {
      const html = renderToString(
        <AnalyticsPanel
          currentUser={mockPrincipalUser}
          schools={[]}
          students={[]}
          getDistrictStats={mockGetDistrictStats}
          getBlockStats={mockGetBlockStats}
          schoolsLoading={false}
          schoolsError={null}
        />
      );

      expect(html).toContain('Total Schools');
      expect(html).toContain('>0<');
      expect(html).toContain('Assigned facility');
      expect(html).toContain('No school data available');
    });

    it('4. Principal with loaded schools shows 1 in Total Schools card and renders school name', () => {
      const html = renderToString(
        <AnalyticsPanel
          currentUser={mockPrincipalUser}
          schools={mockSchools}
          students={mockStudents}
          getDistrictStats={mockGetDistrictStats}
          getBlockStats={mockGetBlockStats}
          schoolsLoading={false}
          schoolsError={null}
        />
      );

      expect(html).toContain('Total Schools');
      expect(html).toContain('>1<');
      expect(html).toContain('Assigned facility');
      expect(html).toContain('GPS Central Guntur');
    });

    it('5. Admin roles (state, district, block) show their own totals unchanged', () => {
      // State Admin
      const stateAdminHtml = renderToString(
        <AnalyticsPanel
          currentUser={mockAdminUser}
          schools={mockSchools}
          students={mockStudents}
          getDistrictStats={mockGetDistrictStats}
          getBlockStats={mockGetBlockStats}
          schoolsLoading={false}
          schoolsError={null}
        />
      );
      expect(stateAdminHtml).toContain('Total Schools');
      expect(stateAdminHtml).toContain('>2<');
      expect(stateAdminHtml).toContain('All facilities');
      expect(stateAdminHtml).toContain('Geographical Analytics');

      // District Admin
      const districtAdminHtml = renderToString(
        <AnalyticsPanel
          currentUser={mockDistrictAdmin}
          schools={mockSchools}
          students={mockStudents}
          getDistrictStats={mockGetDistrictStats}
          getBlockStats={mockGetBlockStats}
          schoolsLoading={false}
          schoolsError={null}
        />
      );
      expect(districtAdminHtml).toContain('Total Schools');
      expect(districtAdminHtml).toContain('>2<');
      expect(districtAdminHtml).toContain('All facilities');

      // Block Admin
      const blockAdminHtml = renderToString(
        <AnalyticsPanel
          currentUser={mockBlockAdmin}
          schools={mockSchools}
          students={mockStudents}
          getDistrictStats={mockGetDistrictStats}
          getBlockStats={mockGetBlockStats}
          schoolsLoading={false}
          schoolsError={null}
        />
      );
      expect(blockAdminHtml).toContain('Total Schools');
      expect(blockAdminHtml).toContain('>2<');
      expect(blockAdminHtml).toContain('All facilities');
    });
  });
});
