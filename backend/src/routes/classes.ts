import express from 'express';
import { dbStore, UserRole, CYCLE_NAMES } from '../db';
import { getAuthUser } from '../auth';

export function registerClassRoutes(app: express.Express) {
  app.get('/api/classes', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const classes = await dbStore.getClasses();
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN || user.role === UserRole.BLOCK_ADMIN) {
      return res.json(classes);
    }
    // A teacher/school-scoped user with zero classes should see an empty
    // list — that's a correct, expected state for a new account, not a
    // reason to widen scope to every class in the database (issue #291).
    const filtered = classes.filter(c => c.schoolId === user.schoolId || (user.assignedSchools && user.assignedSchools.includes(c.schoolId || '')));
    res.json(filtered);
  });

  // Issue #183: gap-analysis engine. Computed on-demand from live data every
  // call — nothing here is persisted or cached, so it's never stale and
  // there's no new collection to keep in sync.
  app.get('/api/classes/:id/remediation-groups', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const classes = await dbStore.getClasses();
    const cls = classes.find(c => c.id === req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found.' });

    const isUnrestricted = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(user.role);
    const hasSchoolAccess = cls.schoolId === user.schoolId || (user.assignedSchools && user.assignedSchools.includes(cls.schoolId));
    const isOwningTeacher = cls.teacherId === user.id;
    if (!isUnrestricted && !hasSchoolAccess && !isOwningTeacher) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const students = (await dbStore.getStudents({ schoolId: cls.schoolId })).filter(
      s => s.classGroup === cls.className && s.section === cls.section
    );

    const worksheets = await dbStore.getWorksheets();
    const worksheetCycleById = new Map(worksheets.map(w => [w.id, w.cycle]));

    const allReports = await dbStore.getEvaluationReports({ studentIds: students.map(s => s.id) });

    const REMEDIATION_CYCLES: string[] = [CYCLE_NAMES[0], CYCLE_NAMES[1]]; // Baseline, Mid-year

    const groups = students.map(s => {
      const studentReports = allReports
        .filter(r => r.studentId === s.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const cycleReport = studentReports.find(r => {
        const cycle = worksheetCycleById.get(r.worksheetId);
        return cycle !== undefined && REMEDIATION_CYCLES.includes(cycle);
      });
      const report = cycleReport || studentReports[0];

      const weakTopics = report
        ? Object.entries(report.conceptMastery)
            .filter(([, mastery]) => mastery === 'Needs Practice')
            .map(([topic]) => topic)
        : [];
      const assessedTopicCount = report ? Object.keys(report.conceptMastery).length : 0;

      // currentLevel < targetLevel is NOT a useful "behind schedule" signal in
      // this codebase — targetLevel is defined as currentLevel + 1 essentially
      // everywhere it's set (seed.ts, evaluation routes), so that comparison
      // is true for nearly every student by construction. currentSubLevel is
      // the real signal: it's computed elsewhere from actual performance at
      // the student's current level (0 = Mastery, 1 = Easier/partial passes,
      // 2 = Remedial/failed everything at that level).
      const strugglingAtCurrentLevel = s.currentSubLevel === 2;
      const majorityWeak = assessedTopicCount > 0 && weakTopics.length > assessedTopicCount / 2;
      const group: 'Practice' | 'Remedial' = (strugglingAtCurrentLevel || majorityWeak) ? 'Remedial' : 'Practice';

      return {
        studentId: s.id,
        studentName: s.name,
        currentLevel: s.currentLevel,
        targetLevel: s.targetLevel,
        group,
        weakTopics,
        hasReport: !!report,
        cycleMatched: !!cycleReport,
        reportCycle: report ? (worksheetCycleById.get(report.worksheetId) ?? null) : null,
      };
    });

    res.json({
      classId: cls.id,
      className: cls.className,
      section: cls.section,
      practice: groups.filter(g => g.group === 'Practice'),
      remedial: groups.filter(g => g.group === 'Remedial'),
    });
  });
}
