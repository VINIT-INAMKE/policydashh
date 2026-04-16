'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/src/trpc/client'
import { Bell, MessageSquare, GitPullRequest, BookOpen, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'

type NotificationRow = {
  id: string
  userId: string
  type: 'feedback_status_changed' | 'cr_status_changed' | 'version_published' | 'section_assigned'
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  linkHref: string | null
  isRead: boolean
  createdAt: string
}

type TabValue = 'all' | 'unread' | 'feedback' | 'versions' | 'crs'

function getNotificationIcon(type: string, isRead: boolean) {
  const colorClass = isRead ? 'text-muted-foreground' : 'text-foreground'
  const iconProps = { className: `size-4 ${colorClass}` }

  switch (type) {
    case 'feedback_status_changed':
      return <MessageSquare {...iconProps} />
    case 'cr_status_changed':
      return <GitPullRequest {...iconProps} />
    case 'version_published':
      return <BookOpen {...iconProps} />
    case 'section_assigned':
      return <UserPlus {...iconProps} />
    default:
      return <Bell {...iconProps} />
  }
}

function filterNotifications(items: NotificationRow[], tab: TabValue): NotificationRow[] {
  switch (tab) {
    case 'unread':
      return items.filter((n) => !n.isRead)
    case 'feedback':
      return items.filter((n) => n.type === 'feedback_status_changed')
    case 'versions':
      return items.filter((n) => n.type === 'version_published')
    case 'crs':
      return items.filter((n) => n.type === 'cr_status_changed')
    default:
      return items
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [loadedPages, setLoadedPages] = useState<NotificationRow[][]>([])
  const prevDataRef = useRef<NotificationRow[] | undefined>(undefined)

  const { data: unreadCount = 0 } = trpc.notification.unreadCount.useQuery(
    undefined,
    { refetchInterval: 10_000 },
  )

  const { data: rawNotifications, isLoading } = trpc.notification.list.useQuery(
    { limit: 20, cursor },
  )

  const notifications = rawNotifications as NotificationRow[] | undefined

  // Accumulate pages as data arrives
  useEffect(() => {
    if (notifications && notifications !== prevDataRef.current) {
      prevDataRef.current = notifications
      if (!cursor) {
        // First page / reset
        setLoadedPages([notifications])
      } else {
        // Append new page
        setLoadedPages((prev) => [...prev, notifications])
      }
    }
  }, [notifications, cursor])

  const allItems = useMemo(
    () => loadedPages.flat(),
    [loadedPages],
  )

  const utils = trpc.useUtils()

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate()
      utils.notification.list.invalidate()
    },
  })

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate()
      utils.notification.list.invalidate()
    },
  })

  const filteredItems = filterNotifications(allItems, activeTab)

  // Show load more when the latest page returned exactly `limit` items
  const showLoadMore = notifications?.length === 20

  const handleNotificationClick = useCallback((notification: NotificationRow) => {
    if (!notification.isRead) {
      markReadMutation.mutate({ id: notification.id })
    }
    if (notification.linkHref) {
      router.push(notification.linkHref)
    }
  }, [markReadMutation, router])

  const handleLoadMore = useCallback(() => {
    if (allItems.length > 0) {
      const lastItem = allItems[allItems.length - 1]
      setCursor(lastItem.id)
    }
  }, [allItems])

  return (
    <div className="mx-auto max-w-2xl py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} unread</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList variant="line">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="crs">Change Requests</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {isLoading && allItems.length === 0 ? (
              <div className="space-y-2 pt-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bell className="size-12 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  You&apos;re all caught up.
                </p>
                <p className="text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              </div>
            ) : (
              <div className="divide-y pt-2">
                {filteredItems.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={`flex w-full min-h-[56px] items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      notification.isRead ? 'bg-transparent' : 'bg-muted'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 shrink-0 w-2">
                      {!notification.isRead && (
                        <span
                          className="block size-2 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                    </div>

                    {/* Icon */}
                    <div className="mt-1 shrink-0">
                      {getNotificationIcon(notification.type, notification.isRead)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${notification.isRead ? 'font-normal' : 'font-semibold'}`}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {notification.body}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </time>
                  </button>
                ))}

                {/* Load more */}
                {showLoadMore && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
