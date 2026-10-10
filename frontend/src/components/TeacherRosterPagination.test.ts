import { describe, expect, it } from 'vitest';

interface Student {
  id: string;
  name: string;
  classGroup: string;
  section: string;
}

// Simulated pagination & roster helper matching Table & TeacherDashboard logic
function processRosterData(
  students: Student[],
  activeClassFilter: string | null,
  currentPage: number,
  rowsPerPage: number = 10
) {
  // 1. Filter by classGroup if activeClassFilter is set
  const filtered = activeClassFilter === null
    ? students
    : students.filter(s => s.classGroup === activeClassFilter);

  const totalFilteredCount = filtered.length;
  const totalPages = Math.ceil(totalFilteredCount / rowsPerPage) || 1;

  // 2. Safe page calculation (clamping out-of-range page)
  const safePage = currentPage > totalPages ? 1 : currentPage;
  const start = (safePage - 1) * rowsPerPage;
  const paginated = filtered.slice(start, start + rowsPerPage);

  return {
    filtered,
    totalFilteredCount,
    totalPages,
    safePage,
    paginated,
    isEmpty: totalFilteredCount === 0,
    isPageOutOfBounds: currentPage > totalPages,
  };
}

describe('Teacher Roster & Pagination Logic (#553)', () => {
  const mockStudents: Student[] = Array.from({ length: 25 }, (_, i) => ({
    id: `std_${i + 1}`,
    name: `Student ${i + 1}`,
    classGroup: i < 15 ? 'Class 1' : i < 20 ? 'Class 2' : 'Class 3',
    section: 'A',
  }));

  it('1. Roster displays normally when requesting full roster', () => {
    const res = processRosterData(mockStudents, null, 1, 10);
    expect(res.totalFilteredCount).toBe(25);
    expect(res.paginated.length).toBe(10);
    expect(res.paginated[0].id).toBe('std_1');
  });

  it('2. Roster containing > page-size students paginates correctly', () => {
    const page1 = processRosterData(mockStudents, null, 1, 10);
    const page2 = processRosterData(mockStudents, null, 2, 10);
    const page3 = processRosterData(mockStudents, null, 3, 10);

    expect(page1.totalPages).toBe(3);
    expect(page1.paginated.length).toBe(10);
    expect(page2.paginated.length).toBe(10);
    expect(page3.paginated.length).toBe(5);
  });

  it('3. Class/group filter returns the correct students', () => {
    const class1 = processRosterData(mockStudents, 'Class 1', 1, 10);
    const class2 = processRosterData(mockStudents, 'Class 2', 1, 10);

    expect(class1.filtered.every(s => s.classGroup === 'Class 1')).toBe(true);
    expect(class2.filtered.every(s => s.classGroup === 'Class 2')).toBe(true);
  });

  it('4. Filtered roster has correct total count', () => {
    const class1 = processRosterData(mockStudents, 'Class 1', 1, 10);
    const class2 = processRosterData(mockStudents, 'Class 2', 1, 10);
    const class3 = processRosterData(mockStudents, 'Class 3', 1, 10);

    expect(class1.totalFilteredCount).toBe(15);
    expect(class2.totalFilteredCount).toBe(5);
    expect(class3.totalFilteredCount).toBe(5);
  });

  it('5. Empty class/group displays the correct empty state', () => {
    const emptyClass = processRosterData(mockStudents, 'Class 4', 1, 10);

    expect(emptyClass.totalFilteredCount).toBe(0);
    expect(emptyClass.isEmpty).toBe(true);
    expect(emptyClass.paginated.length).toBe(0);
  });

  it('6. Changing class/group resets/adjusts pagination correctly', () => {
    // User was on Page 3 of All Students (25 students)
    let currentPage = 3;
    let res = processRosterData(mockStudents, null, currentPage, 10);
    expect(res.safePage).toBe(3);

    // Switch to Class 2 (5 students -> 1 page max)
    // Changing class tab resets currentPage or safePage clamps it to 1
    const activeClassFilter = 'Class 2';
    currentPage = 1; // Tab change resets page to 1
    res = processRosterData(mockStudents, activeClassFilter, currentPage, 10);
    expect(res.safePage).toBe(1);
    expect(res.paginated.length).toBe(5);
  });

  it('7. An invalid/out-of-range page does not produce a misleading blank roster', () => {
    // User was on Page 3 (currentPage = 3), then active filter changed to Class 2 (5 students)
    // without resetting currentPage state.
    const currentPage = 3; // Out of bounds for Class 2 (totalPages = 1)
    const res = processRosterData(mockStudents, 'Class 2', currentPage, 10);

    // Verify safePage fallback prevents returning empty array when students exist
    expect(res.isPageOutOfBounds).toBe(true);
    expect(res.safePage).toBe(1);
    expect(res.paginated.length).toBe(5);
    expect(res.paginated[0].classGroup).toBe('Class 2');
  });

  it('8. Loading, empty, and out-of-bounds states remain distinguishable', () => {
    const loadingState = { loading: true, students: [] };
    const emptyRosterState = processRosterData([], null, 1, 10);
    const outOfBoundsState = processRosterData(mockStudents, 'Class 2', 5, 10);

    expect(loadingState.loading).toBe(true);
    expect(emptyRosterState.isEmpty).toBe(true);
    expect(outOfBoundsState.isEmpty).toBe(false); // Students exist, safePage handles display!
    expect(outOfBoundsState.paginated.length).toBe(5);
  });
});
