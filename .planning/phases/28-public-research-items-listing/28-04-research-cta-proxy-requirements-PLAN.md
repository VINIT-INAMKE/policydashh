---
phase: 28-public-research-items-listing
plan: 04
type: execute
wave: 4
depends_on:
  - 28-00
  - 28-01
  - 28-02
  - 28-03
files_modified:
  - app/research/page.tsx
  - proxy.ts
  - .planning/REQUIREMENTS.md
  - tests/phase-28/no-leak.test.ts
autonomous: true
requirements:
  - RESEARCH-09
  - RESEARCH-10
must_haves:
  truths:
    - "app/research/page.tsx contains a new 'Published Research' section with Browse CTA linking to /research/items"
    - "The existing /research page prose is preserved — Understanding the Landscape heading, Key Themes, Research Outputs, Join Consultation CTA all unchanged"
    - "proxy.ts isPublicRoute matcher includes '/api/research(.*)' with a Phase 28 comment header naming RESEARCH-10"
    - "Existing proxy.ts whitelist entries (including '/research(.*)') are preserved — append-only edit per Phase 19 convention"
    - "REQUIREMENTS.md v0.2 Research Module subsection includes RESEARCH-09 and RESEARCH-10 with descriptions from CONTEXT.md"
    - "REQUIREMENTS.md Traceability table has new rows: RESEARCH-09 | Phase 28 | Complete and RESEARCH-10 | Phase 28 | Complete"
    - "REQUIREMENTS.md Coverage footer is updated to reflect +2 v0.2 requirements"
  artifacts:
    - path: "app/research/page.tsx"
      provides: "Browse CTA section appended before closing </div>; no prose change"
      contains: "Browse published research"
    - path: "proxy.ts"
      provides: "Public-route matcher for /api/research(.*)"
      contains: "'/api/research(.*)'"
    - path: ".planning/REQUIREMENTS.md"
      provides: "RESEARCH-09 + RESEARCH-10 registered with status, description, traceability row"
      contains: "RESEARCH-09"
  key_links:
    - from: "/research page"
      to: "/research/items"
      via: "<Link><Button>Browse published research</Button></Link>"
      pattern: "href=\"/research/items\""
    - from: "Clerk middleware"
      to: "/api/research/[id]/download"
      via: "isPublicRoute(request) = true"
      pattern: "/api/research(.*)"
---

<objective>
Wave 4 deployment-surface closeout. Three cross-file edits wrap Phase 28:

1. Append a "Browse published research" CTA to the existing `/research` static page (no prose changes) — SC-3.
2. Add `/api/research(.*)` to `proxy.ts` so the Plan 28-01 download route is publicly accessible — Pitfall 3.
3. Register RESEARCH-09 and RESEARCH-10 in `.planning/REQUIREMENTS.md` with descriptions from CONTEXT.md and new traceability rows.

Purpose: Plan 28-01's download route is sitting behind Clerk's auth gate today. The proxy.ts addition unlocks it. The /research CTA is the user-visible bridge from the existing static page to the new listing. Registering the two requirements in REQUIREMENTS.md closes the coverage gate — ROADMAP.md lists RESEARCH-09/10 under Phase 28 but REQUIREMENTS.md doesn't yet have them (checked at planning time).

Runs Wave 4 because: proxy.ts whitelist addition depends only on 28-00 (the proxy test) — it can technically run in parallel with 28-01/28-02/28-03. But grouping it with the /research CTA + REQUIREMENTS registration keeps all three "append" edits in one plan for a clean commit.

Output: /research page with CTA, proxy.ts whitelist updated, REQUIREMENTS.md registrations + traceability rows.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/28-public-research-items-listing/28-CONTEXT.md
@.planning/phases/28-public-research-items-listing/28-RESEARCH.md
@.planning/phases/28-public-research-items-listing/28-UI-SPEC.md
@AGENTS.md
@app/research/page.tsx
@proxy.ts
@tests/phase-28/research-cta.test.tsx
@tests/phase-28/proxy-public-routes.test.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

Current `app/research/page.tsx` structure (end of file — where CTA goes):
```typescript
          <section id="join-consultation">
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Shape This Policy</h2>
            <p className="text-[16px] font-normal leading-[1.8] mb-6">
              Join the consultation process and help shape India's blockchain policy framework.
            </p>
            <Link href="/participate">
              <Button variant="default">Join Consultation</Button>
            </Link>
          </section>
        </main>
      </div>
    </div>
  )
}
```

CTA must go **inside <main>** AFTER `join-consultation` section and BEFORE `</main>`. Uses `variant="outline"` (per UI-SPEC Surface C — "variant='outline' (not primary) to avoid competing with the existing Join Consultation primary CTA"). Needs `<hr className="border-border my-12" />` separator before it.

Current `proxy.ts` createRouteMatcher block (lines 3-19):
```typescript
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/inngest(.*)',
  '/portal(.*)',
  '/api/export/policy-pdf(.*)',
  // Phase 19 - public intake form + submit endpoint (INTAKE-01, INTAKE-07)
  '/participate(.*)',
  '/api/intake(.*)',
  // Phase 20 - public workshops listing + cal.com registration (WS-08, D-08)
  '/workshops(.*)',
  // Phase 20.5 - public research + framework content pages (PUB-06, PUB-07, PUB-08)
  '/research(.*)',
  '/framework(.*)',
])
```

Append before `])`, AFTER the `/framework(.*)` line:
```typescript
  // Phase 28 - public research items download endpoint (RESEARCH-10 presigned GET)
  '/api/research(.*)',
```

This keeps: git blame clean, comment header convention parity with Phases 19, 20, 20.5 (STATE.md Phase 19: "append-at-end + comment header pattern for createRouteMatcher whitelist additions — preserves git blame, makes audits scriptable").

REQUIREMENTS.md v0.2 section location (line 227 in the file — "### Research Module"):
```markdown
### Research Module

- [x] **RESEARCH-01**: ...
- [x] **RESEARCH-02**: ...
...
- [x] **RESEARCH-08**: ...
```

Append after RESEARCH-08:
```markdown
- [x] **RESEARCH-09**: Public `/research/items` listing at `app/research/items/page.tsx` renders all `status = 'published'` items with query-param filters (`?document=`, `?type=`, `?from=`, `?to=`, `?sort=`), offset pagination ≥40/page default newest-first, card layout per UI-SPEC (title, type badge, authors or "Source: Confidential", publishedDate, Download/View Source CTA). Existing `/research` static page gains a "Browse published research" CTA linking to `/research/items`.
- [x] **RESEARCH-10**: Public `/research/items/[id]` detail page at `app/research/items/[id]/page.tsx` renders full metadata, formatted abstract, DOI as `https://doi.org/{doi}` hyperlink, presigned R2 download via `app/api/research/[id]/download/route.ts` (24h TTL, per-IP rate limit); lists linked sections as `/framework/[docId]#section-{sectionId}` links and linked versions as `/portal/[docId]?v=<label>` links; NO feedback IDs, stakeholder names, or internal metadata leak to the public surface.
```

Traceability table location (line 438-ish in REQUIREMENTS.md):
```markdown
| RESEARCH-08 | Phase 27 | Complete |
```

Append rows:
```markdown
| RESEARCH-09 | Phase 28 | Complete |
| RESEARCH-10 | Phase 28 | Complete |
```

Coverage footer (line 440):
```markdown
- v0.2 requirements: 63 total — 63 mapped, 0 complete
- Total: 150 requirements — 150 mapped, 87 complete, 63 pending, 0 unmapped
```

Update to:
```markdown
- v0.2 requirements: 65 total — 65 mapped, 2 complete (RESEARCH-09, RESEARCH-10)
- Total: 152 requirements — 152 mapped, 89 complete, 63 pending, 0 unmapped
```

(Note: v0.2 completion count is 0 in the current file because the auto-tick hasn't run. This plan only claims RESEARCH-09/10 as complete — the other 63 pending items are tracked separately. If a prior phase already closed some v0.2 requirements, the execute agent should re-count and update accordingly.)

Footer `*Last updated*` stamp:
```markdown
*Last updated: 2026-04-20 — Phase 28 added RESEARCH-09 and RESEARCH-10 (2 public-surface requirements)*
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Append Browse CTA to app/research/page.tsx</name>
  <files>app/research/page.tsx</files>
  <behavior>
    - Insert new section AFTER the existing `join-consultation` section and BEFORE `</main>`.
    - Section content per UI-SPEC Surface C: H2 "Published Research" + body copy + Link to /research/items + Button variant="outline".
    - Preceded by `<hr className="border-border my-12" />`.
    - Section id: `browse-research`.
    - Does not remove or modify any existing prose — asserted by research-cta.test.tsx passing tests "Understanding the Landscape", "Join Consultation", "Research Outputs" preserved.
  </behavior>
  <read_first>
    - D:/aditee/policydash/app/research/page.tsx (current full file)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-UI-SPEC.md Surface C (exact copy + variant choice)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md §Code Examples "Browse CTA addition to /research page"
    - D:/aditee/policydash/tests/phase-28/research-cta.test.tsx (5 passing asserts this Task must satisfy)
  </read_first>
  <action>
Edit `app/research/page.tsx` by inserting a new `<section>` immediately after the existing `join-consultation` section and before `</main>`.

The exact insertion (locate the existing `</section>` that closes `join-consultation`, then add):

```typescript
          </section>
          <hr className="border-border my-12" />
          <section id="browse-research">
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Published Research</h2>
            <p className="text-[16px] font-normal leading-[1.8] mb-6">
              Browse the citable research items that inform the policy framework under consultation.
            </p>
            <Link href="/research/items">
              <Button variant="outline">Browse published research</Button>
            </Link>
          </section>
        </main>
```

Rules:
- Use the Edit tool (surgical — do not rewrite the whole file).
- Preserve the final `</div>` and `</main>` closers exactly as they are.
- `<Button variant="outline">` (NOT "default") — UI-SPEC Surface C: "Button uses variant='outline' (not primary) to avoid competing with the existing Join Consultation primary CTA on the same page."
- The `Link` and `Button` components are already imported at the top of the file — reuse, do not re-import.
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28/research-cta.test.tsx --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep "id=\"browse-research\"" app/research/page.tsx` returns a match
    - `grep "Browse published research" app/research/page.tsx` returns a match
    - `grep "href=\"/research/items\"" app/research/page.tsx` returns a match
    - `grep "variant=\"outline\"" app/research/page.tsx` returns a match (distinct from existing default variant on Join Consultation)
    - `grep "Understanding the Landscape" app/research/page.tsx` returns a match (prose preserved)
    - `grep "Join Consultation" app/research/page.tsx` returns a match (prose preserved)
    - `grep "Research Outputs" app/research/page.tsx` returns a match (prose preserved)
    - `npx vitest run tests/phase-28/research-cta.test.tsx` exits 0 with 5 passing tests
    - `npx tsc --noEmit 2>&1 | grep "app/research/page.tsx"` returns 0 lines
  </acceptance_criteria>
  <done>
    /research page has Browse CTA section, existing prose preserved, research-cta.test.tsx all 5 asserts GREEN.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add /api/research(.*) matcher to proxy.ts</name>
  <files>proxy.ts</files>
  <behavior>
    - Insert new matcher line `'/api/research(.*)',` in the `isPublicRoute = createRouteMatcher([...])` array, after the existing `'/framework(.*)'` line.
    - Preceded by a comment header `// Phase 28 - public research items download endpoint (RESEARCH-10 presigned GET)`.
    - Preserves all existing matchers in order (append-at-end + comment header convention).
  </behavior>
  <read_first>
    - D:/aditee/policydash/proxy.ts (current full file)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md §Presigned Download Strategy — "CRITICAL FINDING: The download API route at /api/research/[id]/download/route.ts is NOT covered by the existing /research(.*) public route matcher"
    - D:/aditee/policydash/tests/phase-28/proxy-public-routes.test.ts (3 asserts this Task must satisfy)
  </read_first>
  <action>
Edit `proxy.ts` surgically. Locate the line:

```typescript
  '/framework(.*)',
```

Insert AFTER it, BEFORE `])`:

```typescript
  // Phase 28 - public research items download endpoint (RESEARCH-10 presigned GET)
  '/api/research(.*)',
```

Result (final block should look like):

```typescript
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/inngest(.*)',
  '/portal(.*)',
  '/api/export/policy-pdf(.*)',
  // Phase 19 - public intake form + submit endpoint (INTAKE-01, INTAKE-07)
  '/participate(.*)',
  '/api/intake(.*)',
  // Phase 20 - public workshops listing + cal.com registration (WS-08, D-08)
  '/workshops(.*)',
  // Phase 20.5 - public research + framework content pages (PUB-06, PUB-07, PUB-08)
  '/research(.*)',
  '/framework(.*)',
  // Phase 28 - public research items download endpoint (RESEARCH-10 presigned GET)
  '/api/research(.*)',
])
```

Rules:
- Use the Edit tool for a surgical append.
- Do NOT modify the default export or the `config.matcher` array below — those remain untouched.
- Do NOT disturb existing comment lines (`Phase 19`, `Phase 20`, `Phase 20.5`).
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28/proxy-public-routes.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep "'/api/research(.*)'" proxy.ts` returns a match
    - `grep "Phase 28" proxy.ts` returns a match
    - `grep "RESEARCH-10" proxy.ts` returns a match
    - `grep "'/research(.*)'" proxy.ts` returns a match (existing Phase 20.5 matcher preserved)
    - `grep "'/framework(.*)'" proxy.ts` returns a match (preserved)
    - `grep "'/workshops(.*)'" proxy.ts` returns a match (preserved)
    - `grep "Phase 19\\|Phase 20" proxy.ts` returns ≥ 3 matches (comment headers for 19, 20, 20.5 preserved)
    - `npx vitest run tests/phase-28/proxy-public-routes.test.ts` exits 0 with 3 passing tests
    - `npx tsc --noEmit 2>&1 | grep "proxy.ts"` returns 0 lines
  </acceptance_criteria>
  <done>
    proxy.ts has /api/research(.*) matcher with Phase 28 comment header, existing whitelist preserved, proxy-public-routes.test.ts all 3 asserts GREEN.
  </done>
</task>

<task type="auto">
  <name>Task 3: Register RESEARCH-09 and RESEARCH-10 in .planning/REQUIREMENTS.md</name>
  <files>.planning/REQUIREMENTS.md</files>
  <behavior>
    - Append RESEARCH-09 and RESEARCH-10 lines to the v0.2 "### Research Module" subsection after the existing RESEARCH-08 entry.
    - Append traceability rows to the `## Traceability` table after the existing `| RESEARCH-08 | Phase 27 | Complete |` row.
    - Update Coverage footer counts (+2 to v0.2 and Total).
    - Update "Last updated" stamp.
  </behavior>
  <read_first>
    - D:/aditee/policydash/.planning/REQUIREMENTS.md (current file — identify exact line numbers for RESEARCH-08, traceability table end, Coverage block, Last updated stamp)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-CONTEXT.md §Goal, §Scope (IN), §Success criteria (descriptions for RESEARCH-09/10 drawn from here)
    - D:/aditee/policydash/.planning/phases/26-research-module-data-server/26-00-SUMMARY.md (if exists — reference for how Phase 26 registered RESEARCH-01..05)
  </read_first>
  <action>
Edit `.planning/REQUIREMENTS.md` in three places.

**Edit 1: Research Module subsection** — locate `- [x] **RESEARCH-08**: ...` and insert AFTER it:

```markdown
- [x] **RESEARCH-09**: Public `/research/items` listing page (`app/research/items/page.tsx`) renders all items with `status = 'published'`; supports query-param filters `?document=`, `?type=`, `?from=`, `?to=`, `?sort=newest|oldest`; defaults to newest-first; offset pagination (40 items/page); card layout with title, type badge, authors (or "Source: Confidential" when `isAuthorAnonymous`), publishedDate, Download-or-View-Source CTA; existing `/research` static page gains a "Browse published research" CTA linking to `/research/items` without prose changes.
- [x] **RESEARCH-10**: Public `/research/items/[id]` detail page (`app/research/items/[id]/page.tsx`) renders full metadata, formatted abstract (whitespace-preserved), DOI as `https://doi.org/{doi}` hyperlink, presigned R2 download via `app/api/research/[id]/download/route.ts` (24h TTL, per-IP rate limit 10/60s); links to policy sections as `/framework/[docId]#section-{sectionId}` and to policy versions as `/portal/[docId]?v=<label>` (filtered to published versions); NO feedback IDs, stakeholder names, `createdBy`/`reviewedBy`, or internal audit columns leak to the public surface; `proxy.ts` whitelists `/api/research(.*)` for unauthenticated download access.
```

**Edit 2: Traceability table** — locate the line `| RESEARCH-08 | Phase 27 | Complete |` and append AFTER it:

```markdown
| RESEARCH-09 | Phase 28 | Complete |
| RESEARCH-10 | Phase 28 | Complete |
```

**Edit 3: Coverage footer + Last updated stamp**:

Locate:
```markdown
**Coverage:**
- v1 requirements: 87 total — 87 mapped, 87 complete
- v0.2 requirements: 63 total — 63 mapped, 0 complete
- Total: 150 requirements — 150 mapped, 87 complete, 63 pending, 0 unmapped
```

**Important:** Before editing, grep for the actual current Coverage line values — prior phase completions may have incremented `v0.2 requirements ... complete` beyond 0. Take the CURRENT values, add 2 to v0.2 total and v0.2 complete, add 2 to Total, and update "complete" and "total" fields accordingly.

Replace with (if current state is still 0 complete):
```markdown
**Coverage:**
- v1 requirements: 87 total — 87 mapped, 87 complete
- v0.2 requirements: 65 total — 65 mapped, 2 complete (RESEARCH-09, RESEARCH-10)
- Total: 152 requirements — 152 mapped, 89 complete, 63 pending, 0 unmapped
```

(Adjust if v0.2 complete count in the file at edit-time differs — increment by 2, not replace with hardcoded 2.)

Locate final line:
```markdown
*Last updated: 2026-04-20 — Phase 27 added RESEARCH-06..08 (3 UI-bearing requirements)*
```

Replace with:
```markdown
*Last updated: 2026-04-20 — Phase 28 added RESEARCH-09 and RESEARCH-10 (2 public-surface requirements)*
```

Use Edit tool for all three surgical edits — do not rewrite the whole file.
  </action>
  <verify>
    <automated>grep -c "RESEARCH-09\|RESEARCH-10" D:/aditee/policydash/.planning/REQUIREMENTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "RESEARCH-09" .planning/REQUIREMENTS.md` returns ≥ 2 (one entry + one traceability row)
    - `grep -c "RESEARCH-10" .planning/REQUIREMENTS.md` returns ≥ 2 (one entry + one traceability row)
    - `grep "\\*\\*RESEARCH-09\\*\\*" .planning/REQUIREMENTS.md` returns a match (bold entry)
    - `grep "\\*\\*RESEARCH-10\\*\\*" .planning/REQUIREMENTS.md` returns a match
    - `grep "| RESEARCH-09 | Phase 28 | Complete |" .planning/REQUIREMENTS.md` returns a match
    - `grep "| RESEARCH-10 | Phase 28 | Complete |" .planning/REQUIREMENTS.md` returns a match
    - `grep "v0.2 requirements: 65 total" .planning/REQUIREMENTS.md` returns a match (or other correct incremented number if prior phases updated since planning)
    - `grep "Phase 28 added RESEARCH-09 and RESEARCH-10" .planning/REQUIREMENTS.md` returns a match
    - The existing `- [x] **RESEARCH-01** through RESEARCH-08**` lines are untouched (verify via `grep -c "^\\- \\[x\\] \\*\\*RESEARCH-0[1-8]\\*\\*:" .planning/REQUIREMENTS.md` returns 8)
  </acceptance_criteria>
  <done>
    REQUIREMENTS.md has RESEARCH-09 and RESEARCH-10 registered in Research Module subsection, traceability table updated with 2 rows, Coverage footer incremented, Last updated stamp refreshed.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Full phase-28 suite GREEN + phase acceptance gate quartet</name>
  <files>tests/phase-28/no-leak.test.ts</files>
  <behavior>
    - Convert the final it.todo in no-leak.test.ts (listing-card HTML stub) to a GREEN assert, since the CTA on /research/items is now wired.
    - Run the phase acceptance gate quartet (per STATE.md Phase 19 convention): (1) full phase-28 suite, (2) full vitest suite, (3) `npx tsc --noEmit`, (4) `git diff --stat` to confirm only Phase 28 files touched in this wave.
  </behavior>
  <read_first>
    - D:/aditee/policydash/tests/phase-28/no-leak.test.ts (current state after Plan 28-03 Task 3 conversion)
    - D:/aditee/policydash/app/research/items/_components/research-card.tsx (Plan 28-02 output — has Card class + typeLabel + date + CTA; does NOT render description, doi, or linked sections count)
  </read_first>
  <action>
Edit the final `it.todo` in `tests/phase-28/no-leak.test.ts`:

```typescript
  // Replace:
  it.todo('listing-page card HTML does NOT contain abstract, doi, linked sections count (CONTEXT.md Q9)')

  // With:
  it('listing-page card HTML does NOT contain abstract/description, doi, or linked sections count (CONTEXT.md Q9)', async () => {
    // ResearchCard is a pure-server component taking a PublicResearchItem prop.
    // Import directly and renderToStaticMarkup with a fixture that includes
    // description + doi + would-be-linked-sections values — assert HTML omits them.
    const { ResearchCard } = await import('@/app/research/items/_components/research-card')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const React = await import('react')

    const html = renderToStaticMarkup(
      React.createElement(ResearchCard, {
        item: {
          id: 'r1', readableId: 'RI-001', documentId: 'd1',
          title: 'AI Policy', itemType: 'report',
          description: 'This abstract must NOT appear on the card.',
          externalUrl: null, artifactId: 'art-1',
          doi: '10.1234/secret-doi-value',
          authors: ['J. Doe'], publishedDate: '2026-02-01',
          peerReviewed: false, journalOrSource: null,
          versionLabel: null, previousVersionId: null,
          isAuthorAnonymous: false, retractionReason: null,
        },
      }),
    )
    expect(html).not.toContain('This abstract must NOT appear on the card.')
    expect(html).not.toContain('10.1234/secret-doi-value')
    expect(html).not.toMatch(/linked sections|Informs These Sections/i)
  })
```

Run the full phase-28 suite + acceptance gate quartet:

```bash
# Gate 1: phase-28 suite
npx vitest run tests/phase-28 --reporter=dot

# Gate 2: full vitest suite (ensures no regression in prior phase tests)
npx vitest run --reporter=dot

# Gate 3: TypeScript clean
npx tsc --noEmit

# Gate 4: only Phase 28 files touched in this wave (Plans 28-00..28-04 files)
git diff --name-only HEAD~1 HEAD
```

All four must pass. If Gate 2 regresses any prior phase test, investigate — most likely cause: the new proxy.ts entry accidentally broke some prior phase's proxy-related test. Do NOT suppress or skip failing tests.
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28 --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "it.todo" tests/phase-28/no-leak.test.ts` returns 0 (all real asserts)
    - `npx vitest run tests/phase-28` exits 0 with 0 failures, 0 todos
    - `npx vitest run` exits 0 (full project suite — no regression)
    - `npx tsc --noEmit` exits 0
    - `grep "This abstract must NOT appear" tests/phase-28/no-leak.test.ts` returns a match (test fixture sentinel string)
  </acceptance_criteria>
  <done>
    Full phase-28 suite is GREEN end-to-end. Acceptance gate quartet (phase suite, full suite, tsc, git diff scope) all pass. Phase 28 ready for /gsd:verify-work.
  </done>
</task>

</tasks>

<verification>
Wave 4 closeout verification:
- /research page has Browse CTA section
- proxy.ts has /api/research(.*) public matcher
- REQUIREMENTS.md has RESEARCH-09 + RESEARCH-10 registered with traceability rows
- All 8 phase-28 test files GREEN (0 red, 0 todo)
- Full vitest suite GREEN (no regression)
- TypeScript clean
- Only Phase 28 files touched in Plan 28-04 commit
</verification>

<success_criteria>
- RESEARCH-09 + RESEARCH-10 registered in REQUIREMENTS.md
- Download route publicly accessible via proxy whitelist
- /research page has CTA to /research/items
- Zero Wave 0 RED tests remaining
- Full phase-28 suite GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/28-public-research-items-listing/28-04-SUMMARY.md` covering: 3 files edited (app/research/page.tsx + proxy.ts + REQUIREMENTS.md), all Wave 0 test files flipped from RED/todo to GREEN, phase-wide acceptance gate quartet passed, next step /gsd:verify-work.
</output>
