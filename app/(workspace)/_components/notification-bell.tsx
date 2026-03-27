'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/src/trpc/client'
import { Bell, MessageSquare, GitPullRequest, BookOpen, UserPlus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
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

export function NotificationBell() {
  const router = useRouter()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const { data: unreadCount = 0 } = trpc.notification.unreadCount.useQuery(
    undefined,
    { refetchInterval: 10_000 },
  )

  const { data: notifications, isLoading } = trpc.notification.list.useQuery(
    { limit: 20 },
    { enabled: popoverOpen },
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

  const allNotifications = (notifications ?? []) as NotificationRow[]
  const displayedNotifications = activeTab === 'unread'
    ? allNotifications.filter((n) => !n.isRead)
    : allNotifications

  const handleNotificationClick = (notification: NotificationRow) => {
    if (!notification.isRead) {
      markReadMutation.mutate({ id: notification.id })
    }
    if (notification.linkHref) {
      router.push(notification.linkHref)
      setPopoverOpen(false)
    }
  }

  const bellLabel = unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications'

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={bellLabel} className="relative" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary p-0 text-[10px] text-primary-foreground"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-[360px] max-h-[480px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-xl font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4">
            <TabsList variant="line">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <NotificationList
              notifications={displayedNotifications}
              isLoading={isLoading}
              onItemClick={handleNotificationClick}
            />
          </TabsContent>

          <TabsContent value="unread" className="mt-0">
            <NotificationList
              notifications={displayedNotifications}
              isLoading={isLoading}
              onItemClick={handleNotificationClick}
            />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              router.push('/notifications')
              setPopoverOpen(false)
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationList({
  notifications,
  isLoading,
  onItemClick,
}: {
  notifications: NotificationRow[]
  isLoading: boolean
  onItemClick: (notification: NotificationRow) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Bell className="size-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No notifications yet.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-[320px]">
      <div className="divide-y">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className={`flex w-full min-h-[44px] items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/50 ${
              notification.isRead ? 'bg-transparent' : 'bg-muted'
            }`}
            onClick={() => onItemClick(notification)}
          >
            <div className="mt-1 shrink-0">
              {getNotificationIcon(notification.type, notification.isRead)}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm ${notification.isRead ? 'font-normal' : 'font-semibold'}`}>
                {notification.title}
              </p>
              {notification.body && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {notification.body}
                </p>
              )}
            </div>
            <time className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </time>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
