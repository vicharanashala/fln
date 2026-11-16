import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ObservationSheetCard, canPrintObservationSheet } from './ObservationSheetCard';
import { ClassGroup, User, UserRole } from '../../types';

const teacher: User = { id: 't1', email: 't@school.test', name: 'Teacher', role: UserRole.TEACHER, schoolId: 's1' };
const classes: ClassGroup[] = [
  { id: 'c1', schoolId: 's1', className: 'Balvatika', section: 'A', teacherId: 't1' },
  { id: 'c2', schoolId: 's1', className: 'Balvatika', section: 'B', teacherId: 't1' },
];
const render = (over: Partial<React.ComponentProps<typeof ObservationSheetCard>> = {}) => renderToString(
  <ObservationSheetCard classes={classes} activeClass={classes[0]} onSelectClass={() => {}} currentUser={teacher} token="tok" {...over} />,
);

describe('ObservationSheetCard (#914)', () => {
  it('shows the class, cycle and layout choices and the print button', () => {
    const html = render();
    expect(html).toContain('Teacher Observation Sheet');
    expect(html).toContain('Print observation sheet');
    for (const word of ['Balvatika - A', 'Balvatika - B', 'Baseline', 'Mid-year', 'End-of-year', 'Class grid', 'Per child', 'Both']) {
      expect(html).toContain(word);
    }
    expect(html).not.toContain('role="alert"');
  });

  it('starts with both layouts chosen, so one click prints the grid and the per-child sheets', () => {
    expect(render()).toMatch(/<input[^>]*checked=""[^>]*value="both"|<input[^>]*value="both"[^>]*checked=""/);
    expect(render().match(/checked=""/g)).toHaveLength(1);
  });

  it('says there is nothing to print when the caller has no class, and offers no button', () => {
    const html = render({ classes: [], activeClass: null });
    expect(html).toContain('No classes found');
    expect(html).not.toContain('Print observation sheet');
  });

  it('is not shown to a suspended teacher, whom the API refuses, but is shown to other roles that reach the panel', () => {
    expect(canPrintObservationSheet({ ...teacher, isBanned: true })).toBe(false);
    expect(render({ currentUser: { ...teacher, isBanned: true } })).toBe('');
    expect(canPrintObservationSheet(teacher)).toBe(true);
    expect(canPrintObservationSheet({ ...teacher, role: UserRole.VOLUNTEER, isBanned: true })).toBe(true);
  });
});
