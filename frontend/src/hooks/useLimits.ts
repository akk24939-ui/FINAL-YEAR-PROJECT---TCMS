import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { consumerApi } from '../api/consumer.api'
import type {
  ConsumerLimitsResponse,
  ConsumerLimitsUpdateRequest,
  SelfRestrictionData,
  LockRequest,
} from '../types/consumer.types'

export const LIMITS_QUERY_KEY = ['consumer', 'limits'] as const
export const RESTRICTION_QUERY_KEY = ['consumer', 'restriction'] as const

// ── New ConsumerLimits hook (dedicated limits table) ──────────────────────────
export function useLimits() {
  const query = useQuery<ConsumerLimitsResponse, Error>({
    queryKey: LIMITS_QUERY_KEY,
    queryFn: () => consumerApi.getLimits().then(r => r.data),
    staleTime: 60_000,
    retry: 1,
  })
  return {
    limits: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useUpdateLimits() {
  const queryClient = useQueryClient()
  return useMutation<ConsumerLimitsResponse, Error, ConsumerLimitsUpdateRequest>({
    mutationFn: (data) => consumerApi.updateLimits(data).then(r => r.data),
    onSuccess: (data) => queryClient.setQueryData(LIMITS_QUERY_KEY, data),
  })
}

// ── Self-restriction lock hooks (SelfRestriction table — unchanged) ────────────
export function useLockLimits() {
  const queryClient = useQueryClient()
  return useMutation<SelfRestrictionData, Error, LockRequest>({
    mutationFn: (data) => consumerApi.lockLimits(data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIMITS_QUERY_KEY })
    },
  })
}

export function useConfirmIncrease() {
  const queryClient = useQueryClient()
  return useMutation<SelfRestrictionData, Error, void>({
    mutationFn: () => consumerApi.confirmIncrease().then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIMITS_QUERY_KEY })
    },
  })
}
