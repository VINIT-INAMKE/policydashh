'use client'

import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VerifiedBadge } from './verified-badge'

interface PublicVersionSelectorProps {
  versions: Array<{ id: string; versionLabel: string; publishedAt: string; txHash: string | null }>
  currentVersionId: string
  policyId: string
}

export function PublicVersionSelector({
  versions,
  currentVersionId,
  policyId,
}: PublicVersionSelectorProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">Version</label>
      <Select
        value={currentVersionId}
        onValueChange={(value: string | null) => {
          if (value) {
            router.push(`/portal/${policyId}?version=${value}`)
          }
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              <span className="flex items-center gap-2">
                {v.versionLabel}
                <VerifiedBadge txHash={v.txHash} />
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
