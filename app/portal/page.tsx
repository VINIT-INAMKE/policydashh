import { Suspense } from 'react'
import { db } from '@/src/db'
import { policyDocuments } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { eq, desc } from 'drizzle-orm'
import { Globe } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicPolicyCard } from './_components/public-policy-card'

interface PublishedPolicy {
  policyId: string
  title: string
  description: string | null
  versionLabel: string
  publishedAt: string
}

async function PublishedPoliciesList() {
  // Query all published versions grouped by documentId, taking the latest per document
  const publishedVersions = await db
    .select({
      documentId: documentVersions.documentId,
      versionLabel: documentVersions.versionLabel,
      publishedAt: documentVersions.publishedAt,
      policyTitle: policyDocuments.title,
      policyDescription: policyDocuments.description,
    })
    .from(documentVersions)
    .innerJoin(policyDocuments, eq(documentVersions.documentId, policyDocuments.id))
    .where(eq(documentVersions.isPublished, true))
    .orderBy(desc(documentVersions.publishedAt))

  // Group by documentId and pick latest per document
  const seen = new Set<string>()
  const policies: PublishedPolicy[] = []

  for (const row of publishedVersions) {
    if (seen.has(row.documentId)) continue
    seen.add(row.documentId)
    policies.push({
      policyId: row.documentId,
      title: row.policyTitle,
      description: row.policyDescription,
      versionLabel: row.versionLabel,
      publishedAt: row.publishedAt?.toISOString() ?? new Date().toISOString(),
    })
  }

  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Globe className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No published policies</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          There are no publicly available policy documents at this time. Check back later.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {policies.map((policy) => (
        <PublicPolicyCard
          key={policy.policyId}
          policyId={policy.policyId}
          title={policy.title}
          description={policy.description}
          versionLabel={policy.versionLabel}
          publishedAt={policy.publishedAt}
        />
      ))}
    </div>
  )
}

function PolicyCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
          <div className="flex items-start justify-between">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center justify-between border-t pt-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Force dynamic rendering - published policies change when versions are published
export const dynamic = 'force-dynamic'

export default function PublicPortalPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold leading-[1.2]">Published Policies</h1>
        <p className="text-sm text-muted-foreground">
          Publicly available policy documents from this consultation.
        </p>
      </div>
      <Suspense fallback={<PolicyCardsSkeleton />}>
        <PublishedPoliciesList />
      </Suspense>
    </div>
  )
}
