import type { EvaluationReport } from '../types';
import { Modal } from './Modal';

export function ReportModal({
  report,
  studentName,
  onClose,
}: {
  report: EvaluationReport;
  studentName: string;
  onClose: () => void;
}) {
  return (
    <Modal title={`Evaluation Report — ${studentName}`} onClose={onClose}>
      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat card">
          <div className="label">Score</div>
          <div className="value">{report.scorePercent}%</div>
          <div className="muted" style={{ fontSize: 12 }}>{report.correctCount}/{report.totalQuestions} correct</div>
        </div>
        <div className="stat card">
          <div className="label">Assigned Level</div>
          <div className="value" style={{ fontSize: 18 }}>{report.assignedLevelName}</div>
        </div>
      </div>

      <div className="card mb" style={{ background: '#f8fafd' }}>
        <strong>Narrative</strong>
        <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{report.narrative}</p>
      </div>

      <strong>Per-question breakdown</strong>
      <div className="panel mt" style={{ maxHeight: 260, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Q</th><th>Topic</th><th>Expected</th><th>Given</th><th>Result</th></tr></thead>
          <tbody>
            {report.breakdown.map((b) => (
              <tr key={b.questionId}>
                <td>{b.questionId}</td>
                <td>{b.topic}</td>
                <td className="muted">{b.expected}</td>
                <td className="muted">{b.submitted || '—'}</td>
                <td>{b.correct ? <span className="badge evaluated">✓</span> : <span className="badge pending">✗</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
