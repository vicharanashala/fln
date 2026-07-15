/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { User, UserRole } from '../types';

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

  const mockUsersList = [
    { label: 'Superadmin 🌐', email: 'superadmin@fln.org', pass: 'Fln@2026' },
    { label: 'Punjab Admin 🌾', email: 'admin.pb@fln.org', pass: 'Fln@2026' },
    { label: 'Haryana Admin 🌾', email: 'admin.hr@fln.org', pass: 'Fln@2026' },
    { label: 'UP Admin 🏛️', email: 'admin.up@fln.org', pass: 'Fln@2026' },
    { label: 'Rajasthan Admin 🏰', email: 'admin.rj@fln.org', pass: 'Fln@2026' },
    { label: 'Ludhiana Dist 🏢', email: 'district.ldh@fln.org', pass: 'Fln@2026' },
    { label: 'Ambala Dist 🏢', email: 'district.amb@fln.org', pass: 'Fln@2026' },
    { label: 'Ludhiana Block 🏫', email: 'block.ldh-01@fln.org', pass: 'Fln@2026' },
    { label: 'Punjab Principal 🎓', email: 'gps-mt-001@fln.org', pass: 'Fln@2026' },
    { label: 'Haryana Teacher 👩‍🏫', email: 'gps-amb-003.t01@fln.org', pass: 'Fln@2026' },
    { label: 'Punjab Volunteer 🤝', email: 'vol.rahul@fln.org', pass: 'Fln@2026' },
    { label: 'Haryana Volunteer 🤝', email: 'vol.hr_vipin@fln.org', pass: 'Fln@2026' }
  ];

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      const data = await res.json();
      if (res.ok) {
        onLoginSuccess(data.token, data.user);
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

        {/* Quick Credentials Panel for Mock Access */}
        <div className="mt-8 border-t-2 border-slate-100 dark:border-slate-800 pt-5">
          <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
            Active System Roles for Demonstration (Password: Fln@2026)
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {mockUsersList.map(u => (
              <button
                key={u.email}
                onClick={() => handleLogin(undefined, u.email, u.pass)}
                className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/70 p-2.5 text-left border border-slate-200/80 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 transition hover:-translate-y-0.5 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
              >
                <div className="font-extrabold truncate text-slate-900 dark:text-white">
                  {u.label}
                </div>
                <div className="truncate text-slate-400 dark:text-slate-500 text-[9px]">{u.email}</div>
              </button>
            ))}
          </div>
        </div>

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