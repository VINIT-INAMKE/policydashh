'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AnonymityToggle } from './anonymity-toggle'

const FEEDBACK_TYPES = [
  { value: 'issue', label: 'Issue' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'endorsement', label: 'Endorsement' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'question', label: 'Question' },
] as const

const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const

const IMPACT_CATEGORIES = [
  { value: 'legal', label: 'Legal' },
  { value: 'security', label: 'Security' },
  { value: 'tax', label: 'Tax' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'innovation', label: 'Innovation' },
  { value: 'clarity', label: 'Clarity' },
  { value: 'governance', label: 'Governance' },
  { value: 'other', label: 'Other' },
] as const

type FeedbackType = (typeof FEEDBACK_TYPES)[number]['value']
type Priority = (typeof PRIORITIES)[number]['value']
type ImpactCategory = (typeof IMPACT_CATEGORIES)[number]['value']

interface SubmitFeedbackFormProps {
  sectionId: string
  documentId: string
  sectionTitle: string
  userName: string
  orgType: string
}

export function SubmitFeedbackForm({
  sectionId,
  documentId,
  sectionTitle,
  userName,
  orgType,
}: SubmitFeedbackFormProps) {
  const router = useRouter()

  const [feedbackType, setFeedbackType] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [impactCategory, setImpactCategory] = useState<string>('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [suggestedChange, setSuggestedChange] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  const submitMutation = trpc.feedback.submit.useMutation({
    onSuccess: (data) => {
      toast.success(`Feedback submitted. Your feedback ID is ${data.readableId}.`)
      router.push(`/policies/${documentId}`)
    },
    onError: (error) => {
      toast.error(error.message || "Couldn't submit your feedback. Check your connection and try again.")
    },
  })

  const isValid =
    feedbackType !== '' &&
    priority !== '' &&
    impactCategory !== '' &&
    title.trim().length >= 1 &&
    body.trim().length >= 10

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || feedbackType === '' || priority === '' || impactCategory === '') return

    submitMutation.mutate({
      sectionId,
      documentId,
      feedbackType: feedbackType as FeedbackType,
      priority: priority as Priority,
      impactCategory: impactCategory as ImpactCategory,
      title: title.trim(),
      body: body.trim(),
      suggestedChange: suggestedChange.trim() || undefined,
      isAnonymous,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Section context banner */}
      <div className="flex items-center gap-2 rounded-md bg-muted p-2 px-4">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-[12px] font-normal leading-[1.4] text-muted-foreground">
          Feedback on: {sectionTitle}
        </span>
      </div>

      {/* Feedback Type */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="feedback-type">Feedback Type *</Label>
        <Select
          value={feedbackType}
          onValueChange={(val) => val && setFeedbackType(val)}
        >
          <SelectTrigger id="feedback-type">
            <SelectValue placeholder="Select feedback type" />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="priority">Priority *</Label>
        <Select
          value={priority}
          onValueChange={(val) => val && setPriority(val)}
        >
          <SelectTrigger id="priority">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Impact Category */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="impact">Impact Category *</Label>
        <Select
          value={impactCategory}
          onValueChange={(val) => val && setImpactCategory(val)}
        >
          <SelectTrigger id="impact">
            <SelectValue placeholder="Select impact category" />
          </SelectTrigger>
          <SelectContent>
            {IMPACT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="Summarize your feedback in one line"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Body *</Label>
        <Textarea
          id="body"
          placeholder="Describe your feedback in detail. Be specific about what you'd like to see changed and why."
          required
          rows={6}
          minLength={10}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {/* Suggested Change */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="suggested-change">Suggested Change (optional)</Label>
        <Textarea
          id="suggested-change"
          placeholder="Describe the specific wording or structural change you propose."
          rows={4}
          maxLength={2000}
          value={suggestedChange}
          onChange={(e) => setSuggestedChange(e.target.value)}
        />
      </div>

      {/* Evidence (optional) */}
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold leading-[1.4]">Evidence (optional)</span>
        <div className="flex items-start gap-3 rounded-md bg-muted p-4">
          <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Evidence can be attached after submitting your feedback. You'll be able to add files and links from the feedback detail view.
          </p>
        </div>
      </div>

      {/* Attribution */}
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold leading-[1.4]">Attribution</span>
        <AnonymityToggle
          value={isAnonymous}
          onChange={setIsAnonymous}
          userName={userName}
          orgType={orgType}
        />
      </div>

      {/* Button row */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Discard
        </Button>
        <Button
          type="submit"
          disabled={!isValid || submitMutation.isPending}
        >
          {submitMutation.isPending && (
            <Loader2 className="mr-1 size-4 animate-spin" />
          )}
          Submit Feedback
        </Button>
      </div>
    </form>
  )
}
