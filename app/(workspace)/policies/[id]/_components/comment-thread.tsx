'use client'

import { useState } from 'react'
import {
  MoreHorizontal,
  CheckCheck,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { getPresenceColor, getInitials } from '@/src/lib/collaboration/presence-colors'

/** Relative time formatter */
function formatRelativeTime(date: Date | string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

export interface ThreadReply {
  id: string
  threadId: string
  authorId: string
  body: string
  createdAt: string
}

export interface ThreadData {
  id: string
  sectionId: string
  commentId: string
  authorId: string
  body: string
  resolved: boolean
  orphaned: boolean
  createdAt: string
  updatedAt: string
  replies: ThreadReply[]
}

interface CommentThreadProps {
  thread: ThreadData
  onResolve: (id: string) => void
  onReopen: (id: string) => void
  onDelete: (id: string) => void
  onReply: (threadId: string, body: string) => Promise<void>
  currentUserId: string
  isActive: boolean
  /** Map of userId -> displayName for showing author names */
  userNames?: Map<string, string>
}

export function CommentThread({
  thread,
  onResolve,
  onReopen,
  onDelete,
  onReply,
  currentUserId,
  isActive,
  userNames,
}: CommentThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOwner = thread.authorId === currentUserId
  const authorName = userNames?.get(thread.authorId) ?? 'User'
  const authorColor = getPresenceColor(thread.authorId)
  const authorInitials = getInitials(authorName)

  const handleReplySubmit = async () => {
    if (!replyText.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onReply(thread.id, replyText.trim())
      setReplyText('')
      setShowReplyForm(false)
    } catch {
      toast.error("Couldn't post your reply. Try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResolve = () => {
    onResolve(thread.id)
    toast('Thread resolved.')
  }

  const handleReopen = () => {
    onReopen(thread.id)
    toast('Thread reopened.')
  }

  const handleDelete = () => {
    onDelete(thread.id)
    toast('Comment deleted.', {
      action: {
        label: 'Undo',
        onClick: () => {
          // Undo is fire-and-forget; the parent can re-fetch
        },
      },
      duration: 5000,
    })
  }

  return (
    <div
      className={`rounded-md border border-border p-4 mb-2 transition-colors ${
        thread.resolved
          ? 'bg-muted'
          : isActive
            ? 'bg-muted/50'
            : 'bg-background'
      }`}
      data-comment-thread-id={thread.commentId}
    >
      {/* Thread header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Author avatar */}
          <div
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: authorColor.bg }}
          >
            {authorInitials}
          </div>
          <span className={`text-xs font-semibold ${thread.resolved ? 'text-muted-foreground' : ''}`}>
            {authorName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(thread.createdAt)}
          </span>
          {thread.resolved && (
            <Badge variant="secondary" className="ml-1 h-4 text-[10px]">
              Resolved
            </Badge>
          )}
        </div>

        {/* Action menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" aria-label="Thread actions" />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom">
            {thread.resolved ? (
              <DropdownMenuItem onClick={handleReopen}>
                <RotateCcw className="size-3.5" />
                Reopen thread
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={handleResolve}>
                  <CheckCheck className="size-3.5" />
                  Resolve thread
                </DropdownMenuItem>
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                      Delete comment
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Root comment body */}
      <p className={`mt-1 text-sm leading-relaxed ${thread.resolved ? 'text-muted-foreground' : ''}`}>
        {thread.body}
      </p>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {thread.replies.map((reply) => {
            const replyName = userNames?.get(reply.authorId) ?? 'User'
            return (
              <div key={reply.id} className="ml-4 border-l-2 border-border pl-3">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold ${thread.resolved ? 'text-muted-foreground' : ''}`}>
                    {replyName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(reply.createdAt)}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${thread.resolved ? 'text-muted-foreground' : ''}`}>
                  {reply.body}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Reply button + Resolve button (open threads only) */}
      {!thread.resolved && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResolve}
            aria-label={`Resolve comment thread by ${authorName}`}
          >
            <CheckCheck className="size-3.5" />
            Resolve
          </Button>
        </div>
      )}

      {/* Inline reply form */}
      {showReplyForm && !thread.resolved && (
        <div className="mt-2 ml-4 border-l-2 border-border pl-3">
          <Textarea
            placeholder="Add a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value.slice(0, 2000))}
            rows={2}
            disabled={isSubmitting}
            autoFocus
            className="min-h-0"
          />
          {replyText.length >= 1800 && (
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {replyText.length} / 2000
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleReplySubmit}
              disabled={!replyText.trim() || isSubmitting}
            >
              {isSubmitting && <Loader2 className="size-3 animate-spin" />}
              Post reply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReplyForm(false)
                setReplyText('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
