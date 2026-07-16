import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useStates, useDistricts, useBlocks, useSchools, useCreateTeacher } from '../hooks/useCoordinator';
import { UserRole } from '../types';

type Role = 'teacher' | 'admin' | 'superadmin';

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: Role;
  stateId: string;
  districtId: string;
  blockId: string;
  schoolId: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
];

export default function CoordinatorRegistration() {
  const navigate = useNavigate();
  const createTeacherMutation = useCreateTeacher();

  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');

  const { data: states, isLoading: statesLoading, isError: statesError } = useStates();
  const { data: districts, isLoading: districtsLoading } = useDistricts(selectedState || null);
  const { data: blocks, isLoading: blocksLoading } = useBlocks(selectedDistrict || null);
  const { data: schools, isLoading: schoolsLoading } = useSchools(selectedBlock || null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      role: 'teacher',
      stateId: '',
      districtId: '',
      blockId: '',
      schoolId: '',
    },
  });

  const selectedRole = watch('role');
  const isTeacher = selectedRole === 'teacher';

  const onStateChange = (stateId: string) => {
    setSelectedState(stateId);
    setSelectedDistrict('');
    setSelectedBlock('');
    setValue('districtId', '');
    setValue('blockId', '');
    setValue('schoolId', '');
  };

  const onDistrictChange = (districtId: string) => {
    setSelectedDistrict(districtId);
    setSelectedBlock('');
    setValue('blockId', '');
    setValue('schoolId', '');
  };

  const onBlockChange = (blockId: string) => {
    setSelectedBlock(blockId);
    setValue('schoolId', '');
  };

  const onSubmit = async (formData: FormValues) => {
    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      password: formData.password,
      school: isTeacher ? formData.schoolId : '000000000000000000000000',
    };

    createTeacherMutation.mutate(payload, {
      onSuccess: () => {
        reset();
        setSelectedState('');
        setSelectedDistrict('');
        setSelectedBlock('');
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Register New Coordinator</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a new teacher or administrative account
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
      </div>

      {createTeacherMutation.isSuccess && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Coordinator registered successfully!
        </div>
      )}

      {createTeacherMutation.isError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {(createTeacherMutation.error as any)?.response?.data?.message ||
            (createTeacherMutation.error as Error).message ||
            'Failed to register coordinator. Please try again.'}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Account Details</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                {...register('firstName', {
                  required: 'First name is required',
                  maxLength: { value: 50, message: 'Max 50 characters' },
                })}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                  errors.firstName ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'
                }`}
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-slate-700">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                {...register('lastName', {
                  required: 'Last name is required',
                  maxLength: { value: 50, message: 'Max 50 characters' },
                })}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                  errors.lastName ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'
                }`}
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Invalid email format',
                  },
                })}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                  errors.email ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phoneNumber" className="mb-1 block text-sm font-medium text-slate-700">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phoneNumber"
                type="tel"
                {...register('phoneNumber', {
                  required: 'Phone number is required',
                  pattern: {
                    value: /^[+]?[\d\s()-]{10,15}$/,
                    message: 'Invalid phone number',
                  },
                })}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                  errors.phoneNumber ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'
                }`}
              />
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.phoneNumber.message}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
                pattern: {
                  value: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/,
                  message: 'Must include uppercase, number & special character',
                },
              })}
              className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                errors.password ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Min 8 chars, 1 uppercase, 1 number, 1 special character
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Role & Access</h2>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
              Role <span className="text-red-500">*</span>
            </label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <select
                  id="role"
                  value={field.value}
                  onChange={(e) => {
                    field.onChange(e);
                    if (e.target.value !== 'teacher') {
                      setSelectedState('');
                      setSelectedDistrict('');
                      setSelectedBlock('');
                      setValue('stateId', '');
                      setValue('districtId', '');
                      setValue('blockId', '');
                      setValue('schoolId', '');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

          {isTeacher && (
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">School Assignment</h3>

              <div>
                <label htmlFor="stateId" className="mb-1 block text-sm font-medium text-slate-700">
                  State <span className="text-red-500">*</span>
                </label>
                {statesLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading states...
                  </div>
                ) : statesError ? (
                  <p className="text-sm text-red-600">Failed to load states. Please refresh.</p>
                ) : (
                  <select
                    id="stateId"
                    value={selectedState}
                    {...register('stateId', {
                      required: isTeacher ? 'State is required' : false,
                      onChange(e) {
                        onStateChange(e.target.value);
                      },
                    })}
                    className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                      errors.stateId ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-300'
                    }`}
                  >
                    <option value="">Select State</option>
                    {states?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                {errors.stateId && (
                  <p className="mt-1 text-xs text-red-600">{errors.stateId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="districtId" className="mb-1 block text-sm font-medium text-slate-700">
                  District <span className="text-red-500">*</span>
                </label>
                <select
                  id="districtId"
                  value={selectedDistrict}
                  disabled={!selectedState || districtsLoading}
                  {...register('districtId', {
                    required: isTeacher ? 'District is required' : false,
                    onChange(e) {
                      onDistrictChange(e.target.value);
                    },
                  })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                    !selectedState
                      ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                      : errors.districtId
                        ? 'border-red-400 ring-1 ring-red-400'
                        : 'border-slate-300'
                  }`}
                >
                  <option value="">
                    {districtsLoading ? 'Loading districts...' : 'Select District'}
                  </option>
                  {districts?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {errors.districtId && (
                  <p className="mt-1 text-xs text-red-600">{errors.districtId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="blockId" className="mb-1 block text-sm font-medium text-slate-700">
                  Block <span className="text-red-500">*</span>
                </label>
                <select
                  id="blockId"
                  value={selectedBlock}
                  disabled={!selectedDistrict || blocksLoading}
                  {...register('blockId', {
                    required: isTeacher ? 'Block is required' : false,
                    onChange(e) {
                      onBlockChange(e.target.value);
                    },
                  })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                    !selectedDistrict
                      ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                      : errors.blockId
                        ? 'border-red-400 ring-1 ring-red-400'
                        : 'border-slate-300'
                  }`}
                >
                  <option value="">
                    {blocksLoading ? 'Loading blocks...' : 'Select Block'}
                  </option>
                  {blocks?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errors.blockId && (
                  <p className="mt-1 text-xs text-red-600">{errors.blockId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="schoolId" className="mb-1 block text-sm font-medium text-slate-700">
                  School <span className="text-red-500">*</span>
                </label>
                <select
                  id="schoolId"
                  disabled={!selectedBlock || schoolsLoading}
                  {...register('schoolId', {
                    required: isTeacher ? 'School is required' : false,
                  })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                    !selectedBlock
                      ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                      : errors.schoolId
                        ? 'border-red-400 ring-1 ring-red-400'
                        : 'border-slate-300'
                  }`}
                >
                  <option value="">
                    {schoolsLoading ? 'Loading schools...' : 'Select School'}
                  </option>
                  {schools?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.schoolId && (
                  <p className="mt-1 text-xs text-red-600">{errors.schoolId.message}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createTeacherMutation.isPending}
            className="rounded-lg bg-primary-navy px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-navy-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createTeacherMutation.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Registering...
              </span>
            ) : (
              'Register Coordinator'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
