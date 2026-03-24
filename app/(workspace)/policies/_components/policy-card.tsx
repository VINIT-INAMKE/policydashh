'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditPolicyDialog } from './edit-policy-dialog'
import { DeletePolicyDialog } from './delete-policy-dialog'

interface PolicyCardProps {
  policy: {
    id: string
    title: string
    description: string | null
    sectionCount: number
    updatedAt: Date | string
  }
}

export function PolicyCard({ policy }: PolicyCardProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <Card
        className="cursor-pointer transition-all hover:border-primary/20 hover:shadow-sm"
        onClick={() => router.push(`/policies/${policy.id}`)}
        role="link"
        aria-label={`${policy.title}, ${policy.sectionCount} sections, updated ${formatDistanceToNow(new Date(policy.updatedAt), { addSuffix: true })}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-snug">{policy.title}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More options for ${policy.title}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditOpen(true)
                  }}
                >
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteOpen(true)
                  }}
                >
                  Delete Policy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {policy.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {policy.description}
            </p>
          )}
        </CardHeader>
        <CardFooter className="flex items-center justify-between">
          <Badge variant="secondary">
            {policy.sectionCount} {policy.sectionCount === 1 ? 'section' : 'sections'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(policy.updatedAt), { addSuffix: true })}
          </span>
        </CardFooter>
      </Card>

      <EditPolicyDialog
        policy={policy}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeletePolicyDialog
        policy={policy}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
