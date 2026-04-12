import { Inngest } from 'inngest'

/**
 * The singleton Inngest client for PolicyDash.
 *
 * This file intentionally does NOT declare events. In Inngest v4 each event
 * is an exported EventType instance (see `./events.ts`) that carries its own
 * schema and acts as both the trigger for createFunction and the factory for
 * sending. One source of truth per event, no centralized union type.
 */
export const inngest = new Inngest({
  id: 'policydash',
})
