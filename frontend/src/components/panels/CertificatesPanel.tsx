import React, { useEffect, useRef, useState } from 'react';
import { Award, Printer, Search, ChevronDown } from 'lucide-react';
import { Student, User, UserRole } from '../../types';

type RankedStudent = {
  student: Student;
  rank: number;
  issuedAt?: string;
};

const ordinal = (rank: number) => {
  const endings = ['th', 'st', 'nd', 'rd'];
  const remainder = rank % 100;
  return `${rank}${endings[(remainder - 20) % 10] || endings[remainder] || endings[0]}`;
};

const printCertificate = async (certificate?: HTMLDivElement | null) => {
  if (!certificate) return;

  await document.fonts?.ready;

  const originalParent = certificate.parentNode;
  const originalNextSibling = certificate.nextSibling;

  document.body.appendChild(certificate);

  const cleanup = () => {
    document.body.classList.remove('printing-certificate');
    document.body.classList.remove('printing-normal-certificate');

    if (originalParent) {
      originalParent.insertBefore(
        certificate,
        originalNextSibling ?? null
      );
    }
  };

  document.body.classList.add('printing-certificate');
  document.body.classList.add('printing-normal-certificate');

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

  const weekOfMonth = Math.ceil(issuedAt.getDate() / 7);
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
              of Appreciation
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
            For earning a top class rank as of {ordinal(weekOfMonth)} week of {month}
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

  const selectedStudent =
    students.find(student => student.id === selectedStudentId) ??
    students[0];

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
      await printCertificate(certificatePreviewRef.current);
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

      {/* Normal certificate */}
      {variant !== 'ranked' && <div className="max-w-4xl">
        <div
          ref={certificatePreviewRef}
          data-certificate-preview
          className={`aspect-[297/210] overflow-hidden rounded-2xl border-4 shadow-lg ${
            isClassOne
              ? 'border-orange-400 bg-white'
              : isClassTwo
                ? 'border-[#0D99FF] bg-[#CFE9FB] p-2'
                : 'border-amber-300 bg-[#fffdf8]'
          }`}
        >
          <div
            className={
              isClassTwo
                ? ''
                : `h-3 ${
                    isClassOne
                      ? 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-300'
                      : 'bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300'
                  }`
            }
          />

          <div
            className={`relative px-6 py-10 text-center sm:px-12 ${
              isClassTwo
                ? 'h-full rounded-xl border-2 border-[#0D99FF]'
                : ''
            }`}
          >
            {isClassOne ? (
              <>
                <div className="absolute left-4 top-3 text-6xl text-amber-400">
                  ☀
                </div>
                <div className="absolute left-4 top-20 -rotate-12 text-[10px] font-black text-cyan-500">
                  FANTASTIC!
                </div>
                <div className="absolute right-5 top-7 rotate-12 rounded-t-full border-8 border-b-0 border-orange-500 bg-cyan-400 px-3 py-2 text-sm font-black text-white">
                  Brilliant!
                </div>
                <div className="absolute bottom-5 left-7 text-3xl text-amber-400">
                  ★ ✦
                </div>
                <div className="absolute bottom-4 right-8 text-4xl">
                  🏆
                </div>
              </>
            ) : isClassTwo ? (
              <>
                <div className="certificate-star absolute left-3 top-2 text-3xl">
                  ★
                </div>
                <div className="certificate-star absolute left-9 top-9 text-base">
                  ★
                </div>
                <div className="certificate-star absolute left-14 top-6 text-xs">
                  ★
                </div>
                <div className="certificate-star absolute right-4 top-2 text-3xl">
                  ★
                </div>
                <div className="certificate-star absolute bottom-3 left-6 text-base">
                  ★
                </div>
              </>
            ) : (
              <>
                <div className="absolute left-5 top-5 text-4xl text-amber-400">
                  ★
                </div>
                <div className="absolute right-6 top-7 text-4xl text-teal-500">
                  ✦
                </div>
                <div className="absolute bottom-5 left-8 text-3xl text-orange-400">
                  ✶
                </div>
                <div className="absolute bottom-5 right-8 text-3xl text-rose-500">
                  ✹
                </div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-orange-500 bg-amber-300 text-3xl text-white shadow-[0_0_0_5px_#fffdf8,0_0_0_8px_#14b8a6]">
                  ★
                </div>
              </>
            )}

            <p
              className={`mt-5 text-[10px] font-bold uppercase tracking-[0.25em] ${
                isClassTwo
                  ? 'text-[#0D99FF]'
                  : 'text-teal-700'
              }`}
            >
              FLN Portal · Foundational Literacy &amp; Numeracy
            </p>

            <h3
              className={`mt-3 text-3xl font-bold sm:text-4xl ${
                isClassTwo
                  ? 'font-script font-normal text-[#0D99FF] normal-case'
                  : `text-slate-900 ${
                      isClassOne
                        ? 'font-sans'
                        : 'font-serif'
                    }`
              }`}
            >
              Certificate of
            </h3>

            <p
              className={`mt-1 text-3xl sm:text-5xl ${
                isClassTwo
                  ? 'font-hand font-bold normal-case tracking-normal text-[#0D99FF] text-4xl sm:text-6xl'
                  : `font-black uppercase tracking-wider text-orange-500 ${
                      isClassOne ? 'font-sans' : ''
                    }`
              }`}
            >
              Excellence
            </p>

            <p
              className={`mt-7 text-base ${
                isClassTwo
                  ? 'text-[#0D99FF]'
                  : 'text-slate-600'
              }`}
            >
              This certificate is proudly presented to
            </p>

            <p
              className={`mx-auto mt-3 max-w-xl border-b-2 px-4 pb-2 text-2xl font-bold sm:text-4xl ${
                isClassTwo
                  ? 'border-[#0D99FF] text-[#1E1E1E]'
                  : 'border-slate-700 text-blue-700'
              }`}
            >
              {selectedStudent.name}
            </p>

            <p
              className={`mx-auto mt-6 max-w-2xl text-sm leading-6 ${
                isClassTwo
                  ? 'text-[#0D99FF]'
                  : 'text-slate-600'
              }`}
            >
              for dedication and progress in foundational literacy
              and numeracy.
            </p>

            <div className="mx-auto mt-7 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                [
                  'Class',
                  `${selectedStudent.classGroup} - ${selectedStudent.section}`,
                ],
                [
                  'Current Level',
                  `L${selectedStudent.currentLevel}.${selectedStudent.currentSubLevel ?? 0}`,
                ],
                [
                  'Learning Streak',
                  `${selectedStudent.streak} days`,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className={`rounded-xl border px-3 py-3 text-xs font-bold ${
                    isClassTwo
                      ? 'border-[#0D99FF] bg-white text-[#0D99FF]'
                      : 'border-cyan-200 bg-cyan-50 text-cyan-900'
                  }`}
                >
                  {label}
                  <span
                    className={`mt-1 block text-lg ${
                      isClassTwo
                        ? 'text-[#0D99FF]'
                        : 'text-teal-700'
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div
              className={`mx-auto mt-10 grid max-w-xl grid-cols-2 gap-10 text-xs ${
                isClassTwo
                  ? 'text-[#0D99FF]'
                  : 'text-slate-600'
              }`}
            >
              <div className="pt-2">
                <strong
                  className={`block ${
                    isClassTwo
                      ? 'text-[#1E1E1E]'
                      : 'text-slate-800'
                  }`}
                >
                  {new Date().toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
                Date issued
              </div>

              <div
                className={`border-t pt-2 ${
                  isClassTwo
                    ? 'border-[#0D99FF]'
                    : 'border-slate-600'
                }`}
              >
                <strong
                  className={`block ${
                    isClassTwo
                      ? 'text-[#1E1E1E]'
                      : 'text-slate-800'
                  }`}
                >
                  {currentUser.name}
                </strong>
                Teacher signature
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => void handlePrintCertificate()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" />
            Print Certificate
          </button>
        </div>
      </div>}

      {/* Ranked students */}
      {variant !== 'individual' && <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {rankingTitle ?? `Top ${rankingLimit} Students`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ranked using current level, learning streak, and name.
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
                  Top {rankingLimit} Rank Certificate
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
