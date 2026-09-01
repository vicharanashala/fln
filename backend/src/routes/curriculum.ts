import express from 'express';
import { dbStore } from '../db';
import { getAuthUser } from '../auth';

/**
 * Read-only access to the 93-level curriculum.
 *
 * PR #408 seeded `curriculumLevels` and added accessors on `dbStore`, but never
 * exposed them over HTTP — so the 93 levels existed in the database and nothing
 * on the site could read them. Every level list in the UI was still built from
 * a hand-authored table. This is the route that lets those surfaces read the
 * real thing.
 *
 * Read-only by design. Levels are seeded (`npm run seed:levels`), and
 * `conceptId` is immutable because student evidence points at it — so there is
 * deliberately no POST/PATCH/DELETE here. Authenticated rather than
 * Superadmin-only: this is curriculum reference data every role's dashboard
 * needs to render a level name, not something only curriculum authors read.
 */

/**
 * Whether a level's worksheets can actually be produced today.
 *
 * Three states, not two, and the distinction is the whole point:
 *
 *  - `ready`     — mapped to legacy content that exists on disk. Generation works.
 *  - `no-content`— mapped, but the legacy level it maps to has no worksheet
 *                  file or builder. A real, known gap.
 *  - `unmapped`  — we do not know yet. The level has no `legacyLevel59`, so
 *                  nothing connects it to the 1-59 worksheet engine.
 *
 * `unmapped` is NOT the same as "cannot be built", and collapsing the two would
 * make the UI lie. Today the worksheet engine builds 59 levels perfectly well;
 * what is missing is the crosswalk saying WHICH 93-space level each of those
 * corresponds to. Until `Research/fln_59_to_93_crosswalk.json` lands, every
 * level is `unmapped` — including ones whose content demonstrably works.
 *
 * `hasStaticHtml`/`hasBuilder` are both gated on `legacyLevel59 !== null` at
 * seed time (seedCurriculumLevels.ts), so reading them alone would report all
 * 93 as contentless. That would be pessimistically wrong, which is why this
 * derives a status rather than surfacing the raw booleans as "buildable".
 */
export type LevelContentStatus = 'ready' | 'no-content' | 'unmapped';

function contentStatusOf(level: { legacyLevel59: number | null; hasStaticHtml: boolean; hasBuilder: boolean }): LevelContentStatus {
  if (level.legacyLevel59 === null) return 'unmapped';
  return (level.hasStaticHtml || level.hasBuilder) ? 'ready' : 'no-content';
}

export function registerCurriculumRoutes(app: express.Express) {
  /** All 93 levels, ascending, each with its derived content status. */
  app.get('/api/curriculum/levels', async (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const levels = await dbStore.getCurriculumLevels();
      res.json(levels.map((l) => ({ ...l, contentStatus: contentStatusOf(l) })));
    } catch (err: any) {
      console.error('[curriculum] failed to read curriculumLevels:', err);
      res.status(500).json({ error: 'Failed to read the curriculum levels.' });
    }
  });

  /**
   * Coverage summary. `unmapped` is reported as its own number rather than
   * folded into a single percentage, so a reader cannot mistake "we have not
   * mapped this yet" for "we have measured this and there is nothing there".
   */
  app.get('/api/curriculum/coverage', async (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [coverage, levels] = await Promise.all([
        dbStore.getCurriculumCoverage(),
        dbStore.getCurriculumLevels(),
      ]);
      const byStatus = { ready: 0, 'no-content': 0, unmapped: 0 };
      for (const l of levels) byStatus[contentStatusOf(l)]++;
      res.json({
        ...coverage,
        byStatus,
        crosswalkLanded: byStatus.unmapped < levels.length,
      });
    } catch (err: any) {
      console.error('[curriculum] failed to compute coverage:', err);
      res.status(500).json({ error: 'Failed to compute curriculum coverage.' });
    }
  });

  /** One level by its 1-93 number. */
  app.get('/api/curriculum/levels/:levelNumber', async (req, res) => {
    if (!getAuthUser(req)) return res.status(401).json({ error: 'Unauthorized' });
    const levelNumber = Number(req.params.levelNumber);
    if (!Number.isInteger(levelNumber)) {
      return res.status(400).json({ error: 'levelNumber must be an integer.' });
    }
    try {
      const level = await dbStore.getCurriculumLevel(levelNumber);
      if (!level) {
        return res.status(404).json({
          error: `No curriculum level ${levelNumber}. The curriculum defines levels 1-93; ` +
            `run "npm run seed:levels" if the collection is empty.`,
        });
      }
      res.json({ ...level, contentStatus: contentStatusOf(level) });
    } catch (err: any) {
      console.error('[curriculum] failed to read level:', err);
      res.status(500).json({ error: 'Failed to read the curriculum level.' });
    }
  });
}
