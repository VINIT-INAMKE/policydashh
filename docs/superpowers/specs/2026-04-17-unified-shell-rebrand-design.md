# Unified Shell + Civilization Lab Rebrand

**Date:** 2026-04-17
**Status:** Draft
**Scope:** Merge 3 disconnected shells into one adaptive layout, rebrand PolicyDash to Civilization Lab, unify typography/color/nav across all routes.

---

## Problem

The app has three disconnected shells:

1. **Landing** (`app/page.tsx`) — inline nav with dead `href="#"` links, Newsreader + Inter fonts, `--cl-*` color vars
2. **Public** (`app/(public)/layout.tsx`) — separate `PublicHeader` + `PublicFooter`, same fonts/colors as landing but a different layout component
3. **Workspace** (`app/(workspace)/layout.tsx`) — `WorkspaceNav` + `UserButton`, Geist fonts, Tailwind default colors

Consequences:
- Logged-in users on public pages lose workspace nav and can't get back
- Forms ask for name/email the system already has
- `/participate` is meaningless for existing users
- Three font stacks, two color systems, zero auth awareness on public pages
- "PolicyDash" branding throughout needs to become "Civilization Lab"

---

## Solution: One Shell, One Nav, One Theme

### 1. Route Structure

Kill route groups. All pages become direct children of `app/`.

```
app/
  layout.tsx              <- single root layout
  page.tsx                <- landing (hero + sections)
  dashboard/page.tsx      <- from (workspace)/dashboard
  policies/               <- from (workspace)/policies (all nested routes)
  feedback/               <- from (workspace)/feedback
  workshop-manage/        <- from (workspace)/workshop-manage
  workshops/              <- from (public)/workshops
  participate/             <- from (public)/participate
  portal/                 <- from (public)/portal
  research/               <- from (public)/research
  framework/              <- from (public)/framework
  users/                  <- from (workspace)/users
  audit/                  <- from (workspace)/audit
  notifications/          <- from (workspace)/notifications
  setup/                  <- from (workspace)/setup
  sign-in/                <- stays
  sign-up/                <- stays
  api/                    <- stays (no changes)
  _components/            <- shared components (adaptive header, footer)
```

URL paths do not change. Moving `app/(workspace)/dashboard/page.tsx` to `app/dashboard/page.tsx` still serves `/dashboard`.

### 2. Root Layout

Single `app/layout.tsx`:

```
ClerkProvider
  TRPCProvider
    <body class="cl-landing {fonts}">
      <AdaptiveHeader />        <- auth-aware nav
      <main>{children}</main>
      <Footer />                <- single footer
      <Toaster />
    </body>
```

- Fonts: Newsreader (headlines) + Inter (body) everywhere. Kill Geist.
- Color system: `--cl-*` vars from `globals.css` `.cl-landing` class applied to `<body>` globally. Remove the `.cl-landing` scoping — these become the app's design tokens.
- The `cl-landing` class name itself gets removed (or renamed to just the body default). The CSS vars become global.

### 3. Adaptive Header

One `<AdaptiveHeader>` server component replaces all three navs.

**Server-side:**
```ts
const { userId } = await auth()
const user = userId ? await db.query.users.findFirst(...) : null
```

**Render logic:**

| Auth State | Left | Center/Nav | Right |
|-----------|------|------------|-------|
| Not logged in | Logo: "Civilization Lab" | Research, Framework, Workshops, Participate, Portal | Sign In button |
| Logged in (stakeholder) | Logo: "Civilization Lab" | Dashboard, Policies, Feedback, Workshops | NotificationBell + UserButton |
| Logged in (admin) | Logo: "Civilization Lab" | Dashboard, Policies, Feedback, Workshops, Users, Audit | NotificationBell + UserButton |
| Logged in (workshop_moderator) | Logo: "Civilization Lab" | Dashboard, Policies, Feedback, Workshops, Workshop Manage | NotificationBell + UserButton |
| Logged in (auditor) | Logo: "Civilization Lab" | Dashboard, Policies, Feedback, Workshops, Audit | NotificationBell + UserButton |

**Public pages still accessible when logged in.** If a logged-in user navigates to `/research`, `/portal`, `/workshops`, `/framework` — the header shows their workspace nav (not the public nav). They see the page content but with workspace context (edit links for admins, pre-filled forms for stakeholders).

**Mobile:** Single hamburger menu. When logged in, shows workspace items + public items grouped under a "Public Pages" section. When not logged in, shows public items only.

**Logo click:** Not logged in -> `/`. Logged in -> `/dashboard`.

### 4. Footer

One `<Footer>` component. Replaces both `PublicFooter` and the landing page inline footer.

- Shows: "Published by Civilization Lab" + year
- When not logged in: shows "Sign In" link
- When logged in: no sign-in link (redundant — UserButton is in header)
- Links: Portal, Research, Framework (always visible)

### 5. Auth-Aware Public Pages

Each former "public" page adapts based on auth state:

#### `/participate`
- **Not logged in:** Full form (name, email, role, orgType, Turnstile)
- **Logged in:** "You're already a member. Go to Dashboard" with link. Or if they arrived via a workshop feedback JWT link, show the feedback form (existing behavior).

#### `/workshops`
- **Not logged in:** Registration form asks name + email
- **Logged in:** One-click register (pre-fill name/email from `users` table, skip form fields, just "Confirm Registration" button)
- **Admin/moderator logged in:** Shows "Manage" link next to each workshop they own

#### `/portal`, `/research`, `/framework`
- **Not logged in:** Read-only public view (unchanged)
- **Logged in as admin/policy_lead:** Inline "Edit in workspace" links on sections, "Publish as Draft" toggle visible
- **Logged in as stakeholder:** "Submit Feedback" quick-links on assigned sections

#### `/portal/[policyId]`
- **Logged in as admin:** Shows "Edit" button linking to `/policies/[policyId]`
- Shows Verified State badges (unchanged)

### 6. Auth Gating (proxy.ts)

No changes to proxy.ts. It continues to protect non-public routes via `auth.protect()`. The public route whitelist stays identical:

```ts
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)', '/sign-up(.*)',
  '/api/webhooks(.*)', '/api/inngest(.*)', '/api/intake(.*)',
  '/portal(.*)', '/participate(.*)', '/workshops(.*)',
  '/research(.*)', '/framework(.*)',
  '/api/export/policy-pdf(.*)',
])
```

Moving files out of `(public)` and `(workspace)` route groups does NOT change which routes are protected. The proxy matches on URL path, not file location.

### 7. Brand Rename: PolicyDash -> Civilization Lab

#### User-visible (must change)
| File | Current | New |
|------|---------|-----|
| `app/layout.tsx` metadata | `title: "PolicyDash"` | `title: "Civilization Lab"` |
| `app/(public)/_components/public-header.tsx` -> `app/_components/adaptive-header.tsx` | `PolicyDash` logo | `Civilization Lab` |
| `app/(public)/_components/public-footer.tsx` -> `app/_components/footer.tsx` | `Published by PolicyDash` | `Published by Civilization Lab` |
| `app/(workspace)/layout.tsx` -> deleted (merged into root) | `PolicyDash` h1 | N/A (adaptive header handles it) |
| `app/(public)/participate/page.tsx` metadata | `... \| PolicyDash` | `... \| Civilization Lab` |
| `app/(public)/workshops/page.tsx` metadata | `... \| PolicyDash` | `... \| Civilization Lab` |
| All email templates | `POLICYDASH` / `PolicyDash` | `CIVILIZATION LAB` / `Civilization Lab` |
| PDF export footers | `PolicyDash` | `Civilization Lab` |
| `src/lib/email.ts` from address | `PolicyDash <onboarding@...>` | `Civilization Lab <noreply@civilization-lab.com>` |

#### Infrastructure (change with care)
| File | Current | New | Note |
|------|---------|-----|------|
| `package.json` name | `policydashboard` | `civilization-lab` | npm name only |
| `src/inngest/client.ts` id | `policydash` | `civilization-lab` | Re-registers all Inngest fns. Must re-sync. |
| `src/lib/cardano.ts` project check | `project === 'policydash'` | `project === 'policydash' \|\| project === 'civilization-lab'` | Accept both for backward compat |
| `src/inngest/functions/milestone-ready.ts` | `project: 'policydash'` | `project: 'civilization-lab'` | New anchors use new name |
| `src/inngest/functions/version-anchor.ts` | `project: 'policydash'` | `project: 'civilization-lab'` | New anchors use new name |

### 8. Design System Unification

**Typography:**
- Headlines: Newsreader (serif), loaded via `next/font/google`
- Body: Inter (sans), loaded via `next/font/google`
- Kill Geist Sans / Geist Mono from root layout

**Colors (from landing page, promoted to global):**
- Surface: `#f7fafc` (cream)
- On-surface: `#181c1e` (near-black)
- Primary: `#000a1e` (navy)
- Accent: `#179d53` (emerald, used for CTAs)
- Error: `#ba1a1a`
- All `--cl-*` CSS vars become global on `body`, not scoped to `.cl-landing`

**Workspace pages currently using Tailwind defaults** (`bg-background`, `text-foreground`) will inherit the `--cl-*` system. The shadcn CSS vars (`--background`, `--foreground`, etc.) should be mapped to their `--cl-*` equivalents in `globals.css`:

```css
:root {
  --background: var(--cl-surface);
  --foreground: var(--cl-on-surface);
  --primary: var(--cl-primary);
  --primary-foreground: var(--cl-on-primary);
  --muted: var(--cl-surface-container);
  --muted-foreground: var(--cl-on-surface-variant);
  --accent: var(--cl-tertiary);
  --accent-foreground: var(--cl-on-tertiary);
  --destructive: var(--cl-error);
  --destructive-foreground: var(--cl-on-error);
  --border: var(--cl-outline-variant);
  --ring: var(--cl-primary);
}
```

This bridges shadcn components (which read `--background`, `--primary`, etc.) to the Civilization Lab palette without rewriting every component.

### 9. Role-Aware Nav Items

The adaptive header shows nav items based on role:

| Nav Item | Unauthenticated | Stakeholder | Observer | Research Lead | Workshop Mod | Policy Lead | Auditor | Admin |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Research | Y | - | - | - | - | - | - | - |
| Framework | Y | - | - | - | - | - | - | - |
| Workshops | Y | - | - | - | - | - | - | - |
| Participate | Y | - | - | - | - | - | - | - |
| Portal | Y | - | - | - | - | - | - | - |
| Sign In | Y | - | - | - | - | - | - | - |
| Dashboard | - | Y | Y | Y | Y | Y | Y | Y |
| Policies | - | Y | Y | Y | Y | Y | Y | Y |
| Feedback | - | Y | - | Y | Y | Y | Y | Y |
| Workshops | - | Y | Y | Y | Y | Y | Y | Y |
| Workshop Manage | - | - | - | - | Y | - | - | Y |
| Users | - | - | - | - | - | Y | - | Y |
| Audit | - | - | - | - | - | - | Y | Y |

Public pages remain accessible to logged-in users via direct URL. They just don't appear in the primary nav (the content is available but navigation prioritizes workspace tasks).

Exception: A "Public Pages" dropdown or secondary nav group could show Portal, Research, Framework for logged-in users who need to preview public content.

### 10. Migration Strategy

**Phase 1: Move files (no behavior change)**
- Move all pages from `(public)/` and `(workspace)/` to `app/` root
- Move shared `_components` out of route groups
- Delete empty route group folders
- Update any relative imports
- Verify: all URLs still work, TSC clean, tests pass

**Phase 2: Unify layout**
- Create `AdaptiveHeader` and `Footer` components
- Replace both `layout.tsx` files with single root layout
- Wire auth detection in header
- Delete old `PublicHeader`, `PublicFooter`, `WorkspaceNav`

**Phase 3: Unify theme**
- Promote `--cl-*` vars to global
- Bridge shadcn vars to `--cl-*` equivalents
- Replace Geist with Newsreader + Inter
- Remove `.cl-landing` class scoping

**Phase 4: Auth-aware public pages**
- `/participate` — redirect or "already registered" for logged-in users
- `/workshops` — one-click register for logged-in users
- `/portal`, `/framework` — edit links for admin/policy_lead

**Phase 5: Rebrand**
- Rename all "PolicyDash" references to "Civilization Lab"
- Update email templates, PDF exports, metadata
- Update Inngest client ID + re-sync
- Update Cardano anchor project name (keep backward compat)
- Update package.json

### 11. Risk Mitigation

- **URL stability:** Route groups don't affect URLs. No links break.
- **Auth regression:** proxy.ts is path-based, not folder-based. Same whitelist works.
- **Import breakage:** TSC catches immediately. Run `npx tsc --noEmit` after each phase.
- **Test suite:** Run `npm test` after each phase. Breadcrumb test already updated for `/workshop-manage`.
- **Inngest re-sync:** Changing client ID requires re-syncing on Inngest dashboard. Plan for this.
- **Cardano backward compat:** Accept both `policydash` and `civilization-lab` in verification.

### 12. Out of Scope

- Role permission changes (observer role cleanup, research_lead enhancements) — separate effort
- New dashboard features — separate effort
- Mobile-first responsive redesign — the adaptive header gets a hamburger menu but full mobile UX is a follow-up
- Landing page content changes — the hero/sections content stays, just gets wired into the unified shell

---

## Success Criteria

1. One `layout.tsx` at `app/` root. Zero route groups.
2. One `<AdaptiveHeader>` renders correct nav items for all 8 states (unauthenticated + 7 roles).
3. Logged-in user visiting `/workshops` sees workspace header with pre-filled registration.
4. Logged-in user visiting `/participate` sees redirect or "already registered."
5. All pages use Newsreader + Inter. No Geist anywhere.
6. All pages use `--cl-*` color system. Shadcn vars bridged.
7. "Civilization Lab" replaces "PolicyDash" in all user-visible locations.
8. `npx tsc --noEmit` exits 0.
9. `npm test` passes at current baseline.
10. Inngest re-synced with new client ID.
11. Cardano verification accepts both old and new project names.
