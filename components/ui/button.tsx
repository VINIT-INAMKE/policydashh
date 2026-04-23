"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonVariants } from "./button-variants"

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & ButtonVariants) {
  // When the caller overrides `render` with a non-button element (e.g. a
  // next/link `<Link>` or a plain `<a download>`), Base UI warns unless we
  // opt out of native-button semantics. Default to `false` in that case so
  // call sites don't have to repeat `nativeButton={false}` everywhere.
  const resolvedNativeButton = nativeButton ?? render === undefined

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={resolvedNativeButton}
      render={render}
      {...props}
    />
  )
}

export { Button }
// Re-export from the pure variants module so client callers can still import
// `buttonVariants` from `@/components/ui/button`. Server callers should
// import from `@/components/ui/button-variants` directly.
export { buttonVariants } from "./button-variants"
