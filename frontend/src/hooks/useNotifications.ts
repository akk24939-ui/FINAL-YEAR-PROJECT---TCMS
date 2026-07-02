import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { consumerApi } from '../api/consumer.api'
import type { NotificationItem } from '../types/consumer.types'

export const NOTIFICATIONS_QUERY_KEY = ['consumer', 'notifications'] as const
export const UNREAD_COUNT_QUERY_KEY = ['consumer', 'notifications', 'unread'] as const

export function useNotifications() {
  const query = useQuery<NotificationItem[], Error>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => consumerApi.getNotifications().then(r => r.data),
    staleTime: 30_000,
  })
  return { notifications: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useUnreadCount() {
  const query = useQuery<{ unread_count: number }, Error>({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: () => consumerApi.getUnreadCount().then(r => r.data),
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 0,
  })
  return { unreadCount: query.data?.unread_count ?? 0, isLoading: query.isLoading }
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation<NotificationItem, Error, string>({
    mutationFn: (id) => consumerApi.markNotificationRead(id).then(r => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationItem[]>(NOTIFICATIONS_QUERY_KEY, (old) =>
        old ? old.map(n => n.id === updated.id ? updated : n) : old
      )
      queryClient.setQueryData<{ unread_count: number }>(UNREAD_COUNT_QUERY_KEY, (old) =>
        old ? { unread_count: Math.max(0, old.unread_count - 1) } : old
      )
    },
  })
}
