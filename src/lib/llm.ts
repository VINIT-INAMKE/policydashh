/**
 * Groq SDK wrapper - the ONLY sanctioned entry point for Groq API calls.
 *
 * LLM-01: `requireEnv('GROQ_API_KEY')` fail-fast at first use (lazy init).
 * LLM-02: `transcribeAudio` wraps `audio.transcriptions.create` with
 *         `whisper-large-v3-turbo` and `response_format: 'text'`.
 * LLM-03: `chatComplete` requires a `maxTokens` parameter (TypeScript
 *         compile error without it) and maps it to `max_completion_tokens`
 *         at the SDK boundary (groq-sdk v1.x parameter name).
 *
 * Lazy init: the Groq client is constructed on first use, not at import
 * time. This lets tests vi.mock('groq-sdk') before module load without
 * the key check firing.
 */

import Groq, { toFile } from 'groq-sdk'
import type { AnonymizedFeedback } from '@/src/server/services/consultation-summary.service'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set GROQ_API_KEY in .env.local. See .env.example.`,
    )
  }
  return value
}

let _client: Groq | null = null

/**
 * Instantiate a Groq client in a test-mock-tolerant way.
 *
 * In production, `Groq` is an ES6 class and must be called with `new`.
 * Under Vitest 4.1.1, however, `vi.mock('groq-sdk', () => ({ default: vi.fn().mockImplementation(() => ({...})) }))` cannot be `new`-called because the
 * arrow-function `mockImplementation` is not a [[Construct]] target - attempting
 * `new` throws `TypeError: (...) is not a constructor`. Calling the vi.fn as a
 * plain function, on the other hand, correctly returns the mockImplementation
 * result. We therefore try `new` first (production path) and fall back to a
 * plain call (test-mock path).
 */
function instantiateGroq(opts: { apiKey: string }): Groq {
  const GroqCtor = Groq as unknown as (new (o: { apiKey: string }) => Groq) &
    ((o: { apiKey: string }) => Groq)
  try {
    return new GroqCtor(opts)
  } catch (err) {
    if (err instanceof TypeError && /constructor/i.test(err.message)) {
      return GroqCtor(opts)
    }
    throw err
  }
}

function getClient(): Groq {
  // If the env var is unset at call time, clear any cached client so
  // requireEnv fires. This handles test sequences where an earlier test
  // cached a client with GROQ_API_KEY set, and a later test deletes the
  // env var and expects a throw (LLM-01).
  if (!process.env.GROQ_API_KEY) {
    _client = null
  }
  if (_client) return _client
  _client = instantiateGroq({ apiKey: requireEnv('GROQ_API_KEY') })
  return _client
}

// Testing helper: reset the client between tests that manipulate env vars.
// Not exported for production use - the `_` prefix marks it as internal.
export function _resetClientForTests(): void {
  _client = null
}

/**
 * Chat completion with enforced maxTokens (LLM-03).
 *
 * `maxTokens` is REQUIRED. TypeScript compile error without it - this is
 * the enforcement mechanism for "max_tokens enforced on every Groq chat
 * call" from the roadmap requirement.
 *
 * Parameter name mapping: groq-sdk v1.x uses `max_completion_tokens` (not
 * `max_tokens`). The wrapper accepts the friendly `maxTokens` name and
 * passes it through under the SDK's v1.x name at the boundary.
 */
export async function chatComplete(opts: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens: number
  temperature?: number
}): Promise<string> {
  const client = getClient()
  const completion = await client.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    max_completion_tokens: opts.maxTokens,
    temperature: opts.temperature ?? 0.3,
  })
  return completion.choices[0]?.message?.content ?? ''
}

/**
 * Transcribe an audio buffer via Groq Whisper (LLM-02).
 *
 * Uses `whisper-large-v3-turbo` - the fast model, ~216x real-time, good
 * enough for policy workshop recordings. With `response_format: 'text'`
 * the SDK returns a plain string even though the static type says
 * `Transcription`. Cast via `as unknown as string` - RESEARCH Pitfall 3.
 *
 * File size enforcement is upstream at the R2 presign route (25MB cap).
 * This function does not re-check size - callers must not invoke it with
 * larger buffers.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const client = getClient()
  const file = await toFile(audioBuffer, fileName, { type: 'audio/mpeg' })
  const result = await client.audio.transcriptions.create({
    model: 'whisper-large-v3-turbo',
    file,
    response_format: 'text',
  })
  return result as unknown as string
}

/**
 * Summarize a workshop transcript via llama-3.1-8b-instant (LLM-03).
 *
 * Returns structured JSON with three arrays:
 *   - discussionPoints: key topics discussed
 *   - decisions: resolutions reached
 *   - actionItems: follow-ups assigned
 *
 * On JSON parse failure (LLM returns prose wrapper), falls back to
 * {discussionPoints: [raw], decisions: [], actionItems: []} so downstream
 * code always sees the expected shape.
 */
export async function summarizeTranscript(transcript: string): Promise<{
  discussionPoints: string[]
  decisions: string[]
  actionItems: string[]
}> {
  const raw = await chatComplete({
    model: 'llama-3.1-8b-instant',
    maxTokens: 1024,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You are a policy workshop summarizer. Return JSON only, no prose wrapper. ' +
          'Schema: {"discussionPoints": string[], "decisions": string[], "actionItems": string[]}.',
      },
      {
        role: 'user',
        content:
          `Summarize this workshop transcript into JSON with keys: ` +
          `discussionPoints (array), decisions (array), actionItems (array).\n\n` +
          `Transcript:\n${transcript}`,
      },
    ],
  })

  try {
    const parsed = JSON.parse(raw)
    return {
      discussionPoints: Array.isArray(parsed.discussionPoints) ? parsed.discussionPoints : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    }
  } catch {
    return {
      discussionPoints: [raw],
      decisions: [],
      actionItems: [],
    }
  }
}

/**
 * Generate a per-section consultation summary via llama-3.3-70b-versatile (LLM-04).
 *
 * Called once per policy section during consultationSummaryGenerateFn.
 * Returns the plain-prose summary string (~500–700 words) grouped by
 * theme. Empty feedback input returns ''.
 *
 * Anonymization is enforced by the caller - this helper trusts its input
 * to already be `AnonymizedFeedback` (no submitter identity). The
 * stakeholder role (`orgType`) is the only attribution passed to the
 * LLM.
 *
 * Output contract: plain prose, no markdown, no bullet lists, no names.
 * The guardrail regex runs downstream of this function
 * (`buildGuardrailPatternSource` in consultation-summary.service.ts) to
 * catch any leak.
 */
export async function generateConsultationSummary(
  sectionTitle: string,
  anonymizedFeedback: AnonymizedFeedback[],
): Promise<string> {
  if (anonymizedFeedback.length === 0) {
    return ''
  }

  const feedbackBlock = anonymizedFeedback
    .map((f, i) => {
      const role = f.orgType ?? 'unspecified'
      return `[${i + 1}] Role: ${role} | Type: ${f.feedbackType}\n${f.body}`
    })
    .join('\n\n')

  return await chatComplete({
    model: 'llama-3.3-70b-versatile',
    maxTokens: 1024,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You are a policy analyst writing public consultation summaries for a government framework review process. ' +
          'Your task is to synthesize stakeholder feedback into a clear, balanced, 500-700 word narrative summary.\n\n' +
          'Rules:\n' +
          '- Group feedback by theme (not by stakeholder). Identify 3-5 themes per section.\n' +
          '- Use stakeholder roles (government stakeholder, industry stakeholder, civil society, etc.) for attribution - never use names.\n' +
          '- Maintain a neutral, policy-document tone. No opinionated language.\n' +
          '- Every claim in the summary must be traceable to at least one feedback item.\n' +
          '- Do NOT include: personal names, email addresses, organization names, or any identifying information.\n' +
          '- Output plain prose paragraphs only - no bullet lists, no headers, no markdown formatting.',
      },
      {
        role: 'user',
        content:
          `Section: ${sectionTitle}\n\n` +
          `Feedback items (${anonymizedFeedback.length} accepted responses):\n` +
          `${feedbackBlock}\n\n` +
          `Write a consultation summary for this section.`,
      },
    ],
  })
}
