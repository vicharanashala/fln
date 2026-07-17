import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchStates,
  fetchDistricts,
  fetchBlocks,
  fetchSchools,
  createTeacher,
  State,
  District,
  Block,
  School,
  CreateTeacherPayload,
} from '../services/coordinatorService';

export function useStates() {
  return useQuery<State[]>({
    queryKey: ['states'],
    queryFn: fetchStates,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistricts(stateId: string | null) {
  return useQuery<District[]>({
    queryKey: ['districts', stateId],
    queryFn: () => fetchDistricts(stateId!),
    enabled: !!stateId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBlocks(districtId: string | null) {
  return useQuery<Block[]>({
    queryKey: ['blocks', districtId],
    queryFn: () => fetchBlocks(districtId!),
    enabled: !!districtId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSchools(blockId: string | null) {
  return useQuery<School[]>({
    queryKey: ['schools', blockId],
    queryFn: () => fetchSchools(blockId!),
    enabled: !!blockId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeacherPayload) => createTeacher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}
