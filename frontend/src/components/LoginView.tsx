/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, ArrowLeft, KeyRound, CheckCircle2, X } from 'lucide-react';
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const mockUsersList = [
    { label: 'Superadmin', email: 'superadmin@fln.org', pass: 'Fln@2026' },
    { label: 'AP State Admin', email: 'admin.ap@fln.org', pass: 'Fln@2026' },
    { label: 'Guntur District', email: 'district.gnt@fln.org', pass: 'Fln@2026' },
    { label: 'Guntur Block', email: 'block.gnt_01@fln.org', pass: 'Fln@2026' },
    { label: 'School Principal', email: 'school.ap_gnt_gnt_01_01@fln.org', pass: 'Fln@2026' },
    { label: 'Class 2 Teacher', email: 'teacher.ap_gnt_gnt_01_01.c2@fln.org', pass: 'Fln@2026' },
    { label: 'Class 3 Teacher', email: 'teacher.ap_gnt_gnt_01_01.c3@fln.org', pass: 'Fln@2026' },
    { label: 'Volunteer', email: 'vol.ap_gnt_gnt_01_03@fln.org', pass: 'Fln@2026' },
  ];

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok && res.status !== 404) {
        throw new Error('Request failed');
      }
    } catch {
      // Silently succeed — we don't reveal whether the email exists
    } finally {
      setForgotLoading(false);
      setForgotSent(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 transition-colors duration-200">
      
      {/* Container with neutral double border design */}
      <div className="w-full max-w-lg rounded-xl border-t-8 border-t-indigo-700 dark:border-t-indigo-600 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-md dark:shadow-slate-950/50 transition-all">

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
          
          {/* User Email or Username input */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Official Email Address / SSO Username
            </label>
            <input
              type="email"
              required
              className="w-full rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-700 dark:focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-700 dark:focus:ring-indigo-500 font-medium"
              placeholder="enter mail or username"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* User Password input */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Official Access Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-700 dark:focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-700 dark:focus:ring-indigo-500 font-medium"
                placeholder="*********"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => { setShowForgotPassword(true); setForgotSent(false); setForgotEmail(''); }} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                Forgot Password?
              </button>
            </div>
          </div>

          {/* Validation Alerts */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs font-bold text-red-700 dark:text-red-400 animate-shake">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Action Trigger */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-indigo-700 dark:bg-indigo-800 py-3.5 text-xs font-extrabold text-white shadow-md dark:shadow-slate-950/50 transition-all duration-150 hover:bg-indigo-600 dark:hover:bg-indigo-700 border border-indigo-300 dark:border-indigo-700 active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest cursor-pointer font-mono"
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
                disabled={loading}
                onClick={() => handleLogin(undefined, u.email, u.pass)}
                className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-left border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition hover:bg-amber-50/70 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800 hover:text-indigo-700 dark:hover:text-amber-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          onKeyDown={(e) => { if (e.key === 'Escape') setShowForgotPassword(false); }}
        >
          <div className="w-full max-w-md rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 id="forgot-password-title" className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Reset Password</h3>
              </div>
              <button onClick={() => setShowForgotPassword(false)} aria-label="Close" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!forgotSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Enter your registered email address and we will send you a password reset link.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-950 dark:text-white placeholder-slate-400 focus:border-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-700 font-medium"
                  placeholder="Enter your email address"
                />
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-lg bg-indigo-700 dark:bg-indigo-800 py-2.5 text-xs font-extrabold text-white uppercase tracking-widest hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                >
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Reset link sent!</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  If an account exists with <strong>{forgotEmail}</strong>, you will receive a password reset link shortly. Check your inbox and spam folder.
                </p>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};