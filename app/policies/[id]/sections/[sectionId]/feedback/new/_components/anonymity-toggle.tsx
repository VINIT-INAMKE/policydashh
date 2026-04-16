'use client'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

interface AnonymityToggleProps {
  value: boolean
  onChange: (isAnonymous: boolean) => void
  userName: string
  orgType: string
}

export function AnonymityToggle({
  value,
  onChange,
  userName,
  orgType,
}: AnonymityToggleProps) {
  return (
    <div className="rounded-md bg-muted p-4">
      <h3 className="text-[14px] font-semibold leading-[1.4]">
        How should your feedback be attributed?
      </h3>
      <p className="mt-1 text-[12px] font-normal leading-[1.4] text-muted-foreground">
        This controls whether your name and organization appear on your feedback.
      </p>
      <RadioGroup
        className="mt-3"
        value={value ? 'anonymous' : 'named'}
        onValueChange={(val: string) => onChange(val === 'anonymous')}
      >
        <label
          className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-background/50"
        >
          <RadioGroupItem value="named" className="mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium leading-snug">
              Named &mdash; {userName}, {orgType}
            </span>
            <span className="text-[12px] font-normal leading-[1.4] text-muted-foreground">
              Your identity will be visible to Policy Leads.
            </span>
          </div>
        </label>
        <label
          className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-background/50"
        >
          <RadioGroupItem value="anonymous" className="mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium leading-snug">
              Anonymous
            </span>
            <span className="text-[12px] font-normal leading-[1.4] text-muted-foreground">
              Your feedback will be attributed as &lsquo;Anonymous&rsquo;. Policy Leads cannot see your identity.
            </span>
          </div>
        </label>
      </RadioGroup>
    </div>
  )
}
