import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

/**
 * Wave 0 RED contract for Plan 02 Task 02-01 (LLM-01, LLM-02, LLM-03).
 * Goes GREEN when src/lib/llm.ts ships chatComplete + transcribeAudio + summarizeTranscript.
 * Strategy: dynamic import in beforeAll (Plan 16 pattern) because target module does not exist yet.
 */

const mocks = vi.hoisted(() => ({
  transcriptionsMock: vi.fn().mockResolvedValue('mocked transcript text'),
  chatCompletionsMock: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{"discussionPoints":["point1"],"decisions":["d1"],"actionItems":["a1"]}' } }],
  }),
  toFileMock: vi.fn().mockResolvedValue({ _mockFile: true }),
  groqConstructorMock: vi.fn(),
}))

vi.mock('groq-sdk', () => {
  mocks.groqConstructorMock.mockImplementation(() => ({
    audio: { transcriptions: { create: mocks.transcriptionsMock } },
    chat: { completions: { create: mocks.chatCompletionsMock } },
  }))
  return {
    default: mocks.groqConstructorMock,
    toFile: mocks.toFileMock,
  }
})

// Use variable-path dynamic import to bypass Vite's static import-analysis
// walker (Plan 16 Pattern 2). Required because src/lib/llm.ts does not yet
// exist on disk during Wave 0 RED.
let llmModule: {
  chatComplete: (opts: {
    model: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    maxTokens: number
    temperature?: number
  }) => Promise<string>
  transcribeAudio: (audioBuffer: Buffer, fileName: string) => Promise<string>
  summarizeTranscript: (transcript: string) => Promise<{
    discussionPoints: string[]
    decisions: string[]
    actionItems: string[]
  }>
} | null

beforeAll(async () => {
  const targetPath = ['.', 'llm'].join('/')
  try {
    llmModule = (await import(/* @vite-ignore */ targetPath)) as typeof llmModule
  } catch (err) {
    llmModule = null
    // eslint-disable-next-line no-console
    console.warn('[llm.test] target module not yet implemented:', (err as Error).message)
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GROQ_API_KEY = 'test-key'
})

describe('llm.ts — Wave 0 RED contract', () => {
  it('chatComplete throws when GROQ_API_KEY unset (LLM-01)', async () => {
    if (!llmModule) throw new Error('llm.ts not yet implemented — Wave 0 RED')
    delete process.env.GROQ_API_KEY
    // New Groq() instance should fail inside chatComplete lazy init
    await expect(
      llmModule.chatComplete({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 128,
      }),
    ).rejects.toThrow(/GROQ_API_KEY/)
  })

  it('chatComplete passes max_completion_tokens to Groq SDK (LLM-03)', async () => {
    if (!llmModule) throw new Error('llm.ts not yet implemented — Wave 0 RED')
    await llmModule.chatComplete({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 512,
    })
    expect(mocks.chatCompletionsMock).toHaveBeenCalledTimes(1)
    const arg = mocks.chatCompletionsMock.mock.calls[0][0]
    expect(arg.model).toBe('llama-3.1-8b-instant')
    expect(arg.max_completion_tokens).toBe(512)
    // max_tokens (old name) must NOT be passed
    expect(arg.max_tokens).toBeUndefined()
  })

  it('transcribeAudio calls audio.transcriptions.create with whisper-large-v3-turbo (LLM-02)', async () => {
    if (!llmModule) throw new Error('llm.ts not yet implemented — Wave 0 RED')
    const buf = Buffer.from('fake-audio-bytes')
    const result = await llmModule.transcribeAudio(buf, 'recording.mp3')
    expect(mocks.toFileMock).toHaveBeenCalledTimes(1)
    expect(mocks.transcriptionsMock).toHaveBeenCalledTimes(1)
    const arg = mocks.transcriptionsMock.mock.calls[0][0]
    expect(arg.model).toBe('whisper-large-v3-turbo')
    expect(arg.response_format).toBe('text')
    expect(result).toBe('mocked transcript text')
  })

  it('summarizeTranscript returns structured JSON object (LLM-03)', async () => {
    if (!llmModule) throw new Error('llm.ts not yet implemented — Wave 0 RED')
    const result = await llmModule.summarizeTranscript('some transcript text')
    expect(result).toEqual({
      discussionPoints: ['point1'],
      decisions: ['d1'],
      actionItems: ['a1'],
    })
    // Must use llama-3.1-8b-instant
    const chatArg = mocks.chatCompletionsMock.mock.calls[0][0]
    expect(chatArg.model).toBe('llama-3.1-8b-instant')
  })
})
