/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * One-click demo sign-in cards.
 *
 * This lives in its own module and is loaded lazily so that neither the sample
 * account addresses nor the panel markup end up in a production bundle. An
 * earlier version of this panel shipped to production and published a working
 * Superadmin credential on the public login page; keeping it out of the main
 * chunk means a future edit cannot reintroduce that by accident.
 *
 * Rendered only when VITE_ENABLE_DEMO_LOGINS === 'true' AND
 * VITE_DEMO_LOGIN_PASSWORD is set. See LoginView.
 */

interface DemoLoginPanelProps {
  password: string;
  onSelect: (email: string, password: string) => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Superadmin 🌐', email: 'superadmin@fln.org' },
  { label: 'Punjab Admin 🌾', email: 'admin.pb@fln.org' },
  { label: 'Haryana Admin 🌾', email: 'admin.hr@fln.org' },
  { label: 'UP Admin 🏛️', email: 'admin.up@fln.org' },
  { label: 'Rajasthan Admin 🏰', email: 'admin.rj@fln.org' },
  { label: 'Ludhiana Dist 🏢', email: 'district.ldh@fln.org' },
  { label: 'Ambala Dist 🏢', email: 'district.amb@fln.org' },
  { label: 'Ludhiana Block 🏫', email: 'block.ldh_01@fln.org' },
  { label: 'Punjab Principal 🎓', email: 'school.pb_ldh_ldh_01_01@fln.org' },
  { label: 'Haryana Teacher 👩‍🏫', email: 'teacher.hr_amb_amb_01_01.c2@fln.org' },
  { label: 'Punjab Volunteer 🤝', email: 'vol.pb_ldh_ldh_01_03@fln.org' },
  { label: 'Haryana Volunteer 🤝', email: 'vol.hr_amb_amb_01_03@fln.org' }
];

const DemoLoginPanel: React.FC<DemoLoginPanelProps> = ({ password, onSelect }) => (
  <div className="mt-8 border-t-2 border-slate-100 dark:border-slate-800 pt-5">
    <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
      Demo build — sample roles
    </p>
    <div className="grid grid-cols-2 gap-2 text-[10px]">
      {DEMO_ACCOUNTS.map(u => (
        <button
          key={u.email}
          onClick={() => onSelect(u.email, password)}
          className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-left border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition hover:bg-amber-50/70 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800 hover:text-indigo-700 dark:hover:text-amber-400 cursor-pointer"
        >
          <div className="font-extrabold truncate text-slate-900 dark:text-white">
            {u.label}
          </div>
          <div className="truncate text-slate-400 dark:text-slate-500 text-[9px]">{u.email}</div>
        </button>
      ))}
    </div>
  </div>
);

export default DemoLoginPanel;
