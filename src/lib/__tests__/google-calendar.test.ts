import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('google-calendar — auth', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'test_client_id')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'test_client_secret')
    vi.stubEnv('GOOGLE_OAUTH_REFRESH_TOKEN', 'test_refresh_token')
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('exchanges refresh token for access token via oauth2 endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'fresh_token', expires_in: 3600 }),
    })
    const { _internal_getAccessToken, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    const token = await _internal_getAccessToken()
    expect(token).toBe('fresh_token')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('test_refresh_token')
    expect(body.get('client_id')).toBe('test_client_id')
    expect(body.get('client_secret')).toBe('test_client_secret')
  })

  it('caches access token in-memory and reuses on subsequent calls', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'cached', expires_in: 3600 }),
    })
    const { _internal_getAccessToken, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await _internal_getAccessToken()
    await _internal_getAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws GoogleCalendarError on token exchange failure', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid_grant',
    })
    const { _internal_getAccessToken, _internal_resetTokenCache, GoogleCalendarError } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(_internal_getAccessToken()).rejects.toBeInstanceOf(GoogleCalendarError)
  })

  it('throws GoogleCalendarError when env vars are missing', async () => {
    vi.stubEnv('GOOGLE_OAUTH_REFRESH_TOKEN', '')
    const { _internal_getAccessToken, _internal_resetTokenCache, GoogleCalendarError } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(_internal_getAccessToken()).rejects.toBeInstanceOf(GoogleCalendarError)
  })
})
