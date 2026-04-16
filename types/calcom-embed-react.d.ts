/**
 * Phase 20 Plan 20-05 ambient shim for `@calcom/embed-react`.
 *
 * The runtime package (`@calcom/embed-react@^1.5.3`) is declared in
 * `package.json` but may not be present in `node_modules` until the
 * parallel executor finishes `pnpm install`. This ambient declaration
 * keeps `tsc --noEmit` green during the split execution window.
 *
 * When the real package is installed, its own `.d.ts` takes precedence
 * (TypeScript prefers package-local types over ambient declarations).
 * This file is safe to leave in place - it carries no runtime code.
 *
 * Minimal API surface needed by `app/(public)/workshops/_components/cal-embed.tsx`:
 *   - default export: <Cal calLink namespace config? style? />
 *   - named export: getCalApi (not used in this plan but included for parity)
 */
declare module '@calcom/embed-react' {
  import * as React from 'react'

  export interface CalProps {
    calLink: string
    namespace?: string
    config?: Record<string, string | number | boolean | undefined>
    style?: React.CSSProperties
    className?: string
  }

  const Cal: React.ComponentType<CalProps>
  export default Cal

  export function getCalApi(options?: {
    namespace?: string
  }): Promise<(command: string, ...args: unknown[]) => void>
}
