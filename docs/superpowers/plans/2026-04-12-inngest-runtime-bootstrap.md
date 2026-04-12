# Inngest Runtime Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and wire up Inngest as the automation runtime substrate, proven end-to-end with one sample function that exercises typed events, extracted testable logic, `step.run`, `step.sleep`, and the Next.js route handler. After this plan lands, every future flow in Domain 9 of the combined feature list spec becomes a small additive change — add an event schema, add a function file, append to the barrel.

**Architecture:** PolicyDash runs on Vercel (serverless) + Neon (Postgres). A long-running worker is not an option, so Inngest Cloud's managed step-function model is used: Inngest's cloud calls `POST /api/inngest` when events fire or schedules trigger, and function execution happens inside the existing Next.js serverless functions. Typed events are defined with Zod schemas and passed to `EventSchemas.fromZod()`, giving end-to-end type safety from the `emitEvent()` caller through the function handler. Pure business logic inside each step is extracted into helper modules so it can be unit-tested with Vitest without needing the Inngest Dev Server.

**Tech Stack:** `inngest` npm package (client + `inngest/next` adapter), Zod (already in the codebase), Vitest (already configured), TypeScript with `@/src/...` path alias (existing convention).

**Non-goals:**
- Defining the full event registry for the 7 production flows (Flow 1–7) — those are separate plans.
- Emitting events from existing tRPC mutations (wiring into feedback, CR, workshop routers) — deferred to the flow plans.
- Integration with the in-app `notifications` table or the Resend email path — deferred.
- Production secret rotation / key hand-off to Vercel — documented, not executed.

---

## Prerequisites and conventions

- **Path alias:** `@/src/...` maps to `src/` at the project root. Established by `app/api/upload/route.ts` which imports `@/src/lib/r2`. Use the same pattern for all new imports.
- **Test pattern:** Vitest, `src/**/*.test.ts` glob (see `vitest.config.mts`), run with `npm test`. Use `__tests__` subfolders for colocated tests.
- **Commit style:** `type(scope): subject` — e.g. `feat(inngest): ...`, `chore(inngest): ...`, `docs(inngest): ...`, `test(inngest): ...`. Current HEAD uses this convention.
- **Env file:** `.env.example` already exists at the project root with `DATABASE_URL`, Clerk keys, etc. Add new vars to it alongside the existing blocks.
- **Next.js 16:** per `AGENTS.md`, this project is on a version of Next.js with breaking changes that may differ from training data. Route handlers in the App Router still use named exports for HTTP methods (`export const GET`, `export const POST`), which is what `inngest/next`'s `serve()` returns. Task 8 includes a verification step against the installed `inngest/next` types before wiring the route.
- **User convention:** commit directly to master, no worktrees, no feature branches. Each task commits on completion.

---

## File Structure

New files (all created by this plan):

```
src/inngest/
  client.ts                       — Inngest client instance + typed EventSchemas
  emit.ts                         — typed emitEvent() helper wrapping inngest.send()
  README.md                       — local dev instructions + production deploy notes
  lib/
    greeting.ts                   — pure greeting logic for the sample function (testable)
  functions/
    hello.ts                      — sample Inngest function using step.run + step.sleep
    index.ts                      — barrel exporting the functions array
  __tests__/
    greeting.test.ts              — Vitest unit test for pure greeting logic

app/api/inngest/
  route.ts                        — Next.js route handler that mounts serve()
```

Modified files:

```
.env.example                      — add INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY block
package.json + package-lock.json  — adds "inngest" dependency
```

Each file has one clear responsibility:
- `client.ts` **only** defines the Inngest client and the event schemas.
- `emit.ts` **only** exposes a type-safe wrapper over `inngest.send`.
- `lib/greeting.ts` **only** does the pure string computation (no side effects, no Inngest imports — keeps the test trivial).
- `functions/hello.ts` **only** wires the Inngest function (retry config, step wiring) and delegates the real work to `lib/greeting.ts`.
- `functions/index.ts` is a barrel that every new flow appends itself to.
- `app/api/inngest/route.ts` is Next.js glue, nothing more.
- `README.md` captures the "how do I run this locally and ship it to prod" knowledge so future flow authors don't rediscover it.

---

## Task 1: Install Inngest and update .env.example

**Files:**
- Modify: `package.json` (dependency added via npm)
- Modify: `.env.example`

- [ ] **Step 1: Install the Inngest SDK**

Run:
```bash
npm install inngest
```

Expected: `inngest` added to `dependencies` in `package.json` (not `devDependencies` — the client runs in production).

- [ ] **Step 2: Verify the install**

Run:
```bash
npm ls inngest
```

Expected: Prints a tree fragment like `policydashboard@0.1.0 ... └── inngest@3.x.x`. If it prints `(empty)` or an error, the install failed — re-run `npm install`.

- [ ] **Step 3: Add Inngest env vars to .env.example**

Append this block to the end of `.env.example`:

```
# Inngest (automation runtime)
# Dev: not required — Inngest Dev Server runs keyless locally
# Prod: required — create an app at https://app.inngest.com, copy these from the app's "Keys" page
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(inngest): install inngest SDK and add env var placeholders"
```

---

## Task 2: Create the Inngest client with typed EventSchemas

**Files:**
- Create: `src/inngest/client.ts`

- [ ] **Step 1: Create the client file**

Create `src/inngest/client.ts` with this exact content:

```ts
import { EventSchemas, Inngest, type GetEvents } from 'inngest'
import { z } from 'zod'

/**
 * Domain event registry.
 *
 * Every Inngest event PolicyDash emits must have a Zod schema here. The schemas
 * are collected into EventSchemas.fromZod() so both `inngest.send()` and the
 * function handlers get end-to-end type safety (and runtime validation on send).
 *
 * To add a new event: create a z.object({ name: z.literal('your.event.name'),
 * data: z.object({ ... }) }) and append it to the tuple passed to fromZod().
 */
const eventSchemas = [
  z.object({
    name: z.literal('sample.hello'),
    data: z.object({
      recipientName: z.string().min(1),
    }),
  }),
] as const

export const inngest = new Inngest({
  id: 'policydash',
  schemas: new EventSchemas().fromZod(eventSchemas),
})

export type PolicyDashEvents = GetEvents<typeof inngest>
```

- [ ] **Step 2: Verify the file type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors. If the `inngest` package's `EventSchemas.fromZod` signature in the installed version differs from what's written above (rare — this API has been stable since v3), adapt to match the installed types. Check `node_modules/inngest/components/EventSchemas.d.ts` for the current shape.

- [ ] **Step 3: Commit**

```bash
git add src/inngest/client.ts
git commit -m "feat(inngest): add typed client with EventSchemas registry"
```

---

## Task 3: Create the typed emit helper

**Files:**
- Create: `src/inngest/emit.ts`

- [ ] **Step 1: Create the emit helper**

Create `src/inngest/emit.ts` with this exact content:

```ts
import { inngest, type PolicyDashEvents } from './client'

type EmitInput<K extends keyof PolicyDashEvents> = {
  name: K
  data: PolicyDashEvents[K]['data']
}

/**
 * Type-safe wrapper around inngest.send(). Prefer this over calling
 * inngest.send() directly so every emission site benefits from the event
 * registry in client.ts — misspelled event names and missing data fields
 * become TypeScript errors at the call site.
 *
 * Usage:
 *   await emitEvent({
 *     name: 'sample.hello',
 *     data: { recipientName: 'PolicyDash' },
 *   })
 */
export async function emitEvent<K extends keyof PolicyDashEvents>(
  event: EmitInput<K>,
): Promise<void> {
  await inngest.send(event)
}
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/inngest/emit.ts
git commit -m "feat(inngest): add typed emitEvent helper"
```

---

## Task 4: Write the failing test for the pure greeting logic

**Files:**
- Create: `src/inngest/__tests__/greeting.test.ts`

- [ ] **Step 1: Write the test**

Create `src/inngest/__tests__/greeting.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest'
import { buildGreeting } from '../lib/greeting'

describe('buildGreeting', () => {
  it('includes the recipient name in the greeting', () => {
    const result = buildGreeting({
      recipientName: 'PolicyDash',
      deliveredAt: new Date('2026-04-12T12:00:00.000Z'),
    })

    expect(result).toContain('PolicyDash')
  })

  it('includes the ISO timestamp of delivery', () => {
    const result = buildGreeting({
      recipientName: 'Test User',
      deliveredAt: new Date('2026-04-12T12:00:00.000Z'),
    })

    expect(result).toContain('2026-04-12T12:00:00.000Z')
  })

  it('rejects an empty recipient name with a clear error', () => {
    expect(() =>
      buildGreeting({ recipientName: '', deliveredAt: new Date() }),
    ).toThrow(/recipientName/)
  })
})
```

- [ ] **Step 2: Run the test — it must fail**

Run:
```bash
npm test -- src/inngest/__tests__/greeting.test.ts
```

Expected: FAIL. Vitest reports that `../lib/greeting` cannot be resolved — the module does not exist yet. This is the intended failure mode.

---

## Task 5: Implement the pure greeting logic

**Files:**
- Create: `src/inngest/lib/greeting.ts`

- [ ] **Step 1: Create the greeting implementation**

Create `src/inngest/lib/greeting.ts` with this exact content:

```ts
type BuildGreetingInput = {
  recipientName: string
  deliveredAt: Date
}

/**
 * Pure greeting builder used by the sample Inngest function.
 *
 * Extracted from the step body so it can be unit tested without needing
 * the Inngest Dev Server. Every future flow should follow the same pattern:
 * the heavy lifting of a step lives in a testable module under
 * src/inngest/lib/, and the function file in src/inngest/functions/ is a
 * thin wrapper that calls it from inside step.run().
 */
export function buildGreeting({
  recipientName,
  deliveredAt,
}: BuildGreetingInput): string {
  if (recipientName.trim().length === 0) {
    throw new Error('buildGreeting: recipientName must not be empty')
  }

  return `Hello, ${recipientName}! Delivered at ${deliveredAt.toISOString()}`
}
```

- [ ] **Step 2: Run the test — it must pass**

Run:
```bash
npm test -- src/inngest/__tests__/greeting.test.ts
```

Expected: PASS. All three test cases green.

- [ ] **Step 3: Commit**

```bash
git add src/inngest/lib/greeting.ts src/inngest/__tests__/greeting.test.ts
git commit -m "feat(inngest): add testable greeting helper for sample function"
```

---

## Task 6: Create the sample Inngest function

**Files:**
- Create: `src/inngest/functions/hello.ts`

- [ ] **Step 1: Create the function file**

Create `src/inngest/functions/hello.ts` with this exact content:

```ts
import { inngest } from '../client'
import { buildGreeting } from '../lib/greeting'

/**
 * Sample Inngest function — the bootstrap smoke test.
 *
 * Listens for `sample.hello`, builds a greeting inside a step.run so the
 * computation is idempotent and observable, sleeps 5 seconds to prove the
 * delayed-execution primitive works, then returns the greeting as the run
 * output (visible in the Inngest dashboard).
 *
 * Keep this function in the codebase as a permanent smoke test. When the
 * real Domain 9 flows land, they follow the same structure: extract pure
 * logic into src/inngest/lib/, wire the function here with step.run /
 * step.sleep / step.sleepUntil as needed, and append to the functions barrel.
 */
export const helloFn = inngest.createFunction(
  {
    id: 'sample-hello',
    name: 'Sample hello',
    // retries counts attempts AFTER the initial try. retries: 3 means up to
    // 4 total attempts before Inngest marks the run as failed.
    retries: 3,
  },
  { event: 'sample.hello' },
  async ({ event, step }) => {
    const greeting = await step.run('build-greeting', () => {
      return buildGreeting({
        recipientName: event.data.recipientName,
        deliveredAt: new Date(),
      })
    })

    await step.sleep('brief-delay', '5s')

    return { greeting }
  },
)
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors. The `event.data.recipientName` access should be fully typed as `string` thanks to the Zod schema registered in `client.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/inngest/functions/hello.ts
git commit -m "feat(inngest): add sample hello function with step.run + step.sleep"
```

---

## Task 7: Create the functions barrel

**Files:**
- Create: `src/inngest/functions/index.ts`

- [ ] **Step 1: Create the barrel**

Create `src/inngest/functions/index.ts` with this exact content:

```ts
import { helloFn } from './hello'

/**
 * The array of Inngest functions mounted at /api/inngest.
 *
 * To add a new flow: create the function file in this directory, import it
 * here, and append it to the functions array below. The route handler at
 * app/api/inngest/route.ts imports this array and hands it to serve().
 */
export const functions = [helloFn]
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/inngest/functions/index.ts
git commit -m "feat(inngest): add functions barrel export"
```

---

## Task 8: Mount the Inngest route handler in Next.js

**Files:**
- Create: `app/api/inngest/route.ts`

- [ ] **Step 1: Verify the inngest/next adapter signature against the installed version**

Per `AGENTS.md`, confirm the installed `inngest/next` package exports a `serve` function that returns an object with named HTTP method handlers. Inspect the type definitions directly — this works regardless of whether the project uses CommonJS or ESM:

```bash
ls node_modules/inngest/next.d.ts node_modules/inngest/next.d.mts 2>/dev/null
```

Open whichever file exists (at least one will) and read the `export` block at the bottom. The rest of this task assumes `serve({ client, functions })` returns an object exposing named `GET`, `POST`, and `PUT` handlers. If the installed version exports a different shape (for example, the handlers are named differently or there is a default export), adjust Step 2 below to match.

- [ ] **Step 2: Create the route handler**

Create `app/api/inngest/route.ts` with this exact content:

```ts
import { serve } from 'inngest/next'
import { inngest } from '@/src/inngest/client'
import { functions } from '@/src/inngest/functions'

/**
 * Inngest HTTP entry point.
 *
 * Inngest Cloud calls this route to (a) discover the list of functions at
 * deploy time, (b) deliver events to the appropriate function handler at
 * runtime. Locally, the Inngest Dev Server polls GET /api/inngest to
 * discover functions and POSTs here to trigger runs.
 *
 * This file should stay a three-line glue file — the client lives in
 * src/inngest/client.ts and functions are added to the barrel at
 * src/inngest/functions/index.ts.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
```

- [ ] **Step 3: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Verify Next.js can resolve the route**

Run:
```bash
npm run build
```

Expected: Build succeeds. The build output should include a line mentioning `/api/inngest` as a route. If the build fails with a type error on the `serve()` call, re-check Step 1 above — the installed adapter may expose a different signature.

- [ ] **Step 5: Commit**

```bash
git add app/api/inngest/route.ts
git commit -m "feat(inngest): mount route handler at /api/inngest"
```

---

## Task 9: Write the Inngest README

**Files:**
- Create: `src/inngest/README.md`

- [ ] **Step 1: Create the README**

Create `src/inngest/README.md` with this exact content:

````markdown
# Inngest — automation runtime

PolicyDash uses Inngest as its background-job and event substrate. Inngest is a
managed service: it calls `POST /api/inngest` when events fire or schedules
trigger, and all function execution happens inside the existing Next.js
serverless functions on Vercel. There is no self-hosted worker.

## Architecture at a glance

- `client.ts` — the singleton Inngest client plus the typed event registry
  (Zod schemas feeding `EventSchemas.fromZod()`). Every event PolicyDash emits
  must be registered here.
- `emit.ts` — the `emitEvent()` helper. Prefer this over `inngest.send()`
  directly so misspelled event names become TypeScript errors at the call site.
- `lib/*.ts` — pure business logic called from inside `step.run()` bodies.
  Testable in isolation with Vitest — no Inngest Dev Server required.
- `functions/*.ts` — thin Inngest function definitions (retry config, step
  wiring) that delegate real work to `lib/`.
- `functions/index.ts` — barrel that collects every function into the array
  mounted at `/api/inngest`.
- `../../app/api/inngest/route.ts` — Next.js route handler, three-line glue.

## Local development

Inngest ships a local Dev Server that discovers PolicyDash's functions by
polling `http://localhost:3000/api/inngest`. No API keys are needed locally.

**Terminal 1 — Next.js:**
```bash
npm run dev
```

**Terminal 2 — Inngest Dev Server:**
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

The `-u` flag tells the Dev Server exactly where to find PolicyDash's function
endpoint. By default the Dev Server binds to port 8288. Open
<http://localhost:8288> in a browser. Confirm the "Apps" tab shows one app
named `policydash` with one function (`sample-hello`). If it does not appear,
the Dev Server will retry polling — make sure `npm run dev` is running on port
3000 and that `/api/inngest` returns a 200 (you can curl it directly).

## Smoke test (run this after bootstrap lands)

1. Both dev servers running (see above).
2. In the Inngest Dev UI at <http://localhost:8288>, go to "Events" → "Send".
3. Event name: `sample.hello`. Payload:
   ```json
   { "data": { "recipientName": "PolicyDash" } }
   ```
4. Click Send. Go to the "Runs" tab.
5. Expected: one run for function `sample-hello` in state "Running" for a few
   seconds (the 5-second `step.sleep`), then "Completed" with output
   `{"greeting":"Hello, PolicyDash! Delivered at <iso>"}`.
6. If the run fails, the Dev UI shows the full step-by-step timeline and the
   failing step's error. Fix and re-run from the same panel.

## Adding a new flow

1. Add a Zod schema for the new event in `client.ts` (append to the
   `eventSchemas` tuple).
2. Put any non-trivial business logic in `lib/<flow-name>.ts` and unit test it.
3. Create `functions/<flow-name>.ts` with `inngest.createFunction()`. Keep the
   function body a thin shell that calls into `lib/`.
4. Import and append to the `functions` array in `functions/index.ts`.
5. Emit the event from wherever the trigger lives (usually a tRPC mutation):
   ```ts
   import { emitEvent } from '@/src/inngest/emit'
   await emitEvent({ name: 'your.event', data: { ... } })
   ```
6. Smoke test against the local Dev Server before committing.

## Production deployment (Vercel + Inngest Cloud)

Not executed by the bootstrap plan — these are the steps to run once, when
promoting the first flow to production.

1. Create an account at <https://app.inngest.com>.
2. Create an app called `policydash`.
3. From the app's "Keys" page, copy `INNGEST_EVENT_KEY` and
   `INNGEST_SIGNING_KEY`.
4. Add both to Vercel → Project Settings → Environment Variables, scoped to
   Production (and Preview if you want previews to run against Inngest Cloud).
5. In Inngest Cloud, register the deployed PolicyDash URL as the app endpoint
   (e.g., `https://policydash.example.com/api/inngest`). Inngest Cloud sends a
   sync request to that URL to discover functions.
6. Deploy. Confirm in the Inngest Cloud dashboard that `sample-hello` appears
   in the function list.
7. (Optional) Send a test `sample.hello` event from Inngest Cloud to verify
   the production path end-to-end.
````

- [ ] **Step 2: Commit**

```bash
git add src/inngest/README.md
git commit -m "docs(inngest): add runtime README with local dev + prod deploy instructions"
```

---

## Task 10: Local smoke test

No files to change — this task proves the substrate works end-to-end. Treat a
failure here as a real bug in the preceding tasks, not a quirk of the test
environment.

- [ ] **Step 1: Start the Next.js dev server**

In terminal 1, run:
```bash
npm run dev
```

Expected: Next.js boots on `http://localhost:3000` within a few seconds. Leave
this terminal running.

- [ ] **Step 2: Start the Inngest Dev Server**

In terminal 2, run:
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

The `-u` flag explicitly tells the Dev Server where PolicyDash's function
endpoint lives. Without it, some Inngest CLI versions require you to register
the URL in the UI after boot. Passing it upfront avoids that step.

Expected: The Dev Server boots on port 8288 and starts polling the URL. After
a moment you should see a log line mentioning the `policydash` app was
discovered with `1` function. Leave this terminal running.

- [ ] **Step 3: Open the Inngest Dev UI**

In a browser, open <http://localhost:8288>.

- [ ] **Step 4: Confirm the function is registered**

In the Dev UI, click "Apps" in the sidebar.

Expected: One app listed, `policydash`, with a "Functions" count of `1`. Click
it and confirm the function `sample-hello` is present with trigger
`sample.hello`.

- [ ] **Step 5: Send the test event**

In the Dev UI, click "Events" in the sidebar, then "Send Event" (or the
equivalent button — wording varies slightly by Inngest CLI version). Fill in:

- Event name: `sample.hello`
- Payload body:
  ```json
  { "data": { "recipientName": "PolicyDash bootstrap" } }
  ```

Click Send.

- [ ] **Step 6: Watch the run**

Click "Runs" in the sidebar.

Expected: A run for function `sample-hello` appears. It enters the
`build-greeting` step, completes it immediately, enters the `brief-delay`
step (step.sleep), and waits ~5 seconds. Then the run completes with output
`{"greeting":"Hello, PolicyDash bootstrap! Delivered at <iso>"}`.

If the run fails, the Dev UI shows the failing step and the error. Common
failure modes:

- **"Cannot find module ..."** → one of the `@/src/...` imports is wrong.
  Re-check path aliases against `tsconfig.json`.
- **"Event schema validation failed"** → the JSON payload in Step 5 did not
  include the `recipientName` field under `data`. Re-send with the exact
  payload above.
- **"Next.js 404 on /api/inngest"** → the route handler in Task 8 is not
  exporting the HTTP method the Dev Server is calling. Re-check Task 8 Step 2
  and that the `inngest/next` adapter returns `{ GET, POST, PUT }` in the
  installed version.

- [ ] **Step 7: Run the full test suite as a final sanity check**

Run:
```bash
npm test
```

Expected: All tests pass (the existing suite plus the new `greeting.test.ts`).

- [ ] **Step 8: Run the typechecker as a final sanity check**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Run the production build as a final sanity check**

Run:
```bash
npm run build
```

Expected: Build succeeds. The build output includes `/api/inngest` as a route.

No commit for this task — it is pure verification.

---

## Done-when

After Task 10 passes, the Inngest runtime is fully bootstrapped:

- `inngest` is installed and declared in `package.json`.
- The typed event registry is in place — adding a new event is a one-line Zod
  schema addition in `client.ts`.
- The `emitEvent()` helper gives type-safe dispatch at every call site.
- One end-to-end function proves the substrate: typed event → Zod validation →
  step.run with extracted testable logic → step.sleep delayed execution →
  function output visible in the dashboard.
- Vitest covers the pure helper.
- TypeScript compiles clean across the whole repo.
- `npm run build` succeeds.
- The Inngest Dev Server discovers PolicyDash locally and can trigger runs.
- The README documents local dev, the smoke-test procedure, the pattern for
  adding new flows, and the production deploy path.

At this point, every flow in Domain 9 of the combined feature list spec
(Flow 1 through Flow 7) becomes a small, additive, testable change on top of
this substrate. The next plan can pick any flow and land it without touching
this scaffolding.
