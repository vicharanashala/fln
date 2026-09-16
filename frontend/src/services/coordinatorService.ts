import { apiFetch } from './apiClient';

export interface State {
  id: string;
  name: string;
}

export interface District {
  id: string;
  name: string;
}

export interface Block {
  id: string;
  name: string;
  districtId: string;
}

export interface School {
  id: string;
  name: string;
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength: 'high' | 'low';
}

export interface CreateTeacherPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  school: string;
}

export interface CreateTeacherResponse {
  success: boolean;
  message: string;
  data: {
    teacherId: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('fln_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
  return res.json();
}

export async function fetchStates(): Promise<State[]> {
  return getJson('/api/states');
}

export async function fetchDistricts(stateId: string): Promise<District[]> {
  return getJson(`/api/districts/by-state/${stateId}`);
}

export async function fetchBlocks(districtId: string): Promise<Block[]> {
  return getJson(`/api/blocks/by-district/${districtId}`);
}

export async function fetchSchools(blockId: string): Promise<School[]> {
  return getJson(`/api/schools/by-block/${blockId}`);
}

export async function createTeacher(payload: CreateTeacherPayload): Promise<CreateTeacherResponse> {
  const res = await apiFetch('/api/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
