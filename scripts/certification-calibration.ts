import fs from 'fs';
import path from 'path';

const MASTERY_RULE_VERSION = 'v1-provisional-2of3';

interface CliArgs {
  classNum?: number;
  cycle?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let classNum: number | undefined;
  let cycle: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--class' && args[i + 1]) {
      const val = parseInt(args[i + 1], 10);
      // FLN scope covers Balvatika (0) to Class 3
      if (isNaN(val) || val < 0 || val > 3) {
        console.error(`Error: Invalid class '--class ${args[i + 1]}'. FLN scope covers Balvatika (0) to Class 3.`);
        process.exit(1);
      }
      classNum = val;
      i++;
    } else if (args[i] === '--cycle' && args[i + 1]) {
      cycle = args[i + 1];
      i++;
    }
  }
  return { classNum, cycle };
}

function findDbPath(): string | null {
  const possiblePaths = [
    path.resolve(process.cwd(), 'backend/data/db.json'),
    path.resolve(process.cwd(), 'data/db.json'),
    path.resolve(process.cwd(), 'db.json'),
    path.resolve(__dirname, '../backend/data/db.json'),
    path.resolve(__dirname, '../data/db.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const { classNum, cycle } = parseArgs();

  const dbPath = findDbPath();
  if (!dbPath) {
    console.error('[ERROR] Could not find db.json anywhere in the workspace.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(dbPath, 'utf-8');
  const db = JSON.parse(rawData);

  const reports = db.evaluationReports || db.evaluations || db.reports || [];

  if (reports.length === 0) {
    console.log('no data');
    process.exit(0);
  }

  let filtered = reports;
  if (classNum !== undefined) {
    filtered = filtered.filter((r: any) => r.studentClass === classNum || r.class === classNum);
  }

  if (cycle) {
    filtered = filtered.filter((r: any) => r.cycle && r.cycle.toLowerCase() === cycle.toLowerCase());
  }

  // Deduplicate by studentId + worksheetId
  const uniqueMap = new Map<string, any>();
  for (const r of filtered) {
    const key = `${r.studentId || r.id}-${r.worksheetId || 'default'}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, r);
    }
  }
  const processedReports = Array.from(uniqueMap.values());

  if (processedReports.length === 0) {
    console.log('no data');
    process.exit(0);
  }

  const conceptStats = new Map<string, {
    totalStudents: Set<string>;
    beginners: number;
    progressing: number;
    proficient: number;
    totalEvidenceCount: number;
    evidenceRecordsCount: number;
    teacherAgreements: { agree: number; worksheetHigher: number; teacherHigher: number };
  }>();

  const levelRank: Record<string, number> = {
    Beginner: 1,
    Progressing: 2,
    Proficient: 3
  };

  for (const report of processedReports) {
    const conceptMasteryObj = report.conceptMastery || {};
    const concepts = Object.keys(conceptMasteryObj);
    const fallbackConcepts = concepts.length > 0 ? concepts : ['General'];

    for (const concept of fallbackConcepts) {
      if (!conceptStats.has(concept)) {
        conceptStats.set(concept, {
          totalStudents: new Set(),
          beginners: 0,
          progressing: 0,
          proficient: 0,
          totalEvidenceCount: 0,
          evidenceRecordsCount: 0,
          teacherAgreements: { agree: 0, worksheetHigher: 0, teacherHigher: 0 }
        });
      }

      const stats = conceptStats.get(concept)!;
      stats.totalStudents.add(report.studentId || report.id || 'unknown');

      const total = report.totalQuestions || 2;
      const score = report.score || 0;
      const correctCount = Math.round((score / 100) * total);

      stats.totalEvidenceCount += total;
      stats.evidenceRecordsCount += 1;

      let level = 'Beginner';
      if (total >= 2 && (correctCount / total) >= 0.6) {
        level = 'Proficient';
      } else if (total >= 1 && correctCount > 0) {
        level = 'Progressing';
      }

      if (level === 'Beginner') stats.beginners++;
      else if (level === 'Progressing') stats.progressing++;
      else if (level === 'Proficient') stats.proficient++;

      const teacherRating = report.teacherRating;
      if (teacherRating && levelRank[teacherRating]) {
        const wRank = levelRank[level];
        const tRank = levelRank[teacherRating];
        if (wRank === tRank) {
          stats.teacherAgreements.agree++;
        } else if (wRank > tRank) {
          stats.teacherAgreements.worksheetHigher++;
        } else {
          stats.teacherAgreements.teacherHigher++;
        }
      }
    }
  }

  console.log(`\n=== Certification Calibration Report (Rule Version: ${MASTERY_RULE_VERSION}) ===\n`);
  console.log(
    'Concept'.padEnd(25) +
    'Total'.padEnd(8) +
    'Beg(%)'.padEnd(10) +
    'Prog'.padEnd(8) +
    'Prof'.padEnd(8) +
    'Avg Evid'.padEnd(10) +
    'Teacher Agreement (Agree / W-High / T-High)'.padEnd(45) +
    'Notes'
  );
  console.log('-'.repeat(130));

  for (const [concept, stats] of conceptStats.entries()) {
    const totalCount = stats.totalStudents.size;
    const begShare = totalCount > 0 ? ((stats.beginners / totalCount) * 100).toFixed(1) + '%' : '0.0%';
    const avgEvidence = stats.evidenceRecordsCount > 0 
      ? (stats.totalEvidenceCount / stats.evidenceRecordsCount).toFixed(1) 
      : '0.0';
    
    const agreementStr = `${stats.teacherAgreements.agree} / ${stats.teacherAgreements.worksheetHigher} / ${stats.teacherAgreements.teacherHigher}`;
    const notes = totalCount < 30 ? 'too few to judge' : '';

    console.log(
      concept.padEnd(25) +
      String(totalCount).padEnd(8) +
      begShare.padEnd(10) +
      String(stats.progressing).padEnd(8) +
      String(stats.proficient).padEnd(8) +
      avgEvidence.padEnd(10) +
      agreementStr.padEnd(45) +
      notes
    );
  }
  console.log('\n');
}

main().catch((err) => {
  console.error('Calibration script execution failed:', err);
  process.exit(1);
});