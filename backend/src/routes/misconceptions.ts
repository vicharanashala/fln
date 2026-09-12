import express from 'express';
import { dbStore, UserRole, MisconceptionCluster } from '../db';
import { getAuthUser } from '../auth';
import {
  analyseCohort,
  proposeErrorCategories,
  reconcileRootCauses,
  CohortAnalysis
} from '../misconceptionFingerprint';
import { isPlaceholderArchetypeName } from '../studentArchetypeService';

/**
 * Who may rename a misconception archetype.
 *
 * Volunteers are deliberately absent: they conduct assessments but do not own a
 * teaching group, and an archetype name is shared across every school teaching
 * that class, so the blast radius of the edit exceeds their remit.
 */
const ARCHETYPE_RENAME_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.TEACHER,
  UserRole.SCHOOL,
  UserRole.BLOCK_ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPERADMIN
]);

/** Long enough for "The Non-Regroupers · when regrouping" and a teacher's own phrasing. */
const ARCHETYPE_NAME_MAX_LENGTH = 80;
const ARCHETYPE_TEXT_MAX_LENGTH = 1000;

// --- Misconception fingerprinting: cluster a cohort on HOW it fails ---------
//
// Read-only analysis over already-graded submissions. The cohort pass invokes
// Gemini to name the discovered archetypes, so results are memoised briefly:
// the dossier UI re-fetches on every open and re-clustering per render would
// burn quota for an answer that cannot have changed.
// The cache stores the in-flight PROMISE, not the resolved value. The dossier
// UI fires /compare and /cohort together, so caching only settled results
// lets both miss, run their own Gemini naming pass, and disagree about what
// the same cluster is called. Sharing the promise means concurrent callers
// always see one consistent analysis.
//
// The cache lives at module scope rather than inside the register function so
// the submit handlers — now in routes/evaluation.ts and routes/students.ts —
// can invalidate it by importing `invalidateFingerprintCache` below. It was
// previously a closure inside startServer(), which is why the original comment
// apologised for having to hoist the function declaration.
const fingerprintCache = new Map<string, { at: number; value: Promise<CohortAnalysis> }>();
const FINGERPRINT_TTL_MS = 5 * 60 * 1000;

/**
 * Drop memoised analyses when new answers land.
 *
 * Without this a teacher can grade a sheet and then open Misconceptions to
 * results computed up to five minutes earlier, with the child they just
 * marked missing from them.
 */
export function invalidateFingerprintCache() {
  fingerprintCache.clear();
}

function getCohortAnalysis(classGroup?: string, schoolId?: string): Promise<CohortAnalysis> {
  const key = `${classGroup ?? '*'}|${schoolId ?? '*'}`;
  const hit = fingerprintCache.get(key);
  if (hit && Date.now() - hit.at < FINGERPRINT_TTL_MS) return hit.value;

  const pending = (async () => {
    // Reports are loaded alongside submissions because a diagnostic writes only
    // a report: without them every diagnostic-only child is counted as having
    // no submission and disappears from the cohort.
    const [allStudents, submissions, worksheets, reports] = await Promise.all([
      dbStore.getStudents(),
      dbStore.getAnswerSubmissions(),
      dbStore.getWorksheets(),
      dbStore.getEvaluationReports()
    ]);

    const students = allStudents.filter(s =>
      (!classGroup || s.classGroup === classGroup) && (!schoolId || s.schoolId === schoolId)
    );
    const ids = new Set(students.map(s => s.id));

    return analyseCohort(
      students,
      submissions.filter(s => ids.has(s.studentId)),
      worksheets,
      { classGroup, reports: reports.filter(r => ids.has(r.studentId)) }
    );
  })();

  // Never cache a rejection — a transient DB blip would otherwise be pinned
  // for the whole TTL.
  pending.catch(() => fingerprintCache.delete(key));
  fingerprintCache.set(key, { at: Date.now(), value: pending });
  return pending;
}

export function registerMisconceptionRoutes(app: express.Express) {
  // Whole-cohort view: discovered archetypes, membership, and score collisions.
  app.get('/api/misconceptions/cohort', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const classGroup = (req.query.classGroup as string) || undefined;
      const schoolId = (req.query.schoolId as string) || undefined;
      const analysis = await getCohortAnalysis(classGroup, schoolId);
      res.json(analysis);
    } catch (error: any) {
      console.error('[MisconceptionFingerprint] cohort analysis failed:', error?.message || error);
      res.status(500).json({ error: 'Misconception analysis failed.' });
    }
  });

  // What the nine coded rules could not read, and what Gemini thinks it means.
  //
  // Kept off the cohort path deliberately: it is an occasional maintenance
  // question ("has a new kind of mistake started appearing?"), not something to
  // pay for on every dashboard render. Nothing it returns feeds the clustering —
  // a proposal is a suggestion for a human to turn into a coded rule.
  app.get('/api/misconceptions/residue', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const classGroup = (req.query.classGroup as string) || undefined;
      const schoolId = (req.query.schoolId as string) || undefined;
      const analysis = await getCohortAnalysis(classGroup, schoolId);
      const proposals = await proposeErrorCategories(analysis.residue, classGroup ?? 'this class');
      res.json({
        unclassifiedCount: analysis.unclassifiedCount,
        unclassifiedRate: analysis.unclassifiedRate,
        residue: analysis.residue,
        proposals,
        generatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[MisconceptionFingerprint] residue analysis failed:', error?.message || error);
      res.status(500).json({ error: 'Residue analysis failed.' });
    }
  });

  // One child's dossier, plus the archetype they belong to.
  app.get('/api/misconceptions/fingerprint/:studentId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const students = await dbStore.getStudents();
      const student = students.find(s => s.id === req.params.studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });

      const analysis = await getCohortAnalysis(student.classGroup, student.schoolId);
      const fingerprint = analysis.fingerprints.find(f => f.studentId === student.id);
      if (!fingerprint) {
        return res.status(404).json({
          error: 'No error signature available for this student yet.',
          reason: 'NO_SUBMISSIONS_WITH_ERRORS'
        });
      }
      const archetype = analysis.archetypes.find(a => a.clusterId === fingerprint.clusterId) ?? null;

      // Join the Python pipeline's per-answer root causes, where a diagnostic
      // produced any, and check its carelessness calls against the measured
      // evidence this module holds.
      const reports = await dbStore.getEvaluationReports();
      // Any pipeline output is worth surfacing, not just per-question causes:
      // when its LLM step falls back, it still yields the failed levels and the
      // difficulty breakdown, and those are the fields a teacher acts on.
      const latest = reports
        .filter(
          r =>
            r.studentId === student.id &&
            ((Array.isArray(r.rootCauses) && r.rootCauses.length > 0) ||
              (Array.isArray(r.levelsFailed) && r.levelsFailed.length > 0) ||
              r.performanceByDifficulty)
        )
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))[0];

      res.json({
        fingerprint,
        archetype,
        rootCauses: latest?.rootCauses ?? null,
        levelsFailed: latest?.levelsFailed ?? null,
        prerequisitesToCheck: latest?.prerequisitesToCheck ?? null,
        reconciliation: latest ? reconcileRootCauses(fingerprint, latest.rootCauses) : null,
        generatedAt: analysis.generatedAt
      });
    } catch (error: any) {
      console.error('[MisconceptionFingerprint] fingerprint failed:', error?.message || error);
      res.status(500).json({ error: 'Misconception analysis failed.' });
    }
  });

  // The comparison the feature exists for: two children, one score, two minds.
  // With no ?a/?b the server picks the sharpest collision it found on its own.
  app.get('/api/misconceptions/compare', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const classGroup = (req.query.classGroup as string) || undefined;
      const schoolId = (req.query.schoolId as string) || undefined;
      const analysis = await getCohortAnalysis(classGroup, schoolId);

      let aId = req.query.a as string | undefined;
      let bId = req.query.b as string | undefined;

      if (!aId || !bId) {
        const best = analysis.collisions[0];
        if (!best) {
          return res.status(404).json({
            error: 'No two children in this cohort share a score across different archetypes.',
            reason: 'NO_COLLISION'
          });
        }
        aId = best.a;
        bId = best.b;
      }

      const left = analysis.fingerprints.find(f => f.studentId === aId);
      const right = analysis.fingerprints.find(f => f.studentId === bId);
      if (!left || !right) return res.status(404).json({ error: 'Student not found in this cohort.' });

      const archetypeOf = (id?: number) => analysis.archetypes.find(a => a.clusterId === id) ?? null;
      res.json({
        left: { fingerprint: left, archetype: archetypeOf(left.clusterId) },
        right: { fingerprint: right, archetype: archetypeOf(right.clusterId) },
        sameScore: left.score === right.score,
        sameLevel: left.currentLevel === right.currentLevel,
        totalCollisions: analysis.collisions.length,
        cohortSize: analysis.analysedCount,
        archetypeCount: analysis.archetypes.length,
        usedFallbackNaming: analysis.usedFallbackNaming,
        generatedAt: analysis.generatedAt
      });
    } catch (error: any) {
      console.error('[MisconceptionFingerprint] compare failed:', error?.message || error);
      res.status(500).json({ error: 'Misconception analysis failed.' });
    }
  });

  /**
   * Rename an archetype by hand.
   *
   * The generated name is derived from the centroid and is accurate but blunt;
   * a teacher who recognises the pattern in their own room can put a better
   * word to it. Only the label changes — `centroid` and `studentIds` are not
   * writable here, so renaming cannot move a child between groups or alter who
   * the archetype describes.
   *
   * NOTE ON SCOPE: an archetype is keyed by `classGroup` and carries no
   * `schoolId`, so one rename is visible to every school teaching that class.
   * That is a property of the existing data model, not of this endpoint; until
   * archetypes are school-scoped, the rename is recorded against its author
   * rather than restricted.
   */
  app.patch('/api/misconceptions/clusters/:clusterId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended.' });

    // Volunteers conduct assessments but do not own a teaching group, and the
    // name they would be editing is shared across every school in the class.
    if (!ARCHETYPE_RENAME_ROLES.has(user.role)) {
      return res.status(403).json({ error: 'Your role cannot rename archetypes.' });
    }

    const { name, description, teacherAction, forwardRisk } = req.body ?? {};

    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'A name is required.' });
    }
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'A name cannot be blank.' });
    }
    if (trimmed.length > ARCHETYPE_NAME_MAX_LENGTH) {
      return res
        .status(400)
        .json({ error: `A name cannot exceed ${ARCHETYPE_NAME_MAX_LENGTH} characters.` });
    }
    // Setting a name that reads as a placeholder would hand it straight back to
    // the automated re-naming pass, which exists to replace exactly these.
    if (isPlaceholderArchetypeName(trimmed)) {
      return res.status(400).json({ error: 'That name is reserved for unnamed archetypes.' });
    }

    // Optional prose. A rename usually invalidates the generated description
    // that sits beside it, so the teacher can correct both in one call; each is
    // left untouched when omitted.
    const optionalText: Record<string, string> = {};
    for (const [field, value] of Object.entries({ description, teacherAction, forwardRisk })) {
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        return res.status(400).json({ error: `${field} must be a string.` });
      }
      if (value.length > ARCHETYPE_TEXT_MAX_LENGTH) {
        return res
          .status(400)
          .json({ error: `${field} cannot exceed ${ARCHETYPE_TEXT_MAX_LENGTH} characters.` });
      }
      optionalText[field] = value.trim();
    }

    try {
      const clusters = (await dbStore.getMisconceptionClusters()) as MisconceptionCluster[];
      const cluster = clusters.find(c => c.id === req.params.clusterId);
      if (!cluster) return res.status(404).json({ error: 'Archetype not found.' });

      const now = new Date().toISOString();
      const updated: MisconceptionCluster = {
        ...cluster,
        ...optionalText,
        name: trimmed,
        nameSetBy: user.email,
        nameSetByRole: user.role,
        nameSetAt: now,
        updatedAt: now
      };

      await dbStore.updateMisconceptionCluster(updated);
      invalidateFingerprintCache();
      res.json({ archetype: updated });
    } catch (error: any) {
      console.error('[MisconceptionFingerprint] rename failed:', error?.message || error);
      res.status(500).json({ error: 'Could not rename this archetype.' });
    }
  });
}
