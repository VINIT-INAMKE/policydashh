import { NonRetriableError } from 'inngest'
import { and, eq } from 'drizzle-orm'
import { inngest } from '../client'
import { workshopRecordingUploadedEvent } from '../events'
import { db } from '@/src/db'
import {
  workshopArtifacts,
  workshopEvidenceChecklist,
} from '@/src/db/schema/workshops'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { getDownloadUrl } from '@/src/lib/r2'
import { transcribeAudio, summarizeTranscript } from '@/src/lib/llm'

/**
 * workshop-recording-processed — Groq-backed transcription + summarization.
 *
 * Triggered by `workshop.recording_uploaded` events fired from the
 * `workshop.attachArtifact` mutation (Plan 17-04) when a moderator uploads
 * a recording. Runs four steps:
 *
 *   1. fetch-recording: presigned GET on the R2 key -> ArrayBuffer -> base64
 *   2. transcribe: Groq Whisper (whisper-large-v3-turbo) via llm.ts
 *   3. summarize: Groq llama-3.1-8b-instant via llm.ts
 *   4. store-artifacts: 2 draft workshop_artifacts rows + fill checklist slot
 *
 *   - WS-14: Transcription + summary appear as draft artifacts; moderator
 *     approves via workshop.approveArtifact before broader visibility.
 *   - LLM-02: whisper-large-v3-turbo at the llm.ts wrapper layer.
 *   - LLM-03: llama-3.1-8b-instant with enforced max_completion_tokens.
 *
 * Pitfall 2 (Buffer serialization): `step.run` JSON-serializes return
 * values. Buffer <-> base64 at the step boundary so each step result stays
 * JSON-safe and Inngest memoization works across retries.
 *
 * Pitfall 8 (Groq rate limits): `concurrency.limit = 2` caps parallel
 * Groq calls regardless of how many workshops are completed at once.
 * Transient 429s bubble as plain Error so Inngest retries exponentially.
 */

export const workshopRecordingProcessedFn = inngest.createFunction(
  {
    id: 'workshop-recording-processed',
    name: 'Workshop recording — transcribe + summarize via Groq',
    retries: 2, // fewer retries than default: Groq calls are expensive
    concurrency: { key: 'groq-transcription', limit: 2 },
    // Inlined per src/inngest/README.md §90-94 (type widening footgun).
    triggers: [{ event: workshopRecordingUploadedEvent }],
  },
  async ({ event, step }) => {
    const { workshopId, workshopArtifactId, r2Key, moderatorId } = event.data

    // Step 1: fetch the recording binary from R2 and serialize to base64
    // for JSON-safe hand-off to the next step.
    const audioBase64 = await step.run('fetch-recording', async () => {
      const url = await getDownloadUrl(r2Key, 300) // 5-min presigned GET
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`R2 fetch failed: ${res.status} ${res.statusText}`)
      }
      const ab = await res.arrayBuffer()
      return Buffer.from(ab).toString('base64')
    })

    // Step 2: transcribe via Groq Whisper.
    const transcript = await step.run('transcribe', async () => {
      const buf = Buffer.from(audioBase64, 'base64')
      return await transcribeAudio(buf, 'recording.mp3')
    })

    if (!transcript || transcript.length === 0) {
      throw new NonRetriableError('Transcription returned empty text')
    }

    // Step 3: summarize via Groq llama.
    const summary = await step.run('summarize', async () => {
      return await summarizeTranscript(transcript)
    })

    // Step 4: persist as draft workshop artifacts + fill the checklist slot.
    await step.run('store-artifacts', async () => {
      // Insert transcript as an evidence artifact with content populated.
      const [transcriptEv] = await db
        .insert(evidenceArtifacts)
        .values({
          title:      'Workshop transcript (draft)',
          type:       'file',
          url:        '', // text content lives in `content`, not url
          content:    transcript,
          uploaderId: moderatorId,
        })
        .returning({ id: evidenceArtifacts.id })

      // Insert summary as an evidence artifact — structured JSON in content.
      const [summaryEv] = await db
        .insert(evidenceArtifacts)
        .values({
          title:      'Workshop summary (draft)',
          type:       'file',
          url:        '',
          content:    JSON.stringify(summary, null, 2),
          uploaderId: moderatorId,
        })
        .returning({ id: evidenceArtifacts.id })

      // Link transcript to workshop as a draft workshop_artifact.
      await db.insert(workshopArtifacts).values({
        workshopId,
        artifactId:   transcriptEv.id,
        artifactType: 'summary', // transcript stored under 'summary' family
        reviewStatus: 'draft',
      })

      // Link summary to workshop as a draft workshop_artifact.
      await db.insert(workshopArtifacts).values({
        workshopId,
        artifactId:   summaryEv.id,
        artifactType: 'summary',
        reviewStatus: 'draft',
      })

      // Flip the 'recording' checklist slot to 'filled' (Pitfall 7).
      // If the checklist row does not exist yet (workshop wasn't marked
      // completed before recording upload), this update is a no-op — that
      // is acceptable; the checklist row will be created when completion
      // fires and a future fill-recording-slot scan can reconcile.
      await db
        .update(workshopEvidenceChecklist)
        .set({
          status:     'filled',
          artifactId: transcriptEv.id,
          filledAt:   new Date(),
        })
        .where(
          and(
            eq(workshopEvidenceChecklist.workshopId, workshopId),
            eq(workshopEvidenceChecklist.slot, 'recording'),
          ),
        )

      return {
        transcriptArtifactId: transcriptEv.id,
        summaryArtifactId:    summaryEv.id,
      }
    })

    return {
      workshopId,
      workshopArtifactId,
      transcriptLength: transcript.length,
    }
  },
)
