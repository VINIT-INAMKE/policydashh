'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const FEEDBACK_TYPES = ['issue', 'suggestion', 'endorsement', 'evidence', 'question'] as const

const typeLabels: Record<string, string> = {
  issue: 'Issue',
  suggestion: 'Suggestion',
  endorsement: 'Endorsement',
  evidence: 'Evidence',
  question: 'Question',
}

export default function EvidenceGapsPage() {
  const router = useRouter()
  const [documentId, setDocumentId] = useState<string>('')
  const [sectionId, setSectionId] = useState<string>('')
  const [feedbackType, setFeedbackType] = useState<string>('')

  // Role gate: check if user is research_lead or admin
  const userQuery = trpc.user.getMe.useQuery()
  const user = userQuery.data

  // Redirect non-research_lead / non-admin users
  const isAllowed = user?.role === 'research_lead' || user?.role === 'admin'
  if (user && !isAllowed) {
    router.replace('/dashboard')
    return null
  }

  // Fetch all claims without evidence (no server-side filters -- client-side filtering)
  const claimsQuery = trpc.evidence.claimsWithoutEvidence.useQuery(
    {},
    { enabled: isAllowed },
  )

  // Fetch document list for filter
  const documentsQuery = trpc.document.list.useQuery(undefined, {
    enabled: isAllowed,
  })

  // Fetch sections for selected document
  const sectionsQuery = trpc.document.getSections.useQuery(
    { documentId: documentId },
    { enabled: isAllowed && !!documentId },
  )

  const allClaims = claimsQuery.data ?? []
  const documents = documentsQuery.data ?? []
  const sections = sectionsQuery.data ?? []

  // Client-side filtering
  const filteredClaims = useMemo(() => {
    let result = allClaims
    if (documentId) {
      result = result.filter((c) => c.documentId === documentId)
    }
    if (sectionId) {
      result = result.filter((c) => c.sectionId === sectionId)
    }
    if (feedbackType) {
      result = result.filter((c) => c.feedbackType === feedbackType)
    }
    return result
  }, [allClaims, documentId, sectionId, feedbackType])

  // When document changes, reset section
  function handleDocumentChange(value: string | null) {
    setDocumentId(!value || value === '__all__' ? '' : value)
    setSectionId('')
  }

  function handleSectionChange(value: string | null) {
    setSectionId(!value || value === '__all__' ? '' : value)
  }

  function handleTypeChange(value: string | null) {
    setFeedbackType(!value || value === '__all__' ? '' : value)
  }

  // Loading state
  if (userQuery.isLoading) {
    return null
  }

  if (!isAllowed) {
    return null
  }

  const isLoading = claimsQuery.isLoading

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Claims Without Evidence</h1>
        <p className="text-sm text-muted-foreground">
          Feedback items with no supporting evidence attached.
        </p>
      </div>

      {/* Count summary */}
      <p className="text-sm">
        {filteredClaims.length} item{filteredClaims.length !== 1 ? 's' : ''} found
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Select value={documentId || '__all__'} onValueChange={handleDocumentChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Documents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Documents</SelectItem>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  {doc.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={sectionId || '__all__'}
            onValueChange={handleSectionChange}
            disabled={!documentId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sections</SelectItem>
              {sections.map((sec) => (
                <SelectItem key={sec.id} value={sec.id}>
                  {sec.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select value={feedbackType || '__all__'} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Types</SelectItem>
              {FEEDBACK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {typeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CheckCircle className="size-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No gaps found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All feedback items have supporting evidence attached.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[160px]">Section</TableHead>
              <TableHead className="w-[100px]">Submitted</TableHead>
              <TableHead className="w-[140px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClaims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {claim.readableId}
                </TableCell>
                <TableCell className="max-w-0">
                  <span className="block truncate text-sm">{claim.title}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{typeLabels[claim.feedbackType] ?? claim.feedbackType}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {claim.sectionName}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(claim.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Attach evidence to ${claim.readableId}: ${claim.title}`}
                    render={<Link href={`/feedback/${claim.id}/evidence`} />}
                  >
                    <Paperclip className="size-3.5" />
                    Attach Evidence
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
