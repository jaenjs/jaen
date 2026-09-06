import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore
} from 'react'
import {
  getUiLocale,
  seedUiLocale,
  setUiLocale,
  subscribeUiLocale
} from 'gatsby-plugin-jaen'
import {resolve} from '../client/limosen'

export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG'

const CODES: I18nCode[] = ['en-US', 'de-AT', 'tr-TR', 'ar-EG']

interface I18nContextValue {
  code: I18nCode
  setCode: (code: I18nCode) => void
}

const I18nContext = createContext<I18nContextValue>({
  code: 'de-AT',
  setCode: () => {},
})

declare const __JAEN_ZITADEL_GQL__:
  | {authority?: string; clientId?: string}
  | undefined

/** 'tr', 'tr-TR' and 'TR_tr' all have to find tr-TR. */
const matchCode = (raw?: string | null): I18nCode | undefined => {
  const base = raw?.replace('_', '-').split('-')[0]?.toLowerCase()
  return base ? CODES.find(c => c.slice(0, 2) === base) : undefined
}

/**
 * The language the signed-in account asked for, read out of the OIDC session.
 *
 * This is the same session the auth header comes from, so it needs no provider
 * above it and no extra request: Zitadel puts the account's language into the
 * `locale` claim, and that claim is what the CMS follows too. Reading it here
 * rather than through a React context also means the app does not care in which
 * order the Gatsby plugins wrap the root element.
 */
const readAccountLocale = (): string | undefined => {
  try {
    const z =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null

    if (!z?.authority || !z?.clientId) return undefined

    const raw = window.sessionStorage?.getItem(
      `oidc.user:${z.authority}:${z.clientId}`
    )

    if (!raw) return undefined

    return JSON.parse(raw)?.profile?.locale
  } catch {
    return undefined
  }
}

/**
 * The account's language as the identity server holds it right now.
 *
 * readAccountLocale above reads the `locale` claim, and that claim is minted at
 * login: a language chosen in the settings on another device is only in the
 * profile. Reading the field the settings page actually writes is what seeds a
 * device that has no language of its own yet with the right one.
 *
 * It is one small request against the identity facade, not the fleet database,
 * and every failure is swallowed: the claim and the browser language are still
 * there, so a driver never ends up worse off than before.
 */
const fetchAccountLocale = async (): Promise<string | undefined> => {
  try {
    const edges = await resolve(
      ({query}) => {
        const profiles = (query as any).currentUser?.profiles
        const node = profiles?.edges?.[0]?.node
        if (node) void node.preferredLanguage
        return profiles?.edges
      },
      {cachePolicy: 'no-store'}
    )

    const language = (edges as any[])?.[0]?.node?.preferredLanguage

    return typeof language === 'string' && language ? language : undefined
  } catch {
    return undefined
  }
}

const readBrowserLocale = (): string | undefined => {
  if (typeof navigator === 'undefined') return undefined

  const languages = Array.isArray(navigator.languages)
    ? navigator.languages
    : [navigator.language]

  return languages.find(Boolean)
}

// The server never has a pick; rendering with none keeps hydration identical.
const getServerUiLocale = (): null => null

/**
 * The app's language.
 *
 * One source: jaen's ui-locale store, the language of the screen. The CMS
 * settings set it the moment a language is chosen, it lives in localStorage
 * across reloads, and the frame subscribes to the same store, so the drawer
 * and this page change together, without a navigation and without a login.
 *
 * `code` is what the server renders with. On a device whose store is still
 * empty the order is the one the CMS uses: the OIDC locale claim (there before
 * any request), then the browser. The account's profile is asked once over the
 * pylon and seeds the store, because a language picked in the settings on
 * another device is only there, and the claim was minted at login. Once the
 * store has a value it wins, whatever the claim says. A driver whose account
 * is set to Turkish gets the Turkish app without touching anything, and a
 * switch through setCode is a pick like the settings page's: it is stored,
 * so it stays put.
 */
export function I18nProvider({
  code: initialCode = 'de-AT',
  children,
}: {
  code?: I18nCode
  children: React.ReactNode
}) {
  const stored = useSyncExternalStore(
    subscribeUiLocale,
    getUiLocale,
    getServerUiLocale
  )
  const [seedCode, setSeedCode] = useState<I18nCode>(initialCode)
  const code = matchCode(stored) ?? seedCode

  useEffect(() => {
    const resolved =
      matchCode(readAccountLocale()) ?? matchCode(readBrowserLocale())

    if (resolved && resolved !== seedCode) setSeedCode(resolved)
    // The session appears after the OIDC redirect, so this also has to run when
    // the app is entered straight from /loading.
  }, [seedCode])

  /**
   * The claim settles the language immediately, without a request, so the app
   * never renders in the wrong one while waiting. Then the account is asked
   * and seeds the store of a device that has none. Runs once per mount, which
   * covers a driver returning to the app.
   */
  useEffect(() => {
    let cancelled = false

    void fetchAccountLocale().then(locale => {
      if (cancelled || !locale) return

      seedUiLocale(locale)

      const resolved = matchCode(locale)

      if (resolved) {
        setSeedCode(current => (resolved === current ? current : resolved))
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSetCode = useCallback((c: I18nCode) => {
    setUiLocale(c)
  }, [])

  return (
    <I18nContext.Provider value={{code, setCode: handleSetCode}}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18nCode(): I18nCode {
  return useContext(I18nContext).code
}

export function useI18n() {
  return useContext(I18nContext)
}
