import assert from 'node:assert';
import fs from 'fs';
import { renderClassGridObservationPdf, renderPerChildObservationPdf } from '../paperGenerator';

async function runCheck() {
  console.log('--- Running Check: Teacher Observation Sheet PDF (#618) ---');

  const args = {
    classId: 'class_balvatika_01',
    className: 'Balvatika',
    section: 'A',
    cycle: 'Baseline',
    students: [
      { id: 's1', name: 'Aarav Kumar' },
      { id: 's2', name: 'Ananya Sharma' },
    ],
    concepts: ['S3.1', 'S3.2', 'S3.3', 'S3.4', 'S3.5', 'S3.7']
  };

  // 1. Render Class-Grid Observation PDF
  const gridRes = await renderClassGridObservationPdf(args);
  assert.ok(fs.existsSync(gridRes.filePath), 'Class-grid PDF file should be created');
  assert.ok(gridRes.pdfBuffer.length > 0, 'Class-grid PDF buffer should be non-empty');

  // 2. Render Per-Child Observation PDF
  const childRes = await renderPerChildObservationPdf(args);
  assert.ok(fs.existsSync(childRes.filePath), 'Per-child PDF file should be created');
  assert.ok(childRes.pdfBuffer.length > 0, 'Per-child PDF buffer should be non-empty');

  console.log('✓ All checks passed for #618 Teacher Observation Sheet PDF!');
}

runCheck().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
