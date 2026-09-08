/**
 * The one place a machine answer becomes a sentence a person reads,
 * design-consistency.md rule 14.
 *
 * Owner, 2026-09-08: "Alerts sind noch alle in Englisch." The screens were not
 * the problem. Every toast, banner and empty state already draws its own title
 * out of its own catalogue; what stood between them was the message of the
 * `Error` the layer had thrown, and that message was the pylon's English
 * (`Forbidden`, `Not found`), the app's own English (`no link in the answer`,
 * `Notifications are not supported`) or a GraphQL string. Twenty odd screens
 * put `err.message` into a toast description, so twenty odd screens showed
 * English in all four languages.
 *
 * Translating where a screen draws would have been the wrong place twice: a
 * screen also passes its own catalogue string to the same banner, and a sink
 * cannot tell a German sentence it was handed from an English one it has to
 * replace. So the translation happens where the `Error` is made. From here on
 * an error the app raises carries the reader's sentence as its `message`, the
 * machine's own text as `detail` and the pylon's code as `code`, which is what
 * keeps AUTH_REQUIRED and FORBIDDEN two different answers (hard-rules.md)
 * while both read as one language on the screen.
 *
 * The language is module state, set by the shell on every render, the way
 * offline.ts holds the language of its refusals: an error is thrown from an
 * async function outside React, where no hook can be read, and it still has to
 * read like the screen around it.
 */
import type {I18nCode} from './i18n'
import {getI18nErrors, type ErrorStrings} from './locales/i18nErrors'

declare const __JAEN_ZITADEL_GQL__:
  | {authority?: string; clientId?: string}
  | undefined

let language: I18nCode | undefined

/**
 * The language the failures are worded in. The shell sets it from the
 * account's language on every render, next to setOfflineLanguage.
 */
export const setErrorLanguage = (code: I18nCode) => {
  language = code
}

/** Before the shell has rendered once: the session's claim, then the browser. */
const guessLanguage = (): I18nCode => {
  const codes: I18nCode[] = ['en-US', 'de-AT', 'tr-TR', 'ar-EG']
  const match = (raw: unknown): I18nCode | undefined => {
    const base =
      typeof raw === 'string'
        ? raw.replace('_', '-').split('-')[0]?.toLowerCase()
        : undefined
    return base ? codes.find(c => c.slice(0, 2) === base) : undefined
  }
  try {
    const z =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    if (z?.authority && z?.clientId) {
      const raw = window.sessionStorage?.getItem(
        `oidc.user:${z.authority}:${z.clientId}`
      )
      const claim = raw ? match(JSON.parse(raw)?.profile?.locale) : undefined
      if (claim) return claim
    }
  } catch {
    // No session, the browser decides.
  }
  try {
    return match(navigator.languages?.[0] ?? navigator.language) ?? 'de-AT'
  } catch {
    return 'de-AT'
  }
}

export const errorStrings = (): ErrorStrings =>
  getI18nErrors(language ?? guessLanguage()).strings

/** The keys of the catalogue, so a caller names a sentence and not a string. */
export type ErrorKey = keyof ErrorStrings

/**
 * What the pylon answers, mapped to what a person is told. A code that is not
 * here falls to Unknown, and the machine text goes to the console rather than
 * to the screen. See pylon/src/errors and pylon/src/auth for the list.
 */
const BY_CODE: Record<string, ErrorKey> = {
  AUTH_REQUIRED: 'AuthRequired',
  UNAUTHENTICATED: 'AuthRequired',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'NotFound',
  USER_NOT_FOUND: 'NotFound',
  INVALID_INPUT: 'InvalidInput',
  BAD_USER_INPUT: 'InvalidInput',
  GRAPHQL_VALIDATION_FAILED: 'InvalidInput',
  CONFIRMATION_REQUIRED: 'ConfirmationRequired',
  PICKUP_IN_PAST: 'PickupInPast',
  INVALID_PHONE: 'InvalidPhone',
  INVALID_TRANSITION: 'InvalidTransition',
  PAYOUT_LOCKED: 'PayoutLocked',
  LINK_EXPIRED: 'LinkExpired',
  CODE_EXHAUSTED: 'CodeExhausted',
  MISCONFIGURED: 'Server',
  GATEWAY_READ_FAILED: 'Server',
  INTERNAL_SERVER_ERROR: 'Server'
}

/**
 * The machine texts that reach a person without a code: the pylon's own
 * defaults where an older resolver threw a bare message, and yoga's mask.
 * Matched on the whole message, lower cased, so a sentence a resolver wrote
 * for a person is never swallowed by a substring.
 */
const BY_MESSAGE: Record<string, ErrorKey> = {
  forbidden: 'Forbidden',
  'authentication required': 'AuthRequired',
  'not found': 'NotFound',
  'invalid input': 'InvalidInput',
  'unexpected error.': 'Server',
  'graphql error': 'Unknown'
}

export interface AppErrorOptions {
  /** The pylon's `extensions.code`, kept for a caller that branches on it. */
  code?: string
  /** The machine's own text, for the console and for a test. Never drawn. */
  detail?: string
  /** The failure this one wraps, so a stack is not lost. */
  cause?: unknown
}

/**
 * A failure with a sentence in it. `message` is the reader's language, so
 * every screen that already draws `err.message` is right without a change.
 */
export class AppError extends Error {
  readonly code?: string
  readonly detail?: string

  constructor(key: ErrorKey, options: AppErrorOptions = {}) {
    super(errorStrings()[key])
    this.name = 'AppError'
    this.code = options.code
    this.detail = options.detail
    if (options.cause !== undefined) {
      ;(this as {cause?: unknown}).cause = options.cause
    }
  }
}

/**
 * The key a machine answer maps to, or undefined when nothing here knows it.
 * A caller that gets undefined says Unknown and logs the text.
 */
export const errorKey = (
  code: string | undefined,
  message: string | undefined
): ErrorKey | undefined => {
  if (code && BY_CODE[code]) return BY_CODE[code]
  const text = (message ?? '').trim().toLowerCase()
  if (text && BY_MESSAGE[text]) return BY_MESSAGE[text]
  return undefined
}

/**
 * A GraphQL answer that carried errors, as one `AppError`.
 *
 * Every read and write of the app goes through one of half a dozen small
 * clients (shared/hooks.ts, hooks/bookings.ts, hooks/users.ts and their
 * siblings), and each one used to build its own `new Error(errors[0].message)`.
 * They call this instead, so the code survives, the sentence is the reader's,
 * and the machine's text is on the error for the console and for a test.
 */
export const sentenceFor = (
  code: string | undefined,
  detail: string
): string => {
  const key = errorKey(code, detail)
  if (!key) {
    // Swallowing the machine's own words is a decision (hard-rules.md): the
    // reader gets a sentence they can read, and the text a developer needs
    // stays on the error as `detail` and in the console instead of on screen.
    warnUnknown(code, detail)
  }
  return errorStrings()[key ?? 'Unknown']
}

/**
 * The machine's own words, for the handful of checks that branch on how the
 * schema worded a failure ("Cannot query field ..."). Never shown to a
 * person: every error of this app now carries the reader's sentence as its
 * `message` and the machine's text as `detail`, and a check that reads the
 * message would be reading a translation.
 */
export const machineText = (err: unknown): string => {
  const detail = (err as {detail?: unknown})?.detail
  if (typeof detail === 'string' && detail) return detail
  return err instanceof Error ? err.message : ''
}

/**
 * A failure as a sentence, whatever shape it arrived in: an error this app
 * worded keeps its own, a coded or known machine answer gets the catalogue's,
 * and anything else falls to the caller's own fallback.
 */
export const failureText = (err: unknown, fallback?: string): string => {
  if (err instanceof AppError) return err.message
  const raw = (err as {code?: unknown})?.code
  const code = typeof raw === 'string' ? raw : undefined
  const detail = machineText(err)
  const key = errorKey(code, detail)
  if (key) return errorStrings()[key]
  if (detail) warnUnknown(code, detail)
  return fallback ?? errorStrings().Unknown
}

export const graphqlError = (errors: unknown): AppError => {
  const first = (Array.isArray(errors) ? errors[0] : undefined) as
    | {message?: unknown; extensions?: {code?: unknown}}
    | undefined
  const code =
    typeof first?.extensions?.code === 'string'
      ? first.extensions.code
      : undefined
  const detail = String(first?.message ?? 'GraphQL error')
  return new AppError(errorKey(code, detail) ?? unknownKey(code, detail), {
    code,
    detail
  })
}

/** Unknown, and the machine's text into the console on the way past. */
const unknownKey = (code: string | undefined, detail: string): ErrorKey => {
  warnUnknown(code, detail)
  return 'Unknown'
}

/**
 * An HTTP status as a sentence. Yoga answers a refusal with a status of its
 * own where the gateway refuses before the resolver runs, and gqty turns that
 * into "Received HTTP 401 from GraphQL endpoint" long before any error
 * extension exists to read.
 */
export const httpKey = (status: number): ErrorKey => {
  if (status === 401) return 'AuthRequired'
  if (status === 403) return 'Forbidden'
  if (status === 404) return 'NotFound'
  if (status >= 400 && status < 500) return 'InvalidInput'
  return 'Server'
}

/** The status gqty put into its own message, when it put one there. */
export const statusInText = (text: string): number | undefined => {
  const match = /Received HTTP (\d{3})/.exec(text)
  return match ? Number(match[1]) : undefined
}

/**
 * A failure the app itself raises, by the name of its sentence. `detail` is
 * what the code used to throw in English.
 */
export const appError = (key: ErrorKey, detail?: string): AppError =>
  new AppError(key, {detail})

const warned = new Set<string>()

const warnUnknown = (code: string | undefined, detail: string) => {
  const mark = `${code ?? ''}:${detail}`
  if (warned.has(mark)) return
  warned.add(mark)
  try {
    // eslint-disable-next-line no-console
    console.warn('[taxi-app] no sentence for this failure yet:', mark)
  } catch {
    // A runtime without a console is not worth an exception.
  }
}

/**
 * What a screen shows for a failure it holds as a value rather than as an
 * error. Strings pass through untouched, because a screen that hands its own
 * catalogue string to a banner is already right; only an `Error` is worded.
 */
export const errorText = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  return String(value)
}
