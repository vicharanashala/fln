import { Student } from '../types';

export type RiskCategory = 'High Priority' | 'Moderate Priority' | 'Stable Progress';

export interface RiskAnalysisResult {
  category: RiskCategory;
  riskScore: number; // 0 to 100 scale (higher score = higher risk)
  recommendation: string;
  reasoning: string;
  levelGap: number;
}

export function computeStudentRisk(student: Student): RiskAnalysisResult {
  if (student.riskCategory && student.riskScore !== undefined) {
    const levelGap = Math.max(0, student.targetLevel - student.currentLevel);
    let recommendation = student.recommendedIntervention || '';
    if (!recommendation) {
      if (student.riskCategory === 'High Priority') {
        recommendation = 'Assign 1-on-1 foundational remedial worksheet & daily practice.';
      } else if (student.riskCategory === 'Moderate Priority') {
        recommendation = 'Provide targeted level-up practice sheets & peer study pairing.';
      } else {
        recommendation = 'Maintain regular assessment schedule & advanced level challenges.';
      }
    }
    return {
      category: student.riskCategory,
      riskScore: student.riskScore,
      recommendation,
      reasoning: `Based on documented evaluation metrics and placement history.`,
      levelGap
    };
  }

  const levelGap = Math.max(0, (student.targetLevel || 10) - (student.currentLevel || 0));
  const hasHistory = student.levelHistory && student.levelHistory.length > 0;
  const streak = student.streak || 0;

  let riskScore = 0;

  // Level gap contribution (up to 50 pts)
  if (levelGap >= 5) riskScore += 50;
  else if (levelGap >= 3) riskScore += 35;
  else if (levelGap >= 2) riskScore += 20;
  else if (levelGap === 1) riskScore += 10;

  // Placement history contribution
  if (!hasHistory) riskScore += 25; // Pending placement

  // Low streak / inactivity (up to 25 pts)
  if (streak === 0) riskScore += 25;
  else if (streak <= 2) riskScore += 10;

  // Normalize riskScore 0 - 100
  riskScore = Math.min(100, Math.max(0, riskScore));

  let category: RiskCategory = 'Stable Progress';
  let recommendation = 'Maintain regular assessment schedule & advanced level challenges.';
  let reasoning = 'Student is meeting expected learning benchmarks and showing consistent progress.';

  if (riskScore >= 55 || levelGap >= 4) {
    category = 'High Priority';
    recommendation = 'Assign 1-on-1 foundational remedial worksheet & daily practice.';
    reasoning = `Student is ${levelGap} level(s) behind target with low activity streak (${streak} days). Urgent academic support required.`;
  } else if (riskScore >= 30 || levelGap >= 2) {
    category = 'Moderate Priority';
    recommendation = 'Provide targeted level-up practice sheets & peer study pairing.';
    reasoning = `Student is ${levelGap} level(s) behind target. Moderate intervention recommended to prevent learning decay.`;
  }

  return {
    category,
    riskScore,
    recommendation,
    reasoning,
    levelGap
  };
}

export function summarizeRiskDistribution(students: Student[]) {
  const summary = {
    highPriorityCount: 0,
    moderatePriorityCount: 0,
    stableProgressCount: 0,
    total: students.length,
    highPriorityPercentage: 0,
    moderatePriorityPercentage: 0,
    stableProgressPercentage: 0
  };

  students.forEach(s => {
    const res = computeStudentRisk(s);
    if (res.category === 'High Priority') summary.highPriorityCount++;
    else if (res.category === 'Moderate Priority') summary.moderatePriorityCount++;
    else summary.stableProgressCount++;
  });

  if (summary.total > 0) {
    summary.highPriorityPercentage = Math.round((summary.highPriorityCount / summary.total) * 100);
    summary.moderatePriorityPercentage = Math.round((summary.moderatePriorityCount / summary.total) * 100);
    summary.stableProgressPercentage = Math.round((summary.stableProgressCount / summary.total) * 100);
  }

  return summary;
}
