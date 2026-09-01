/**
 * Misconception Fingerprinting — the "same score, different mind" dossier.
 *
 * The panel is built around one deliberate piece of staging. It opens showing
 * exactly what the platform shows today: two children, one score, one level,
 * two identical-looking cards. Only when the teacher asks for it does it reveal
 * the error signatures underneath. The point of the interaction is to make the
 * information that is currently being discarded feel like a loss.
 *
 * All analysis happens on the server (backend/src/misconceptionFingerprint.ts).
 * This component renders; it computes nothing.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Fingerprint, AlertTriangle, ChevronRight, RefreshCw, Sparkles, Eye, Shuffle } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

/* ---------- shapes mirrored from the backend module ---------- */

interface GlyphSpec {
  path: string;
  innerPath: string;
  hue: number;
  accentHue: number;
  spikes: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  size: number;
  signatureHash: string;
}

interface ErrorInstance {
  questionId: string;
  prompt: string;
  expected: string;
  submitted: string;
  morphology: string;
  topic: string;
  sourceLevel: number;
  difficulty: string;
  requiredRegrouping: boolean;
  multiDigit: boolean;
}

interface Fingerprint {
  studentId: string;
  studentName: string;
  classGroup: string;
  currentLevel: number;
  score: number;
  totalAnswered: number;
  totalIncorrect: number;
  vector: Record<string, number>;
  signature: Array<{ key: string; label: string; value: number }>;
  weakness: {
    weakestLevel: number | null;
    levelsFailed: number[];
    topics: Array<{ topic: string; wrong: number; attempted: number; rate: number }>;
  };
  errors: ErrorInstance[];
  clusterId?: number;
  clusterDistance?: number;
  mixedProfile?: boolean;
  secondaryClusterId?: number;
  secondaryDistance?: number;
  insufficientEvidence?: boolean;
  evidenceReason?: string;
  glyph: GlyphSpec;
}

interface Archetype {
  clusterId: number;
  slug: string;
  stableName: string;
  name: string;
  description: string;
  forwardRisk: string;
  teacherAction: string;
  memberCount: number;
  memberIds: string[];
  distinctiveFeatures: Array<{ key: string; label: string; value: number; lift: number }>;
  namedByFallback: boolean;
  incoherent: boolean;
}

interface ComparePayload {
  left: { fingerprint: Fingerprint; archetype: Archetype | null };
  right: { fingerprint: Fingerprint; archetype: Archetype | null };
  sameScore: boolean;
  sameLevel: boolean;
  totalCollisions: number;
  cohortSize: number;
  archetypeCount: number;
  usedFallbackNaming: boolean;
}

interface CohortPayload {
  archetypes: Archetype[];
  fingerprints: Fingerprint[];
  analysedCount: number;
  clusteredCount: number;
  studentCount: number;
  noErrorCount: number;
  noSubmissionCount: number;
  silhouette: number;
  lowSeparation: boolean;
  weaknessByTopic: Array<{ topic: string; childrenWeak: number; childrenAttempted: number; studentIds: string[] }>;
  weaknessByLevel: Array<{ level: number; childrenWeak: number; studentIds: string[] }>;
  unclassifiedCount: number;
  unclassifiedRate: number;
  residue: Array<{ questionId: string; prompt: string; expected: string; submitted: string; count: number }>;
  collisions: Array<{ a: string; b: string; score: number; level: number }>;
}

interface ResiduePayload {
  unclassifiedCount: number;
  unclassifiedRate: number;
  residue: CohortPayload['residue'];
  proposals: Array<{ name: string; description: string; examples: string[]; affectedAnswers: number }>;
}

interface Props {
  token: string;
  classGroup?: string;
}

const MORPHOLOGY_LABELS: Record<string, string> = {
  offByOne: 'off by one',
  placeValueTenfold: 'place value',
  digitConcatenation: 'no regrouping',
  digitReversal: 'digits reversed',
  digitPermutation: 'digits scrambled',
  operationSubstitution: 'wrong operation',
  nearMiss: 'near miss',
  grossMagnitude: 'wrong magnitude',
  omission: 'left blank'
};

/* ---------- the glyph ---------- */

/**
 * The signature made visible.
 *
 * Two children on the same score produce two different shapes here, which is
 * the entire argument of the feature compressed into one image. It is not a
 * chart — there are no axes and no scale — it is an identifier you can
 * recognise across a class set at a glance.
 */
const Glyph: React.FC<{ glyph: GlyphSpec; size?: number; animate?: boolean }> = ({
  glyph,
  size = 190,
  animate = true
}) => {
  const gid = `glyph-${glyph.signatureHash}`;
  return (
    <svg
      viewBox={`0 0 ${glyph.size} ${glyph.size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`Error signature ${glyph.signatureHash}`}
      className="drop-shadow-sm"
    >
      <defs>
        <radialGradient id={gid} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor={`hsl(${glyph.accentHue} 85% 72%)`} stopOpacity="0.95" />
          <stop offset="60%" stopColor={`hsl(${glyph.hue} 72% 55%)`} stopOpacity="0.85" />
          <stop offset="100%" stopColor={`hsl(${glyph.hue} 65% 38%)`} stopOpacity="0.75" />
        </radialGradient>
      </defs>

      {/* faint reference ring so different sizes stay comparable */}
      <circle
        cx={glyph.size / 2}
        cy={glyph.size / 2}
        r={34}
        fill="none"
        stroke={`hsl(${glyph.hue} 40% 60%)`}
        strokeOpacity="0.25"
        strokeDasharray="2 4"
      />

      <path d={glyph.path} fill={`url(#${gid})`} stroke={`hsl(${glyph.hue} 70% 40%)`} strokeWidth="1.5">
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${glyph.size / 2} ${glyph.size / 2}`}
            to={`360 ${glyph.size / 2} ${glyph.size / 2}`}
            dur="60s"
            repeatCount="indefinite"
          />
        )}
      </path>

      <path
        d={glyph.innerPath}
        fill={`hsl(${glyph.accentHue} 80% 92%)`}
        fillOpacity="0.55"
        stroke={`hsl(${glyph.accentHue} 70% 45%)`}
        strokeWidth="1"
      />

      {glyph.spikes.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={`hsl(${glyph.accentHue} 85% 45%)`}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};

/* ---------- dossier ---------- */

const Dossier: React.FC<{
  data: { fingerprint: Fingerprint; archetype: Archetype | null };
  revealed: boolean;
  accent: string;
  /** Every archetype in the cohort, so a mixed child's runner-up can be named. */
  archetypes?: Archetype[];
}> = ({ data, revealed, accent, archetypes = [] }) => {
  const { fingerprint: fp, archetype } = data;
  const secondary =
    fp.mixedProfile && fp.secondaryClusterId !== undefined
      ? archetypes.find(a => a.clusterId === fp.secondaryClusterId) ?? null
      : null;

  return (
    <div
      className={`flex-1 rounded-xl border bg-white shadow-sm transition-all duration-500 dark:bg-slate-900 ${
        revealed ? `${accent}` : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Identity block — identical for both children by construction */}
      <div className="border-b border-slate-100 p-5 dark:border-slate-700">
        <h3 className="font-sans text-lg font-bold text-slate-900 dark:text-white">{fp.studentName}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {fp.classGroup} · Student {fp.studentId}
        </p>
        <div className="mt-4 flex gap-6">
          <div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{fp.score}%</div>
            <div className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Score
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{fp.currentLevel}</div>
            <div className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Level
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {fp.totalIncorrect}/{fp.totalAnswered}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Wrong
            </div>
          </div>
        </div>
      </div>

      {!revealed ? (
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="h-[190px] w-[190px] animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
            Everything the platform currently records about this child is above this line.
          </p>
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <div className="flex flex-col items-center">
            <Glyph glyph={fp.glyph} />
            <code className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              signature {fp.glyph.signatureHash}
            </code>
          </div>

          {archetype && (
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Discovered archetype
                </span>
              </div>
              <h4 className="mt-1 font-sans text-xl font-bold text-slate-900 dark:text-white">
                {archetype.name}
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{archetype.description}</p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {archetype.memberCount} of this class share this signature.
              </p>
              {fp.mixedProfile && (
                <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <span className="font-semibold">Mixed profile.</span> This child fails in two
                  different ways at once
                  {secondary ? (
                    <>
                      {' '}— the other resembles <span className="font-semibold">{secondary.name}</span>
                    </>
                  ) : null}
                  , so one label does not cover them. Both patterns are listed below.
                </p>
              )}
            </div>
          )}

          {/* This child's own numbers — not the group average */}
          <div>
            <div className="mb-2 text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {fp.studentName.split(' ')[0]}'s own error signature
            </div>
            <div className="space-y-1.5">
              {fp.signature.slice(0, 4).map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, f.value * 100)}%`,
                        backgroundColor: `hsl(${fp.glyph.hue} 70% 55%)`
                      }}
                    />
                  </div>
                  <span className="w-[52%] shrink-0 text-[11px] text-slate-600 dark:text-slate-300">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {archetype?.forwardRisk && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/40">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    What breaks later
                  </div>
                  <p className="mt-0.5 text-xs text-amber-900 dark:text-amber-200">{archetype.forwardRisk}</p>
                </div>
              </div>
            </div>
          )}

          {archetype?.teacherAction && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/40">
              <div className="text-[10px] font-mono uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Monday morning
              </div>
              <p className="mt-0.5 text-xs text-emerald-900 dark:text-emerald-200">{archetype.teacherAction}</p>
            </div>
          )}

          {/* The raw evidence, so nothing here is a black box */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              Evidence — every wrong answer ({fp.errors.length})
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Question</th>
                    <th className="py-1 pr-2 font-medium">Wrote</th>
                    <th className="py-1 pr-2 font-medium">Correct</th>
                    <th className="py-1 font-medium">Pattern</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {fp.errors.map(e => (
                    <tr key={e.questionId} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1 pr-2 font-mono">{e.prompt.replace('What is ', '').replace('?', '')}</td>
                      <td className="py-1 pr-2 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {e.submitted === '' ? '—' : e.submitted}
                      </td>
                      <td className="py-1 pr-2 font-mono text-slate-400">{e.expected}</td>
                      <td className="py-1">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `hsl(${fp.glyph.hue} 60% 92%)`,
                            color: `hsl(${fp.glyph.hue} 70% 30%)`
                          }}
                        >
                          {MORPHOLOGY_LABELS[e.morphology] ?? e.morphology}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

/* ---------- single-child panel, for the marking screens ---------- */

/**
 * How this one child fails, shown where a teacher finishes marking.
 *
 * The marking screen already answers "what level" — that is the pipeline's
 * report. It has never answered "and how does this child go wrong", even though
 * the same submission contains it. This is that second half, and the point of
 * showing it here rather than only on the Misconceptions page is that a teacher
 * is looking at exactly this child at exactly this moment.
 *
 * Fetched after the report renders rather than blocking it: the cohort analysis
 * takes a few seconds, and the placement must never wait on an analysis layer.
 * Degrades to a plain sentence when the child has too few mistakes to read, or
 * when they are the first in the class to be assessed and no cohort exists yet.
 */
export const ChildErrorSignature: React.FC<{ studentId: string; token: string }> = ({
  studentId,
  token
}) => {
  const [data, setData] = useState<{ fingerprint: Fingerprint; archetype: Archetype | null } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/misconceptions/fingerprint/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;
        if (!res.ok) {
          setState('none');
          return;
        }
        const payload = await res.json();
        setData(payload);
        setState('ready');
      } catch {
        if (!cancelled) setState('none');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, token]);

  if (state === 'loading') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
        Reading how this child failed…
      </div>
    );
  }

  if (state === 'none' || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h4 className="text-xs font-mono font-bold uppercase text-slate-400 dark:text-slate-500">
          How this child failed
        </h4>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Not enough wrong answers yet to see a pattern. One or two mistakes cannot tell a habit from
          an accident — this fills in as the child sits more work.
        </p>
      </div>
    );
  }

  const fp = data.fingerprint;
  const archetype = data.archetype;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h4 className="text-xs font-mono font-bold uppercase text-slate-400 dark:text-slate-500">
        How this child failed
      </h4>

      <div className="mt-3 flex flex-wrap items-start gap-5">
        <Glyph glyph={fp.glyph} size={110} animate={false} />

        <div className="min-w-[240px] flex-1">
          {archetype ? (
            <>
              <p className="font-sans text-base font-bold text-slate-900 dark:text-white">
                {archetype.name}
              </p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {archetype.description}
              </p>
              <p className="mt-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                {archetype.memberCount > 1
                  ? `${archetype.memberCount - 1} other ${
                      archetype.memberCount - 1 === 1 ? 'child' : 'children'
                    } in this class fail the same way.`
                  : 'No one else in this class fails this way yet.'}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This child has a readable error pattern, but the class does not yet have enough
              assessed children to group them against.
            </p>
          )}

          {fp.weakness.weakestLevel !== null && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              First breaks at <span className="font-semibold">Level {fp.weakness.weakestLevel}</span>
              {fp.weakness.topics.length > 0 && (
                <> · weakest in {fp.weakness.topics[0].topic}</>
              )}
            </p>
          )}

          <div className="mt-3 space-y-1">
            {fp.signature.slice(0, 3).map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, f.value * 100)}%`,
                      backgroundColor: `hsl(${fp.glyph.hue} 70% 55%)`
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {archetype?.teacherAction && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <span className="font-semibold">For this pattern:</span> {archetype.teacherAction}
        </p>
      )}
    </div>
  );
};

/* ---------- panel ---------- */

/** The classes the platform assesses. Archetypes never span them. */
const CLASS_GROUPS = ['Class 2', 'Class 3', 'Class 4'];

const MisconceptionFingerprint: React.FC<Props> = ({ token, classGroup: fixedClassGroup }) => {
  // Selectable rather than fixed. The board used to default to a hard-coded
  // class with no control to leave it, so archetypes belonging to any other
  // class were unreachable however many the analysis had found.
  const [selectedClass, setSelectedClass] = useState(fixedClassGroup ?? CLASS_GROUPS[0]);
  const classGroup = fixedClassGroup ?? selectedClass;
  const [compare, setCompare] = useState<ComparePayload | null>(null);
  const [cohort, setCohort] = useState<CohortPayload | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** No two children share a score across archetypes — an absence, not a fault. */
  const [noCollision, setNoCollision] = useState(false);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [residue, setResidue] = useState<ResiduePayload | null>(null);
  const [residueLoading, setResidueLoading] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(
    async (a?: string, b?: string) => {
      setLoading(true);
      setError('');
      setNoCollision(false);
      try {
        const qs = new URLSearchParams({ classGroup });
        if (a && b) {
          qs.set('a', a);
          qs.set('b', b);
        }
        const [cmpRes, cohortRes] = await Promise.all([
          apiFetch(`/api/misconceptions/compare?${qs.toString()}`, { headers }),
          apiFetch(`/api/misconceptions/cohort?classGroup=${encodeURIComponent(classGroup)}`, { headers })
        ]);

        if (!cmpRes.ok) {
          const text = await cmpRes.text();
          let msg = `Comparison unavailable (HTTP ${cmpRes.status}).`;
          let reason = '';
          try {
            const parsed = JSON.parse(text);
            if (parsed.error) msg = parsed.error;
            if (parsed.reason) reason = parsed.reason;
          } catch {
            /* non-JSON error page: keep the status-based message */
          }
          // The side-by-side comparison needs two children on the same score in
          // different archetypes. Having no such pair is an ordinary property of
          // a cohort — guaranteed, in fact, whenever no archetypes were found —
          // so it is an absent optional panel, not a failure to report in red.
          if (reason === 'NO_COLLISION') {
            setNoCollision(true);
          } else {
            setError(msg);
          }
          setCompare(null);
        } else {
          const payload: ComparePayload = await cmpRes.json();
          setCompare(payload);
          setLeftId(payload.left.fingerprint.studentId);
          setRightId(payload.right.fingerprint.studentId);
        }

        if (cohortRes.ok) setCohort(await cohortRes.json());
      } catch (e: any) {
        setError(e?.message || 'Failed to reach the misconception service.');
      } finally {
        setLoading(false);
      }
    },
    [classGroup, headers]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Children without a clusterable signature are shown separately rather than
  // offered for comparison — there is nothing to compare them on.
  const roster = useMemo(
    () => (cohort?.fingerprints ?? []).filter(f => !f.insufficientEvidence),
    [cohort]
  );
  const thinEvidence = useMemo(
    () => (cohort?.fingerprints ?? []).filter(f => f.insufficientEvidence),
    [cohort]
  );

  const applyPair = (a: string, b: string) => {
    setRevealed(false);
    load(a, b);
  };

  const inspectResidue = useCallback(async () => {
    setResidueLoading(true);
    try {
      const res = await apiFetch(
        `/api/misconceptions/residue?classGroup=${encodeURIComponent(classGroup)}`,
        { headers }
      );
      if (res.ok) setResidue(await res.json());
    } catch {
      /* the panel is diagnostic; a failure here must not disturb the dossier */
    } finally {
      setResidueLoading(false);
    }
  }, [classGroup, headers]);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Fingerprint className="mt-0.5 h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="font-sans text-lg font-bold text-slate-900 dark:text-white">
                Misconception Fingerprinting
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Children clustered by <span className="font-semibold">how</span> they fail, never by how
                much. Archetypes are discovered from this cohort's own errors — nothing here comes from a
                predefined list.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!fixedClassGroup && (
              <select
                value={selectedClass}
                onChange={e => {
                  // A different class is a different cohort: drop the pair being
                  // compared so the next load picks its own, rather than asking
                  // for two children who are not in it.
                  setLeftId('');
                  setRightId('');
                  setRevealed(false);
                  setSelectedClass(e.target.value);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                aria-label="Class"
              >
                {CLASS_GROUPS.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <button
            onClick={() => {
              setRevealed(false);
              load(leftId || undefined, rightId || undefined);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-analyse
            </button>
          </div>
        </div>

        {compare && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Children analysed', value: compare.cohortSize },
              { label: 'Archetypes found', value: compare.archetypeCount },
              { label: 'Score collisions', value: compare.totalCollisions },
              { label: 'Naming', value: compare.usedFallbackNaming ? 'Offline' : 'AI' }
            ].map(s => (
              <div
                key={s.label}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50"
              >
                <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{s.value}</div>
                <div className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/*
        A cohort with nothing to analyse is the normal state of a real class, not
        an error: children who answered everything correctly leave no failure
        signature. Say which it is, rather than surfacing the comparison's 404.
      */}
      {cohort && cohort.analysedCount === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-sans text-base font-bold text-slate-900 dark:text-white">
            Nothing to fingerprint in {classGroup} yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            This analysis reads wrong answers. {cohort.studentCount}{' '}
            {cohort.studentCount === 1 ? 'child is' : 'children are'} in this cohort:{' '}
            {cohort.noSubmissionCount > 0 && (
              <>
                <span className="font-medium">{cohort.noSubmissionCount}</span> have no marked
                submission yet
                {cohort.noErrorCount > 0 ? ', and ' : '.'}
              </>
            )}
            {cohort.noErrorCount > 0 && (
              <>
                <span className="font-medium">{cohort.noErrorCount}</span> answered everything
                correctly, so there is no failure to characterise.
              </>
            )}
          </p>
        </div>
      ) : (
        error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        )
      )}

      {noCollision && cohort && cohort.analysedCount > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No side-by-side comparison for {classGroup}: it needs two children on the same score who
          fail in different ways, and this cohort has no such pair. Everything below is unaffected.
        </div>
      )}

      {loading && !compare && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Building error signatures for this cohort…
        </div>
      )}

      {compare && (
        <>
          {/* the claim, stated before it is shown */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800/60 dark:bg-indigo-950/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  {compare.sameScore && compare.sameLevel
                    ? `Both children scored ${compare.left.fingerprint.score}% and both sit at Level ${compare.left.fingerprint.currentLevel}.`
                    : 'Comparing two children from this cohort.'}
                </p>
                <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                  {revealed
                    ? 'They do not have the same problem.'
                    : 'Today the platform treats them as the same child. They are not.'}
                </p>
              </div>
              {!revealed && (
                <button
                  onClick={() => setRevealed(true)}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                  <Eye className="h-4 w-4" />
                  Reveal the difference
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row">
            <Dossier
              data={compare.left}
              revealed={revealed}
              accent="border-indigo-300 dark:border-indigo-700"
              archetypes={cohort?.archetypes}
            />
            <Dossier
              data={compare.right}
              revealed={revealed}
              accent="border-teal-300 dark:border-teal-700"
              archetypes={cohort?.archetypes}
            />
          </div>

          {/* pair picker */}
          {roster.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Compare any two children
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {[
                  { value: leftId, set: setLeftId, label: 'Left' },
                  { value: rightId, set: setRightId, label: 'Right' }
                ].map(sel => (
                  <label key={sel.label} className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{sel.label}</span>
                    <select
                      value={sel.value}
                      onChange={e => sel.set(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {roster.map(f => (
                        <option key={f.studentId} value={f.studentId}>
                          {f.studentName} — {f.score}%
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button
                  onClick={() => applyPair(leftId, rightId)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  Compare
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/*
        Everything below is cohort-driven and deliberately OUTSIDE the comparison
        block. The two-child comparison needs a score collision to exist; the
        teaching groups do not, and a class with no collision must still show a
        teacher who is weak where rather than an empty page.
      */}

      {/* the teaching lists — who to sit together */}
      {cohort && cohort.archetypes.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm dark:border-indigo-800/50 dark:bg-indigo-950/20">
          <h3 className="font-sans text-base font-bold text-slate-900 dark:text-white">
            Teaching groups — {classGroup}
          </h3>
          <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
            Children who fail the same way, listed so they can be taught together. Each group has a
            fixed code that does not change between runs, even when the descriptive name does.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {cohort.archetypes.map(a => {
              const members = a.memberIds
                .map(id => cohort.fingerprints.find(f => f.studentId === id))
                .filter((f): f is Fingerprint => Boolean(f));
              const levels = members
                .map(m => m.weakness.weakestLevel)
                .filter((l): l is number => l !== null);
              const startAt = levels.length > 0 ? Math.min(...levels) : null;
              return (
                <div
                  key={a.clusterId}
                  className={`rounded-lg border bg-white p-4 dark:bg-slate-900 ${
                    a.incoherent
                      ? 'border-sky-300 dark:border-sky-800/60'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4 className="font-sans text-sm font-bold text-slate-900 dark:text-white">
                      {a.name}
                    </h4>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {a.slug}
                    </code>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {a.memberCount} {a.memberCount === 1 ? 'child' : 'children'}
                      {startAt !== null && <> · start at Level {startAt}</>}
                    </span>
                  </div>

                  {a.incoherent && (
                    <p className="mt-1 text-[11px] font-medium text-sky-800 dark:text-sky-300">
                      Not a misconception — do not reteach the topic to this group.
                    </p>
                  )}

                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {members.map(m => (
                      <li
                        key={m.studentId}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {m.studentName}
                        <span className="ml-1 text-slate-400">{m.score}%</span>
                      </li>
                    ))}
                  </ul>

                  {a.teacherAction && (
                    <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      <span className="font-semibold">Teach together:</span> {a.teacherAction}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* every archetype this cohort produced */}
          {cohort && cohort.archetypes.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="font-sans text-base font-bold text-slate-900 dark:text-white">
                Archetypes discovered in {classGroup}
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                These groups were not defined in advance. The cohort was clustered on its error
                signatures and {cohort.archetypes.length} distinct ways of failing came out.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {cohort.archetypes.map(a => {
                  const member = cohort.fingerprints.find(f => f.clusterId === a.clusterId);
                  return (
                    <div
                      key={a.clusterId}
                      className={`flex gap-3 rounded-lg border p-4 ${
                        a.incoherent
                          ? 'border-sky-200 bg-sky-50/60 dark:border-sky-800/60 dark:bg-sky-950/30'
                          : 'border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      {member && <Glyph glyph={member.glyph} size={72} animate={false} />}
                      <div className="min-w-0">
                        <h4 className="font-sans text-sm font-bold text-slate-900 dark:text-white">
                          {a.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {a.memberCount} {a.memberCount === 1 ? 'child' : 'children'}
                        </p>
                        {a.incoherent && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
                            <Shuffle className="h-3 w-3" />
                            No stable pattern — not a misconception
                          </span>
                        )}
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{a.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {cohort.archetypes.some(a => a.incoherent) && (
                <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  The highlighted group is the one archetype named in advance rather than by the
                  model. Its finding is that there is <em>no</em> consistent mental model to name —
                  these children get equivalent questions right and wrong by turns — and a model
                  asked to explain that will invent a misconception instead of reporting its absence.
                </p>
              )}
            </div>
          )}

          {/* Honest reporting of how well the partition actually separated */}
          {cohort && cohort.lowSeparation && cohort.archetypes.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/40">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    These archetypes are weakly separated (silhouette {cohort.silhouette.toFixed(2)}).
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                    The clustering always returns groups, even when the cohort does not really
                    contain any. Treat the names below as a hypothesis to check against the
                    evidence, not as a finding.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/*
            Who is weak where.
            The two features fused into one row per child: the archetype answers
            HOW they fail, the level and topic answer WHERE — the second half
            coming from the same level mapping the Python pipeline applies.
          */}
          {cohort && roster.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="font-sans text-base font-bold text-slate-900 dark:text-white">
                Who is weak where — {classGroup}
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Every child who has been assessed, with the lowest level they got something wrong at
                and the topics they are failing. Start at the lowest level: a higher skill stands on
                the one beneath it.
              </p>

              {cohort.weaknessByLevel.length > 0 && (
                <div className="mb-5 flex flex-wrap gap-2">
                  {cohort.weaknessByLevel.map(l => (
                    <span
                      key={l.level}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-200"
                    >
                      <span className="font-bold tabular-nums">{l.childrenWeak}</span>{' '}
                      {l.childrenWeak === 1 ? 'child breaks' : 'children break'} first at{' '}
                      <span className="font-semibold">Level {l.level}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 pr-3 font-medium">Child</th>
                      <th className="py-2 pr-3 font-medium">Score</th>
                      <th className="py-2 pr-3 font-medium">Breaks at</th>
                      <th className="py-2 pr-3 font-medium">Weak in</th>
                      <th className="py-2 font-medium">How they fail</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {[...roster]
                      .sort(
                        (a, b) =>
                          (a.weakness.weakestLevel ?? 99) - (b.weakness.weakestLevel ?? 99) ||
                          a.score - b.score
                      )
                      .map(f => {
                        const arch = cohort.archetypes.find(a => a.clusterId === f.clusterId);
                        const weak = f.weakness.topics.filter(t => t.rate >= 0.5);
                        return (
                          <tr key={f.studentId} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">
                              {f.studentName}
                              {f.mixedProfile && (
                                <span className="ml-1.5 text-[10px] font-normal text-slate-400">mixed</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{f.score}%</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {f.weakness.weakestLevel !== null ? (
                                <span className="font-semibold">L{f.weakness.weakestLevel}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {weak.length > 0 ? (
                                weak.map(t => (
                                  <span
                                    key={t.topic}
                                    className="mr-1 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                                  >
                                    {t.topic} {t.wrong}/{t.attempted}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2 text-slate-600 dark:text-slate-400">
                              {arch ? arch.name : <span className="text-slate-400">not grouped</span>}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {cohort.weaknessByTopic.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="mb-2 text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Across the class
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cohort.weaknessByTopic.map(t => (
                      <span
                        key={t.topic}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      >
                        {t.topic} —{' '}
                        <span className="font-bold tabular-nums">{t.childrenWeak}</span> of{' '}
                        <span className="tabular-nums">{t.childrenAttempted}</span> weak
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* The classifier's own blind spot, and what might be hiding in it */}
          {cohort && cohort.unclassifiedCount > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-sans text-base font-bold text-slate-900 dark:text-white">
                    Mistakes the rules could not read ({cohort.unclassifiedCount})
                  </h3>
                  <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
                    {(cohort.unclassifiedRate * 100).toFixed(0)}% of this cohort's wrong answers did
                    not match any of the nine known error patterns. A small number is normal. A
                    growing one means a kind of mistake is appearing that has no name yet.
                  </p>
                </div>
                <button
                  onClick={inspectResidue}
                  disabled={residueLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${residueLoading ? 'animate-pulse' : ''}`} />
                  {residueLoading ? 'Looking…' : 'Suggest new categories'}
                </button>
              </div>

              {residue && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {residue.proposals.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No recurring pattern found — these look like unrelated one-off mistakes. That
                      is the expected answer, and a more useful one than a category invented to fill
                      the gap.
                    </p>
                  ) : (
                    <>
                      <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
                        Candidates only. Nothing here has been applied to any child — a proposal
                        becomes real when someone reviews it and it is written in as a coded rule.
                      </p>
                      <div className="space-y-3">
                        {residue.proposals.map(p => (
                          <div
                            key={p.name}
                            className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-800/60 dark:bg-violet-950/30"
                          >
                            <div className="flex items-baseline gap-2">
                              <h4 className="font-sans text-sm font-bold text-slate-900 dark:text-white">
                                {p.name}
                              </h4>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {p.affectedAnswers} answers
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                              {p.description}
                            </p>
                            {p.examples.length > 0 && (
                              <p className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                e.g. {p.examples.slice(0, 5).join(' · ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Children the analysis deliberately declines to characterise */}
          {thinEvidence.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="font-sans text-base font-bold text-slate-900 dark:text-white">
                Not enough evidence yet ({thinEvidence.length})
              </h3>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                These children got too few questions wrong to have a signature — one or two mistakes
                cannot tell a habit from an accident. They are listed rather than assigned an
                archetype on thin evidence.
              </p>
              <div className="flex flex-wrap gap-2">
                {thinEvidence.map(f => (
                  <span
                    key={f.studentId}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {f.studentName} · {f.score}% · {f.totalIncorrect} wrong
                  </span>
                ))}
              </div>
            </div>
      )}
    </div>
  );
};

export default MisconceptionFingerprint;
