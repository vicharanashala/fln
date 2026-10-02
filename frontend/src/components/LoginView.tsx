import { apiFetch } from '../services/apiClient';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from 'react';
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { User, UserRole } from '../types';

// Loaded only in an explicitly-flagged demo build — see DemoLoginPanel.
// The ternary is deliberate: Vite substitutes the env literal at build time, so in
// a normal build this folds to `null` and Rollup drops the dynamic import
// altogether. A plain `lazy(() => import(...))` would still emit the chunk as a
// fetchable file even though nothing renders it.
const DemoLoginPanel =
  import.meta.env.VITE_ENABLE_DEMO_LOGINS === 'true'
    ? lazy(() => import('./DemoLoginPanel'))
    : null;

interface LoginViewProps {
  onLoginSuccess: (token: string, user: User) => void;
  onBackToHome: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Demo one-click sign-in cards. OFF unless VITE_ENABLE_DEMO_LOGINS is explicitly
  // "true" at build time, because this panel previously shipped to production and
  // published a working Superadmin credential on the public login page.
  //
  // The password is not hardcoded any more — it comes from
  // VITE_DEMO_LOGIN_PASSWORD alongside the flag. A build with the flag on but no
  // password set renders nothing, so a partial config cannot reveal the old value.
  // The panel itself is a lazy import so the sample addresses stay out of the
  // production bundle entirely.
  const showDemoLogins =
    import.meta.env.VITE_ENABLE_DEMO_LOGINS === 'true' &&
    !!import.meta.env.VITE_DEMO_LOGIN_PASSWORD;

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      const data = await res.json();
      if (res.ok) {
        const payload = data?.data || data;
        const token = payload?.token;
        const user = payload?.user || payload?.teacher || payload;
        onLoginSuccess(token, user);
      } else {
        setError(data.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('Connection failed. Verify server state.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-12 transition-colors duration-200">
      
      {/* Container with neutral double border design */}
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200/80 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/80 p-8 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all">

        {/* Branding header */}
        <div className="flex flex-col items-center text-center">
          {/* Authentic Ashoka Pillar Emblem Visual Representation */}
          <div className="flex h-16 w-16 items-center justify-center rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-1.5 shadow-sm text-amber-800 dark:text-amber-400">
            <svg className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A3,3 0 0,0 9,5C9,6.08 9.58,7.03 10.42,7.56C9.03,8.4 8,9.88 8,11.6V13.5H16V11.6C16,9.88 14.97,8.4 13.58,7.56C14.42,7.03 15,6.08 15,5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5A1,1 0 0,1 12,6A1,1 0 0,1 11,5A1,1 0 0,1 12,4M10,15V19H14V15H10M9,20V21H15V20H9Z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl uppercase">
            FLN Portal Login
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Foundational Literacy and Numeracy (FLN) assessment scheme
          </p>
          <span className="mt-2 inline-block rounded bg-amber-100 dark:bg-amber-950/40 px-3 py-1 text-[10px] font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-widest border border-amber-200 dark:border-amber-800">
            AUTHORIZED DEPARTMENTAL SIGN-IN
          </span>
        </div>

        {/* Form panel */}
        <form className="mt-8 space-y-4" onSubmit={(e) => handleLogin(e)}>
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 dark:text-slate-300">
              Official Email Address / SSO Username
            </label>
            <input
              type="email"
              required
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.75 text-sm font-medium text-slate-950 shadow-sm placeholder-slate-400 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
              placeholder="enter mail or username"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 dark:text-slate-300">
              Official Access Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 py-2.75 pr-10 pl-3.5 text-sm font-medium text-slate-950 shadow-sm placeholder-slate-400 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
                placeholder="*********"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-xs font-semibold text-red-700 shadow-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-full bg-indigo-600 py-3.5 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-[0_14px_28px_-16px_rgba(79,70,229,0.9)] transition-all duration-200 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Verifying Digital Certificate Signature...' : 'Secure Sign In'}
          </button>
        </form>

        {showDemoLogins && DemoLoginPanel && (
          <Suspense fallback={null}>
            <DemoLoginPanel
              password={import.meta.env.VITE_DEMO_LOGIN_PASSWORD as string}
              onSelect={(demoEmail, demoPass) => handleLogin(undefined, demoEmail, demoPass)}
            />
          </Suspense>
        )}

        {/* Back to Home CTA */}
        <button
          onClick={onBackToHome}
          className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs font-extrabold text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline uppercase tracking-wider"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Public Information Portal
        </button>

        {/* Legal Disclaimer Tag */}
        <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-4 text-center text-[9px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed uppercase tracking-wider">
          Warning: Unauthorized access to this system is strictly prohibited under the IT Act, 2000. All activities are monitored.
        </div>
      </div>
    </div>
  );
};