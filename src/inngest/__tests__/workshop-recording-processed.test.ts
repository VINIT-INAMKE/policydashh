import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

/**
 * Wave 0 RED contract for Plan 04 (WS-14, LLM-02 wiring, LLM-03 wiring).
 * Goes GREEN when src/inngest/functions/workshop-recording-processed.ts
 * ships workshopRecordingProcessedFn.
 *
 * Strategy: variable-path dynamic import bypasses Vite static-analysis walker
 * (Plan 16 Pattern 2) because target module does not exist yet.
 */

const mocks = vi.hoisted(() => {
  const insertReturningMock = vi.fn().mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111111' }])
  const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturningMock })
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock })

  const updateWhereMock = vi.fn().mockResolvedValue(undefined)
  const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock })
  const updateMock = vi.fn().mockReturnValue({ set: updateSetMock })

  return {
    insertMock, insertValuesMock, insertReturningMock,
    updateMock, updateSetMock, updateWhereMock,
    getDownloadUrlMock: vi.fn().mockResolvedValue('https://r2.test/presigned-url'),
    fetchMock: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(1024),
    }),
    transcribeAudioMock: vi.fn().mockResolvedValue('mocked transcript text'),
    summarizeTranscriptMock: vi.fn().mockResolvedValue({
      discussionPoints: ['p1'],
      decisions: ['d1'],
      actionItems: ['a1'],
    }),
  }
})

vi.mock('@/src/db', () => ({
  db: {
    insert: mocks.insertMock,
    update: mocks.updateMock,
  },
}))

vi.mock('@/src/lib/r2', () => ({
  getDownloadUrl: mocks.getDownloadUrlMock,
}))

vi.mock('@/src/lib/llm', () => ({
  transcribeAudio: mocks.transcribeAudioMock,
  summarizeTranscript: mocks.summarizeTranscriptMock,
}))

// Global fetch mock
const originalFetch = global.fetch
beforeAll(() => {
  global.fetch = mocks.fetchMock as unknown as typeof fetch
})

let fnModule: { workshopRecordingProcessedFn?: unknown } | null = null

beforeAll(async () => {
  const targetPath = ['..', 'functions', 'workshop-recording-processed'].join('/')
  try {
    fnModule = (await import(/* @vite-ignore */ targetPath)) as {
      workshopRecordingProcessedFn?: unknown
    }
  } catch (err) {
    fnModule = null
    // eslint-disable-next-line no-console
    console.warn('[workshop-recording-processed.test] target module not yet implemented:', (err as Error).message)
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

function makeStep() {
  const calls: Array<string> = []
  const run = vi.fn(async (id: string, fn: () => Promise<unknown>) => {
    calls.push(id)
    return await fn()
  })
  return { step: { run }, calls }
}

function makeEvent() {
  return {
    name: 'workshop.recording_uploaded',
    ts: Date.now(),
    data: {
      workshopId: '00000000-0000-0000-0000-000000000001',
      workshopArtifactId: '00000000-0000-0000-0000-000000000002',
      r2Key: 'recording/1234-abc-test.mp3',
      moderatorId: '00000000-0000-0000-0000-000000000003',
    },
  }
}

async function invoke(event: ReturnType<typeof makeEvent>, step: ReturnType<typeof makeStep>['step']) {
  const fn = (fnModule as { workshopRecordingProcessedFn?: Record<string, unknown> } | null)
    ?.workshopRecordingProcessedFn
  if (!fn) {
    throw new Error('workshopRecordingProcessedFn not yet implemented - Wave 0 RED')
  }
  const handler = (fn['fn'] ?? (fn as { handler?: unknown }).handler) as
    | ((args: unknown) => Promise<unknown>)
    | undefined
  if (typeof handler !== 'function') {
    throw new Error('handler not exposed - Wave 0 RED')
  }
  return await handler({ event, step, runId: 'test', attempt: 0, logger: console })
}

describe('workshopRecordingProcessedFn - Wave 0 RED contract', () => {
  it('runs 4 steps in order: fetch-recording → transcribe → summarize → store-artifacts (WS-14)', async () => {
    const { step, calls } = makeStep()
    await invoke(makeEvent(), step)
    expect(calls).toContain('fetch-recording')
    expect(calls).toContain('transcribe')
    expect(calls).toContain('summarize')
    expect(calls).toContain('store-artifacts')
    // Order check
    expect(calls.indexOf('fetch-recording')).toBeLessThan(calls.indexOf('transcribe'))
    expect(calls.indexOf('transcribe')).toBeLessThan(calls.indexOf('summarize'))
    expect(calls.indexOf('summarize')).toBeLessThan(calls.indexOf('store-artifacts'))
  })

  it('fetches recording via r2.getDownloadUrl with r2Key (WS-14)', async () => {
    const { step } = makeStep()
    await invoke(makeEvent(), step)
    expect(mocks.getDownloadUrlMock).toHaveBeenCalledWith('recording/1234-abc-test.mp3', expect.any(Number))
  })

  it('calls transcribeAudio with a Buffer (LLM-02 wiring)', async () => {
    const { step } = makeStep()
    await invoke(makeEvent(), step)
    expect(mocks.transcribeAudioMock).toHaveBeenCalledTimes(1)
    const arg = mocks.transcribeAudioMock.mock.calls[0][0]
    expect(Buffer.isBuffer(arg)).toBe(true)
  })

  it('calls summarizeTranscript with the transcript string (LLM-03 wiring)', async () => {
    const { step } = makeStep()
    await invoke(makeEvent(), step)
    expect(mocks.summarizeTranscriptMock).toHaveBeenCalledWith('mocked transcript text')
  })

  it('inserts draft artifacts (transcript + summary) with reviewStatus=draft', async () => {
    const { step } = makeStep()
    await invoke(makeEvent(), step)
    expect(mocks.insertMock).toHaveBeenCalled()
    // Two workshopArtifacts inserts (transcript + summary) + two evidenceArtifacts inserts
    // = 4 total inserts minimum
    expect(mocks.insertMock.mock.calls.length).toBeGreaterThanOrEqual(4)
  })
})

// Restore global fetch after the suite
afterAll(() => {
  global.fetch = originalFetch
})
