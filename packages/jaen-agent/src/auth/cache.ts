// src/auth/cache.ts
//
// A token that introspected as active is remembered across requests.
//
// Pylon v3's `useAuth` introspects every bearer on every request and then
// fetches the userinfo, two round trips of about 750 ms each from Cloudflare's
// edge to accounts.netsnek.com (measured by the taxi pylon on 2026-09-05,
// whose src/auth/cache.ts this is adapted from). The agent is polled every
// five seconds by every open CMS, so paying that per poll is not an option.
//
// The plugin's own middleware is wrapped rather than replaced: it stays the
// only thing that validates a token, and this only remembers what it decided,
// in the module, keyed by the SHA-256 of the token, for AUTH_CACHE_TTL_MS
// (sixty seconds, 0 disables). A revoked token therefore keeps working for up
// to a minute and no longer. A hit past half its life is refreshed in the
// background against a context of its own, so a caller who keeps working
// never pays the round trips again.
//
// Two things it also fixes, both peculiar to the v3 plugin:
//   * an anonymous request never reaches next(), because the plugin returns
//     without calling it when there is no token at all, and hono then answers
//     404 instead of letting the resolver refuse with AUTH_REQUIRED;
//   * a 401 from the plugin is not remembered, so a bad token is refused
//     freshly every time rather than cached.
import type {Context, MiddlewareHandler} from 'hono'

/** The hono context variable the resolved grant list is cached under. */
export const ROLES_CACHE_KEY = 'callerGrantsResolved'

/** The hono context variable the request's cache entry is reachable under. */
export const AUTH_CACHE_ENTRY_KEY = 'authCacheEntry'

const DEFAULT_TTL_MS = 60_000

/** Bounded, so a flood of distinct bad tokens cannot grow the isolate. */
const MAX_ENTRIES = 2_000

export type AuthCacheEntry = {
  auth: Record<string, unknown>
  grants?: unknown[]
  storedAt: number
  expiresAt: number
  refreshing?: boolean
}

const entries = new Map<string, AuthCacheEntry>()

const ttlMs = (ctx: Context): number => {
  const raw = (ctx.env as any)?.AUTH_CACHE_TTL_MS

  if (raw === undefined || raw === null || raw === '') return DEFAULT_TTL_MS

  const n = Number(raw)

  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TTL_MS
}

/** The same two places the plugin reads the token from, minus the cookie. */
const bearer = (ctx: Context): string | undefined => {
  const header = ctx.req.header('Authorization')

  if (header) {
    const parts = header.split(' ')
    if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) return parts[1]
  }

  return ctx.req.query('token') || undefined
}

const keyOf = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  )

  return Array.from(new Uint8Array(digest), b =>
    b.toString(16).padStart(2, '0')
  ).join('')
}

/** Only an answer that actually identified somebody is worth remembering. */
const remember = (
  key: string,
  auth: unknown,
  ttl: number,
  previous?: AuthCacheEntry
): AuthCacheEntry | undefined => {
  const user = (auth as any)?.user

  if (!auth || typeof auth !== 'object' || !user?.sub) return undefined

  const now = Date.now()
  const expiresAt = now + ttl

  if (expiresAt <= now) return undefined

  if (entries.size >= MAX_ENTRIES) {
    for (const [k, e] of entries) if (e.expiresAt <= now) entries.delete(k)

    if (entries.size >= MAX_ENTRIES) {
      const oldest = entries.keys().next().value
      if (oldest !== undefined) entries.delete(oldest)
    }
  }

  const entry: AuthCacheEntry = {
    auth: auth as Record<string, unknown>,
    grants:
      previous && (previous.auth as any)?.user?.sub === user.sub
        ? previous.grants
        : undefined,
    storedAt: now,
    expiresAt
  }

  entries.set(key, entry)

  return entry
}

/**
 * The plugin's middleware run again in the background, against a context of
 * its own, so the finished request's variables are left alone. It reads
 * ctx.req and ctx.env and writes ctx.set('auth'); nothing else.
 */
const refresh = async (
  initialize: MiddlewareHandler,
  ctx: Context,
  key: string,
  ttl: number,
  previous: AuthCacheEntry
) => {
  const vars = new Map<string, unknown>()

  const shadow = {
    req: ctx.req,
    env: ctx.env,
    get: (name: string) => vars.get(name),
    set: (name: string, value: unknown) => {
      vars.set(name, value)
    }
  }

  try {
    await initialize(shadow as unknown as Context, async () => {})

    const entry = remember(key, vars.get('auth'), ttl, previous)

    // An introspection that came back inactive, or not at all, forgets the
    // token: the next request pays the round trip and is refused properly.
    if (!entry) entries.delete(key)
  } catch (error) {
    console.error('auth cache: background refresh failed', error)
    entries.delete(key)
  }
}

export const cachedIntrospection = (
  initialize: MiddlewareHandler
): MiddlewareHandler => {
  return async (ctx, next) => {
    const ttl = ttlMs(ctx)
    const token = bearer(ctx)

    // No token at all: the plugin would return without calling next(), and
    // hono would answer 404. The resolver's own guard is what refuses an
    // anonymous call, with AUTH_REQUIRED, so let it get there.
    if (!token) return next()

    if (ttl <= 0) return runOnce(initialize, ctx, next)

    const key = await keyOf(token)
    const now = Date.now()
    const hit = entries.get(key)

    if (hit && hit.expiresAt > now) {
      ctx.set('auth' as never, hit.auth as never)
      ctx.set(AUTH_CACHE_ENTRY_KEY as never, hit as never)
      if (hit.grants) ctx.set(ROLES_CACHE_KEY as never, hit.grants as never)

      if (now - hit.storedAt > ttl / 2 && !hit.refreshing) {
        hit.refreshing = true

        const work = refresh(initialize, ctx, key, ttl, hit).finally(() => {
          hit.refreshing = false
        })

        try {
          ctx.executionCtx.waitUntil(work)
        } catch {
          // No execution context (a local runner): the refresh runs on its own.
        }
      }

      return next()
    }

    if (hit) entries.delete(key)

    return runOnce(initialize, ctx, async () => {
      const entry = remember(key, ctx.get('auth' as never), ttl, hit)
      if (entry) ctx.set(AUTH_CACHE_ENTRY_KEY as never, entry as never)
      return next()
    })
  }
}

/**
 * The plugin, made to always continue.
 *
 * It calls next() itself on the path that identified somebody and returns
 * without it otherwise, so this notices and continues, and the guard in the
 * resolver stays the one thing that refuses a call.
 */
const runOnce = async (
  initialize: MiddlewareHandler,
  ctx: Context,
  next: () => Promise<void>
) => {
  let went = false

  const once = async () => {
    if (went) return
    went = true
    await next()
  }

  await initialize(ctx, once as never)

  if (!went) await once()
}

/** For a debug hook and the tests: how many tokens are remembered right now. */
export const authCacheSize = (): number => entries.size
