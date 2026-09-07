// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 2).
//
// Issue #293: this panel used to show hardcoded fake metrics ("3 Active
// Sessions", "72% Avg Score", "85% Completion Rate") regardless of who was
// logged in or how many real sessions existed. Investigating the fix
// surfaced that there is no backend concept of an "adaptive session"
// anywhere in this codebase at all — no route, no collection, nothing to
// wire these numbers up to. The "Start New Adaptive Test" / "View Session
// Logs" buttons below had no onClick handlers either; they were dead
// ends, not just visually unwired.
//
// Building real adaptive-session tracking (start/stop a session, persist
// per-question difficulty adjustment, compute a real average score and
// completion rate) is a new backend feature, not a data-wiring fix — out
// of scope to invent under pilot time pressure. This panel is now honest
// about that instead of showing fabricated activity: it states the
// feature isn't available yet rather than lying with numbers.
import React from 'react';
import { PageHeader } from './PanelShared';
import { SlidersHorizontal } from 'lucide-react';

export const AdaptiveTestPanel: React.FC = () => {
  return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
        <PageHeader title="Adaptive Assessment" desc="Computer-adaptive testing that adjusts to student ability" icon={<SlidersHorizontal className="h-5 w-5" />} />
        <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 bg-slate-50 dark:bg-slate-800 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Adaptive testing isn't available yet</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            This will let the system pick harder or easier questions in real time based on a student's answers, to pinpoint their exact FLN level.
            For now, use the Diagnostic Test tab to assess students.
          </p>
        </div>
      </div>
  );
};
