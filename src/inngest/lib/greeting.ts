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
