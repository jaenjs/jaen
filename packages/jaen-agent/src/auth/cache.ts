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
// keyed by the SHA-256 of the token, for AUTH_CACHE_TTL_MS (sixty seconds, 0
// disables). A revoked token therefore keeps working for up to a minute and
// no longer. A hit past half its life is refreshed in the background against
// a context of its own, so a caller who keeps working never pays the round
// trips again.
//
// Two tiers, because one was not enough. The module scoped map belongs to one
// Worker isolate, and Cloudflare starts isolates as it pleases: the shared
// draft verifier measured 3.77 s on the first call of a run and 1.7 s on the
// three after it, twice, and that two second gap is a token this isolate had
// not seen. So the same answer also goes into the CACHE KV under
// `auth:<sha256 of the token>`, which every isolate of every colo reads, and a
// cold isolate pays a KV read of a few milliseconds instead of an
// introspection and a userinfo round trip. The KV holds an identity, so the
// key is the hash of the token and nothing else: reading it back means holding
// the token, which already means being that caller.
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

/** Cloudflare KV refuses an expirationTtl below sixty seconds. */
const KV_MIN_TTL_SECONDS = 60

/** The KV prefix. The rest of the key is the SHA-256 of the bearer. */
const KV_PREFIX = 'auth:'

/** Bounded, so a flood of distinct bad tokens cannot grow the isolate. */
const MAX_ENTRIES = 2_000

export type AuthCacheEntry = {
  /** The SHA-256 of the bearer, so the grant list can be written back. */
  key?: string
  auth: Record<string, unknown>
  grants?: unknown
  storedAt: number
  expiresAt: number
  refreshing?: boolean
}

const entries = new Map<string, AuthCacheEntry>()

/** The KV namespace, or null on a runner that has none bound. */
const kvOf = (ctx: Context): KVNamespace | null =>
  ((ctx.env as any)?.CACHE as KVNamespace | undefined) ?? null

/**
 * The entry as the KV holds it.
 *
 * `expiresAt` is an absolute instant and is what the entry is read against,
 * because KV's own expiry has a minute as its floor while the TTL here may be
 * shorter. KV only ever holds a value longer than it is honoured.
 */
const kvRead = async (
  ctx: Context,
  key: string
): Promise<AuthCacheEntry | null> => {
  const kv = kvOf(ctx)

  if (!kv) return null

  try {
    const hit = (await kv.get(KV_PREFIX + key, 'json')) as AuthCacheEntry | null

    if (!hit || typeof hit !== 'object') return null
    if (!(hit.auth as any)?.user?.sub) return null
    if (!(hit.expiresAt > Date.now())) return null

    return hit
  } catch {
    // A KV that is not there is a slower request and never a wrong answer.
    return null
  }
}

const kvWrite = async (ctx: Context, key: string, entry: AuthCacheEntry) => {
  const kv = kvOf(ctx)

  if (!kv) return

  const seconds = Math.max(
    KV_MIN_TTL_SECONDS,
    Math.ceil((entry.expiresAt - entry.storedAt) / 1000)
  )

  try {
    await kv.put(
      KV_PREFIX + key,
      JSON.stringify({
        auth: entry.auth,
        grants: entry.grants,
        storedAt: entry.storedAt,
        expiresAt: entry.expiresAt
      }),
      {expirationTtl: seconds}
    )
  } catch {
    // Same: the next request pays the round trips instead.
  }
}

/** Off the response path where there is an execution context, inline where not. */
const inTheBackground = (ctx: Context, work: Promise<unknown>) => {
  try {
    ctx.executionCtx.waitUntil(work)
  } catch {
    void work
  }
}

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
    key,
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
  const kv = kvOf(ctx)

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
    // Both tiers, or a cold isolate would read the forgotten answer back out
    // of the KV and the revocation would not stick.
    if (!entry) {
      entries.delete(key)
      await kv?.delete(KV_PREFIX + key).catch(() => undefined)
      return
    }

    await kvWrite(ctx, key, entry)
  } catch (error) {
    console.error('auth cache: background refresh failed', error)
    entries.delete(key)
    await kv?.delete(KV_PREFIX + key).catch(() => undefined)
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

    const use = (entry: AuthCacheEntry) => {
      ctx.set('auth' as never, entry.auth as never)
      ctx.set(AUTH_CACHE_ENTRY_KEY as never, entry as never)
      if (entry.grants) ctx.set(ROLES_CACHE_KEY as never, entry.grants as never)

      if (now - entry.storedAt > ttl / 2 && !entry.refreshing) {
        entry.refreshing = true

        inTheBackground(
          ctx,
          refresh(initialize, ctx, key, ttl, entry).finally(() => {
            entry.refreshing = false
          })
        )
      }
    }

    const hit = entries.get(key)

    if (hit && hit.expiresAt > now) {
      use(hit)
      return next()
    }

    if (hit) entries.delete(key)

    // This isolate has not seen the token, which does not mean nobody has.
    // A KV read of a few milliseconds is the whole of what a cold isolate
    // used to pay two seconds for.
    const shared = await kvRead(ctx, key)

    if (shared) {
      shared.key = key
      entries.set(key, shared)
      use(shared)
      return next()
    }

    return runOnce(initialize, ctx, async () => {
      const entry = remember(key, ctx.get('auth' as never), ttl, hit)

      if (entry) {
        ctx.set(AUTH_CACHE_ENTRY_KEY as never, entry as never)
        // Off the response path: the caller waits for the answer, not for the
        // write that saves the next isolate the round trips.
        inTheBackground(ctx, kvWrite(ctx, key, entry))
      }

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

/**
 * The resolved grant list, written back into the shared tier.
 *
 * `../index` resolveCaller works out which roles a caller holds and in which
 * organisation, sometimes with a lookup through the site's identity facade,
 * and hangs the answer on the request's cache entry. Without this the answer
 * would live in one isolate: a cold one would read the identity out of the KV
 * and then pay the facade lookup anyway, which is the round trip this whole
 * file exists to avoid.
 */
export const persistCallerGrants = (
  ctx: Context,
  entry: AuthCacheEntry
): void => {
  if (!entry?.key) return

  inTheBackground(ctx, kvWrite(ctx, entry.key, entry))
}

/** For a debug hook and the tests: how many tokens are remembered right now. */
export const authCacheSize = (): number => entries.size
