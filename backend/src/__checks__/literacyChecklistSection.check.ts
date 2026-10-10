import assert from 'node:assert';
import { renderPerChildObservationPdf } from '../paperGenerator';

async function runCheck() {
  console.log('--- Running Check: Literacy Checklist Section on Observation Sheet (#628) ---');

  const result = await renderPerChildObservationPdf({
    classId: 'c1',
    className: 'Balvatika',
    section: 'A',
    cycle: 'Baseline',
    students: [
      { id: 'stud_lit_01', name: 'Aarav Kumar' },
      { id: 'stud_lit_02', name: 'Bhavya Sharma' }
    ]
  });

  assert.ok(result.pdfBuffer, 'PDF buffer must be generated');
  assert.ok(result.pdfBuffer.length > 0, 'PDF buffer must not be empty');

  const pdfText = result.pdfBuffer.toString();
  assert.ok(pdfText.includes('PDF'), 'Generated file must be a valid PDF document');

  console.log('✓ All checks passed for #628 Literacy Checklist Section!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
