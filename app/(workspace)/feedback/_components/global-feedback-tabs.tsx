'use client'

import { useSearchParams, useRouter } from 'next/navigation'
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
  const activeTab: TabValue =
    urlTab && (VALID_TABS as readonly string[]).includes(urlTab)
      ? (urlTab as TabValue)
      : defaultTab

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
  }

  return (
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
  )
}
