import { apiFetch } from '../services/apiClient';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Award, Globe, BookOpen, Users, BarChart3, ArrowRight, MapPin } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

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
                src="/partners/iit-ropar-logo.svg"
                alt="Indian Institute of Technology Ropar"
                className="h-12 md:h-16 w-auto"
              />
              <img
                src="/partners/vicharanashala-logo.png"
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

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl max-w-4xl mx-auto leading-tight">
            {t('landing.heroTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('landing.heroSubtitle')}
          </p>

        </div>

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

        {/* Assessment cycle order */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
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
      </main>

      {/* Footer */}
      <footer className="bg-[#111827] text-slate-400 dark:text-slate-400 py-8 border-t border-gray-800 text-center text-xs">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p>© 2026 Assessment Platform. Handcrafted for educational diagnostics.</p>
            <p className="mt-1 text-slate-500 dark:text-slate-500">Technical Support & Platform Host: Secure Education Services.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};