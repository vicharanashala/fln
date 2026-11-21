import { describe, expect, it } from 'vitest';
import {
  buildCertificateView,
  LEVEL_ICON,
  LEVEL_LABEL,
  type CertificateConcept,
  type CertificateRecord,
} from './certificateView';

const concepts: CertificateConcept[] = [
  { id: 'S3.1', title: 'Numerals to 10', competency: 'C-8.5', core: true },
  { id: 'S3.2', title: 'Counts to 10', competency: 'C-8.3', core: true },
  { id: 'S3.8', title: 'Number games', competency: 'C-8.5', core: false },
];

const completeRecord: CertificateRecord = {
  id: 'record-1',
  certificateId: 'FLN-2026-001',
  issuedAt: '2026-10-20T00:00:00.000Z',
  decisionSnapshot: {
    outcome: 'complete',
    conceptLevels: {
      'S3.1': 'Proficient',
      'S3.2': 'Progressive',
      'S3.8': 'Beginner',
    },
    unassessedConcepts: [],
  },
};

describe('buildCertificateView', () => {
  it('builds one presentation row for every assessed concept with HPC labels and neutral icons', () => {
    const view = buildCertificateView(completeRecord, concepts);
    const rows = view.groups.flatMap(group => group.concepts);

    expect(view.canPrint).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.level)).toEqual([
      'Proficient',
      'Progressing',
      'Beginner',
    ]);
    expect(rows.map(row => row.icon)).toEqual([
      LEVEL_ICON.Proficient,
      LEVEL_ICON.Progressive,
      LEVEL_ICON.Beginner,
    ]);
    expect(LEVEL_LABEL.Progressive).toBe('Progressing');
  });

  it('groups concepts by competency and reports the lowest level in each group', () => {
    const view = buildCertificateView(completeRecord, concepts);
    const numberCompetency = view.groups.find(group => group.competency === 'C-8.5');

    expect(numberCompetency?.level).toBe('Beginner');
    expect(numberCompetency?.concepts.map(row => row.id)).toEqual(['S3.1', 'S3.8']);
  });

  it('places core concepts before non-core concepts within a competency', () => {
    const view = buildCertificateView(completeRecord, concepts);
    const numberCompetency = view.groups.find(group => group.competency === 'C-8.5');

    expect(numberCompetency?.concepts.map(row => row.core)).toEqual([true, false]);
  });

  it('does not make an incomplete record printable and exposes unassessed concepts', () => {
    const record: CertificateRecord = {
      decisionSnapshot: {
        outcome: 'incomplete',
        conceptLevels: { 'S3.1': 'Proficient' },
        unassessedConcepts: ['S3.2'],
      },
    };

    const view = buildCertificateView(record, concepts);

    expect(view.canPrint).toBe(false);
    expect(view.notYetAssessed).toEqual(['S3.2']);
    expect(view.groups.flatMap(group => group.concepts).map(row => row.id)).toEqual(['S3.1']);
  });

  it('uses the concept id when a title is missing and groups unmapped concepts under Other', () => {
    const view = buildCertificateView(completeRecord, [
      { id: 'S9.9', competency: null, core: true },
    ]);

    expect(view.groups[0].competency).toBe('Other');
    expect(view.groups[0].concepts[0].title).toBe('S9.9');
  });

  it('handles legacy records without per-concept levels without throwing', () => {
    const legacyRecord: CertificateRecord = {
      id: 'legacy-record',
      decisionSnapshot: { outcome: 'complete' },
    };

    const view = buildCertificateView(legacyRecord, concepts);

    expect(view.canPrint).toBe(true);
    expect(view.groups.flatMap(group => group.concepts).every(row => row.level === 'Not available')).toBe(true);
    expect(view.certificateId).toBe('legacy-record');
    expect(view.issuedAt).toBe('Not available');
  });

  it('returns the same certificate id and issue date for repeated rendering', () => {
    const first = buildCertificateView(completeRecord, concepts);
    const second = buildCertificateView(completeRecord, concepts);

    expect(second.certificateId).toBe(first.certificateId);
    expect(second.issuedAt).toBe(first.issuedAt);
  });
});
