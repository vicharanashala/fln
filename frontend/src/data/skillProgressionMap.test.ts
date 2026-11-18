import { describe, expect, it } from 'vitest';
import { CORE_SKILLS, getSubskillPrerequisites } from './skillProgressionMap';

describe('subskill prerequisite edges', () => {
  const ids = new Set(CORE_SKILLS.flatMap(s => s.subskills.map(x => x.id)));
  it('only names subskills that exist', () => {
    for (const id of ids) for (const p of getSubskillPrerequisites(id)) expect(ids.has(p.subskillId)).toBe(true);
  });
  it('has no cycles', () => {
    const state = new Map<string, number>();
    const visit = (id: string): void => {
      state.set(id, 1);
      for (const p of getSubskillPrerequisites(id)) {
        expect(state.get(p.subskillId)).not.toBe(1);
        if (!state.has(p.subskillId)) visit(p.subskillId);
      }
      state.set(id, 2);
    };
    for (const id of ids) if (!state.has(id)) visit(id);
  });
});
