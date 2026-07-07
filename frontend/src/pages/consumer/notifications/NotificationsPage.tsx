/**
 * NotificationsPage.tsx — Full in-app notification centre.
 * Fetches real notifications from /api/v1/consumer/notifications
 * with mark-as-read and mark-all-read functionality.
 */
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell, BellOff, CheckCheck, AlertTriangle, Info,
  AlertCircle, Check, RefreshCw, Loader2
} from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import type { NotificationItem, NotificationType } from '../../../types/consumer.types'

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, {
  icon: React.ReactNode
  bg: string
  border: string
  badge: string
  dot: string
}> = {
  DANGER: {
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-l-4 border-l-red-500',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  WARN: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-l-4 border-l-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  INFO: {
    icon: <Info className="w-5 h-5 text-blue-500" />,
    bg: '',
    border: '',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  SUCCESS: {
    icon: <Check className="w-5 h-5 text-green-500" />,
    bg: '',
    border: '',
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    dot: 'bg-green-500',
  },
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// ── Notification Card ─────────────────────────────────────────────────────────

const NotificationCard: React.FC<{
  notif: NotificationItem
  onMarkRead: (id: string) => void
  isMarking: boolean
}> = ({ notif, onMarkRead, isMarking }) => {
  const cfg = TYPE_CONFIG[notif.notification_type]
  return (
    <div className={`
      flex gap-4 p-4 rounded-2xl
      bg-white dark:bg-gray-900
      border border-gray-100 dark:border-gray-800
      transition-all duration-200 hover:shadow-md
      ${notif.is_read ? 'opacity-70' : cfg.border + ' ' + cfg.bg}
    `}>
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${cfg.badge}`}>
              {notif.notification_type}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              {notif.category.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {formatRelativeTime(notif.created_at)}
            </span>
            {!notif.is_read && (
              <div className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`} />
            )}
          </div>
        </div>
        <p className={`mt-1.5 text-sm font-semibold ${notif.is_read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {notif.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
          {notif.message}
        </p>
        {!notif.is_read && (
          <button
            onClick={() => onMarkRead(notif.id)}
            disabled={isMarking}
            className="mt-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {isMarking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Mark as read
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const NotificationsPage: React.FC = () => {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [markingId, setMarkingId] = useState<string | null>(null)

  const { data: notifications = [], isLoading, isError, refetch } = useQuery<NotificationItem[]>({
    queryKey: ['consumer-notifications'],
    queryFn: () => consumerApi.getNotifications().then(r => r.data),
    refetchInterval: 60_000,
  })

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => {
      setMarkingId(id)
      return consumerApi.markNotificationRead(id).then(r => r.data)
    },
    onSuccess: (updated) => {
      qc.setQueryData<NotificationItem[]>(['consumer-notifications'], (old = []) =>
        old.map(n => n.id === updated.id ? updated : n)
      )
      setMarkingId(null)
    },
    onError: () => setMarkingId(null),
  })

  const { mutate: markAll, isPending: markingAll } = useMutation({
    mutationFn: () => consumerApi.markAllRead(),
    onSuccess: () => {
      qc.setQueryData<NotificationItem[]>(['consumer-notifications'], (old = []) =>
        old.map(n => ({ ...n, is_read: true }))
      )
    },
  })

  const unreadCount = notifications.filter(n => !n.is_read).length
  const displayed = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-900 dark:text-gray-100 font-semibold">Failed to load notifications</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Notifications
            {unreadCount > 0 && (
              <span className="min-w-[22px] h-[22px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll()}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl w-fit">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
              filter === f
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {f} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <BellOff className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => (
            <NotificationCard
              key={n.id}
              notif={n}
              onMarkRead={markRead}
              isMarking={markingId === n.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificationsPage
