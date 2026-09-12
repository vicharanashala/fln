import React, { useState } from 'react';
import { EvaluationReport, EvaluationReasoning, ConfidenceLevel } from '../types';
import {
  Lightbulb,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  TrendingDown,
  Wrench,
  FlaskConical,
  BookOpen,
  Target,
  ShieldCheck,
} from 'lucide-react';

interface ReasoningSectionProps {
  report: EvaluationReport;
  fallbackNarrative?: string;
  // Optional override of section title.
  title?: string;
}

/**
 * Educational Reasoning — Phase 1 of Learning Progression Intelligence.
 *
 * Renders the structured `reasoning` payload that the backend builds from the
 * existing FLN 93-level curriculum. When the payload is absent (e.g. legacy
 * seed data, older reports), it gracefully falls back to the report's
 * narrative string so the UI is never broken.
 */
export const ReasoningSection: React.FC<ReasoningSectionProps> = ({
  report,
  fallbackNarrative,
  title = 'Educational Reasoning',
}) => {
  const r = report.reasoning;
  if (!r) {
    // Fallback: just show the narrative so the layout doesn't regress.
    const fallback = (fallbackNarrative ?? report.narrative ?? '').trim();
    if (!fallback) return null;
    return (
      <div className="space-y-2 bg-white p-5 border border-zinc-150 rounded-xl shadow-inner">
        <h4 className="text-xs font-mono font-bold uppercase text-zinc-400">
          {title} (narrative fallback)
        </h4>
        <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-line">{fallback}</p>
      </div>
    );
  }

  // `explanation`, `conceptMastery` and `learningProgression` are declared
  // required on EvaluationReasoning, so the backend always sends them today.
  // Reports persisted before those fields existed can still be replayed from
  // the database, though, and a missing sub-object would take the whole panel
  // down with a TypeError. Each block below is therefore rendered only when
  // its data is actually present — the same pattern the optional sections
  // (confidence, evidence, curriculumSummary) already use.
  const lp = r.learningProgression;
  return (
    <div
      id="educational-reasoning"
      className="space-y-3 bg-white p-5 border border-indigo-100 rounded-xl shadow-inner"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        <h4 className="text-xs font-mono font-bold uppercase text-zinc-400 tracking-wider">
          {title}
        </h4>
      </div>

      {/* Headline + narrative explanation */}
      {r.explanation && (
        <div className="space-y-1.5">
          <p className="text-zinc-900 text-sm font-semibold leading-snug">
            {r.explanation.headline}
          </p>
          <p className="text-zinc-600 text-xs leading-relaxed whitespace-pre-line">
            {r.explanation.narrative}
          </p>
        </div>
      )}

      {/* Phase 4: Placement Confidence — always visible inline so the
          teacher sees it without expanding any collapsible section. */}
      {r.confidence && <PlacementConfidence confidence={r.confidence} />}

      {/* Learning progression block */}
      {lp && (
        <div className="border-t border-indigo-50 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Current level */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-indigo-500" />
              <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                Current Level
              </span>
            </div>
            <div className="text-zinc-900 text-sm font-semibold">
              Level {lp.currentLevel} · {lp.currentLevelName}
            </div>
            <div className="text-[11px] text-zinc-500">
              Strand: <span className="text-zinc-700 font-medium">{lp.currentStrand}</span>
            </div>
          </div>

          {/* Next milestone */}
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 tracking-wider">
                Next Milestone
              </span>
            </div>
            {lp.nextMilestone ? (
              <>
                <div className="text-zinc-900 text-sm font-semibold">
                  Level {lp.nextMilestone.level} · {lp.nextMilestone.name}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Strand: <span className="text-zinc-700 font-medium">{lp.nextMilestone.strand}</span>
                </div>
              </>
            ) : (
              <div className="text-[11px] text-zinc-500">
                Highest level in the framework — focus on mastery consolidation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blockers */}
      {lp?.blockers && lp.blockers.length > 0 && (
        <div className="border-t border-indigo-50 pt-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-mono font-bold uppercase text-amber-700 tracking-wider">
              Identified Blockers
            </span>
          </div>
          <ul className="text-xs text-zinc-700 space-y-1 pl-4 list-disc marker:text-amber-400">
            {lp.blockers.map((b, i) => (
              <li key={`${b.topic}-${i}`} className="leading-snug">
                <span className="font-medium">{b.topic}</span>
                {b.errorType && (
                  <span className="ml-1 text-[10px] font-mono uppercase text-zinc-400">
                    ({b.errorType})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {lp?.recommendations && lp.recommendations.length > 0 && (
        <div className="border-t border-indigo-50 pt-3 space-y-1.5">
          <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">
            Curriculum-Grounded Recommendations
          </span>
          <ol className="text-xs text-zinc-700 space-y-1 pl-4 list-decimal marker:text-indigo-400">
            {lp.recommendations.map((rec, i) => (
              <li key={i} className="leading-snug">{rec}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Personalized rationale */}
      {r.personalized && (
        <div className="border-t border-indigo-50 pt-3 space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
            Why these questions were chosen
          </span>
          <p className="text-[11px] text-zinc-600 leading-snug">{r.personalized.rationale}</p>
        </div>
      )}

      {/* Phase 2: Learning Evidence (collapsible). */}
      {(r.evidence || r.remediation) && (
        <LearningEvidence evidence={r.evidence} remediation={r.remediation} />
      )}

      {/* Phase 3: Curriculum Summary (collapsible). */}
      {r.curriculumSummary && (
        <CurriculumSummary summary={r.curriculumSummary} />
      )}

      {/* Prerequisite Learning Path. The backend groups the submitted answers by
          each question's conceptId, then walks the curriculum's prerequisite
          edges for every concept the student got wholly wrong. Renders only when
          the backend supplies the payload — i.e. when a failed concept actually
          has prerequisite edges. Names arrive already resolved to curriculum
          titles; nothing is computed here. */}
      {r.prerequisiteLearningPath && (
        <div className="border-t border-indigo-50 pt-3">
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                Prerequisite Learning Path
              </span>
            </div>

            <p className="text-[11px] text-indigo-700/80 leading-snug">
              The student struggled with{' '}
              <strong>{r.prerequisiteLearningPath.affectedCompetencies.join(', ')}</strong>.
              Strengthen the following prerequisite competencies first, then reintroduce the failed topics.
            </p>

            {r.prerequisiteLearningPath.supportingSkills.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                  Supporting Skills
                </span>
                <ul className="text-[11px] text-zinc-700 space-y-0.5 pl-3 list-disc marker:text-indigo-400">
                  {r.prerequisiteLearningPath.supportingSkills.map((p, i) => (
                    <li key={`plp-ss-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {r.prerequisiteLearningPath.affectedCompetencies.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                  Reintroduce
                </span>
                <ul className="text-[11px] text-zinc-700 space-y-0.5 pl-3 list-disc marker:text-indigo-400">
                  {r.prerequisiteLearningPath.affectedCompetencies.map((p, i) => (
                    <li key={`plp-rei-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {(r.prerequisiteLearningPath.supportingSkills.length > 0 || r.prerequisiteLearningPath.affectedCompetencies.length > 0) && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                  Weekly Teacher Action Plan
                </span>
                <ol className="text-[11px] text-zinc-700 space-y-1.5 pl-3 list-decimal marker:text-indigo-400">
                  {r.prerequisiteLearningPath.supportingSkills.length > 0 && (
                    <>
                      <li key="plp-week-1">
                        <span className="font-medium">Week 1</span>
                        <span className="text-zinc-600"> — Practice the Supporting Skills listed above.</span>
                      </li>
                      <li key="plp-week-2">
                        <span className="font-medium">Week 2</span>
                        <span className="text-zinc-600"> — Continue practicing the Supporting Skills listed above until mastered.</span>
                      </li>
                    </>
                  )}
                  <li key="plp-week-3">
                    <span className="font-medium">Week 3</span>
                    <span className="text-zinc-600"> — Review all Supporting Skills before progressing.</span>
                  </li>
                  {r.prerequisiteLearningPath.affectedCompetencies.length > 0 && (
                    <li key="plp-week-4">
                      <span className="font-medium">Week 4</span>
                      <span className="text-zinc-600"> — Reintroduce the failed competencies listed above.</span>
                    </li>
                  )}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface LearningEvidenceProps {
  evidence: EvaluationReasoning['evidence'];
  remediation: EvaluationReasoning['remediation'];
}

/**
 * Phase 2: collapsible "Learning Evidence" subsection.
 *
 * Surfaces deterministic evidence about the placement:
 *  - Assessed topics, strongest concepts, weakest concepts.
 *  - Failed-question summary (counts, by level, by topic).
 *  - Difficulty breakdown (when available).
 *  - Remediation explanation (when personalised pipeline output is present).
 *
 * Fully degrades to null when the underlying data is not available — never
 * invents data.
 */
const LearningEvidence: React.FC<LearningEvidenceProps> = ({ evidence, remediation }) => {
  const [open, setOpen] = useState(false);

  // Build a small summary chip to entice the user to open.
  const summaryBits: string[] = [];
  if (evidence) {
    if (evidence.strongestConcepts.length > 0) {
      summaryBits.push(`${evidence.strongestConcepts.length} strong`);
    }
    if (evidence.weakestConcepts.length > 0) {
      summaryBits.push(`${evidence.weakestConcepts.length} weak`);
    }
    summaryBits.push(`${evidence.failedQuestionSummary.total} failed`);
  }
  if (remediation) {
    summaryBits.push(`${remediation.reusedFailedQuestions} reused`);
  }
  const summary = summaryBits.join(' · ');

  return (
    <div className="border-t border-indigo-50 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left px-1 py-1 rounded hover:bg-indigo-50/60 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
            Learning Evidence
          </span>
          {summary && (
            <span className="text-[10px] font-mono text-zinc-400 normal-case tracking-normal">
              ({summary})
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-3 pl-1">
          {evidence && (
            <>
              {/* Assessed topics */}
              {evidence.assessedTopics.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">
                    Assessed Topics ({evidence.assessedTopics.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {evidence.assessedTopics.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strongest / weakest side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-green-50/60 border border-green-100 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-[10px] font-mono font-bold uppercase text-green-700 tracking-wider">
                      Strongest Concepts
                    </span>
                  </div>
                  {evidence.strongestConcepts.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic">No concept fully mastered yet.</p>
                  ) : (
                    <ul className="text-[11px] text-zinc-700 space-y-0.5 pl-3 list-disc marker:text-green-500">
                      {evidence.strongestConcepts.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3 h-3 text-amber-600" />
                    <span className="text-[10px] font-mono font-bold uppercase text-amber-700 tracking-wider">
                      Weakest Concepts
                    </span>
                  </div>
                  {evidence.weakestConcepts.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic">No concept gaps detected.</p>
                  ) : (
                    <ul className="text-[11px] text-zinc-700 space-y-0.5 pl-3 list-disc marker:text-amber-500">
                      {evidence.weakestConcepts.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Failed question summary */}
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-2.5 space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 tracking-wider">
                  Failed Question Summary
                  <span className="ml-2 normal-case text-zinc-400 tracking-normal">
                    total: {evidence.failedQuestionSummary.total}
                  </span>
                </span>

                {evidence.failedQuestionSummary.byLevel.length > 0 && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      By level
                    </span>
                    <ul className="text-[11px] text-zinc-700 space-y-0.5 pl-3 list-disc">
                      {evidence.failedQuestionSummary.byLevel.map((row) => (
                        <li key={row.level}>
                          Level {row.level}
                          {row.name ? ` — ${row.name}` : ''}: {row.count}
                          {row.pipelineReported && (
                            <span className="ml-1 text-[10px] font-mono uppercase text-indigo-500">
                              (may need review)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evidence.failedQuestionSummary.byTopic.length > 0 && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      By topic
                    </span>
                    <ul className="text-[11px] text-zinc-700 space-y-0.5 pl-3 list-disc">
                      {evidence.failedQuestionSummary.byTopic.map((row) => (
                        <li key={row.topic}>
                          {row.topic}: {row.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evidence.failedQuestionSummary.byLevel.length === 0 &&
                  evidence.failedQuestionSummary.byTopic.length === 0 && (
                    <p className="text-[11px] text-zinc-500 italic">No failures recorded.</p>
                  )}
              </div>

              {/* Difficulty breakdown */}
              {evidence.difficultyBreakdown && (
                <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-2.5 space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                    Performance by Difficulty
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-700">
                    {(['easy', 'medium', 'hard'] as const).map((k) => {
                      const row = evidence.difficultyBreakdown![k];
                      const pct = row.attempted > 0 ? Math.round((row.correct / row.attempted) * 100) : 0;
                      return (
                        <div
                          key={k}
                          className="bg-white/70 border border-indigo-50 rounded p-1.5 text-center"
                        >
                          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                            {k}
                          </div>
                          <div className="font-semibold">
                            {row.correct}/{row.attempted}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Remediation */}
          {remediation && (
            <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] font-mono font-bold uppercase text-blue-700 tracking-wider">
                  Remediation Plan
                </span>
              </div>
              <p className="text-[11px] text-zinc-700 leading-snug">{remediation.remediationReason}</p>
              <div className="flex flex-wrap gap-3 text-[10px] font-mono text-zinc-500 pt-1">
                <span>
                  Reused failed questions:{' '}
                  <strong className="text-zinc-700">{remediation.reusedFailedQuestions}</strong>
                </span>
                <span>
                  Newly introduced curriculum:{' '}
                  <strong className="text-zinc-700">{remediation.newlyIntroducedCurriculum}</strong>
                </span>
                {remediation.targetClass !== null && (
                  <span>
                    Target:{' '}
                    <strong className="text-zinc-700">
                      Class {remediation.targetClass}
                      {remediation.targetPhrase ? ` (${remediation.targetPhrase})` : ''}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface CurriculumSummaryProps {
  summary: NonNullable<EvaluationReasoning['curriculumSummary']>;
}

/**
 * Phase 3: collapsible "Curriculum Summary" subsection.
 *
 * Surfaces curriculum metadata from the existing FLN Levels Structure:
 *  - Current Level objective
 *  - Current Level learning outcome(s)
 *  - Topics covered at this level
 *  - Next curriculum milestone name + objective
 *  - Deterministic explanation of why this transition occurs
 *
 * All content is sourced from the backend loader (which reads the .md
 * files at startup); we never invent content here.
 */
const CurriculumSummary: React.FC<CurriculumSummaryProps> = ({ summary }) => {
  const [open, setOpen] = useState(false);
  const summaryBits: string[] = [];
  if (summary.currentTopics.length > 0) {
    summaryBits.push(`${summary.currentTopics.length} topics`);
  }
  if (summary.currentLearningOutcome.length > 0) {
    summaryBits.push(`${summary.currentLearningOutcome.length} outcomes`);
  }
  if (summary.nextLevelName) {
    summaryBits.push(`next: ${summary.nextLevelName}`);
  }
  const summaryText = summaryBits.join(' · ');

  return (
    <div className="border-t border-indigo-50 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left px-1 py-1 rounded hover:bg-indigo-50/60 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
            Curriculum Summary
          </span>
          {summaryText && (
            <span className="text-[10px] font-mono text-zinc-400 normal-case tracking-normal">
              ({summaryText})
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-3 pl-1">
          {/* Current Level */}
          <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-indigo-500" />
              <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                Current Level — {summary.currentLevelName}
              </span>
            </div>

            {summary.currentObjective && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Objective
                </span>
                <p className="text-[11px] text-zinc-700 leading-snug">
                  {summary.currentObjective}
                </p>
              </div>
            )}

            {summary.currentLearningOutcome.length > 0 && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Learning Outcome
                </span>
                <ul className="text-[11px] text-zinc-700 space-y-0.5 pl-3 list-disc marker:text-indigo-400">
                  {summary.currentLearningOutcome.map((lo, i) => (
                    <li key={i}>{lo}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.currentTopics.length > 0 && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Topics Covered
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {summary.currentTopics.map((t, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono bg-white/80 text-zinc-700 px-2 py-0.5 rounded border border-indigo-100"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Next Milestone */}
          {summary.nextLevelName && (
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 tracking-wider">
                  Next Curriculum Milestone
                </span>
              </div>
              <div className="text-zinc-900 text-sm font-semibold">
                {summary.nextLevelName}
              </div>
              {summary.nextObjective && (
                <p className="text-[11px] text-zinc-600 leading-snug">
                  {summary.nextObjective}
                </p>
              )}
            </div>
          )}

          {/* Transition reason */}
          {summary.transitionReason && (
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">
                Why this transition occurs
              </span>
              <p className="text-[11px] text-zinc-700 leading-snug whitespace-pre-line">
                {summary.transitionReason}
              </p>
             </div>
           )}
         </div>
       )}
     </div>
   );
};

interface PlacementConfidenceProps {
  confidence: NonNullable<EvaluationReasoning['confidence']>;
}

/**
 * Phase 4: Placement Confidence.
 *
 * Deterministic display of how confident the system is in the placed FLN
 * level. Surfaces a numeric percentage, a categorical label, and a
 * deterministic explanation. Color-coded so the teacher can spot weak
 * confidence at a glance.
 */
const confidenceTone: Record<ConfidenceLevel, { badge: string; bar: string; label: string }> = {
  'Very High': {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    bar: 'bg-emerald-500',
    label: 'Very High',
  },
  High: {
    badge: 'bg-green-100 text-green-800 border-green-200',
    bar: 'bg-green-500',
    label: 'High',
  },
  Moderate: {
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    bar: 'bg-amber-500',
    label: 'Moderate',
  },
  Low: {
    badge: 'bg-red-100 text-red-800 border-red-200',
    bar: 'bg-red-500',
    label: 'Low',
  },
};

const PlacementConfidence: React.FC<PlacementConfidenceProps> = ({ confidence }) => {
  const pct = Math.round(confidence.score * 100);
  const tone = confidenceTone[confidence.level] ?? confidenceTone.Moderate;
  return (
    <div className="border-t border-indigo-50 pt-3">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
          Placement Confidence
        </span>
      </div>

      <div className="bg-white border border-indigo-100 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-zinc-900 tabular-nums">
              {pct}%
            </span>
            <span
              data-confidence-level={confidence.level}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${tone.badge}`}
            >
              {tone.label}
            </span>
          </div>
        </div>

        <div
          className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Placement confidence: ${pct}% (${confidence.level})`}
        >
          <div
            className={`h-full ${tone.bar} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-[11px] text-zinc-600 leading-snug">
          {confidence.explanation}
        </p>
      </div>
    </div>
  );
};
