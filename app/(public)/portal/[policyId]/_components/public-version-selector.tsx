'use client'

import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PublicVersionSelectorProps {
  versions: Array<{ id: string; versionLabel: string; publishedAt: string }>
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
              {v.versionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
