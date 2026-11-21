import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Printer, Search, ChevronDown } from 'lucide-react';
import { Student, User, UserRole } from '../../types';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../services/apiClient';
import { buildCertificateView, type CertificateConcept, type CertificateRecord } from '../../utils/certificateView';
import { SkillCertificate } from './SkillCertificate';

type RankedStudent = {
  student: Student;
  rank: number;
  issuedAt?: string;
};

const getCertificationClassNumber = (classGroup: string): number | null => {
  const label = classGroup.trim();
  if (/^balvatika$/i.test(label)) return 0;
  const match = label.match(/^class\s*([1-3])(?:\D|$)/i);
  return match ? Number(match[1]) : null;
};

const ordinal = (rank: number) => {
  const endings = ['th', 'st', 'nd', 'rd'];
  const remainder = rank % 100;
  return `${rank}${endings[(remainder - 20) % 10] || endings[remainder] || endings[0]}`;
};

const printCertificate = async (certificate?: HTMLDivElement | null, kind: 'normal' | 'skill' = 'normal') => {
  if (!certificate) return;

  await document.fonts?.ready;

  const originalParent = certificate.parentNode;
  const originalNextSibling = certificate.nextSibling;

  document.body.appendChild(certificate);

  const cleanup = () => {
    document.body.classList.remove('printing-certificate');
    document.body.classList.remove('printing-normal-certificate');
    document.body.classList.remove('printing-skill-certificate');

    if (originalParent) {
      originalParent.insertBefore(
        certificate,
        originalNextSibling ?? null
      );
    }
  };

  document.body.classList.add('printing-certificate');
  document.body.classList.add(kind === 'skill' ? 'printing-skill-certificate' : 'printing-normal-certificate');

  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
};

function RankCertificate({
  ranked,
  teacherName,
  allStudents,
  certificateRef,
}: {
  ranked: RankedStudent;
  teacherName: string;
  allStudents: Student[];
  certificateRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const issuedAt = ranked.issuedAt
    ? new Date(ranked.issuedAt)
    : new Date();

  const issuedDate = issuedAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const month = issuedAt.toLocaleDateString('en-IN', {
    month: 'long',
  });

  const classmates = allStudents
    .filter(
      student =>
        student.classGroup === ranked.student.classGroup &&
        student.section === ranked.student.section
    )
    .sort(
      (a, b) =>
        b.currentLevel - a.currentLevel ||
        b.streak - a.streak ||
        a.name.localeCompare(b.name)
    );

  const classRank =
    classmates.findIndex(student => student.id === ranked.student.id) + 1;

  return (
    <div
      ref={certificateRef}
      data-certificate-preview
      className="rank-certificate"
    >
      <div className="rank-certificate__paper">
        <span
          className="rank-certificate__corner rank-certificate__corner--tl"
          aria-hidden="true"
        />
        <span
          className="rank-certificate__corner rank-certificate__corner--br"
          aria-hidden="true"
        />

        <div className="rank-certificate__content">
          <p className="rank-certificate__portal">
            FLN PORTAL · FOUNDATIONAL LITERACY &amp; NUMERACY
          </p>

          <p className="rank-certificate__title">
            <span className="rank-certificate__title-main">
              Certificate
            </span>
            <span className="rank-certificate__title-sub">
              Weekly Recognition
            </span>
          </p>

          <p className="rank-certificate__awarded">
            This Certificate is Awarded to :
          </p>

          <p className="rank-certificate__name">
            {ranked.student.name}
          </p>

          <div className="rank-certificate__divider" />

          <p className="rank-certificate__achievement">
            In recognition of consistent learning progress during {month}
          </p>

          <div className="rank-certificate__facts">
            <span>
              Class
              <b>
                {ranked.student.classGroup} {ranked.student.section}
              </b>
            </span>

            <span>
              Class comparison
              <b>
                #{classRank} of {classmates.length}
              </b>
            </span>

            <span>
              Level
              <b>
                L{ranked.student.currentLevel}.
                {ranked.student.currentSubLevel ?? 0}
              </b>
            </span>
          </div>

          <div className="rank-certificate__bottom">
            <div className="rank-certificate__signatures">
              <div>
                <strong>{issuedDate}</strong>
                <span>Date</span>
              </div>
            </div>

            <div
              className="rank-certificate__medal"
              aria-label={`${ordinal(ranked.rank)} rank`}
            >
              <svg
                className="rank-certificate__medal-ribbon"
                viewBox="0 0 287 190"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M220.027 0H143.341H66.6835L0 147.997L66.6549 122.761L91.8911 189.416L143.341 75.1915L194.791 189.416L220.027 122.761L286.682 147.997L220.027 0Z"
                  fill="#2298FF"
                />
              </svg>

              <span
                className="rank-certificate__medal-ring-outer"
                aria-hidden="true"
              />

              <span
                className="rank-certificate__medal-ring-inner"
                aria-hidden="true"
              />

              <span className="rank-certificate__medal-circle">
                <span>{ranked.rank}</span>
              </span>
            </div>

            <div className="rank-certificate__signatures">
              <div>
                <strong>{teacherName}</strong>
                <span>Teacher</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CertificatesPanel: React.FC<{
  students: Student[];
  currentUser: User;
  variant?: 'all' | 'individual' | 'ranked';
  rankingLimit?: number;
  rankingTitle?: string;
}> = ({ students, currentUser, variant = 'all', rankingLimit = 5, rankingTitle }) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [rankCertificate, setRankCertificate] =
    useState<RankedStudent | null>(null);
  const [certificateRecords, setCertificateRecords] = useState<CertificateRecord[]>([]);
  const [certificateConcepts, setCertificateConcepts] = useState<CertificateConcept[]>([]);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const { t } = useTranslation();

  const certificatePreviewRef =
    useRef<HTMLDivElement>(null);

  const rankCertificatePreviewRef =
    useRef<HTMLDivElement>(null);

  const canIssueCertificates = [
    UserRole.TEACHER,
    UserRole.VOLUNTEER,
  ].includes(currentUser.role);

  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const selectedStudent =
    students.find(student => student.id === selectedStudentId) ??
    students[0];
  const selectedClassNumber = selectedStudent
    ? getCertificationClassNumber(selectedStudent.classGroup)
    : null;

  useEffect(() => {
    if (variant === 'ranked' || !selectedStudent || selectedClassNumber === null) {
      setCertificateRecords([]);
      setCertificateConcepts([]);
      setCertificateLoading(false);
      setCertificateError(null);
      return;
    }

    let cancelled = false;
    setCertificateLoading(true);
    setCertificateError(null);
    setCertificateRecords([]);
    setCertificateConcepts([]);

    Promise.all([
      apiFetch(`/api/certifications?studentId=${encodeURIComponent(selectedStudent.id)}`),
      apiFetch(`/api/certification/concepts?classNumber=${selectedClassNumber}`),
    ])
      .then(async ([recordsResponse, conceptsResponse]) => {
        if (!recordsResponse.ok) throw new Error(`Certifications request failed (${recordsResponse.status}).`);
        if (!conceptsResponse.ok) throw new Error(`Curriculum request failed (${conceptsResponse.status}).`);
        const [records, concepts] = await Promise.all([
          recordsResponse.json() as Promise<CertificateRecord[]>,
          conceptsResponse.json() as Promise<CertificateConcept[]>,
        ]);
        if (cancelled) return;
        setCertificateRecords(Array.isArray(records) ? records : []);
        setCertificateConcepts(Array.isArray(concepts) ? concepts : []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCertificateError(error instanceof Error ? error.message : 'Unable to load certificate data.');
      })
      .finally(() => {
        if (!cancelled) setCertificateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.id, selectedClassNumber, variant]);

  const selectedCertification = useMemo(() => {
    if (selectedClassNumber === null) return null;
    return certificateRecords
      .filter(record => record.classNumber === selectedClassNumber)
      .sort((a, b) => {
        const aDate = Date.parse(a.issuedAt ?? a.updatedAt ?? a.createdAt ?? '');
        const bDate = Date.parse(b.issuedAt ?? b.updatedAt ?? b.createdAt ?? '');
        return bDate - aDate;
      })[0] ?? null;
  }, [certificateRecords, selectedClassNumber]);

  const certificateView = useMemo(
    () => selectedCertification
      ? buildCertificateView(selectedCertification, certificateConcepts)
      : null,
    [selectedCertification, certificateConcepts]
  );

  if (!canIssueCertificates) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Award className="h-8 w-8 mb-3 text-slate-400" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Certificate issuing is not available for this role.
        </p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400 dark:text-slate-500">
        <Award className="h-8 w-8 mb-3" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          No students available.
        </p>
        <p className="text-xs mt-1">
          Register a student before issuing certificates.
        </p>
      </div>
    );
  }

  const filteredStudents = students.filter(student =>
    student.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase()) ||
    student.id
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const isClassOne =
    /^class\s*1(?:\D|$)/i.test(
      selectedStudent.classGroup.trim()
    );

  const isClassTwo =
    /^class\s*2(?:\D|$)/i.test(
      selectedStudent.classGroup.trim()
    );

  const topStudents = [...students]
    .sort(
      (a, b) =>
        b.currentLevel - a.currentLevel ||
        b.streak - a.streak ||
        a.name.localeCompare(b.name)
    )
    .slice(0, rankingLimit)
    .map((student, index) => ({
      student,
      rank: index + 1,
    }));

  const handlePrintCertificate = async () => {
    if (!certificatePreviewRef.current) return;

    try {
      await printCertificate(certificatePreviewRef.current, 'skill');
    } catch (error) {
      console.error(error);
      alert(
        'The certificate could not be printed. Please try again.'
      );
    }
  };

  const printRankCertificate = async () => {
    if (
      !rankCertificate ||
      !rankCertificatePreviewRef.current
    ) {
      return;
    }

    try {
      await printCertificate(
        rankCertificatePreviewRef.current
      );
    } catch (error) {
      console.error(error);
      alert(
        'The certificate could not be printed. Please try again.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {variant === 'all' && <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Certificates
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Issue achievement certificates using the current student
          records.
        </p>
      </div>}

      {/* Student selector */}
      {variant === 'all' && <div className="relative max-w-xl">
        <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Student
        </label>

        <button
          type="button"
          onClick={() => setShowDropdown(value => !value)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <span>{selectedStudent.name}</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-200 px-3 dark:border-slate-700">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={event =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search students..."
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filteredStudents.map(student => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(student.id);
                    setShowDropdown(false);
                    setSearchQuery('');
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-semibold">
                    {student.name}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {student.classGroup} · {student.section}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>}

      {/* Skill-based certificate */}
      {variant !== 'ranked' && (
        <section className="max-w-6xl space-y-4" aria-live="polite">
          {certificateLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent align-middle" />
              {t('certificate.skill.loading')}
            </div>
          ) : certificateError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {t('certificate.skill.error')} {certificateError}
            </div>
          ) : !selectedCertification || !certificateView ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <h3 className="font-bold">{t('certificate.skill.noRecord')}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('certificate.skill.noRecordDescription')}
              </p>
            </div>
          ) : selectedCertification.decisionSnapshot?.outcome === 'incomplete' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
              <h3 className="font-bold text-amber-900 dark:text-amber-200">{t('certificate.skill.incompleteTitle')}</h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                {t('certificate.skill.incompleteMessage')}
              </p>
              {certificateView.notYetAssessed.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {certificateView.notYetAssessed.map(id => {
                    const concept = certificateConcepts.find(item => item.id === id);
                    return (
                      <li key={id} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200">
                        {concept?.title || id}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">{t('certificate.skill.notYetAssessed')}</p>
              )}
            </div>
          ) : selectedCertification.status !== 'active' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {t('certificate.skill.notActive')}
            </div>
          ) : !certificateView.canPrint ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <h3 className="font-bold">{t('certificate.skill.legacyTitle')}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('certificate.skill.legacyRecord')}
              </p>
            </div>
          ) : (
            <>
              <SkillCertificate
                student={selectedStudent}
                teacherName={currentUser.name}
                view={certificateView}
                isClassOne={isClassOne}
                isClassTwo={isClassTwo}
                certificateRef={certificatePreviewRef}
              />
              <div className="flex justify-end">
                <button
                  onClick={() => void handlePrintCertificate()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                  <Printer className="h-4 w-4" />
                  {t('certificate.skill.print')}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Ranked students */}
      {variant !== 'individual' && <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {rankingTitle ?? `Weekly Recognition`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Recognition is based on current level, learning streak, and name.
          </p>
        </div>

        <div className="space-y-2">
          {topStudents.map(({ student, rank }) => (
            <div
              key={student.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-700">
                  {rank}
                </span>

                <div>
                  <p className="text-sm font-semibold">
                    {student.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {student.classGroup} · {student.section}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold">
                  L{student.currentLevel}
                </span>

                <button
                  onClick={() =>
                    setRankCertificate({
                      student,
                      rank,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Award className="h-3.5 w-3.5" />
                  Certificate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* Rank certificate modal */}
      {rankCertificate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-4 sm:p-8">
          <div className="w-full max-w-6xl">
            <div className="mb-3 flex items-center justify-between gap-3 text-white">
              <div>
                <p className="text-sm font-bold">
                  Weekly Recognition
                </p>
                <p className="text-xs text-slate-300">
                  {rankCertificate.student.name} ·{' '}
                  {ordinal(rankCertificate.rank)} rank
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    void printRankCertificate()
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  <Printer className="h-4 w-4" />
                  Print Certificate
                </button>

                <button
                  onClick={() => setRankCertificate(null)}
                  className="rounded-lg border border-white/35 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>

            <RankCertificate
              ranked={rankCertificate}
              teacherName={currentUser.name}
              allStudents={students}
              certificateRef={rankCertificatePreviewRef}
            />
          </div>
        </div>
      )}
    </div>
  );
};
