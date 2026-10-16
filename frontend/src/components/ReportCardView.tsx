import React from 'react';
import { Student, EvaluationReport } from '../types';
import { ArrowLeft, Printer, Download } from 'lucide-react';

interface ReportCardViewProps {
  student: Student;
  reports: EvaluationReport[];
  schoolName: string;
  onBack: () => void;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const MASTERY_PRIORITY: Record<string, number> = { 'Strong': 3, 'Satisfactory': 2, 'Needs Practice': 1 };

export const ReportCardView: React.FC<ReportCardViewProps> = ({ student, reports, schoolName, onBack }) => {
  const sortedReports = [...reports].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const latestReport = sortedReports.length > 0 ? sortedReports[0] : null;
  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((a, r) => a + (r.score / r.totalQuestions) * 100, 0) / reports.length)
    : 0;
  const allConceptMastery: Record<string, 'Strong' | 'Needs Practice' | 'Satisfactory'> = {};
  reports.forEach(r => {
    Object.entries(r.conceptMastery).forEach(([topic, mastery]: [string, 'Strong' | 'Needs Practice' | 'Satisfactory']) => {
      const current = allConceptMastery[topic];
      if (!current || (MASTERY_PRIORITY[mastery] ?? 0) > (MASTERY_PRIORITY[current] ?? 0)) {
        allConceptMastery[topic] = mastery;
      }
    });
  });
  const certified = student.currentLevel >= 5;
  const progressPct = Math.min(100, Math.round((student.currentLevel / 59) * 100));
  const scoreBand = avgScore >= 80 ? 'Strong' : avgScore >= 60 ? 'Satisfactory' : 'Needs Practice';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the report card.');
      return;
    }

    const conceptRows = Object.entries(allConceptMastery).map(([topic, mastery]) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:500;">${escapeHtml(topic)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <span style="display:inline-block;padding:3px 10px;font-size:10px;font-weight:700;border-radius:4px;text-transform:uppercase;font-family:monospace;
            ${mastery === 'Strong' ? 'background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;' : mastery === 'Satisfactory' ? 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;' : 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;'}">
            ${escapeHtml(mastery)}
          </span>
        </td>
      </tr>
    `).join('');

    const assessmentRows = reports.map(r => {
      const pct = Math.round((r.score / r.totalQuestions) * 100);
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.worksheetId)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;font-family:monospace;">${r.score}/${r.totalQuestions}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:${pct >= 80 ? '#065f46' : pct >= 60 ? '#92400e' : '#991b1b'};">${pct}%</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:11px;">${new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        </tr>
      `;
    }).join('');

    const levelHistoryRows = student.levelHistory.map(lh => `
      <tr>
        <td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:600;">L${lh.level}.${lh.subLevel ?? 0}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(lh.reason)}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #e2e8f0;">${new Date(lh.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>FLN Report Card - ${escapeHtml(student.name)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 0; font-size: 13px; background: white; }
          .page { max-width: 800px; margin: 0 auto; padding: 40px; }

          .report-header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 25px; position: relative; }
          .govt-badge { display: inline-block; background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; font-size: 9px; font-weight: 800; padding: 3px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
          .school-name { font-size: 22px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
          .report-subtitle { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 600; }
          .report-type { font-size: 11px; color: #4f46e5; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }

          .student-banner { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 22px; margin-bottom: 25px; }
          .student-banner .name { font-size: 18px; font-weight: 800; color: #0f172a; }
          .student-banner .meta { font-size: 11px; color: #64748b; margin-top: 2px; }
          .student-banner .cert-badge { padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          .cert-pass { background: #d1fae5; color: #065f46; border: 2px solid #34d399; }
          .cert-progress { background: #fef3c7; color: #92400e; border: 2px solid #f59e0b; }

          .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
          .metric-box { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
          .metric-box .value { font-size: 22px; font-weight: 800; color: #4f46e5; }
          .metric-box .label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 4px; letter-spacing: 0.5px; }

          .progress-section { margin-bottom: 25px; }
          .progress-bar-container { background: #e2e8f0; border-radius: 8px; height: 14px; overflow: hidden; margin-top: 8px; }
          .progress-bar-fill { height: 100%; border-radius: 8px; background: linear-gradient(90deg, #4f46e5, #7c3aed); transition: width 0.3s; }

          .section-title { font-size: 13px; font-weight: 800; border-left: 4px solid #4f46e5; padding-left: 10px; margin: 25px 0 12px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; }
          th { background-color: #f1f5f9; text-align: left; padding: 10px 14px; font-weight: 700; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }

          .narrative-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 12px; line-height: 1.6; color: #334155; white-space: pre-line; margin-bottom: 20px; }

          .signature-section { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
          .signature-box { text-align: center; width: 200px; }
          .signature-line { border-top: 1px solid #1e293b; margin-top: 50px; padding-top: 6px; font-size: 11px; color: #64748b; font-weight: 600; }

          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          .footer .confidential { font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px; }

          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            .page { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="report-header">
            <div class="govt-badge">National Education Policy 2020</div>
            <div class="school-name">${escapeHtml(schoolName || 'Government Primary School')}</div>
            <div class="report-subtitle">Foundational Literacy and Numeracy Assessment</div>
            <div class="report-type">Student Progress Report Card</div>
          </div>

          <div class="student-banner">
            <div>
              <div class="name">${escapeHtml(student.name)}</div>
              <div class="meta">${escapeHtml(student.classGroup)} - ${escapeHtml(student.section)} | ID: ${escapeHtml(student.id)} | Age: ${student.age} years</div>
              <div class="meta">School ID: ${escapeHtml(student.schoolId)} | Aadhaar: ${escapeHtml(student.aadharMasked)}</div>
            </div>
            <div class="cert-badge ${certified ? 'cert-pass' : 'cert-progress'}">
              ${certified ? 'FLN Certified' : 'In Progress'}
            </div>
          </div>

          <div class="metrics-grid">
            <div class="metric-box">
              <div class="value">L${student.currentLevel}.${student.currentSubLevel ?? 0}</div>
              <div class="label">Current FLN Level</div>
            </div>
            <div class="metric-box">
              <div class="value">${reports.length}</div>
              <div class="label">Assessments Taken</div>
            </div>
            <div class="metric-box">
              <div class="value" style="color: ${avgScore >= 80 ? '#059669' : avgScore >= 60 ? '#d97706' : '#dc2626'}">${avgScore}%</div>
              <div class="label">Average Score</div>
            </div>
            <div class="metric-box">
              <div class="value" style="color: ${student.streak >= 3 ? '#059669' : '#d97706'}">${student.streak}</div>
              <div class="label">Day Streak</div>
            </div>
          </div>

          <div class="progress-section">
            <div class="section-title">FLN Level Progress (Max: L59)</div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:2px;">
              <span>Level ${student.currentLevel}</span>
              <span>Target: Level ${student.targetLevel}</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width:${progressPct}%"></div>
            </div>
          </div>

          ${reports.length > 0 ? `
          <div class="section-title">Assessment History</div>
          <table>
            <thead>
              <tr>
                <th>Worksheet</th>
                <th style="text-align:center;">Score</th>
                <th style="text-align:center;">Percentage</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${assessmentRows}
            </tbody>
          </table>
          ` : ''}

          ${Object.keys(allConceptMastery).length > 0 ? `
          <div class="section-title">Skill Proficiency Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Topic / Skill</th>
                <th style="text-align:center;">Mastery Level</th>
              </tr>
            </thead>
            <tbody>
              ${conceptRows}
            </tbody>
          </table>
          ` : ''}

          ${latestReport ? `
          <div class="section-title">Teacher Evaluation Summary</div>
          <div class="narrative-box">${escapeHtml(latestReport.narrative)}</div>
          ` : ''}

          ${student.levelHistory.length > 0 ? `
          <div class="section-title">Level Progression History</div>
          <table>
            <thead>
              <tr>
                <th>Level Achieved</th>
                <th>Assessment Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${levelHistoryRows}
            </tbody>
          </table>
          ` : ''}

          <div class="section-title">Overall Performance Band</div>
          <div style="display:flex;gap:12px;margin-bottom:20px;">
            <div style="flex:1;padding:14px;border-radius:8px;text-align:center;${scoreBand === 'Strong' ? 'background:#d1fae5;border:2px solid #34d399;' : scoreBand === 'Satisfactory' ? 'background:#dbeafe;border:2px solid #60a5fa;' : 'background:#fee2e2;border:2px solid #f87171;'}">
              <div style="font-size:16px;font-weight:800;color:${scoreBand === 'Strong' ? '#065f46' : scoreBand === 'Satisfactory' ? '#1e40af' : '#991b1b'};">${scoreBand}</div>
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;margin-top:2px;letter-spacing:0.5px;">Performance Band</div>
            </div>
            <div style="flex:1;padding:14px;border-radius:8px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;">
              <div style="font-size:16px;font-weight:800;color:#4f46e5;">L${student.currentLevel}</div>
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;margin-top:2px;letter-spacing:0.5px;">Current Level</div>
            </div>
            <div style="flex:1;padding:14px;border-radius:8px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;">
              <div style="font-size:16px;font-weight:800;color:#7c3aed;">L${student.targetLevel}</div>
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;margin-top:2px;letter-spacing:0.5px;">Target Level</div>
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Class Teacher Signature</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Principal / Headmaster</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Parent / Guardian</div>
            </div>
          </div>

          <div class="footer">
            <div class="confidential">Confidential Student Academic Record</div>
            <div style="margin-top:4px;">Generated by FLN Portal | National Initiative for Proficiency in Reading with Understanding and Numeracy (NIPUN Bharat)</div>
            <div style="margin-top:2px;">Report generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Student Profile
        </button>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm">
            <Printer className="h-4 w-4" />
            Print Report Card
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
            <Download className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-indigo-700 dark:bg-indigo-800 px-8 py-6 text-center">
          <div className="inline-block bg-amber-200/20 border border-amber-300/30 rounded px-3 py-1 text-[9px] font-extrabold text-amber-100 uppercase tracking-widest mb-3">
            National Education Policy 2020
          </div>
          <h1 className="text-xl font-extrabold text-white uppercase tracking-wide">Student Progress Report Card</h1>
          <p className="text-indigo-200 text-xs mt-1 font-medium">Foundational Literacy and Numeracy Assessment</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{student.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {student.classGroup} - {student.section} | ID: {student.id} | Age: {student.age}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                School: {schoolName} ({student.schoolId})
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider ${certified ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-700' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-700'}`}>
              {certified ? 'FLN Certified' : 'In Progress'}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: `L${student.currentLevel}.${student.currentSubLevel ?? 0}`, label: 'Current Level', color: 'text-indigo-600 dark:text-indigo-400' },
              { value: String(reports.length), label: 'Assessments', color: 'text-slate-900 dark:text-white' },
              { value: `${avgScore}%`, label: 'Average Score', color: avgScore >= 80 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-600' : 'text-red-600' },
              { value: `${student.streak}`, label: 'Day Streak', color: student.streak >= 3 ? 'text-emerald-600' : 'text-amber-600' },
            ].map(m => (
              <div key={m.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className={`text-xl font-extrabold ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold mt-1 tracking-wider">{m.label}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">FLN Level Progress (Max: L59)</h3>
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1">
              <span>Level {student.currentLevel}</span>
              <span>Target: Level {student.targetLevel}</span>
            </div>
            <div className="h-3.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono">{progressPct}%</div>
          </div>

          {reports.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Assessment History</h3>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Worksheet</th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score</th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Percentage</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {reports.map(r => {
                      const pct = Math.round((r.score / r.totalQuestions) * 100);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.worksheetId}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold">{r.score}/{r.totalQuestions}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${pct >= 80 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : pct >= 60 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>{pct}%</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Object.keys(allConceptMastery).length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Skill Proficiency Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(allConceptMastery).map(([topic, mastery]) => (
                  <div key={topic} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{topic}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${mastery === 'Strong' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : mastery === 'Satisfactory' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>{mastery}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestReport && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Teacher Evaluation Summary</h3>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {latestReport.narrative}
              </div>
            </div>
          )}

          {student.levelHistory.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Level Progression History</h3>
              <div className="space-y-2">
                {student.levelHistory.map((lh, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">L{lh.level}</span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{lh.reason}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">Level {lh.level}.{lh.subLevel ?? 0}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{new Date(lh.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
            {['Class Teacher', 'Principal / Headmaster', 'Parent / Guardian'].map(role => (
              <div key={role} className="text-center">
                <div className="h-px bg-slate-300 dark:bg-slate-600 mt-12 mb-2" />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{role}</span>
              </div>
            ))}
          </div>

          <div className="text-center pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-extrabold text-red-500 uppercase tracking-wider">Confidential Student Academic Record</p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">Generated by FLN Portal | NIPUN Bharat | {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
