'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle, Paperclip } from 'lucide-react'
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
// R24: per-tab URL-sync keys. Namespaced (`documentId`, `sectionId`,
// `feedbackType`) so they don't collide with the parent's `?tab=` or
// other tab-specific params. Unknown / invalid values are ignored and
// the server enum validation catches anything malformed.
const EVIDENCE_GAPS_URL_KEYS = {
  documentId:   'documentId',
  sectionId:    'sectionId',
  feedbackType: 'feedbackType',
} as const

const FEEDBACK_TYPE_SET = new Set<string>([
  'issue', 'suggestion', 'endorsement', 'evidence', 'question',
])

export function EvidenceGapsTab() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // R24: seed initial state from URL so refresh / share preserve filters.
  const initialDoc = searchParams.get(EVIDENCE_GAPS_URL_KEYS.documentId) || ''
  const initialSec = initialDoc
    ? (searchParams.get(EVIDENCE_GAPS_URL_KEYS.sectionId) || '')
    : ''
  const urlTypeRaw = searchParams.get(EVIDENCE_GAPS_URL_KEYS.feedbackType) || ''
  const initialType = urlTypeRaw && FEEDBACK_TYPE_SET.has(urlTypeRaw) ? urlTypeRaw : ''

  const [documentId, setDocumentIdState] = useState<string>(initialDoc)
  const [sectionId, setSectionIdState] = useState<string>(initialSec)
  const [feedbackType, setFeedbackTypeState] = useState<string>(initialType)

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

  // R24: write filter state back to URL. Preserves the `?tab=` param and
  // any other page-level keys; only the three namespaced keys are touched.
  const writeUrl = useCallback((doc: string, sec: string, type: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (doc)  params.set(EVIDENCE_GAPS_URL_KEYS.documentId, doc);  else params.delete(EVIDENCE_GAPS_URL_KEYS.documentId)
    if (sec)  params.set(EVIDENCE_GAPS_URL_KEYS.sectionId, sec);   else params.delete(EVIDENCE_GAPS_URL_KEYS.sectionId)
    if (type) params.set(EVIDENCE_GAPS_URL_KEYS.feedbackType, type); else params.delete(EVIDENCE_GAPS_URL_KEYS.feedbackType)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  function handleDocumentChange(value: string | null) {
    const nextDoc = !value || value === '__all__' ? '' : value
    setDocumentIdState(nextDoc)
    // Changing document clears the section dependency; URL must follow.
    setSectionIdState('')
    writeUrl(nextDoc, '', feedbackType)
  }

  function handleSectionChange(value: string | null) {
    const nextSec = !value || value === '__all__' ? '' : value
    setSectionIdState(nextSec)
    writeUrl(documentId, nextSec, feedbackType)
  }

  function handleTypeChange(value: string | null) {
    const nextType = !value || value === '__all__' ? '' : value
    setFeedbackTypeState(nextType)
    writeUrl(documentId, sectionId, nextType)
  }

  const isLoading = claimsQuery.isLoading
  const isError = claimsQuery.isError

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
          {/*
            S23: the section filter is disabled until a document is chosen.
            Previously there was no hint; users clicking the grayed control
            got no context. We wrap the trigger in a title-carrying span so
            both mouse hover AND screen-reader narration surface the reason,
            and add a small helper paragraph below for non-tooltip contexts.
          */}
          <Select
            value={sectionId || '__all__'}
            onValueChange={handleSectionChange}
            disabled={!documentId}
          >
            <SelectTrigger
              title={!documentId ? 'Select a document first' : undefined}
              aria-describedby={!documentId ? 'section-filter-help' : undefined}
            >
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
          {!documentId ? (
            <p
              id="section-filter-help"
              className="mt-1 text-xs text-muted-foreground"
            >
              Select a document to filter by section.
            </p>
          ) : null}
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
      ) : isError ? (
        // S10: surface query errors explicitly instead of collapsing them
        // into "No claims without evidence", which falsely implied the
        // system was fully covered when it was actually failing to load.
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <AlertCircle className="size-10 text-destructive" />
          <h2 className="mt-4 text-[20px] font-semibold leading-[1.2]">
            Couldn&apos;t load evidence gaps
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Something went wrong fetching the evidence-gap report. Check your
            connection and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => claimsQuery.refetch()}
          >
            Retry
          </Button>
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
