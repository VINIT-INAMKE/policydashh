# Inngest - automation runtime

PolicyDash uses Inngest as its background-job and event substrate. Inngest is a
managed service: it calls `POST /api/inngest` when events fire or schedules
trigger, and all function execution happens inside the existing Next.js
serverless functions on Vercel. There is no self-hosted worker.

## Architecture at a glance

- `client.ts` - the singleton Inngest client. Just `new Inngest({ id })`.
- `events.ts` - exported `EventType` instances (one per domain event) built
  with `eventType(name, { schema })`, plus small `sendX()` helpers wrapping
  `inngest.send(event.create(data))` for ergonomic call-site use. Every event
  PolicyDash emits is declared here.
- `lib/*.ts` - pure business logic called from inside `step.run()` bodies.
  Testable in isolation with Vitest - no Inngest Dev Server required.
- `functions/*.ts` - thin Inngest function definitions (retry config, step
  wiring) that delegate real work to `lib/`. Triggers reference the
  `EventType` instance from `events.ts`, not a string event name.
- `functions/index.ts` - barrel that collects every function into the array
  mounted at `/api/inngest`.
- `../../app/api/inngest/route.ts` - Next.js route handler, three-line glue.

## Local development

Inngest ships a local Dev Server that discovers PolicyDash's functions by
polling `http://localhost:3000/api/inngest`. No API keys are needed locally.

**Terminal 1 - Next.js:**
```bash
npm run dev
```

**Terminal 2 - Inngest Dev Server:**
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

The `-u` flag tells the Dev Server exactly where to find PolicyDash's function
endpoint. By default the Dev Server binds to port 8288. Open
<http://localhost:8288> in a browser. Confirm the "Apps" tab shows one app
named `policydash` with one function (`sample-hello`). If it does not appear,
the Dev Server will retry polling - make sure `npm run dev` is running on port
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

1. Declare the event in `events.ts`:
   ```ts
   export const myEvent = eventType('my.event', {
     schema: z.object({ foo: z.string() }),
   })
   export async function sendMyEvent(data: { foo: string }) {
     await inngest.send(myEvent.create(data))
   }
   ```
2. Put any non-trivial business logic in `lib/<flow-name>.ts` and unit test it.
3. Create `functions/<flow-name>.ts` with `inngest.createFunction()`. Use the
   `EventType` as the trigger (not a string) so `event.data` types flow
   automatically. Inngest v4 uses a 2-argument shape - triggers live inside
   the options object:
   ```ts
   import { inngest } from '../client'
   import { myEvent } from '../events'
   export const myFn = inngest.createFunction(
     {
       id: 'my-fn',
       retries: 3,
       triggers: [{ event: myEvent }],
     },
     async ({ event, step }) => { /* ... */ },
   )
   ```

   **Important - inline the `triggers: [...]` array.** Keep the trigger list
   inside the options object literal. If you extract it to an intermediate
   `const triggers = [{ event: myEvent }]`, TypeScript widens the trigger
   type and `event.data` in the handler collapses to `any`. This is a v4
   type-inference footgun - always inline.
4. Import and append to the `functions` array in `functions/index.ts`.
5. Emit the event from wherever the trigger lives (usually a tRPC mutation).
   **Always use the `sendX()` helper - never call `inngest.send()` directly.**
   The helper enforces Zod validation and keeps the type-safe contract between
   call site and schema:
   ```ts
   import { sendMyEvent } from '@/src/inngest/events'
   await sendMyEvent({ foo: 'bar' })
   ```
6. Smoke test against the local Dev Server before committing.

## Errors: retry vs. non-retry

Inngest retries `retries: N` times on any thrown error from a step or handler.
That's the right behavior for **transient** failures - network hiccups, brief
database unavailability, rate-limit bumps, upstream service flaps.

For **deterministic** failures - bad input, policy violation, a missing
prerequisite, a row that does not exist - retrying N times is waste. It burns
retry budget, delays the dashboard signal, and sends the same bad payload
through the same broken code path repeatedly. Throw `NonRetriableError`
from `inngest` instead:

```ts
import { NonRetriableError } from 'inngest'

if (!user) {
  throw new NonRetriableError(`user ${userId} not found`)
}
```

Inngest will mark the run as failed immediately and skip retries. Rule of
thumb: use plain `Error` for anything that might succeed on retry; use
`NonRetriableError` for anything that cannot.

## Function options beyond the basics

The bootstrap's `helloFn` uses `id`, `name`, `retries`, and `triggers`. Real
flows will need more:

- `concurrency` - cap parallel runs per function or per event key. Use this
  on Flow 1 (stakeholder intake) to avoid hammering Resend if a spam burst
  comes through the participate form.
- `rateLimit` - coarser throttle (e.g., "at most N runs per 10 seconds").
- `batchEvents` - merge many incoming events into a single function run for
  bulk processing. Useful for digest emails and feedback normalization.
- `debounce` - collapse a burst of events into one delayed run.
- `throttle` - newer alternative to `rateLimit` with different semantics.
- `priority` - raise or lower a run's scheduling priority.

None of these are wired in the bootstrap. When a flow needs one, look up the
current option shape in `node_modules/inngest/components/InngestFunction.d.ts`
and add it to the options object - the `createFunction` types will check it.

## Step tools beyond step.run + step.sleep

The bootstrap demonstrates `step.run()` (idempotent work) and `step.sleep()`
(fixed delay). Other step tools the real flows will need:

- `step.sleepUntil(targetDate)` - sleep until a specific moment (workshop
  reminders at T-48h and T-2h, deferred tasks).
- `step.waitForEvent(name, { timeout, if })` - pause the function until
  another event arrives (post-workshop evidence waiting on artifact uploads,
  expert review waiting on reviewer response).
- `step.invoke(otherFn, { data })` - synchronously call another Inngest
  function and await its result (composing flows, chaining pipelines).
- `step.sendEvent(name, payload)` - emit an event from inside a step (useful
  for fan-out from one flow to many).

All of these are durable - they survive function re-invocations and produce
one row each in the Inngest dashboard's step timeline. Use them liberally.

## Production deployment (Vercel + Inngest Cloud)

Not executed by the bootstrap plan - these are the steps to run once, when
promoting the first flow to production.

1. Create an account at <https://app.inngest.com>.
2. Create an app called `policydash`.
3. From the app's "Keys" page, copy `INNGEST_EVENT_KEY` and
   `INNGEST_SIGNING_KEY`.
4. Add both keys to Vercel → Project Settings → Environment Variables, scoped
   to **both Production and Preview**. Vercel preview deploys run with
   `NODE_ENV=production`, which means `serve()` operates in signed-request
   mode and will reject unsigned Inngest Cloud calls on preview URLs without
   `INNGEST_SIGNING_KEY`. Scoping the keys to Production alone is a common
   footgun - preview deploys then 401 every Inngest sync request.
5. In Inngest Cloud, register the deployed PolicyDash URL as the app endpoint
   (e.g., `https://policydash.example.com/api/inngest`). Inngest Cloud sends a
   sync request to that URL to discover functions.
6. Deploy. Confirm in the Inngest Cloud dashboard that `sample-hello` appears
   in the function list.
7. (Optional) Send a test `sample.hello` event from Inngest Cloud to verify
   the production path end-to-end.
