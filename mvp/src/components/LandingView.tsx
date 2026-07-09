/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Award, Globe, BookOpen, Users, BarChart3, ArrowRight, MapPin } from 'lucide-react';
import { STATES_DATA } from '../constants';

interface LandingViewProps {
  onNavigateToLogin: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onNavigateToLogin }) => {
  const totalEnrolled = STATES_DATA.reduce((acc, curr) => acc + curr.enrolled, 0);
  const totalCertified = STATES_DATA.reduce((acc, curr) => acc + curr.certified, 0);
  const nationalAvgFlnScore = Math.round((totalCertified / totalEnrolled) * 100);

  const stats = [
    { label: 'States Active', value: '5', desc: 'Implementing standard model', icon: Globe, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' },
    { label: 'Districts Coordinated', value: '92', desc: 'Unified mapping dashboard', icon: MapPin, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'Registered Schools', value: '14,240', desc: 'High & low strength schools', icon: BookOpen, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
    { label: 'Students Tracked', value: `${(totalEnrolled / 100000).toFixed(2)} Lakh`, desc: 'Continuous FLN tracking', icon: Users, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' },
    { label: 'Assessments Conducted', value: '3.4 Lakh', desc: 'Baseline, Mid-year, End-of-year', icon: BarChart3, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40' },
    { label: 'National FLN Score', value: `${nationalAvgFlnScore}%`, desc: 'Certification average', icon: Award, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 transition-colors duration-200">
      
      {/* 1. Official Government Top Accessibility & Bilingual Strip */}
      <div className="w-full bg-[#111827] text-gray-300 text-[10px] md:text-xs font-semibold px-6 py-2 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-gov-saffron">GOVERNMENT OF INDIA</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300 hidden sm:inline">MINISTRY OF SCHOOL EDUCATION & LITERACY</span>
          <span className="text-gray-500 hidden sm:inline">|</span>
          <span className="text-gov-green">DEPARTMENT OF SCHOOL EDUCATION, PUNJAB</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => alert("Screen Reader Access enabled. Screen reader voice instructions active.")}
            className="hover:text-white transition hover:underline"
          >
            Screen Reader Access
          </button>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-gov-saffron font-bold cursor-pointer">ENGLISH</span>
            <span className="text-gray-600">/</span>
            <span className="hover:text-white cursor-pointer" onClick={() => alert("ਪੰਜਾਬੀ ਭਾਸ਼ਾ ਵਿੱਚ ਬਦਲੋ")}>ਪੰਜਾਬੀ</span>
            <span className="text-gray-600">/</span>
            <span className="hover:text-white cursor-pointer" onClick={() => alert("हिन्दी भाषा में बदलें")}>हिन्दी</span>
          </div>
        </div>
      </div>

      {/* 2. Tricolor Ribbon Segment */}
      <div className="tricolor-ribbon" />

      {/* 3. Main Government Banner Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            {/* Authentic Sarnath Pillar representative icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded bg-amber-50 border border-amber-200 p-1 shadow-sm shrink-0">
              <svg className="h-10 w-10 text-amber-800" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A3,3 0 0,0 9,5C9,6.08 9.58,7.03 10.42,7.56C9.03,8.4 8,9.88 8,11.6V13.5H16V11.6C16,9.88 14.97,8.4 13.58,7.56C14.42,7.03 15,6.08 15,5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5A1,1 0 0,1 12,6A1,1 0 0,1 11,5A1,1 0 0,1 12,4M10,15V19H14V15H10M9,20V21H15V20H9Z" />
              </svg>
            </div>
            <div className="border-l-2 border-slate-200 pl-3">
              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                <span className="text-lg font-extrabold tracking-tight text-gov-navy uppercase">
                  NATIONAL FLN PORTAL
                </span>
                <span className="rounded-full bg-gov-saffron/10 px-2.5 py-0.5 text-[10px] font-bold text-gov-saffron uppercase tracking-wider">
                  Official GoI Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                Ministry of School Education & Literacy • Govt. of Punjab Initiative
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToLogin}
              className="rounded-lg bg-gov-navy px-6 py-2.5 text-xs font-extrabold text-white shadow-md transition-all duration-150 hover:bg-gov-navy-light border border-gov-gold active:scale-[0.98] uppercase tracking-wider"
            >
              Sign In to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* 4. Scrolling Flash Bulletin Board */}
      <div className="bg-amber-50/70 border-b border-amber-200/50 py-2.5 px-6">
        <div className="mx-auto max-w-7xl flex items-center gap-3 text-xs overflow-hidden">
          <span className="shrink-0 bg-gov-saffron text-white font-extrabold px-2.5 py-1 rounded text-[10px] uppercase tracking-wider flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
            LATEST NOTICES
          </span>
          <div className="whitespace-nowrap overflow-x-auto text-slate-700 font-medium scrollbar-none flex items-center gap-6">
            <span className="text-gov-navy">● [FLN-PB] Diagnostic test window extended for Ludhiana and Amritsar blocks.</span>
            <span className="text-gov-navy">● [GUIDELINE] Implementation of ASER 2026 standardized testing standards.</span>
            <span className="text-gov-navy">● [CURRICULUM] 59 cumulative proficiency levels mapped with standard learning goals.</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="text-center relative">
          <div className="absolute inset-x-0 -top-12 flex justify-center -z-10 opacity-5">
            <span className="text-[140px] font-black select-none text-gov-navy">FLN</span>
          </div>
          
          <div className="inline-flex items-center gap-2 rounded-full bg-gov-gold/10 px-4 py-1.5 text-xs font-bold text-gov-navy mb-6 border border-gov-gold/20">
            <span className="h-2 w-2 rounded-full bg-gov-saffron" />
            <span>Foundational Literacy and Numeracy (FLN) National Assessment Scheme</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl max-w-4xl mx-auto leading-tight">
            Foundational Literacy and Numeracy (FLN) Assessment & Grader
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 leading-relaxed">
            A state-of-the-art adaptive evaluation, diagnostics, and customized diagnostic worksheet pipeline. Empowering district admin teams, school principals, teachers, and field-level volunteers to elevate primary student learning outcomes under NEP guidelines.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={onNavigateToLogin}
              className="flex items-center gap-2 rounded-xl bg-gov-navy px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-150 hover:bg-gov-navy-light border border-gov-gold active:scale-[0.98]"
            >
              ACCESS DASHBOARD
              <ArrowRight className="h-4 w-4 text-gov-saffron" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className={`rounded-xl p-3 ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vision Section */}
        <div className="mt-20 rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Our Vision
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                To enable all children of Class 3/4 to read with comprehension and write, perform basic mathematical operations, and acquire foundational math skills by providing them with customized assessments and remedial worksheets.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-gray-900">
                Curriculum Integration
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                Our unified model defines 59 cumulative proficiency levels mapped precisely to Class 1, 2, 3, and 4 standards across foundational numeracy strands. Utilizing a specialized evaluation system, we generate diagnostic assessments on demand to pinpoint students' exact gaps.
              </p>
            </div>
          </div>
        </div>

        {/* NCERT / ASER quotes */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <p className="italic text-gray-500">"The standard ASER parameters highlight the importance of assessing child learning based on true competency milestones."</p>
            <p className="mt-3 text-xs font-bold text-indigo-600">— ASER Center</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <p className="italic text-gray-500">"Universal acquisition of foundational numeracy is a prerequisite for any meaningful learning journey."</p>
            <p className="mt-3 text-xs font-bold text-emerald-600">— Foundational Learning Framework</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <p className="italic text-gray-500">"Adaptive worksheet pacing allows teachers to deliver remediation targeted directly to the child's true sub-level (.0/.1/.2)."</p>
            <p className="mt-3 text-xs font-bold text-amber-600">— FLN National Guidelines</p>
          </div>
        </div>
      </main>

      {/* Government Link Directory Panel */}
      <div className="bg-gov-navy text-white border-t border-slate-200 mt-20">
        <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-1 sm:grid-cols-4 gap-8 text-xs">
          <div>
            <h4 className="font-bold uppercase tracking-wider text-gov-saffron mb-3">National Portals</h4>
            <ul className="space-y-2 text-slate-300">
              <li><a href="https://india.gov.in" target="_blank" className="hover:text-white hover:underline">india.gov.in (National Portal)</a></li>
              <li><a href="https://mygov.in" target="_blank" className="hover:text-white hover:underline">mygov.in (MyGov India)</a></li>
              <li><a href="https://education.gov.in" target="_blank" className="hover:text-white hover:underline">Ministry of Education Portal</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-wider text-gov-saffron mb-3">State Resources</h4>
            <ul className="space-y-2 text-slate-300">
              <li><a href="#" className="hover:text-white hover:underline">Punjab School Education Board</a></li>
              <li><a href="#" className="hover:text-white hover:underline">SCERT Punjab e-Learning</a></li>
              <li><a href="#" className="hover:text-white hover:underline">e-Punjab School Portal</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-wider text-gov-saffron mb-3">Key Schemes</h4>
            <ul className="space-y-2 text-slate-300">
              <li><a href="#" className="hover:text-white hover:underline">National FLN Guidelines</a></li>
              <li><a href="#" className="hover:text-white hover:underline">Samagra Shiksha Abhiyan</a></li>
              <li><a href="#" className="hover:text-white hover:underline">PM POSHAN Scheme</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-wider text-gov-saffron mb-3">Platform Information</h4>
            <p className="text-slate-400 leading-relaxed">
              Designed as a secure Foundational Literacy & Numeracy Adaptive evaluation platform, in synchronization with NCERT diagnostic directives.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#111827] text-slate-400 py-8 border-t border-gray-800 text-center text-xs">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p>© 2026 NATIONAL FLN Assessment Platform. Handcrafted in compliance with the Ministry of Education directives.</p>
            <p className="mt-1 text-slate-500">Technical Support & Platform Host: National Informatics Centre (NIC) Server Grid.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-gray-800 text-gov-saffron px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider">
              Digital India Initiative
            </span>
            <span className="rounded bg-gray-800 text-gov-green px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider">
              NIC Hosted
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

