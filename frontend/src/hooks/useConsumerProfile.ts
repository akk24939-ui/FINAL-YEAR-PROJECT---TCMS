import { useQuery } from '@tanstack/react-query'
import { consumerApi } from '../api/consumer.api'
import type { ConsumerProfile } from '../types/consumer.types'

export const PROFILE_QUERY_KEY = ['consumer', 'profile'] as const

export function useConsumerProfile() {
  const query = useQuery<ConsumerProfile, Error>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => consumerApi.getProfile().then(r => r.data),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
