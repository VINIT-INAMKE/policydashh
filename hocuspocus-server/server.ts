import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { neon } from '@neondatabase/serverless'
import { verifyToken } from '@clerk/backend'
import * as Y from 'yjs'

const sql = neon(process.env.DATABASE_URL!)

const server = new Server({
  port: Number(process.env.PORT) || 1234,

  async onAuthenticate({ token, documentName }: { token: string; documentName: string }) {
    // Validate Clerk session JWT
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })
    if (!payload) throw new Error('Unauthorized')

    const clerkUserId = payload.sub

    // SECURITY: Verify user exists and check document-level authorization
    // Look up internal user by Clerk ID
    const userRows = await sql`
      SELECT id, role FROM users WHERE clerk_id = ${clerkUserId}
    `
    if (userRows.length === 0) throw new Error('User not found')
    const user = userRows[0] as { id: string; role: string }

    // Admin and policy_lead have access to all sections
    if (user.role !== 'admin' && user.role !== 'policy_lead') {
      // Extract sectionId from documentName (format: "section-{uuid}")
      const sectionId = documentName.replace('section-', '')

      // Check if user is assigned to this section
      const assignmentRows = await sql`
        SELECT id FROM section_assignments
        WHERE user_id = ${user.id} AND section_id = ${sectionId}
        LIMIT 1
      `
      if (assignmentRows.length === 0) {
        throw new Error('Not authorized to access this section')
      }
    }

    return { userId: clerkUserId, internalUserId: user.id, role: user.role }
  },

  async onLoadDocument({ documentName, document }: { documentName: string; document: any }) {
    // documentName = "section-{uuid}"
    const sectionId = documentName.replace('section-', '')

    // Check if Y.Doc is empty (no Hocuspocus state loaded yet)
    if (document.store.clients.size === 0) {
      const rows = await sql`
        SELECT content FROM policy_sections WHERE id = ${sectionId}
      `
      const existingJson = rows[0]?.content as Record<string, unknown> | undefined
      if (existingJson && existingJson.type === 'doc') {
        // Bootstrap Y.Doc from existing Tiptap JSON (one-time migration)
        const ydoc = TiptapTransformer.toYdoc(existingJson, 'default')
        const update = Y.encodeStateAsUpdate(ydoc)
        Y.applyUpdate(document, update)
      }
    }

    return document
  },

  extensions: [
    new Database({
      async fetch({ documentName }) {
        // documentName = "section-{uuid}"
        const sectionId = documentName.replace('section-', '')
        const rows = await sql`
          SELECT ydoc_binary FROM ydoc_snapshots WHERE section_id = ${sectionId}
        `
        return rows[0]?.ydoc_binary ?? null // returns Uint8Array or null
      },

      async store({ documentName, state, document }) {
        // state is Uint8Array -- primary Yjs binary
        const sectionId = documentName.replace('section-', '')

        // Extract Tiptap JSON for existing content column (secondary, keeps versioning working)
        const json = TiptapTransformer.fromYdoc(document)

        // Upsert binary Y.Doc state
        await sql`
          INSERT INTO ydoc_snapshots (section_id, ydoc_binary, updated_at)
          VALUES (${sectionId}, ${state as unknown as string}, NOW())
          ON CONFLICT (section_id) DO UPDATE
            SET ydoc_binary = EXCLUDED.ydoc_binary,
                updated_at = EXCLUDED.updated_at
        `

        // Keep policySections.content in sync for read-only views / versioning
        await sql`
          UPDATE policy_sections
          SET content = ${JSON.stringify(json)}, updated_at = NOW()
          WHERE id = ${sectionId}
        `
      },
    }),
  ],
})

server.listen().then(() => {
  console.log(`Hocuspocus server listening on port ${Number(process.env.PORT) || 1234}`)
})
