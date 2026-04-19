'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AllFeedbackTab } from './all-feedback-tab'
import { MyOutcomesTab } from './my-outcomes-tab'
import { EvidenceGapsTab } from './evidence-gaps-tab'

interface GlobalFeedbackTabsProps {
  canSeeAll: boolean
  canSeeEvidenceGaps: boolean
}

const VALID_TABS = ['all', 'outcomes', 'evidence-gaps'] as const
type TabValue = (typeof VALID_TABS)[number]

export function GlobalFeedbackTabs({
  canSeeAll,
  canSeeEvidenceGaps,
}: GlobalFeedbackTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Default tab based on role: admin/policy_lead/auditor land on "all", others on "outcomes"
  const defaultTab: TabValue = canSeeAll ? 'all' : 'outcomes'

  const urlTab = searchParams.get('tab')

  // S13: validate the URL tab against BOTH the enum AND the caller's role.
  // A link to ?tab=evidence-gaps shared with a non-admin previously silently
  // collapsed to the default tab with no feedback. Now we detect the
  // unauthorized-tab case, surface a one-shot notice, and strip `tab` from
  // the URL so refreshes don't re-trigger the notice.
  const isAccessibleTab = (tab: string): tab is TabValue => {
    if (!(VALID_TABS as readonly string[]).includes(tab)) return false
    if (tab === 'all' && !canSeeAll) return false
    if (tab === 'evidence-gaps' && !canSeeEvidenceGaps) return false
    return true
  }

  const urlTabIsInvalid = !!urlTab && !isAccessibleTab(urlTab)
  const activeTab: TabValue =
    urlTab && isAccessibleTab(urlTab) ? urlTab : defaultTab

  const [showAccessDenied, setShowAccessDenied] = useState(urlTabIsInvalid)

  useEffect(() => {
    if (!urlTabIsInvalid) return
    // Strip the invalid tab from the URL so a refresh doesn't re-show the
    // notice and the browser history no longer holds the dead link.
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tab')
    const qs = params.toString()
    router.replace(`/feedback${qs ? `?${qs}` : ''}`)
  }, [urlTabIsInvalid, router, searchParams])

  const handleTabChange = (value: string | number | null) => {
    const tab = String(value ?? defaultTab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === defaultTab) {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.replace(`/feedback${qs ? `?${qs}` : ''}`)
    setShowAccessDenied(false)
  }

  return (
    <>
      {showAccessDenied ? (
        <div
          role="status"
          className="mb-3 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            You don&apos;t have access to that tab. Showing your default
            feedback view instead.
          </span>
        </div>
      ) : null}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {canSeeAll && <TabsTrigger value="all">All Feedback</TabsTrigger>}
          <TabsTrigger value="outcomes">My Outcomes</TabsTrigger>
          {canSeeEvidenceGaps && (
            <TabsTrigger value="evidence-gaps">Evidence Gaps</TabsTrigger>
          )}
        </TabsList>

        {canSeeAll && (
          <TabsContent value="all">
            <AllFeedbackTab />
          </TabsContent>
        )}
        <TabsContent value="outcomes">
          <MyOutcomesTab />
        </TabsContent>
        {canSeeEvidenceGaps && (
          <TabsContent value="evidence-gaps">
            <EvidenceGapsTab />
          </TabsContent>
        )}
      </Tabs>
    </>
  )
}
