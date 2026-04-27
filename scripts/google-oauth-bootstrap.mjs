#!/usr/bin/env node
/**
 * One-time helper: prints consent URL, captures auth code from local
 * redirect, exchanges for a refresh token, prints .env.local snippet.
 *
 * Usage: node scripts/google-oauth-bootstrap.mjs
 * Requires GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in env or argv.
 */
import http from 'node:http'
import { URL } from 'node:url'
import { createInterface } from 'node:readline'

const REDIRECT_PORT = 3000
const REDIRECT_PATH = '/api/google-oauth-callback'
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`
const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || (await ask('Client ID: '))
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || (await ask('Client Secret: '))
const organizerEmail =
  process.env.WORKSHOP_ORGANIZER_EMAIL || (await ask('Organizer email (the Google account being authorized): '))

const consentUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
consentUrl.searchParams.set('client_id', clientId)
consentUrl.searchParams.set('redirect_uri', REDIRECT_URI)
consentUrl.searchParams.set('response_type', 'code')
consentUrl.searchParams.set('scope', SCOPES.join(' '))
consentUrl.searchParams.set('access_type', 'offline')
consentUrl.searchParams.set('prompt', 'consent')

console.log('\n1. Open this URL in your browser:\n')
console.log(consentUrl.toString())
console.log(`\n2. After consent, Google will redirect to ${REDIRECT_URI} with ?code=...\n`)
console.log(`3. This script is listening on port ${REDIRECT_PORT}.\n`)

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    if (!req.url?.startsWith(REDIRECT_PATH)) {
      res.writeHead(404).end()
      return
    }
    const u = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
    const c = u.searchParams.get('code')
    const err = u.searchParams.get('error')
    if (err) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end(`OAuth error: ${err}`)
      server.close()
      reject(new Error(err))
      return
    }
    res.writeHead(200, { 'content-type': 'text/plain' }).end('OK — you can close this tab.')
    server.close()
    resolve(c)
  })
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      reject(new Error(`Port ${REDIRECT_PORT} is already in use. Stop the dev server and re-run.`))
    } else {
      reject(e)
    }
  })
  server.listen(REDIRECT_PORT)
})

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }),
})

if (!tokenRes.ok) {
  console.error('Token exchange failed:', await tokenRes.text())
  process.exit(1)
}

const json = await tokenRes.json()
if (!json.refresh_token) {
  console.error(
    'No refresh_token in response. Revoke the app at https://myaccount.google.com/permissions and re-run.',
  )
  process.exit(1)
}
console.log('\n✔ Refresh token obtained. Drop this into .env.local:\n')
console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`)
console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`)
console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${json.refresh_token}`)
console.log(`WORKSHOP_ORGANIZER_EMAIL=${organizerEmail}`)
console.log(`GOOGLE_CALENDAR_ID=primary`)

rl.close()
