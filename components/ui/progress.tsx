"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: ProgressPrimitive.Root.Props & { value?: number }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value ?? 0}
      className={cn("relative w-full", className)}
      {...props}
    >
      <ProgressPrimitive.Track className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
