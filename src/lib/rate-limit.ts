import 'server-only'

/**
 * Shared in-memory rate limiter used by public/unauthenticated routes
 * (workshop-register, workshop-feedback) and per-user endpoints
 * (/api/upload presign).
 *
 * Strategy: simple fixed-window counter with LRU eviction. NOT cluster-safe
 * - a multi-instance deployment would need Upstash/Redis. For single-Vercel
 * or single-host setups this is sufficient to defuse burst abuse of the
 * public intake endpoints; the window is short enough that cross-instance
 * drift is bounded.
 *
 * API:
 *   - `rateLimit(key, { max, windowMs })` - inspect-only; returns whether the
 *     key is currently under limit and how many requests remain. Does NOT
 *     consume.
 *   - `consume(key, { max, windowMs })` - atomically bumps the counter and
 *     returns whether the call should proceed. Returns { ok, remaining,
 *     resetAt }.
 *
 * Keys are caller-shaped strings (e.g. `workshop-register:ip:1.2.3.4`) so
 * multiple routes do not collide. Each key maintains its own window.
 */

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  max: number
  /** Rolling window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  /** True if the request is under the limit. `consume` also bumps the counter. */
  ok: boolean
  /** Requests remaining in the current window after this check (min 0). */
  remaining: number
  /** Unix epoch ms when the current window resets. */
  resetAt: number
}

interface Bucket {
  count: number
  resetAt: number
}

// Hard cap on distinct keys tracked. Oldest entries are evicted when the map
// exceeds this size (rough LRU via insertion order since Map preserves it).
const MAX_ENTRIES = 5000

const buckets = new Map<string, Bucket>()

function evictIfNeeded(): void {
  if (buckets.size <= MAX_ENTRIES) return
  const overflow = buckets.size - MAX_ENTRIES
  let removed = 0
  for (const k of buckets.keys()) {
    buckets.delete(k)
    removed++
    if (removed >= overflow) break
  }
}

function touch(key: string, bucket: Bucket): void {
  // Re-insert to push this key to the tail (most-recently-used) of the Map.
  buckets.delete(key)
  buckets.set(key, bucket)
}

/**
 * Read-only rate-limit check. Does NOT consume a request.
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    return { ok: true, remaining: opts.max, resetAt: now + opts.windowMs }
  }
  const remaining = Math.max(0, opts.max - existing.count)
  return { ok: existing.count < opts.max, remaining, resetAt: existing.resetAt }
}

/**
 * Consume one request against `key`. Returns { ok: false } if the bucket is
 * exhausted. Callers short-circuit with HTTP 429 when ok=false.
 */
export function consume(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + opts.windowMs }
    buckets.set(key, fresh)
    evictIfNeeded()
    return { ok: true, remaining: Math.max(0, opts.max - 1), resetAt: fresh.resetAt }
  }
  if (existing.count >= opts.max) {
    touch(key, existing)
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }
  existing.count += 1
  touch(key, existing)
  return {
    ok: true,
    remaining: Math.max(0, opts.max - existing.count),
    resetAt: existing.resetAt,
  }
}

/**
 * Extract a best-effort client IP from a Next.js / standard Request. Falls
 * back to `'unknown'` so a missing header does not crash the limiter.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}
