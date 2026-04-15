/**
 * Phase 21 — Public shell layout (PUB-09 / PUB-10).
 *
 * Single source of chrome for every `(public)` route. This layout owns:
 *
 *   - `.cl-landing` className (Phase 21 D-01 / D-02 — palette adoption)
 *   - `--font-cl-headline` (Newsreader) + `--font-cl-body` (Inter) font vars
 *   - `<PublicHeader />` sticky glassmorphism nav
 *   - `<PublicFooter />` single-row attribution + Internal Login
 *
 * Pages under `(public)` must NOT wrap themselves in `.cl-landing` any more —
 * the layout supplies it. See D-02 in 21-CONTEXT.md.
 *
 * Next.js note: this is a NESTED layout (route group `(public)` is a logical
 * grouping, not a URL segment), so we render a `<div>` not `<html>`/`<body>` —
 * the root layout in `app/layout.tsx` owns the document tags. Font declarations
 * here are safe because Next.js deduplicates identical font configs across
 * the same request (Phase 21 Pitfall 6).
 */
import { Inter, Newsreader } from 'next/font/google'
import { PublicHeader } from './_components/public-header'
import { PublicFooter } from './_components/public-footer'

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cl-headline',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cl-body',
  display: 'swap',
})

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`cl-landing ${newsreader.variable} ${inter.variable} flex min-h-screen flex-col bg-[var(--cl-surface)] text-[var(--cl-on-surface)]`}
    >
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
