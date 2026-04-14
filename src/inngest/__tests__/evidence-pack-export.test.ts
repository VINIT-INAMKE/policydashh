/**
 * RED Wave 0 contract for Phase 18 (async-evidence-pack-export).
 *
 * All assertions in this file MUST fail until Plan 18-01 ships the target
 * modules:
 *   - src/inngest/events.ts            (adds evidenceExportRequestedEvent + sendEvidenceExportRequested)
 *   - src/inngest/functions/evidence-pack-export.ts (creates evidencePackExportFn)
 *   - src/lib/email.ts                 (adds sendEvidencePackReadyEmail)
 *
 * Reference: .planning/phases/18-async-evidence-pack-export/18-RESEARCH.md
 *            § "Phase 16 Pattern Recap", "Streaming Architecture", "Fallback Strategy"
 *
 * Pattern source: src/inngest/__tests__/notification-dispatch.test.ts (Phase 16) and
 *                 src/inngest/__tests__/workshop-recording-processed.test.ts (Phase 17).
 *
 * Two TDD techniques are used here, both from the Phase 16/17 canonical playbook:
 *
 *   1. vi.hoisted() shared-mock fixtures so vi.mock factories (which Vitest
 *      hoists above the import block) can reach the same vi.fn instances the
 *      describe-blocks assert on.
 *
 *   2. Pattern 2 — variable-path dynamic import inside beforeAll. Vite's
 *      static import-analysis pass walks literal string arguments to import()
 *      and would fail on a missing module at parse time, preventing Vitest
 *      from registering the test file at all. Building the path at runtime
 *      via Array.join() hides it from the analyzer while still resolving
 *      through the normal loader once Plan 18-01 ships the file.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { unzipSync } from 'fflate'

const mocks = vi.hoisted(() => ({
  buildEvidencePack: vi.fn(),
  r2Send: vi.fn().mockResolvedValue({}),
  getDownloadUrl: vi
    .fn()
    .mockResolvedValue('https://r2.example.com/signed/evidence-packs/abc.zip?sig=xyz'),
  sendEvidencePackReadyEmail: vi.fn().mockResolvedValue(undefined),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  fetchMock: vi.fn(),
  dbSelect: vi.fn(),
  inngestSend: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/server/services/evidence-pack.service', () => ({
  buildEvidencePack: mocks.buildEvidencePack,
}))

vi.mock('@/src/lib/r2', () => ({
  r2Client: { send: mocks.r2Send },
  getDownloadUrl: mocks.getDownloadUrl,
  R2_PUBLIC_URL: 'https://r2.example.com',
  generateStorageKey: (folder: string, name: string) =>
    `${folder}/${Date.now()}-${name}`,
}))

vi.mock('@/src/lib/email', () => ({
  sendEvidencePackReadyEmail: mocks.sendEvidencePackReadyEmail,
}))

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: mocks.writeAuditLog,
  ACTIONS: { EVIDENCE_PACK_EXPORT: 'evidence_pack.export' },
}))

vi.mock('@/src/lib/constants', () => ({
  ACTIONS: { EVIDENCE_PACK_EXPORT: 'evidence_pack.export' },
}))

vi.mock('@/src/db', () => ({
  db: {
    select: mocks.dbSelect,
    query: {
      policyDocuments: {
        findFirst: vi.fn().mockResolvedValue({ id: 'doc-1', title: 'Test Policy' }),
      },
    },
  },
}))

vi.mock('@/src/inngest/client', () => ({
  inngest: {
    send: mocks.inngestSend,
    createFunction: (opts: { id: string }, handler: unknown) => ({
      id: () => opts.id,
      opts,
      handler,
    }),
  },
}))

vi.stubGlobal('fetch', mocks.fetchMock)

// -- dynamic-import bindings (Pattern 2) ----------------------------------

let eventsModule: any
let fnModule: any

type StepRunFn = (stepId: string, fn: () => Promise<unknown>) => Promise<unknown>

function makeStep() {
  const callLog: Array<{ id: string; result?: unknown; error?: unknown }> = []
  const run: StepRunFn = vi.fn(async (stepId, fn) => {
    try {
      const result = await fn()
      callLog.push({ id: stepId, result })
      return result
    } catch (err) {
      callLog.push({ id: stepId, error: err })
      throw err
    }
  })
  return { step: { run }, callLog }
}

function getHandler(fn: unknown): (ctx: { event: unknown; step: unknown }) => Promise<any> {
  if (fn == null) {
    throw new Error(
      'evidencePackExportFn is not yet implemented — Wave 0 RED. ' +
        'Plan 18-01 must create src/inngest/functions/evidence-pack-export.ts',
    )
  }
  if (typeof fn === 'function') {
    return fn as (ctx: { event: unknown; step: unknown }) => Promise<any>
  }
  const anyFn = fn as Record<string, unknown>
  for (const key of ['handler', 'fn', '_fn', 'runFn']) {
    const candidate = anyFn[key]
    if (typeof candidate === 'function') {
      return candidate as (ctx: { event: unknown; step: unknown }) => Promise<any>
    }
  }
  throw new Error(
    `Could not locate handler on evidencePackExportFn. Keys: ${Object.keys(anyFn).join(', ')}`,
  )
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    name: 'evidence.export_requested',
    data: {
      documentId: '00000000-0000-0000-0000-000000000002',
      requestedBy: '00000000-0000-0000-0000-000000000001',
      userEmail: 'u@example.com',
      ...overrides,
    },
  }
}

beforeAll(async () => {
  // Pattern 2: variable-path dynamic import bypasses Vite static import
  // analysis so this file compiles before the target modules exist on disk.
  const eventsPath = ['@', 'src', 'inngest', 'events'].join('/')
  const fnPath = ['@', 'src', 'inngest', 'functions', 'evidence-pack-export'].join('/')
  try {
    eventsModule = await import(/* @vite-ignore */ eventsPath)
  } catch (err) {
    eventsModule = undefined
    // eslint-disable-next-line no-console
    console.warn('[evidence-pack-export.test] events module load failed:', (err as Error).message)
  }
  try {
    fnModule = await import(/* @vite-ignore */ fnPath)
  } catch (err) {
    fnModule = undefined
    // eslint-disable-next-line no-console
    console.warn('[evidence-pack-export.test] fn module load failed:', (err as Error).message)
  }
})

beforeEach(() => {
  mocks.buildEvidencePack.mockReset()
  mocks.r2Send.mockClear()
  mocks.r2Send.mockResolvedValue({})
  mocks.getDownloadUrl.mockClear()
  mocks.getDownloadUrl.mockResolvedValue(
    'https://r2.example.com/signed/evidence-packs/abc.zip?sig=xyz',
  )
  mocks.sendEvidencePackReadyEmail.mockClear()
  mocks.writeAuditLog.mockClear()
  mocks.fetchMock.mockReset()
  mocks.dbSelect.mockReset()
  mocks.inngestSend.mockClear()

  // Default: buildEvidencePack returns a couple of small files.
  mocks.buildEvidencePack.mockResolvedValue({
    'INDEX.md': new TextEncoder().encode('# Test Policy\n'),
    'stakeholders.csv': new TextEncoder().encode('name,role\n'),
  })

  // Default: dbSelect chain returns one file artifact + one link artifact.
  mocks.dbSelect.mockImplementation(() => ({
    from: () => ({
      innerJoin: () => ({
        where: () =>
          Promise.resolve([
            {
              id: 'art-1',
              type: 'file',
              title: 'Recording',
              url: 'https://r2.example.com/evidence/rec.mp3',
            },
            {
              id: 'art-2',
              type: 'link',
              title: 'External',
              url: 'https://example.com/ext',
            },
          ]),
      }),
    }),
  }))

  // Default: fetch returns a tiny binary buffer.
  mocks.fetchMock.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
  })
})

describe('evidenceExportRequestedEvent (schema + sender)', () => {
  it('rejects payloads missing documentId via .validate()', async () => {
    expect(eventsModule?.evidenceExportRequestedEvent).toBeDefined()
    const bad = eventsModule.evidenceExportRequestedEvent.create({
      requestedBy: '00000000-0000-0000-0000-000000000001',
      userEmail: null,
    } as any)
    await expect(bad.validate()).rejects.toThrow()
  })

  it('accepts a valid payload with userEmail string-or-null', async () => {
    expect(eventsModule?.evidenceExportRequestedEvent).toBeDefined()
    const ok = eventsModule.evidenceExportRequestedEvent.create({
      documentId: '00000000-0000-0000-0000-000000000002',
      requestedBy: '00000000-0000-0000-0000-000000000001',
      userEmail: null,
    })
    // Inngest v4 `.validate()` returns Promise<void>; "accepts" means it
    // resolves without throwing. (Wave 0 draft wrote .toBeDefined which
    // misread the Inngest API — Plan 18-01 Rule 3 blocker fix.)
    await expect(ok.validate()).resolves.toBeUndefined()
  })

  it('sendEvidenceExportRequested calls inngest.send exactly once after .validate() passes', async () => {
    expect(eventsModule?.sendEvidenceExportRequested).toBeDefined()
    await eventsModule.sendEvidenceExportRequested({
      documentId: '00000000-0000-0000-0000-000000000002',
      requestedBy: '00000000-0000-0000-0000-000000000001',
      userEmail: 'u@example.com',
    })
    expect(mocks.inngestSend).toHaveBeenCalledTimes(1)
  })
})

describe('evidencePackExportFn — pipeline contract (EV-05 + EV-06)', () => {
  it('runs the 6 steps in order: build-metadata → list-binary-artifacts → assemble-and-upload → generate-presigned-url → send-email → write-audit-log', async () => {
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step, callLog } = makeStep()
    await handler({ event: makeEvent(), step })
    const order = callLog.map((c) => c.id)
    expect(order).toEqual([
      'build-metadata',
      'list-binary-artifacts',
      'assemble-and-upload',
      'generate-presigned-url',
      'send-email',
      'write-audit-log',
    ])
  })

  it('build-metadata step invokes buildEvidencePack(documentId)', async () => {
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step } = makeStep()
    await handler({ event: makeEvent(), step })
    expect(mocks.buildEvidencePack).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000002',
    )
  })

  it('list-binary-artifacts step filters to type=file and writes UNAVAILABLE.txt for type=link', async () => {
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step } = makeStep()
    await handler({ event: makeEvent(), step })

    // Find the PutObjectCommand call to R2 and inspect its zipped Body.
    const putCall = mocks.r2Send.mock.calls.find(
      ([cmd]) => cmd?.constructor?.name === 'PutObjectCommand' || cmd?.input?.Key,
    )
    expect(putCall).toBeDefined()
    const input = (putCall as any)[0].input
    expect(input).toBeDefined()
    const body: Uint8Array = input.Body instanceof Buffer ? input.Body : new Uint8Array(input.Body)
    const entries = unzipSync(body)
    const entryNames = Object.keys(entries)
    // file-type artifact was fetched and added under binaries/
    expect(entryNames.some((n) => n.includes('art-1') && !n.includes('UNAVAILABLE'))).toBe(true)
    // link-type artifact got UNAVAILABLE.txt placeholder
    expect(entryNames.some((n) => n.includes('art-2') && n.includes('UNAVAILABLE'))).toBe(true)
  })

  it('degraded fallback: when fetch throws for a binary, places UNAVAILABLE.txt and returns degraded:true', async () => {
    mocks.fetchMock.mockRejectedValueOnce(new Error('timeout'))
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step } = makeStep()
    const result = await handler({ event: makeEvent(), step })
    expect(result?.degraded).toBe(true)

    const putCall = mocks.r2Send.mock.calls.find(
      ([cmd]) => cmd?.constructor?.name === 'PutObjectCommand' || cmd?.input?.Key,
    )
    expect(putCall).toBeDefined()
    const input = (putCall as any)[0].input
    const body: Uint8Array = input.Body instanceof Buffer ? input.Body : new Uint8Array(input.Body)
    const entries = unzipSync(body)
    const entryNames = Object.keys(entries)
    expect(entryNames.some((n) => n.includes('art-1') && n.includes('UNAVAILABLE'))).toBe(true)
  })

  it('assemble-and-upload step calls r2Client.send with PutObjectCommand whose Key matches evidence-packs/<docId>-<ts>.zip and ContentType application/zip', async () => {
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step } = makeStep()
    await handler({ event: makeEvent(), step })
    const putCall = mocks.r2Send.mock.calls.find(
      ([cmd]) => cmd?.constructor?.name === 'PutObjectCommand' || cmd?.input?.Key,
    )
    expect(putCall).toBeDefined()
    const input = (putCall as any)[0].input
    expect(input.Key).toMatch(/^evidence-packs\/[^/]+-\d+\.zip$/)
    expect(input.ContentType).toBe('application/zip')
  })

  it('generate-presigned-url step calls getDownloadUrl(r2Key, 86400) exactly', async () => {
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step } = makeStep()
    await handler({ event: makeEvent(), step })
    expect(mocks.getDownloadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^evidence-packs\//),
      86400,
    )
  })

  it('send-email step calls sendEvidencePackReadyEmail with documentTitle, downloadUrl, fileCount, totalSizeBytes, expiresAt, degraded', async () => {
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step } = makeStep()
    await handler({ event: makeEvent(), step })
    expect(mocks.sendEvidencePackReadyEmail).toHaveBeenCalledWith(
      'u@example.com',
      expect.objectContaining({
        documentTitle: 'Test Policy',
        downloadUrl: expect.any(String),
        fileCount: expect.any(Number),
        totalSizeBytes: expect.any(Number),
        expiresAt: expect.any(String),
      }),
    )
  })

  it('write-audit-log step calls writeAuditLog with action evidence_pack.export, entityType=document, payload.async=true', async () => {
    const handler = getHandler(fnModule?.evidencePackExportFn)
    const { step } = makeStep()
    await handler({ event: makeEvent(), step })
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'evidence_pack.export',
        entityType: 'document',
        entityId: '00000000-0000-0000-0000-000000000002',
        payload: expect.objectContaining({ async: true }),
      }),
    )
  })

  it('exports evidencePackExportFn with id "evidence-pack-export"', async () => {
    expect(fnModule?.evidencePackExportFn).toBeDefined()
    const fn = fnModule.evidencePackExportFn as any
    // Inngest v4 exposes id as a callable function on the createFunction result.
    const id = typeof fn.id === 'function' ? fn.id() : fn.id ?? fn.opts?.id
    expect(id).toBe('evidence-pack-export')
  })
})
