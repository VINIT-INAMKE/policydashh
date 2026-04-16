# Unified Shell + Civilization Lab Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 3 disconnected shells into one adaptive layout with auth-aware nav, unified theme, and rebrand from PolicyDash to Civilization Lab.

**Architecture:** Single root layout with an `<AdaptiveHeader>` server component that reads Clerk auth state and renders role-appropriate nav. All pages move out of `(public)/` and `(workspace)/` route groups to `app/` root. The landing page's design system (Newsreader + Inter, `--cl-*` CSS vars) becomes the global theme, bridged to shadcn's CSS vars.

**Tech Stack:** Next.js 16, Clerk (auth), Tailwind CSS, shadcn/ui, tRPC, Drizzle ORM

---

## Task 1: Move public route group files to app root

**Files:**
- Move: all 36 files from `app/(public)/` to `app/` (preserving subdirectory structure)
- Delete: `app/(public)/layout.tsx` (will be replaced by unified root layout later)
- Modify: 5 files with `@/app/(public)` imports

- [ ] **Step 1: Move public route directories**

```bash
# Move each public route to app root (directories only, not layout.tsx)
mv "app/(public)/framework" app/framework
mv "app/(public)/participate" app/participate
mv "app/(public)/portal" app/portal
mv "app/(public)/research" app/research
mv "app/(public)/workshops" app/workshops
mv "app/(public)/_components" app/_components/public
```

- [ ] **Step 2: Fix cross-group imports in moved files**

In `app/framework/page.tsx` and `app/framework/[policyId]/page.tsx`, replace:
```ts
// OLD
import { PublicPolicyContent } from '@/app/(public)/portal/[policyId]/_components/public-policy-content'
import { PublicSectionNav } from '@/app/(public)/portal/[policyId]/_components/public-section-nav'
// NEW
import { PublicPolicyContent } from '@/app/portal/[policyId]/_components/public-policy-content'
import { PublicSectionNav } from '@/app/portal/[policyId]/_components/public-section-nav'
```

In `app/portal/[policyId]/_components/public-policy-content.tsx`, replace:
```ts
// OLD
} from '@/app/(public)/framework/_components/section-status-badge'
// NEW
} from '@/app/framework/_components/section-status-badge'
```

In `app/portal/[policyId]/page.tsx`, replace:
```ts
// OLD
import { VersionStatusBadge } from '@/app/(workspace)/policies/[id]/versions/_components/version-status-badge'
// NEW (will resolve after Task 2)
import { VersionStatusBadge } from '@/app/policies/[id]/versions/_components/version-status-badge'
```

- [ ] **Step 3: Fix test imports referencing public route group**

In `tests/phase-20/participate-mode-switch.test.tsx`:
```ts
// Replace any @/app/(public)/ imports with @/app/ equivalents
```

In `tests/phase-20/workshops-listing.test.tsx`:
```ts
// Replace any @/app/(public)/ imports with @/app/ equivalents
```

In `tests/phase-20.5/framework-page-render.test.tsx` and `tests/phase-20.5/research-page-render.test.tsx`:
```ts
// Replace any @/app/(public)/ imports with @/app/ equivalents
```

- [ ] **Step 4: Delete empty public route group**

```bash
rm "app/(public)/layout.tsx"
rmdir "app/(public)" 2>/dev/null || rm -rf "app/(public)"
```

- [ ] **Step 5: Verify TSC compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors (some may appear from workspace imports not yet moved - that's ok, Task 2 fixes them)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move public route group to app root

Move all pages from app/(public)/ to app/ root. URLs unchanged.
Update cross-group imports to new paths."
```

---

## Task 2: Move workspace route group files to app root

**Files:**
- Move: all 135 files from `app/(workspace)/` to `app/` (preserving subdirectory structure)
- Delete: `app/(workspace)/layout.tsx` (will be replaced by unified root layout later)
- Modify: 10+ files with `@/app/(workspace)` imports

- [ ] **Step 1: Move workspace route directories**

```bash
mv "app/(workspace)/audit" app/audit
mv "app/(workspace)/dashboard" app/dashboard
mv "app/(workspace)/feedback" app/feedback
mv "app/(workspace)/notifications" app/notifications
mv "app/(workspace)/policies" app/policies
mv "app/(workspace)/setup" app/setup
mv "app/(workspace)/users" app/users
mv "app/(workspace)/workshop-manage" app/workshop-manage
# Move workspace _components to app/_components/workspace
mv "app/(workspace)/_components" app/_components/workspace
```

- [ ] **Step 2: Fix all workspace cross-group imports**

Find and replace `@/app/(workspace)` with `@/app` in all files:

```bash
grep -rl "@/app/(workspace)" app/ src/ tests/ --include="*.ts" --include="*.tsx" | while read f; do
  sed -i 's|@/app/(workspace)|@/app|g' "$f"
done
```

Key files to verify:
- `app/dashboard/_components/auditor-dashboard.tsx`: `@/app/audit/_components/evidence-pack-dialog`
- `app/feedback/outcomes/_components/outcomes-list.tsx`: `@/app/policies/[id]/feedback/_components/status-badge`
- `app/feedback/_components/my-outcomes-tab.tsx`: same
- `app/policies/[id]/change-requests/_components/linked-feedback-list.tsx`: same
- `app/policies/[id]/traceability/_components/search-result-card.tsx`: both status-badge and cr-status-badge
- `src/__tests__/breadcrumb.test.tsx`: `@/app/_components/workspace/breadcrumb`
- `src/__tests__/policy-tab-bar.test.tsx`: `@/app/policies/[id]/_components/policy-tab-bar`
- `src/__tests__/section-content-view.test.tsx`: similar
- `src/__tests__/workspace-nav.test.tsx`: `@/app/_components/workspace/workspace-nav`

- [ ] **Step 3: Delete empty workspace route group**

```bash
rm "app/(workspace)/layout.tsx"
rmdir "app/(workspace)" 2>/dev/null || rm -rf "app/(workspace)"
```

- [ ] **Step 4: Verify TSC compiles clean**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: same pass rate as before (some breadcrumb/nav tests may need path updates done in Step 2)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move workspace route group to app root

Move all pages from app/(workspace)/ to app/ root. URLs unchanged.
Update all cross-group imports. Route groups eliminated."
```

---

## Task 3: Unify theme - promote cl-landing design system to global

**Files:**
- Modify: `app/globals.css` (promote `--cl-*` vars, bridge shadcn vars, kill `.cl-landing` scoping)
- Modify: `app/layout.tsx` (replace Geist with Newsreader + Inter)
- Modify: `app/page.tsx` (remove inline font loading - now in root layout)

- [ ] **Step 1: Promote --cl-* vars to :root in globals.css**

Move all CSS custom properties from the `.cl-landing { ... }` block to `:root { ... }`. Then add shadcn bridge vars. Replace the existing `:root` block and `.cl-landing` block:

```css
:root {
  /* Civilization Lab design tokens (promoted from .cl-landing) */
  --cl-primary: #000a1e;
  --cl-on-primary: #ffffff;
  --cl-primary-container: #002147;
  --cl-on-primary-container: #708ab5;
  /* ... all other --cl-* vars from the .cl-landing block ... */

  /* Bridge shadcn component vars to Civilization Lab tokens */
  --background: var(--cl-surface);
  --foreground: var(--cl-on-surface);
  --primary: var(--cl-primary);
  --primary-foreground: var(--cl-on-primary);
  --secondary: var(--cl-secondary);
  --secondary-foreground: var(--cl-on-secondary);
  --muted: var(--cl-surface-container);
  --muted-foreground: var(--cl-on-surface-variant);
  --accent: var(--cl-tertiary);
  --accent-foreground: var(--cl-on-tertiary);
  --destructive: var(--cl-error);
  --destructive-foreground: var(--cl-on-error);
  --border: var(--cl-outline-variant);
  --input: var(--cl-outline-variant);
  --ring: var(--cl-primary);
  --card: var(--cl-surface-container-lowest);
  --card-foreground: var(--cl-on-surface);
  --popover: var(--cl-surface-container-lowest);
  --popover-foreground: var(--cl-on-surface);
}

body {
  background-color: var(--cl-surface);
  color: var(--cl-on-surface);
  font-family: var(--font-cl-body), 'Inter', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

Delete the `.cl-landing { ... }` block entirely. Keep the `.cl-landing .font-headline` etc. utility classes but rename them to just `.font-headline` (remove `.cl-landing` prefix).

- [ ] **Step 2: Replace Geist with Newsreader + Inter in root layout**

In `app/layout.tsx`, replace font imports:

```tsx
// OLD
import { Geist, Geist_Mono } from "next/font/google";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// NEW
import { Newsreader, Inter } from 'next/font/google'

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
```

Update `<body>` className:
```tsx
// OLD
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>

// NEW
<body className={`${newsreader.variable} ${inter.variable} antialiased`}>
```

- [ ] **Step 3: Remove duplicate font loading from landing page**

In `app/page.tsx`, remove the Newsreader + Inter imports and `const newsreader = ...` / `const inter = ...` declarations. Remove the font variable classes from the root `<div>`. The fonts now come from the root layout.

- [ ] **Step 4: Remove .cl-landing class from landing page and any remaining references**

```bash
grep -rl "cl-landing" app/ --include="*.tsx" --include="*.ts"
```

For each file found, remove the `cl-landing` class name. The styles are now global on `body`.

- [ ] **Step 5: Verify TSC and build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
Expected: clean compilation, no missing font or CSS var references

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: unify design system - Newsreader + Inter, global --cl-* vars

Replace Geist fonts with Newsreader (headlines) + Inter (body).
Promote --cl-* CSS vars from .cl-landing scope to :root.
Bridge shadcn component vars to Civilization Lab design tokens."
```

---

## Task 4: Create AdaptiveHeader and unified Footer

**Files:**
- Create: `app/_components/adaptive-header.tsx`
- Create: `app/_components/footer.tsx`
- Modify: `app/layout.tsx` (wire new components, remove old layout structure)
- Delete: `app/_components/public/public-header.tsx` (after merge)
- Delete: `app/_components/public/public-footer.tsx` (after merge)
- Delete: `app/_components/workspace/workspace-nav.tsx` (after merge)

- [ ] **Step 1: Create AdaptiveHeader server component**

Create `app/_components/adaptive-header.tsx`:

```tsx
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { AdaptiveHeaderClient } from './adaptive-header-client'

export async function AdaptiveHeader() {
  const { userId } = await auth()

  let userRole: string | null = null
  if (userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { role: true },
    })
    userRole = user?.role ?? null
  }

  return <AdaptiveHeaderClient userId={userId} userRole={userRole} />
}
```

- [ ] **Step 2: Create AdaptiveHeaderClient component**

Create `app/_components/adaptive-header-client.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { NotificationBell } from './workspace/notification-bell'

interface NavItem {
  href: string
  label: string
}

const PUBLIC_NAV: NavItem[] = [
  { href: '/research', label: 'Research' },
  { href: '/framework', label: 'Framework' },
  { href: '/workshops', label: 'Workshops' },
  { href: '/participate', label: 'Participate' },
  { href: '/portal', label: 'Portal' },
]

function getWorkspaceNav(role: string | null): NavItem[] {
  const items: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/policies', label: 'Policies' },
  ]

  if (role !== 'observer') {
    items.push({ href: '/feedback', label: 'Feedback' })
  }

  items.push({ href: '/workshops', label: 'Workshops' })

  if (role === 'admin' || role === 'workshop_moderator') {
    items.push({ href: '/workshop-manage', label: 'Workshop Manage' })
  }

  if (role === 'admin' || role === 'policy_lead') {
    items.push({ href: '/users', label: 'Users' })
  }

  if (role === 'admin' || role === 'auditor') {
    items.push({ href: '/audit', label: 'Audit' })
  }

  return items
}

interface Props {
  userId: string | null
  userRole: string | null
}

export function AdaptiveHeaderClient({ userId, userRole }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isLoggedIn = Boolean(userId)
  const navItems = isLoggedIn ? getWorkspaceNav(userRole) : PUBLIC_NAV
  const logoHref = isLoggedIn ? '/dashboard' : '/'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--cl-outline-variant-20)] bg-[var(--cl-surface)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href={logoHref}
          className="text-lg font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-cl-headline), Newsreader, serif' }}
        >
          Civilization Lab
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'text-[var(--cl-on-surface)] bg-[var(--cl-surface-container)]'
                    : 'text-[var(--cl-on-surface-variant)] hover:text-[var(--cl-on-surface)] hover:bg-[var(--cl-surface-container-low)]'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <NotificationBell />
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-sm bg-[var(--cl-primary)] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--cl-on-primary)] transition-transform active:scale-95"
            >
              Sign In
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-1.5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-[var(--cl-outline-variant-20)] px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--cl-on-surface-variant)] hover:bg-[var(--cl-surface-container-low)]"
            >
              {item.label}
            </Link>
          ))}
          {isLoggedIn && (
            <>
              <div className="my-2 border-t border-[var(--cl-outline-variant-20)]" />
              <span className="block px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--cl-on-surface-variant)]">
                Public Pages
              </span>
              {PUBLIC_NAV.filter(p => p.href !== '/participate').map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-[var(--cl-on-surface-variant)] hover:bg-[var(--cl-surface-container-low)]"
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
      )}
    </header>
  )
}
```

- [ ] **Step 3: Create unified Footer**

Create `app/_components/footer.tsx`:

```tsx
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-[var(--cl-outline-variant-20)] bg-[var(--cl-surface-container-low)]">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--cl-on-surface-variant)]">
          Published by Civilization Lab
        </p>
        <nav className="flex items-center gap-4 text-sm text-[var(--cl-on-surface-variant)]">
          <Link href="/portal" className="hover:text-[var(--cl-on-surface)]">Portal</Link>
          <Link href="/research" className="hover:text-[var(--cl-on-surface)]">Research</Link>
          <Link href="/framework" className="hover:text-[var(--cl-on-surface)]">Framework</Link>
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Wire AdaptiveHeader and Footer into root layout**

Modify `app/layout.tsx` to render the new shell:

```tsx
import type { Metadata } from "next";
import { Newsreader, Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { TRPCProvider } from '@/src/trpc/client'
import { Toaster } from 'sonner'
import { AdaptiveHeader } from './_components/adaptive-header'
import { Footer } from './_components/footer'
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Civilization Lab",
  description: "Verifiable policy consultation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${newsreader.variable} ${inter.variable} antialiased`}>
          <TRPCProvider>
            <AdaptiveHeader />
            <main>{children}</main>
            <Footer />
            <Toaster position="top-right" richColors />
          </TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 5: Remove landing page inline nav and footer**

In `app/page.tsx`, delete the inline `<nav>` block (the sticky header with dead links) and the inline footer. The page content (hero, sections) stays. The `<AdaptiveHeader>` and `<Footer>` from root layout handle nav/footer.

- [ ] **Step 6: Delete old nav components (after verifying build)**

```bash
rm app/_components/public/public-header.tsx
rm app/_components/public/public-footer.tsx
rm app/_components/public/__tests__/public-header.test.tsx
rm app/_components/workspace/workspace-nav.tsx
```

Update any remaining imports that referenced these deleted files.

- [ ] **Step 7: Verify TSC, build, and tests**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
npm test 2>&1 | tail -10
```

Fix any import errors from deleted components. The `workspace-nav.test.tsx` and `public-header.test.tsx` tests should be deleted or rewritten for `AdaptiveHeaderClient`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: unified shell with AdaptiveHeader and Footer

Single adaptive nav replaces 3 separate headers. Role-aware nav items.
Landing page, public pages, and workspace pages share one shell.
Mobile hamburger with public pages section for logged-in users."
```

---

## Task 5: Auth-aware public pages

**Files:**
- Modify: `app/participate/page.tsx` (redirect logged-in users)
- Modify: `app/workshops/_components/register-form.tsx` (pre-fill for logged-in)
- Modify: `app/workshops/page.tsx` (pass auth context)
- Modify: `app/portal/[policyId]/page.tsx` (edit link for admin)

- [ ] **Step 1: /participate - redirect logged-in users**

In `app/participate/page.tsx`, add server-side auth check:

```tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function ParticipatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const { userId } = await auth()

  // Workshop feedback deep-link with JWT - always show the form
  if (params.workshopId && params.token) {
    // existing workshop feedback flow - unchanged
  }

  // Logged-in users are already members
  if (userId) {
    redirect('/dashboard')
  }

  // Not logged in - show the participate form (existing behavior)
  // ...
}
```

- [ ] **Step 2: /workshops - one-click register for logged-in users**

In `app/workshops/page.tsx`, pass auth context:

```tsx
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'

export default async function WorkshopsPage() {
  const { userId } = await auth()
  let currentUser: { name: string | null; email: string | null } | null = null

  if (userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { name: true, email: true },
    })
    currentUser = user ?? null
  }

  // Pass currentUser to WorkshopCard -> RegisterForm
  // ...
}
```

In `app/workshops/_components/register-form.tsx`, accept and use pre-filled user data:

```tsx
interface RegisterFormProps {
  workshopId: string
  workshopTitle: string
  disabled?: boolean
  prefillName?: string | null
  prefillEmail?: string | null
}

export function RegisterForm({ workshopId, workshopTitle, disabled, prefillName, prefillEmail }: RegisterFormProps) {
  const [name, setName] = useState(prefillName || '')
  const [email, setEmail] = useState(prefillEmail || '')
  const isPrefilled = Boolean(prefillName && prefillEmail)

  // If user data is pre-filled, skip the form expansion - show "Confirm Registration"
  // ...
}
```

- [ ] **Step 3: /portal/[policyId] - edit link for admin/policy_lead**

In `app/portal/[policyId]/page.tsx`, add:

```tsx
import { auth } from '@clerk/nextjs/server'

// Inside the component:
const { userId } = await auth()
let canEdit = false
if (userId) {
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { role: true },
  })
  canEdit = user?.role === 'admin' || user?.role === 'policy_lead'
}

// In the JSX, conditionally render:
{canEdit && (
  <Link href={`/policies/${policyId}`} className="text-sm font-medium text-[var(--cl-on-tertiary-container)] hover:underline">
    Edit in workspace
  </Link>
)}
```

- [ ] **Step 4: Pass currentUser through workshop card chain**

Update `WorkshopCard` props to accept and forward `currentUser`:

```tsx
// workshop-card.tsx
export function WorkshopCard({ workshop, variant, currentUser }: {
  workshop: WorkshopCardData
  variant: WorkshopCardVariant
  currentUser?: { name: string | null; email: string | null } | null
}) {
  // ...
  <RegisterForm
    workshopId={workshop.id}
    workshopTitle={workshop.title}
    disabled={disabled}
    prefillName={currentUser?.name}
    prefillEmail={currentUser?.email}
  />
}
```

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -10
git add -A
git commit -m "feat: auth-aware public pages

/participate redirects logged-in users to dashboard.
/workshops pre-fills name/email for logged-in registration.
/portal shows edit link for admin/policy_lead."
```

---

## Task 6: Rebrand PolicyDash to Civilization Lab

**Files:**
- Modify: `package.json` (name field)
- Modify: `src/inngest/client.ts` (client id)
- Modify: `src/lib/cardano.ts` (accept both project names)
- Modify: `src/inngest/functions/milestone-ready.ts` (new project name)
- Modify: `src/inngest/functions/version-anchor.ts` (new project name)
- Modify: `src/lib/email.ts` (from address)
- Modify: all email templates (header text)
- Modify: PDF export routes (footer text)
- Modify: page metadata across all routes

- [ ] **Step 1: Rename in package.json**

```json
{
  "name": "civilization-lab",
}
```

Run `npm install` to update package-lock.json.

- [ ] **Step 2: Update Inngest client ID**

In `src/inngest/client.ts`:
```ts
export const inngest = new Inngest({
  id: 'civilization-lab',
})
```

Note: This requires re-syncing on Inngest dashboard after deploy.

- [ ] **Step 3: Update Cardano anchor metadata (backward compat)**

In `src/inngest/functions/milestone-ready.ts`:
```ts
project: 'civilization-lab',
```

In `src/inngest/functions/version-anchor.ts`:
```ts
project: 'civilization-lab',
```

In `src/lib/cardano.ts`, update verification to accept both:
```ts
meta.project === 'policydash' || meta.project === 'civilization-lab'
```

- [ ] **Step 4: Update email from address and templates**

In `src/lib/email.ts`:
```ts
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'Civilization Lab <noreply@civilization-lab.com>'
```

In all email templates (`src/lib/email-templates/*.tsx`), replace:
- `POLICYDASH` -> `CIVILIZATION LAB`
- `PolicyDash` -> `Civilization Lab`
- `policydash.app` -> `civilization-lab.com`

- [ ] **Step 5: Update PDF export footers**

In `app/api/export/policy-pdf/[versionId]/route.tsx`:
```ts
`Generated ${date} -- Civilization Lab Published Policy Export`
```

In `app/api/export/traceability/pdf/_document/traceability-pdf.tsx`:
```ts
`Generated ${date} -- Civilization Lab Traceability Export`
```

- [ ] **Step 6: Update page metadata across all routes**

Find and replace ` | PolicyDash` with ` | Civilization Lab` in all page metadata:

```bash
grep -rl "PolicyDash" app/ --include="*.tsx" --include="*.ts" | while read f; do
  sed -i 's/PolicyDash/Civilization Lab/g' "$f"
done
```

- [ ] **Step 7: Update test fixtures**

In test files referencing `PolicyDash` or `policydash.test`:
```bash
grep -rl "PolicyDash\|policydash" src/__tests__/ tests/ src/inngest/__tests__/ src/lib/__tests__/ --include="*.ts" --include="*.tsx"
```

Update each to use `Civilization Lab` / `civilization-lab` as appropriate.

- [ ] **Step 8: Verify everything**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -15
npm run build 2>&1 | tail -10
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "rebrand: PolicyDash -> Civilization Lab

Rename across package.json, Inngest client ID, Cardano metadata
(backward compat for existing anchors), email templates, PDF exports,
page metadata, and test fixtures."
```

---

## Task 7: Final cleanup and push

- [ ] **Step 1: Delete orphaned files**

Remove any remaining files from old route groups:
```bash
# Check for stragglers
find app -path "*/\(public\)/*" -o -path "*/\(workspace\)/*" 2>/dev/null
```

Remove `calcom.png`, `write-summary-temp.js`, `landing.html` if still present and unwanted.

- [ ] **Step 2: Full verification**

```bash
npx tsc --noEmit
npm test
npm run build
```

All must pass clean.

- [ ] **Step 3: Final commit and push**

```bash
git add -A
git commit -m "chore: final cleanup after unified shell migration"
git push origin master
```

- [ ] **Step 4: Post-deploy actions**

After Vercel deploys:
1. Re-sync Inngest (client ID changed to `civilization-lab`)
2. Verify all routes load with correct nav
3. Test sign-in flow redirects to `/dashboard`
4. Test `/participate` redirects logged-in users
5. Test `/workshops` pre-fills for logged-in users
