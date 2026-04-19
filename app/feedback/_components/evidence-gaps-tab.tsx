'use client'

import { useState } from 'react'
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

const FEEDBACK_TYPES = [
  'issue',
  'suggestion',
  'endorsement',
  'evidence',
  'question',
] as const

const typeLabels: Record<string, string> = {
  issue: 'Issue',
  suggestion: 'Suggestion',
  endorsement: 'Endorsement',
  evidence: 'Evidence',
  question: 'Question',
}

/**
 * Evidence Gaps tab - claims with no supporting evidence attached.
 *
 * Role gating happens at the parent GlobalFeedbackTabs level
 * (admin + research_lead). This component assumes the viewer is allowed.
 */
export function EvidenceGapsTab() {
  const [documentId, setDocumentId] = useState<string>('')
  const [sectionId, setSectionId] = useState<string>('')
  const [feedbackType, setFeedbackType] = useState<string>('')

  // E17: pass filters through to the server so the procedure scopes the
  // query on Postgres instead of shipping every gap to the client and
  // filtering in JS. Router (evidence.claimsWithoutEvidence) already
  // accepts documentId / sectionId / feedbackType input fields.
  const claimsQuery = trpc.evidence.claimsWithoutEvidence.useQuery({
    documentId: documentId || undefined,
    sectionId: sectionId || undefined,
    feedbackType: (feedbackType || undefined) as
      | 'issue'
      | 'suggestion'
      | 'endorsement'
      | 'evidence'
      | 'question'
      | undefined,
  })
  const documentsQuery = trpc.document.list.useQuery()
  const sectionsQuery = trpc.document.getSections.useQuery(
    { documentId: documentId },
    { enabled: !!documentId },
  )

  const filteredClaims = claimsQuery.data ?? []
  const documents = documentsQuery.data ?? []
  const sections = sectionsQuery.data ?? []

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

  const isLoading = claimsQuery.isLoading

  return (
    <div className="flex flex-col gap-6 pt-4">
      <p className="text-sm">
        {filteredClaims.length} item{filteredClaims.length !== 1 ? 's' : ''}{' '}
        found
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Select
            value={documentId || '__all__'}
            onValueChange={handleDocumentChange}
          >
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
          <Select
            value={feedbackType || '__all__'}
            onValueChange={handleTypeChange}
          >
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
          <h2 className="mt-4 text-[20px] font-semibold leading-[1.2]">
            No claims without evidence
          </h2>
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
                  <Badge variant="secondary">
                    {typeLabels[claim.feedbackType] ?? claim.feedbackType}
                  </Badge>
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
                    render={<Link href={`/feedback/${claim.id}`} />}
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
