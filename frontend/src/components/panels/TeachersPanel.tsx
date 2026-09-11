// Extracted from frontend/src/components/PanelViews.tsx (issue #144, PR 4).
// Note: the role guard (SCHOOL/BLOCK_ADMIN only) stays in PanelViews.tsx's
// router line, not here — this component assumes it's already been checked.
import React, { useState } from 'react';
import { School, User, UserRole } from '../../types';
import { PageHeader } from './PanelShared';
import { Users, Plus, X } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

interface TeachersPanelProps {
  schools: School[];
  teachersList: any[];
  currentUser: User;
  token: string;
  refreshTeachers: () => void;
}

export const TeachersPanel: React.FC<TeachersPanelProps> = ({ schools, teachersList, currentUser, token, refreshTeachers }) => {
    const isBlockAdmin = currentUser.role === UserRole.BLOCK_ADMIN;
    const isSchool = currentUser.role === UserRole.SCHOOL;
    const schoolById = new Map<string, School>(schools.map(s => [s.id, s]));

    // Issue 4: Add Teacher form. A principal is locked to their own school;
    // a block admin can pick any school in their block (existing behaviour).
    const [adding, setAdding] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [pickedSchool, setPickedSchool] = useState<string>(
      // Pre-fill: principal -> their own school; otherwise the first school.
      isSchool && currentUser.schoolId
        ? currentUser.schoolId
        : (schools[0]?.id ?? '')
    );
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    const resetForm = () => {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhoneNumber('');
      setPassword('');
      setFormError('');
      setFormSuccess('');
    };

    const handleAddTeacher = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError('');
      setFormSuccess('');
      setSubmitting(true);
      try {
        const res = await apiFetch('/api/teachers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            phoneNumber: phoneNumber || undefined,
            password,
            // For principals this is a redundant confirmation — the backend
            // will reject anything that doesn't match user.schoolId. We send
            // it anyway so the backend can give a useful 400 if the principal
            // picked the wrong school in the picker.
            school: isSchool ? (currentUser.schoolId || pickedSchool) : pickedSchool,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setFormSuccess(data.message || 'Teacher registered successfully.');
          resetForm();
          // Re-fetch the teacher list so the new teacher shows up immediately.
          refreshTeachers();
          setTimeout(() => {
            setFormSuccess('');
            setAdding(false);
          }, 2500);
        } else {
          setFormError(data.error || `Failed (HTTP ${res.status}).`);
        }
      } catch (err) {
        setFormError('Network error. Check connection settings.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <PageHeader title="Teacher Roster" desc={isBlockAdmin ? 'Teaching staff across your block' : 'Manage teaching staff at your school'} icon={<Users className="h-5 w-5" />} />
          {!adding && (
            <button
              type="button"
              onClick={() => { setAdding(true); setFormError(''); setFormSuccess(''); }}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg shadow-sm"
              data-testid="open-add-teacher"
            >
              <Plus className="h-4 w-4" />
              Add Teacher
            </button>
          )}
        </div>

        {adding && (
          <form onSubmit={handleAddTeacher} className="bg-zinc-50 dark:bg-slate-950 border border-zinc-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">New Teacher</h4>
              <button
                type="button"
                onClick={() => { setAdding(false); resetForm(); }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="Close add-teacher form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 text-xs rounded-lg px-3 py-2">{formError}</div>
            )}
            {formSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-200 text-xs rounded-lg px-3 py-2">{formSuccess}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Password * <span className="font-normal normal-case">(≥8, uppercase, digit, special)</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  School * {isSchool ? <span className="font-normal normal-case">(locked to your school)</span> : null}
                </label>
                {isSchool ? (
                  <input
                    type="text"
                    value={currentUser.schoolId || ''}
                    readOnly
                    disabled
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-100 dark:bg-zinc-900 outline-none font-medium text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={pickedSchool}
                    onChange={e => setPickedSchool(e.target.value)}
                    required
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-white dark:bg-zinc-800 outline-none font-medium text-zinc-800 dark:text-zinc-100"
                  >
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-sm"
              >
                {submitting ? 'Saving…' : 'Save Teacher'}
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); resetForm(); }}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">{teachersList.map((t: any) => (
          <div key={t.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div>
              <div className="font-semibold text-sm">{t.name}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {t.email}{t.classes?.length ? ` · ${t.classes.join(', ')}` : ''}
                {isBlockAdmin && t.schoolId && ` · ${schoolById.get(t.schoolId)?.name || t.schoolId}`}
              </div>
            </div>
            <div className="text-right"><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${t.status === 'Active' ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}>{t.status}</span><div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t.studentsCount} students</div></div>
          </div>
        ))}</div>
      </div>
    );
};
