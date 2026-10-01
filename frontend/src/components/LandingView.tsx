import { apiFetch, withBase } from '../services/apiClient';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, BookOpen, Users, BarChart3, MapPin, FileText, Printer, PencilLine, ScanLine, Stethoscope, RefreshCw, WifiOff, GitBranch, ShieldCheck, Github } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import curriculumSummary from '../data/curriculumSummary.json';

interface LandingViewProps {
  onNavigateToLogin: () => void;
  isLoggedIn?: boolean;
}

interface Stats {
  totalStates: number;
  totalDistricts: number;
  totalSchools: number;
  totalStudents: number;
  totalAssessments: number;
  avgFlnLevel: number;
  totalUsers: number;
  certifiedCount?: number;
  certifiedPercent?: number;
}

const REPO_URL = 'https://github.com/vicharanashala/fln';
const RESEARCH_URL = 'https://github.com/vicharanashala/fln/tree/main/Research';

const FRAMEWORK_PRINCIPLES = ['p1', 'p2', 'p3', 'p4'];

/** Which of the four colour bands a cell's count falls in. 0 = not introduced. */
const bandOf = (count: number): 0 | 1 | 2 | 3 | 4 => {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
};

const BAND_LABELS: Record<1 | 2 | 3 | 4, string> = { 1: '1–2', 2: '3–4', 3: '5–6', 4: '7+' };

const HOW_STEPS = [
  { key: 'step1', icon: FileText },
  { key: 'step2', icon: Printer },
  { key: 'step3', icon: PencilLine },
  { key: 'step4', icon: ScanLine },
  { key: 'step5', icon: Stethoscope },
  { key: 'step6', icon: RefreshCw },
];

const USP_ITEMS = [
  { title: 'landing.usp.paperTitle', body: 'landing.usp.paperBody', icon: WifiOff },
  { title: 'landing.usp.diagnosisTitle', body: 'landing.usp.diagnosisBody', icon: GitBranch },
  { title: 'landing.usp.auditableTitle', body: 'landing.usp.auditableBody', icon: ShieldCheck },
  { title: 'landing.usp.openTitle', body: 'landing.usp.openBody', icon: Github },
];

const AUDIENCE_ITEMS = [
  { title: 'landing.audience.teachersTitle', body: 'landing.audience.teachersBody' },
  { title: 'landing.audience.headsTitle', body: 'landing.audience.headsBody' },
  { title: 'landing.audience.statesTitle', body: 'landing.audience.statesBody' },
  { title: 'landing.audience.researchTitle', body: 'landing.audience.researchBody' },
];

export const LandingView: React.FC<LandingViewProps> = ({ onNavigateToLogin, isLoggedIn }) => {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState(100);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const adjustFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(150, Math.max(75, prev + delta));
      document.documentElement.style.fontSize = `${next}%`;
      return next;
    });
  };

  const resetFontSize = () => {
    setFontSize(100);
    document.documentElement.style.fontSize = '100%';
  };

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    const interval = 2000;

    const fetchStats = () => {
      apiFetch('/api/stats')
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => { setStats(d); setStatsLoading(false); })
        .catch(() => {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(fetchStats, interval);
          } else {
            setStatsLoading(false);
          }
        });
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      label: t('landing.stat.statesDistricts'), value: stats ? `${stats.totalStates} States / ${stats.totalDistricts} Districts` : null, desc: t('landing.stat.statesDistrictsDesc'), icon: MapPin,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      hoverDetail: stats ? `Spanning ${stats.totalStates} states/UTs and ${stats.totalDistricts} districts nationwide.` : null,
    },
    {
      label: t('landing.stat.registeredSchools'), value: stats?.totalSchools?.toLocaleString() ?? null, desc: t('landing.stat.registeredSchoolsDesc'), icon: BookOpen,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      hoverDetail: stats && stats.totalStates > 0 ? `~${Math.round(stats.totalSchools / stats.totalStates)} schools per state on average.` : null,
    },
    {
      label: t('landing.stat.studentsTracked'), value: stats?.totalStudents?.toLocaleString() ?? null, desc: t('landing.stat.studentsTrackedDesc'), icon: Users,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
      hoverDetail: stats?.certifiedCount != null && stats?.certifiedPercent != null
        ? `${stats.certifiedCount.toLocaleString()} certified at level 5+ (${stats.certifiedPercent}%).`
        : null,
    },
    {
      label: t('landing.stat.assessmentsConducted'), value: stats?.totalAssessments?.toLocaleString() ?? null, desc: t('landing.stat.assessmentsConductedDesc'), icon: BarChart3,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
      hoverDetail: stats && stats.totalStudents > 0 ? `~${(stats.totalAssessments / stats.totalStudents).toFixed(1)} assessments per enrolled student.` : null,
    },
    {
      label: t('landing.stat.nationalFlnScore'), value: stats ? `L${stats.avgFlnLevel}` : null, desc: t('landing.stat.nationalFlnScoreDesc'), icon: Award,
      color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
      hoverDetail: stats?.certifiedPercent != null ? `${stats.certifiedPercent}% of tracked students are certified (level 5+).` : null,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 transition-colors duration-200">
      
      {/* 1. Accessibility / Top strip (neutral branding) */}
      <div className="w-full bg-[#111827] text-gray-300 text-[10px] md:text-xs font-semibold px-6 py-2 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="font-bold">{t('portal.name')}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300 hidden sm:inline">{t('portal.tagline')}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold">
            <button onClick={() => adjustFontSize(-10)} className="hover:text-white transition px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500" title="Decrease font size">A-</button>
            <button onClick={resetFontSize} className="hover:text-white transition px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500" title="Reset font size">A</button>
            <button onClick={() => adjustFontSize(10)} className="hover:text-white transition px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500" title="Increase font size">A+</button>
          </div>
          <span className="text-gray-700 dark:text-gray-400">|</span>
          <LanguageSwitcher variant="dark" />
        </div>
      </div>

      {/* 3. Main portal banner header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm dark:shadow-slate-950/50">
        <div className="mx-auto max-w-screen-2xl pl-2 pr-6 py-4 md:py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row pl-2">
            <div className="flex items-center gap-3">
              <img
                src={withBase('/partners/iit-ropar-logo.svg')}
                alt="Indian Institute of Technology Ropar"
                className="h-12 md:h-16 w-auto"
              />
              <img
                src={withBase('/partners/vicharanashala-logo.png')}
                alt="Vicharanashala — Lab for Education Design"
                className="h-12 md:h-16 w-auto"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToLogin}
              className="rounded-lg bg-indigo-700 dark:bg-indigo-800 px-6 py-2.5 text-xs font-extrabold text-white shadow-md dark:shadow-slate-950/50 transition-all duration-150 hover:bg-indigo-600 dark:hover:bg-indigo-700 border border-indigo-300 dark:border-indigo-700 active:scale-[0.98] uppercase tracking-wider"
            >
              {isLoggedIn ? 'Go to Dashboard' : t('landing.signIn')}
            </button>
          </div>
        </div>
      </header>

{/* Hero Section */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="text-center relative">
            <div className="absolute inset-x-0 -top-12 flex justify-center -z-10 opacity-5">
            <span className="text-[140px] font-black select-none text-slate-200 dark:text-slate-800">FLN</span>
          </div>

          <p className="mb-4 inline-block rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
            {t('landing.heroBadge')}
          </p>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl max-w-4xl mx-auto leading-tight">
            {t('landing.heroTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('landing.heroSubtitle')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#how-it-works"
              className="rounded-lg bg-indigo-700 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-600 dark:bg-indigo-800 dark:hover:bg-indigo-700"
            >
              {t('landing.heroCtaHow')}
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Github className="h-4 w-4" />
              {t('landing.heroCtaCode')}
            </a>
          </div>
        </div>

        {/* The problem */}
        <section className="mx-auto mt-16 max-w-3xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50">
          <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('landing.problem.title')}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
            {t('landing.problem.body')}
          </p>
        </section>

        {/* Stats Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="group relative flex items-center gap-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm dark:shadow-slate-950/50 transition hover:shadow-md dark:hover:shadow-slate-950/50"
              >
                <div className={`rounded-xl p-3 ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    {stat.label}
                  </p>
                  {stat.value !== null ? (
                    <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">
                      {stat.value}
                    </p>
                  ) : (
                    <div className="mt-1 h-8 w-32 rounded bg-gray-200 dark:bg-slate-700 animate-pulse" />
                  )}
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {stat.desc}
                  </p>
                </div>
                {stat.hoverDetail && (
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-gray-600 dark:text-slate-300 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {stat.hoverDetail}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Vision Section */}
        <div className="mt-20 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm dark:shadow-slate-950/50">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                {t('landing.vision.title')}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-slate-300">
                {t('landing.vision.body')}
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                {t('landing.curriculum.title')}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-slate-300">
                              {t('landing.curriculum.body')}
                            </p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <section id="how-it-works" className="mt-20 scroll-mt-8">
          <h3 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('landing.how.title')}
          </h3>
          <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.key}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-extrabold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {index + 1}
                    </span>
                    <Icon className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {t(`landing.how.${step.key}Title`)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                    {t(`landing.how.${step.key}Body`)}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* What makes this different */}
        <section className="mt-20">
          <h3 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('landing.usp.title')}
          </h3>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {USP_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="font-semibold text-gray-900 dark:text-white">{t(item.title)}</p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                    {t(item.body)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* What the framework is built on */}
        <section id="framework" className="mt-20 scroll-mt-8">
          <h3 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('landing.framework.title')}
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-gray-600 dark:text-slate-300">
            {t('landing.framework.intro')}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FRAMEWORK_PRINCIPLES.map((key) => (
              <div
                key={key}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50"
              >
                <p className="font-semibold text-gray-900 dark:text-white">
                  {t(`landing.framework.${key}Title`)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                  {t(`landing.framework.${key}Body`)}
                </p>
              </div>
            ))}
          </div>

          {/* Shape of the framework — generated from curriculumMap.ts at build time */}
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50">
            <dl className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
              {[
                { label: t('landing.framework.statConcepts'), value: curriculumSummary.totalConcepts },
                { label: t('landing.framework.statStages'), value: curriculumSummary.totalStages },
                { label: t('landing.framework.statStrands'), value: curriculumSummary.totalStrands },
                { label: t('landing.framework.statAges'), value: `${curriculumSummary.ageMin}–${curriculumSummary.ageMax}` },
              ].map((item) => (
                <div key={item.label}>
                  <dd className="text-3xl font-extrabold text-gray-900 dark:text-white">{item.value}</dd>
                  <dt className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    {item.label}
                  </dt>
                </div>
              ))}
            </dl>

            <div className="fln-heatmap mt-10">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {t('landing.framework.mapTitle')}
              </p>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                {t('landing.framework.mapCaption')}
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-auto text-xs">
                  <caption className="sr-only">{t('landing.framework.mapCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="px-2 pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        {t('landing.framework.mapStrand')}
                      </th>
                      {curriculumSummary.stages.map((stage) => (
                        <th
                          key={stage.stage}
                          scope="col"
                          className="w-14 px-1 pb-2 text-center text-[10px] font-semibold tabular-nums text-gray-500 dark:text-slate-400"
                        >
                          {stage.ageLabel}
                        </th>
                      ))}
                      <th scope="col" className="px-2 pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        {t('landing.framework.mapTotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {curriculumSummary.matrix.map((row) => (
                      <tr key={row.strand}>
                        <th scope="row" className="whitespace-nowrap py-1 pr-3 text-left text-xs font-medium text-gray-700 dark:text-slate-200">
                          {row.strand}
                        </th>
                        {row.counts.map((count, index) => {
                          const band = bandOf(count);
                          const stage = curriculumSummary.stages[index];
                          return (
                            <td
                              key={stage.stage}
                              title={
                                band === 0
                                  ? `${row.strand} — ${t('landing.framework.mapNone').toLowerCase()} (${t('landing.framework.mapAges').toLowerCase()} ${stage.ageLabel})`
                                  : t('landing.framework.mapCell', { count, strand: row.strand, ages: stage.ageLabel })
                              }
                              className="h-8 w-14 rounded text-center text-xs font-bold tabular-nums"
                              style={
                                band === 0
                                  ? undefined
                                  : { backgroundColor: `var(--cell-${band})`, color: `var(--ink-${band})` }
                              }
                            >
                              {band === 0 ? <span className="text-gray-300 dark:text-slate-700">·</span> : count}
                            </td>
                          );
                        })}
                        <td className="py-1 pl-3 text-right text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-500 dark:text-slate-400">
                <span className="font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  {t('landing.framework.mapLegend')}
                </span>
                {([1, 2, 3, 4] as const).map((band) => (
                  <span key={band} className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: `var(--cell-${band})` }} />
                    <span className="tabular-nums">{BAND_LABELS[band]}</span>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border border-gray-200 dark:border-slate-700" />
                  {t('landing.framework.mapNone')}
                </span>
              </div>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
              {t('landing.framework.generatedNote')}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={RESEARCH_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t('landing.framework.ctaResearch')}
              </a>
            </div>
          </div>
        </section>

        {/* Assessment cycle order */}
        <h3 className="mt-20 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('landing.cycle.title')}
        </h3>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center shadow-sm dark:shadow-slate-950/50">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{t('landing.cycle.cycle1')}</p>
            <p className="mt-2 font-semibold text-gray-900 dark:text-white">{t('landing.cycle.cycle1Title')}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('landing.cycle.cycle1Description')}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center shadow-sm dark:shadow-slate-950/50">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t('landing.cycle.cycle2')}</p>
            <p className="mt-2 font-semibold text-gray-900 dark:text-white">{t('landing.cycle.cycle2Title')}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('landing.cycle.cycle2Description')}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center shadow-sm dark:shadow-slate-950/50">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('landing.cycle.cycle3')}</p>
            <p className="mt-2 font-semibold text-gray-900 dark:text-white">{t('landing.cycle.cycle3Title')}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('landing.cycle.cycle3Description')}</p>
          </div>
        </div>

        {/* Who it is for */}
        <section className="mt-20">
          <h3 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('landing.audience.title')}
          </h3>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCE_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50"
              >
                <p className="font-semibold text-gray-900 dark:text-white">{t(item.title)}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                  {t(item.body)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Where this stands today */}
        <section className="mt-20 rounded-2xl border border-amber-200 bg-amber-50 p-8 dark:border-amber-900/50 dark:bg-amber-950/20">
          <h3 className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200">
            {t('landing.scope.title')}
          </h3>
          <p className="mt-2 font-semibold text-amber-900 dark:text-amber-200">
            {t('landing.scope.subtitle')}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-amber-900/80 dark:text-amber-100/70">
            {t('landing.scope.body')}
          </p>
        </section>

        {/* Built in the open */}
        <section className="mt-12 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50">
          <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('landing.involve.title')}
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-slate-300">
            {t('landing.involve.body')}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-600 dark:bg-indigo-800 dark:hover:bg-indigo-700"
            >
              <Github className="h-4 w-4" />
              {t('landing.involve.ctaCode')}
            </a>
            <a
              href="#framework"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('landing.involve.ctaFramework')}
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#111827] text-slate-400 dark:text-slate-400 py-8 border-t border-gray-800 text-center text-xs">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p>{t('footer.built')}</p>
            <p className="mt-1 text-slate-500 dark:text-slate-500">{t('footer.license')}</p>
            <p className="mt-1 text-slate-500 dark:text-slate-500">{t('footer.copyright')}</p>
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};