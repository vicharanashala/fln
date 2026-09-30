// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 2).
//
// Issue #604: full rewrite. The previous file held a hardcoded WS_TEMPLATES
// array of 6 fake entries and rendered directly from it -- every school saw
// the identical fake list, and the panel made zero apiFetch calls.
//
// This rewrite deletes the hardcoded array entirely and fetches real
// QuestionTemplate rows via /api/question-templates (the same source the
// QuestionTemplatePanel uses). Per the issue body:
//
//   - Delete lines 6-13 (the WS_TEMPLATES array).
//   - Rewrite lines 15-27 (the component body): replace the direct
//     WS_TEMPLATES.map(...) at line 19 with fetched state.

import React, { useEffect, useState } from 'react';
import { PageHeader } from './PanelShared';
import { ClipboardList, FileQuestion } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import type { QuestionTemplate } from '../../types';

export const WorksheetTemplatesPanel: React.FC = () => {
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const listRes = await apiFetch('/api/question-templates');
      if (!listRes.ok) {
        // Issue #604's "Done when" doesn't pin a specific message; a
        // generic "could not load" is honest here -- the parent panel
        // (`WorksheetsPanel.tsx`) routes real auth failures to the
        // login screen, so we don't need to duplicate that logic.
        setLoadError('Could not load question templates.');
        return;
      }
      setTemplates(await listRes.json());
      setLoadError(null);
    } catch {
      setLoadError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <PageHeader title="Worksheet Templates" desc="Pre-designed assessment templates for each grade and cycle" icon={<ClipboardList className="h-5 w-5" />} />
        <div className="p-6 text-slate-500">Loading templates...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <PageHeader title="Worksheet Templates" desc="Pre-designed assessment templates for each grade and cycle" icon={<ClipboardList className="h-5 w-5" />} />
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">{loadError}</div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Worksheet Templates" desc="Pre-designed assessment templates for each grade and cycle" icon={<ClipboardList className="h-5 w-5" />} />
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
          No question templates yet. Author at least one template in the Superadmin → Question Templates panel to populate this list.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
      <PageHeader title="Worksheet Templates" desc="Pre-designed assessment templates for each grade and cycle" icon={<ClipboardList className="h-5 w-5" />} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(t => (
          <div key={t.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <span className="font-bold text-sm">{t.name}</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                t.assessmentMode === 'observed' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800' :
                t.assessmentMode === 'both'      ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800' :
                                                  'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
              }`}>
                {t.assessmentMode === 'observed' ? 'Observed' : t.assessmentMode === 'both' ? 'Either' : 'Written'}
              </span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <FileQuestion className="h-3 w-3" />
              <span className="font-mono">{t.id}</span>
              <span>· Concept {t.conceptId}</span>
              <span>· L{t.levelNumber}</span>
            </div>
            <div className="flex flex-wrap gap-1 text-[11px]">
              {t.skills.map(s => (
                <span key={s} className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-700 dark:text-slate-300">{s}</span>
              ))}
              {t.subskills.slice(0, 2).map(s => (
                <span key={s} className="rounded bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 text-indigo-700 dark:text-indigo-300">{s}</span>
              ))}
              {t.subskills.length > 2 && (
                <span className="text-slate-500">+{t.subskills.length - 2} more</span>
              )}
            </div>
            <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>Family: {t.questionFamily}</span>
              <span>·</span>
              <span>{t.svgThemeIds.length} theme{t.svgThemeIds.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};