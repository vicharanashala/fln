import api from './api';

export interface State {
  id: string;
  name: string;
  code: string;
}

export interface District {
  id: string;
  name: string;
  code: string;
  state: string;
}

export interface Block {
  id: string;
  name: string;
  code: string;
  district: string;
  state: string;
}

export interface School {
  id: string;
  name: string;
  code: string;
  block: string;
  district: string;
  state: string;
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

export async function fetchStates(): Promise<State[]> {
  const { data } = await api.get('/states');
  return data.data ?? data;
}

export async function fetchDistricts(stateId: string): Promise<District[]> {
  const { data } = await api.get(`/districts/by-state/${stateId}`);
  return data.data ?? data;
}

export async function fetchBlocks(districtId: string): Promise<Block[]> {
  const { data } = await api.get(`/blocks/by-district/${districtId}`);
  return data.data ?? data;
}

export async function fetchSchools(blockId: string): Promise<School[]> {
  const { data } = await api.get(`/schools/by-block/${blockId}`);
  return data.data ?? data;
}

export async function createTeacher(payload: CreateTeacherPayload): Promise<CreateTeacherResponse> {
  const { data } = await api.post('/teachers', payload);
  return data;
}
