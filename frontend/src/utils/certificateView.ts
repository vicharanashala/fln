export type CertificateConceptLevel = 'Beginner' | 'Progressive' | 'Proficient';
export type CertificateLevelLabel = 'Beginner' | 'Progressing' | 'Proficient' | 'Not available';

export const LEVEL_LABEL: Record<CertificateConceptLevel, CertificateLevelLabel> = {
  Beginner: 'Beginner',
  Progressive: 'Progressing',
  Proficient: 'Proficient',
};

export const LEVEL_ICON: Record<CertificateConceptLevel, string> = {
  Beginner: '🌱',
  Progressive: '🌿',
  Proficient: '🌸',
};

const LEVEL_RANK: Record<CertificateConceptLevel, number> = {
  Beginner: 0,
  Progressive: 1,
  Proficient: 2,
};

export interface CertificateConcept {
  id: string;
  title?: string | null;
  competency?: string | null;
  core?: boolean;
}

export interface CertificateRecord {
  id?: string;
  certificateId?: string;
  issuedAt?: string;
  decisionSnapshot?: {
    outcome?: string;
    conceptLevels?: Record<string, CertificateConceptLevel>;
    unassessedConcepts?: string[];
  };
}

export interface CertificateViewRow {
  id: string;
  title: string;
  icon: string;
  level: CertificateLevelLabel;
  core: boolean;
}

export interface CertificateCompetencyGroup {
  competency: string;
  level: CertificateLevelLabel;
  concepts: CertificateViewRow[];
}

export interface CertificateView {
  canPrint: boolean;
  certificateId: string;
  issuedAt: string;
  groups: CertificateCompetencyGroup[];
  notYetAssessed: string[];
}

const isConceptLevel = (value: unknown): value is CertificateConceptLevel =>
  value === 'Beginner' || value === 'Progressive' || value === 'Proficient';

const lowestLevel = (levels: CertificateConceptLevel[]): CertificateLevelLabel => {
  if (levels.length === 0) return 'Not available';
  return LEVEL_LABEL[levels.reduce((lowest, current) =>
    LEVEL_RANK[current] < LEVEL_RANK[lowest] ? current : lowest
  )];
};

/**
 * Convert a stored certification into presentation-ready rows.
 * This helper is deliberately independent of React so it can be tested
 * without rendering the certificate panel.
 */
export function buildCertificateView(
  cert: CertificateRecord,
  concepts: CertificateConcept[],
): CertificateView {
  const snapshot = cert.decisionSnapshot;
  const conceptLevels = snapshot?.conceptLevels;
  const hasLegacyLevels = !conceptLevels;
  const rowsByCompetency = new Map<string, Array<{
    row: CertificateViewRow;
    rawLevel?: CertificateConceptLevel;
  }>>();

  for (const concept of concepts) {
    const rawLevel = conceptLevels?.[concept.id];
    // Old records predate per-concept levels. Keep their concepts visible,
    // but never infer a level that was not stored.
    if (!hasLegacyLevels && !isConceptLevel(rawLevel)) continue;

    const competency = concept.competency?.trim() || 'Other';
    const row: CertificateViewRow = {
      id: concept.id,
      title: concept.title?.trim() || concept.id,
      icon: isConceptLevel(rawLevel) ? LEVEL_ICON[rawLevel] : '○',
      level: isConceptLevel(rawLevel) ? LEVEL_LABEL[rawLevel] : 'Not available',
      core: concept.core === true,
    };

    const group = rowsByCompetency.get(competency) ?? [];
    group.push({ row, rawLevel: isConceptLevel(rawLevel) ? rawLevel : undefined });
    rowsByCompetency.set(competency, group);
  }

  const groups = Array.from(rowsByCompetency, ([competency, entries]) => {
    // Core concepts are shown first within each competency.
    entries.sort((a, b) => Number(b.row.core) - Number(a.row.core));
    const assessedLevels = entries
      .map(entry => entry.rawLevel)
      .filter((level): level is CertificateConceptLevel => level !== undefined);

    return {
      competency,
      level: lowestLevel(assessedLevels),
      concepts: entries.map(entry => entry.row),
    };
  });

  return {
    canPrint: snapshot?.outcome === 'complete',
    certificateId: cert.certificateId || cert.id || 'Not available',
    issuedAt: cert.issuedAt || 'Not available',
    groups,
    notYetAssessed: [...(snapshot?.unassessedConcepts ?? [])],
  };
}
