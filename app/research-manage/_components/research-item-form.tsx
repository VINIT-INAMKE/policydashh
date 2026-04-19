'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/src/trpc/client'
import { uploadFile } from '@/src/lib/r2-upload'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ResearchStatusBadge } from './research-status-badge'
import { AnonymousPreviewCard } from '../[id]/_components/anonymous-preview-card'

/**
 * ResearchItemForm — Phase 27 D-01/D-02/D-03/D-05 (RESEARCH-06 SC-2).
 *
 * Shared metadata form rendered by /research-manage/new (mode='create') and
 * /research-manage/[id]/edit (mode='edit'). Single component, two pages —
 * keeps the field list, validation rules, and upload contract identical
 * across the create and edit surfaces.
 *
 * Decisions enforced by this component:
 *   - D-01 dedicated page (not dialog) — refresh-safe, browser-back works.
 *   - D-02 file upload fires on file-select, not on form save. The R2 upload
 *     completes before the user clicks Save Draft; the four
 *     artifact{FileName,FileSize,R2Key,PublicUrl} fields then flow into the
 *     create/update mutation, which inserts the evidence_artifacts row
 *     server-side (see src/server/routers/research.ts Pitfall 1 fix).
 *   - D-03 itemType auto-drives the upload-mode branch:
 *       * media_coverage | legal_reference → External URL input only
 *       * any other type                    → file upload zone only
 *     No manual "File vs URL" toggle exists; the type IS the toggle.
 *   - D-05 AnonymousPreviewCard renders directly below the
 *     isAuthorAnonymous Switch and re-derives `shouldHideAuthors` on every
 *     render so the preview can never desync from the final output.
 */

const RESEARCH_ITEM_TYPES = [
  'report',
  'paper',
  'dataset',
  'memo',
  'interview_transcript',
  'media_coverage',
  'legal_reference',
  'case_study',
] as const

type ResearchItemType = (typeof RESEARCH_ITEM_TYPES)[number]

const TYPE_LABELS: Record<ResearchItemType, string> = {
  report:               'Report',
  paper:                'Paper',
  dataset:              'Dataset',
  memo:                 'Memo',
  interview_transcript: 'Interview Transcript',
  media_coverage:       'Media Coverage',
  legal_reference:      'Legal Reference',
  case_study:           'Case Study',
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

interface UploadedMeta {
  name: string
  size: number
  key: string
  url: string
}

export interface ResearchItemFormInitialValues {
  id?: string
  documentId?: string
  title?: string
  itemType?: string
  description?: string
  externalUrl?: string
  artifactId?: string | null
  artifactFileName?: string | null
  artifactFileSize?: number | null
  doi?: string
  authors?: string[]
  publishedDate?: string | null
  peerReviewed?: boolean
  journalOrSource?: string
  isAuthorAnonymous?: boolean
  status?: 'draft' | 'pending_review' | 'published' | 'retracted'
}

export interface ResearchItemFormProps {
  mode: 'create' | 'edit'
  initialValues?: ResearchItemFormInitialValues
  documents: { id: string; title: string }[]
  /** Called after a successful create or update with the saved item id. */
  onSuccess: (id: string) => void
  /** Optional cancel link target — defaults to /research-manage. */
  cancelHref?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ResearchItemForm({
  mode,
  initialValues,
  documents,
  onSuccess,
  cancelHref,
}: ResearchItemFormProps) {
  // -- Form state ---------------------------------------------------------
  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [documentId, setDocumentId] = useState(initialValues?.documentId ?? '')
  const [itemType, setItemType] = useState(initialValues?.itemType ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [externalUrl, setExternalUrl] = useState(initialValues?.externalUrl ?? '')
  const [doi, setDoi] = useState(initialValues?.doi ?? '')
  const [journalOrSource, setJournalOrSource] = useState(
    initialValues?.journalOrSource ?? ''
  )
  const [authors, setAuthors] = useState<string[]>(initialValues?.authors ?? [])
  const [authorsInput, setAuthorsInput] = useState<string>(
    (initialValues?.authors ?? []).join(', ')
  )
  const [publishedDate, setPublishedDate] = useState(
    initialValues?.publishedDate ?? ''
  )
  const [peerReviewed, setPeerReviewed] = useState(
    initialValues?.peerReviewed ?? false
  )
  const [isAuthorAnonymous, setIsAuthorAnonymous] = useState(
    initialValues?.isAuthorAnonymous ?? false
  )

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedMeta, setUploadedMeta] = useState<UploadedMeta | null>(null)
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hydrate state when initialValues changes (edit mode parent fetch resolves
  // after first render).
  useEffect(() => {
    if (!initialValues) return
    if (initialValues.title !== undefined) setTitle(initialValues.title)
    if (initialValues.documentId !== undefined)
      setDocumentId(initialValues.documentId)
    if (initialValues.itemType !== undefined) setItemType(initialValues.itemType)
    if (initialValues.description !== undefined)
      setDescription(initialValues.description ?? '')
    if (initialValues.externalUrl !== undefined)
      setExternalUrl(initialValues.externalUrl ?? '')
    if (initialValues.doi !== undefined) setDoi(initialValues.doi ?? '')
    if (initialValues.journalOrSource !== undefined)
      setJournalOrSource(initialValues.journalOrSource ?? '')
    if (initialValues.authors !== undefined) {
      setAuthors(initialValues.authors)
      setAuthorsInput(initialValues.authors.join(', '))
    }
    if (initialValues.publishedDate !== undefined)
      setPublishedDate(initialValues.publishedDate ?? '')
    if (initialValues.peerReviewed !== undefined)
      setPeerReviewed(initialValues.peerReviewed)
    if (initialValues.isAuthorAnonymous !== undefined)
      setIsAuthorAnonymous(initialValues.isAuthorAnonymous)
  }, [initialValues])

  // -- Mutations ----------------------------------------------------------
  const createMutation = trpc.research.create.useMutation({
    onSuccess: (result) => {
      toast.success('Research item saved as draft.')
      onSuccess(result.id)
    },
    onError: (err) => {
      toast.error(
        err.message || "Couldn't save. Check your connection and try again."
      )
    },
  })

  const updateMutation = trpc.research.update.useMutation({
    onSuccess: (result) => {
      toast.success('Changes saved.')
      // result is the updated row; id matches initialValues.id
      onSuccess(result?.id ?? initialValues?.id ?? '')
    },
    onError: (err) => {
      toast.error(
        err.message || "Couldn't save. Check your connection and try again."
      )
    },
  })

  // -- D-02 fire-on-select upload ----------------------------------------
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadState('uploading')
    setUploadProgress(0)
    setUploadErrorMessage(null)
    try {
      const result = await uploadFile(file, {
        category: 'research',
        onProgress: setUploadProgress,
      })
      setUploadedMeta({
        name: result.name,
        size: file.size,
        key: result.key,
        url: result.url,
      })
      setUploadState('done')
    } catch (err) {
      setUploadState('error')
      setUploadErrorMessage(
        err instanceof Error ? err.message : 'Upload failed'
      )
      toast.error('Upload failed. Check your connection and try again.')
    }
  }

  function clearUpload() {
    setUploadedMeta(null)
    setUploadState('idle')
    setUploadProgress(0)
    setUploadErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // -- D-03 itemType-driven upload mode branch ----------------------------
  // External-URL types: media_coverage and legal_reference. Everything else
  // (report/paper/dataset/memo/interview_transcript/case_study, plus the
  // empty default) shows the file upload zone.
  const isExternalUrlType =
    itemType === 'media_coverage' || itemType === 'legal_reference'

  // -- Submit --------------------------------------------------------------
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Client-side minimal guard. Real validation lives in the router schema.
    if (!title.trim() || !documentId || !itemType) return

    // Commit the live authorsInput value to the authors array on submit so
    // users who don't blur the input still get their text saved.
    const liveAuthors = authorsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const commonPayload = {
      title:           title.trim(),
      description:     description.trim() || undefined,
      externalUrl:     externalUrl.trim() || undefined,
      doi:             doi.trim() || undefined,
      authors:         liveAuthors.length > 0 ? liveAuthors : undefined,
      publishedDate:   publishedDate || undefined,
      peerReviewed,
      journalOrSource: journalOrSource.trim() || undefined,
      isAuthorAnonymous,
      // Upload metadata flows server-side. The router create/update resolver
      // inserts the evidence_artifacts row and sets artifactId — keeps the
      // single-write boundary on the server (Pitfall 1).
      ...(uploadedMeta
        ? {
            artifactFileName:  uploadedMeta.name,
            artifactFileSize:  uploadedMeta.size,
            artifactR2Key:     uploadedMeta.key,
            artifactPublicUrl: uploadedMeta.url,
          }
        : {}),
    }

    if (mode === 'create') {
      createMutation.mutate({
        documentId,
        itemType: itemType as ResearchItemType,
        ...commonPayload,
      })
    } else if (mode === 'edit' && initialValues?.id) {
      updateMutation.mutate({
        id: initialValues.id,
        ...commonPayload,
      })
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const canSubmit =
    !!title.trim() && !!documentId && !!itemType && !isSubmitting

  const cancelTarget =
    cancelHref ??
    (mode === 'edit' && initialValues?.id
      ? `/research-manage/${initialValues.id}`
      : '/research-manage')

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Section 1 — Core metadata */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="research-title">Title</Label>
          <Input
            id="research-title"
            placeholder="e.g. NITI Aayog Digital Public Infrastructure Report 2024"
            required
            autoFocus
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="research-document">Document</Label>
          <Select
            value={documentId || null}
            onValueChange={(val) => setDocumentId(val ?? '')}
          >
            <SelectTrigger id="research-document">
              <SelectValue placeholder="Select a policy document" />
            </SelectTrigger>
            <SelectContent>
              {documents.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="research-itemtype">Type</Label>
          <Select
            value={itemType || null}
            onValueChange={(val) => setItemType(val ?? '')}
          >
            <SelectTrigger id="research-itemtype">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {RESEARCH_ITEM_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </Label>
          {mode === 'edit' && initialValues?.status ? (
            <ResearchStatusBadge status={initialValues.status} />
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
      </div>

      {/* Section 2 — Citation metadata */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="research-description">Description</Label>
          <Textarea
            id="research-description"
            placeholder="Abstract or summary"
            rows={4}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {!isAuthorAnonymous && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="research-authors">Authors</Label>
            <Input
              id="research-authors"
              placeholder="Comma-separated names"
              maxLength={2000}
              value={authorsInput}
              onChange={(e) => setAuthorsInput(e.target.value)}
              onBlur={() => {
                const parsed = authorsInput
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0)
                setAuthors(parsed)
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch
              checked={isAuthorAnonymous}
              onCheckedChange={(checked) => setIsAuthorAnonymous(checked)}
            />
            <span className="text-sm">Hide author identity on public surfaces</span>
          </label>
          <AnonymousPreviewCard
            isAuthorAnonymous={isAuthorAnonymous}
            authors={
              authorsInput
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="research-published-date">Published Date</Label>
          <input
            id="research-published-date"
            type="date"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={publishedDate}
            onChange={(e) => setPublishedDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="research-doi">DOI</Label>
          <Input
            id="research-doi"
            placeholder="e.g. 10.1000/xyz123"
            maxLength={100}
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="research-journal">Journal / Source</Label>
          <Input
            id="research-journal"
            placeholder="e.g. Nature, Indian Journal of Law"
            maxLength={500}
            value={journalOrSource}
            onChange={(e) => setJournalOrSource(e.target.value)}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={peerReviewed}
            onCheckedChange={(checked) => setPeerReviewed(checked === true)}
          />
          <span className="text-sm">Peer reviewed</span>
        </label>
      </div>

      {/* Section 3 — D-03 conditional attachment */}
      <div className="flex flex-col gap-2">
        {isExternalUrlType ? (
          <>
            <Label htmlFor="research-external-url">External URL</Label>
            <Input
              id="research-external-url"
              type="url"
              placeholder="https://example.com/article"
              maxLength={2000}
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Link to the source article or legal reference.
            </p>
          </>
        ) : (
          <>
            <Label htmlFor="research-attachment">Attachment</Label>
            {/* D-02: file upload fires on file-select */}
            {uploadState !== 'done' && (
              <Input
                id="research-attachment"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.csv,.xlsx,.xls"
                onChange={handleFileSelect}
                disabled={uploadState === 'uploading'}
              />
            )}
            {uploadState === 'uploading' && (
              <div className="flex flex-col gap-1">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground">Uploading…</p>
              </div>
            )}
            {uploadState === 'done' && uploadedMeta && (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-sm">
                  Uploaded {uploadedMeta.name} · {formatBytes(uploadedMeta.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearUpload}
                >
                  Remove
                </Button>
              </div>
            )}
            {uploadState === 'error' && (
              <p className="text-xs text-destructive">
                {uploadErrorMessage ??
                  'Upload failed. Check your connection and try again.'}
              </p>
            )}
            {/* Show edit-mode existing artifact info when nothing new uploaded */}
            {mode === 'edit' &&
              uploadState === 'idle' &&
              initialValues?.artifactId &&
              initialValues?.artifactFileName && (
                <p className="text-xs text-muted-foreground">
                  Currently attached: {initialValues.artifactFileName}
                  {initialValues.artifactFileSize
                    ? ` · ${formatBytes(initialValues.artifactFileSize)}`
                    : ''}
                  . Selecting a new file replaces it.
                </p>
              )}
            <p className="text-xs text-muted-foreground">
              Allowed: PDF, DOCX, DOC, CSV, XLSX, XLS · max 32 MB
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" render={<Link href={cancelTarget} />}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {mode === 'create' ? 'Save Draft' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
