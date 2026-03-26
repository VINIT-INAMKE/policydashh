'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { trpc } from '@/src/trpc/client'
import { useUser } from '@clerk/nextjs'
import { CommentThread, type ThreadData } from './comment-thread'
import type { PendingComment } from './comment-bubble'
import type { Editor } from '@tiptap/core'

interface CommentPanelProps {
  editor: Editor
  sectionId: string
  isOpen: boolean
  onClose: () => void
  activeCommentId?: string | null
  pendingComment: PendingComment | null
  onCommentCreated?: () => void
  onClearPending?: () => void
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1200)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isDesktop
}

export function CommentPanel({
  editor,
  sectionId,
  isOpen,
  onClose,
  activeCommentId,
  pendingComment,
  onCommentCreated,
  onClearPending,
}: CommentPanelProps) {
  const { user } = useUser()
  const isDesktop = useIsDesktop()
  const [newCommentBody, setNewCommentBody] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)

  // tRPC queries and mutations
  const utils = trpc.useUtils()

  const threadsQuery = trpc.comments.list.useQuery(
    { sectionId },
    { enabled: isOpen },
  )

  const createMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ sectionId })
      onCommentCreated?.()
    },
    onError: () => {
      toast.error("Couldn't post your comment. Check your connection and try again.")
    },
  })

  const replyMutation = trpc.comments.createReply.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ sectionId })
    },
    onError: () => {
      toast.error("Couldn't post your reply. Try again.")
    },
  })

  const resolveMutation = trpc.comments.resolve.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ sectionId })
    },
    onError: () => {
      toast.error("Couldn't resolve this thread. Try again.")
    },
  })

  const reopenMutation = trpc.comments.reopen.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ sectionId })
    },
  })

  const deleteMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ sectionId })
    },
  })

  // Build userNames map from thread data (fallback: "User")
  const userNames = useMemo(() => {
    const map = new Map<string, string>()
    if (user) {
      map.set(user.id, user.fullName ?? 'You')
    }
    return map
  }, [user])

  const threads = (threadsQuery.data ?? []) as ThreadData[]
  const openThreads = threads.filter((t) => !t.resolved)
  const resolvedThreads = threads.filter((t) => t.resolved)

  // Reset form when pending comment changes
  useEffect(() => {
    if (pendingComment) {
      setNewCommentBody('')
    }
  }, [pendingComment])

  const handlePostComment = useCallback(async () => {
    if (!pendingComment || !newCommentBody.trim() || isPostingComment) return
    setIsPostingComment(true)

    try {
      const commentId = crypto.randomUUID()

      // Apply the InlineComment mark to the selected text
      editor
        .chain()
        .focus()
        .setTextSelection({ from: pendingComment.from, to: pendingComment.to })
        .setInlineComment(commentId)
        .run()

      // Save thread to DB
      await createMutation.mutateAsync({
        sectionId,
        commentId,
        body: newCommentBody.trim(),
      })

      setNewCommentBody('')
      onClearPending?.()
    } catch {
      // Error already toasted by mutation onError
    } finally {
      setIsPostingComment(false)
    }
  }, [pendingComment, newCommentBody, isPostingComment, editor, sectionId, createMutation, onClearPending])

  const handleCancelComment = useCallback(() => {
    setNewCommentBody('')
    onClearPending?.()
  }, [onClearPending])

  const handleReply = useCallback(
    async (threadId: string, body: string) => {
      await replyMutation.mutateAsync({ threadId, body })
    },
    [replyMutation],
  )

  const handleResolve = useCallback(
    (id: string) => {
      resolveMutation.mutate({ id })
    },
    [resolveMutation],
  )

  const handleReopen = useCallback(
    (id: string) => {
      reopenMutation.mutate({ id })
    },
    [reopenMutation],
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate({ id })
    },
    [deleteMutation],
  )

  // Truncate text at 40 chars
  const anchorPreview = pendingComment
    ? pendingComment.text.length > 40
      ? pendingComment.text.slice(0, 40) + '...'
      : pendingComment.text
    : ''

  const panelContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-xl font-semibold leading-[1.2]">Comments</h2>
        {isDesktop && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close comments panel">
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* New comment form */}
      {pendingComment && (
        <div className="mx-4 mt-3 rounded-md border border-border bg-muted p-4">
          <p className="text-xs italic text-muted-foreground">
            Commenting on: &quot;{anchorPreview}&quot;
          </p>
          <Textarea
            placeholder="Add a comment..."
            value={newCommentBody}
            onChange={(e) => setNewCommentBody(e.target.value.slice(0, 2000))}
            rows={3}
            disabled={isPostingComment}
            autoFocus
            className="mt-2 min-h-0"
          />
          {newCommentBody.length >= 1800 && (
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {newCommentBody.length} / 2000
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handlePostComment}
              disabled={!newCommentBody.trim() || isPostingComment}
            >
              {isPostingComment && <Loader2 className="size-3 animate-spin" />}
              Post comment
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelComment}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="open" className="mt-3 flex-1 overflow-hidden px-4">
        <TabsList>
          <TabsTrigger value="open">Open ({openThreads.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedThreads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-2 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {threadsQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5 rounded-md border border-border p-4">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))}
              </div>
            ) : openThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-semibold">No comments yet</p>
                <p className="text-xs text-muted-foreground">
                  Select text in the document to leave a comment.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {openThreads.map((thread) => (
                  <CommentThread
                    key={thread.id}
                    thread={thread}
                    onResolve={handleResolve}
                    onReopen={handleReopen}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    currentUserId={user?.id ?? ''}
                    isActive={activeCommentId === thread.commentId}
                    userNames={userNames}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="resolved" className="mt-2 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {resolvedThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-semibold">No resolved comments</p>
                <p className="text-xs text-muted-foreground">
                  Resolved threads will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {resolvedThreads.map((thread) => (
                  <CommentThread
                    key={thread.id}
                    thread={thread}
                    onResolve={handleResolve}
                    onReopen={handleReopen}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    currentUserId={user?.id ?? ''}
                    isActive={activeCommentId === thread.commentId}
                    userNames={userNames}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )

  if (!isOpen) return null

  // Desktop: inline panel
  if (isDesktop) {
    return (
      <div
        className="h-full w-[320px] shrink-0 border-l border-border bg-background"
        style={{ animation: 'slideInRight 200ms ease-out' }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
        {panelContent}
      </div>
    )
  }

  // Mobile: Sheet
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[320px] p-0 sm:max-w-[320px]">
        <SheetHeader className="sr-only">
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>
        {panelContent}
      </SheetContent>
    </Sheet>
  )
}
