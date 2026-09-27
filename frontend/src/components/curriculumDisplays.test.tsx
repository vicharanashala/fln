import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LEVEL_SKILL_MAP, STAGES, STAGE_LABELS } from '../data/skillProgressionMap';
import { Student, User, UserRole } from '../types';
import { PerformancePanel } from './panels/PerformancePanel';
import { ClassSummaryBar } from './dashboards/ClassSummaryBar';
import { FLN_LEVELS_LIST, FLNLevelReferenceModal } from './dashboards/FLNLevelReference';
import { ContentPanel } from './panels/ContentPanel';

const user = { id: 'fixture-teacher', role: UserRole.TEACHER } as User;
const student = { id: 'fixture-student', name: 'Test Student', classGroup: 'Class 4', currentLevel: 100, currentSubLevel: 0, levelHistory: [] } as Student;

describe('curriculum displays above level 93 (#570)', () => {
  it.each([100, LEVEL_SKILL_MAP.length])('keeps progress widths in range at level %i', currentLevel => {
    const students = [{ ...student, currentLevel }];
    const panels = [
      <PerformancePanel students={students} currentUser={user} />,
      <ClassSummaryBar students={students} />,
    ];
    for (const panel of panels) {
      const html = renderToStaticMarkup(panel);
      const widths = [...html.matchAll(/style="width:([\d.]+)%"/g)].map(match => Number(match[1]));
      expect(widths.length).toBeGreaterThan(0);
      for (const width of widths) {
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(100);
        expect(width).toBeCloseTo(currentLevel / LEVEL_SKILL_MAP.length * 100);
      }
    }
  });

  it('renders reference entries beyond 93 with current curriculum labels', () => {
    expect(FLN_LEVELS_LIST).toHaveLength(LEVEL_SKILL_MAP.length);
    const level100 = LEVEL_SKILL_MAP.find(level => level.levelNumber === 100)!;
    expect(FLN_LEVELS_LIST.find(level => level.id === 100)?.name).toBe(level100.capability);
    const html = renderToStaticMarkup(<FLNLevelReferenceModal isOpen onClose={() => {}} />);
    expect(html).toContain(renderToStaticMarkup(<h4>{level100.capability}</h4>).replace(/<\/?h4>/g, ''));
    expect(html).toContain(`${LEVEL_SKILL_MAP.length} curriculum levels`);
  });

  it('orders Content Library dropdown classes by the canonical curriculum stages', () => {
    const html = renderToStaticMarkup(<ContentPanel />);
    const options = [...html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>/g)].map(match => match[1]);
    expect(options).toEqual(['ALL', ...STAGES.map(stage => STAGE_LABELS[stage])]);
  });

  it('includes every canonical class, including Balvatika, in the quick filters', () => {
    const html = renderToStaticMarkup(<ContentPanel />);
    const buttons = [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map(match => match[1]);
    const expectedButtons = STAGES.map(stage => {
      const label = STAGE_LABELS[stage];
      const count = LEVEL_SKILL_MAP.filter(level => level.stage === stage).length;
      return `${label} · ${count}`;
    });
    expect(buttons).toEqual(expectedButtons);
    expect(buttons.some(label => label.startsWith('Balvatika · '))).toBe(true);
  });
});
