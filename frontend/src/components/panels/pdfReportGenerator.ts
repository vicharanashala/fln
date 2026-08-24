// ==========================================
// STUDENT PDF REPORT GENERATOR
// ==========================================
// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 1).
// Pure function — takes (student, report) only, no closure over component
// state — used by student_profile and reports panels.
import { Student, EvaluationReport } from '../../types';

export const handleDownloadPDF = (student: Student, r: EvaluationReport) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download/print the PDF report card.');
      return;
    }

    const conceptBadges = Object.entries(r.conceptMastery)
      .map(([t, m]) => `<span class="badge ${m === 'Strong' ? 'badge-pass' : 'badge-fail'}">${t}: ${m}</span>`)
      .join(' ');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Assessment Report - ${student.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
          .title { font-size: 24px; font-weight: 700; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 5px; font-weight: 500; }
          .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .info-item { font-size: 13px; }
          .info-item strong { color: #0f172a; }
          .section-title { font-size: 14px; font-weight: 700; border-left: 4px solid #4f46e5; padding-left: 10px; margin: 25px 0 15px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
          .metric-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
          .metric-value { font-size: 22px; font-weight: 700; color: #4f46e5; }
          .metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 5px; letter-spacing: 0.5px; }
          .narrative-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; font-size: 13px; white-space: pre-line; margin-bottom: 25px; color: #334155; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th { background-color: #f1f5f9; text-align: left; padding: 10px; font-weight: 700; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          .badge { display: inline-block; padding: 3px 8px; font-size: 9px; font-weight: 700; border-radius: 4px; text-transform: uppercase; font-family: monospace; }
          .badge-pass { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
          .badge-fail { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">FLN Portal</div>
          <div class="subtitle">Foundation Level Diagnostic Evaluation Report</div>
        </div>

        <div class="student-info">
          <div class="info-item">Student Name: <strong>${student.name}</strong></div>
          <div class="info-item">Student ID: <strong>${student.displayId || student.id}</strong></div>
          <div class="info-item">Class / Section: <strong>${student.classGroup} - ${student.section}</strong></div>
          <div class="info-item">Report Date: <strong>${new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
        </div>

        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">${r.score} / ${r.totalQuestions}</div>
            <div class="metric-label">Diagnostic Score</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">L${r.recommendedLevel}.${r.recommendedSubLevel ?? 0}</div>
            <div class="metric-label">Placed Level</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${Math.round((r.score / r.totalQuestions) * 100)}%</div>
            <div class="metric-label">Accuracy Rate</div>
          </div>
        </div>

        <div class="section-title">Concept Mastery Breakdown</div>
        <div style="margin-bottom: 25px; display: flex; gap: 8px; flex-wrap: wrap;">
          ${conceptBadges}
        </div>

        <div class="section-title">AI Evaluation Summary</div>
        <div class="narrative-box">
          ${r.narrative}
        </div>

        <div class="footer">
          Generated automatically by the FLN Portal. Confidential Student Academic Record.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };
