# Google Calendar OAuth setup

One-time setup to connect a personal Google account so the platform can
create workshop calendar events and invite attendees.

## Steps

1. Go to https://console.cloud.google.com/ → select or create a project
2. APIs & Services → Library → search "Google Calendar API" → Enable
3. APIs & Services → OAuth consent screen
   - User type: **Internal** (if your konma.io domain is a Workspace)
     OR **External** + add your account as a Test User
   - Scopes: add `.../auth/calendar.events`
4. APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/google-oauth-callback`
   - Copy the Client ID + Client Secret
5. Run the bootstrap script (it will open a consent URL and capture the code):

   ```bash
   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
     node scripts/google-oauth-bootstrap.mjs
   ```

6. Drop the printed env-var block into `.env.local`. Restart the dev server.

## Token refresh

Refresh tokens don't expire unless explicitly revoked. If `vinit@konma.io`
revokes the app at https://myaccount.google.com/permissions, every Calendar
API call returns 401 — re-run the bootstrap script and replace the
`GOOGLE_OAUTH_REFRESH_TOKEN` env var.
