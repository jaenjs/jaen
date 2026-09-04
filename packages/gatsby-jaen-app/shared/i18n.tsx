import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
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
 * login: changing the language in the CMS settings writes preferredLanguage on
 * the account but leaves the session token alone, so the app kept rendering the
 * language the driver had when they signed in. Reading the field the settings
 * page actually writes is what makes the switch take effect without a new login.
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

/**
 * The app's language, in the order the CMS uses it.
 *
 * `code` is the value the server renders with and the fallback the client keeps
 * if nothing better is known. On the client the account's own language wins,
 * then the browser's. A driver whose Zitadel account is set to Turkish gets the
 * Turkish app without touching anything, which is the entire point: the four
 * catalogues under shared/locales have always been there, but the provider was
 * pinned to de-AT and nothing ever called setCode.
 *
 * An explicit switch through setCode stays put: once someone picks a language by
 * hand, the account language no longer overrides it.
 */
export function I18nProvider({
  code: initialCode = 'de-AT',
  children,
}: {
  code?: I18nCode
  children: React.ReactNode
}) {
  const [code, setCode] = useState<I18nCode>(initialCode)
  const chosenByHand = useRef(false)

  useEffect(() => {
    if (chosenByHand.current) return

    const resolved =
      matchCode(readAccountLocale()) ?? matchCode(readBrowserLocale())

    if (resolved && resolved !== code) setCode(resolved)
    // The session appears after the OIDC redirect, so this also has to run when
    // the app is entered straight from /loading.
  }, [code])

  /**
   * The claim settles the language immediately, without a request, so the app
   * never renders in the wrong one while waiting. Then the account is asked,
   * because a language picked in the settings after signing in is only there.
   * Runs once per mount, which covers a driver returning to the app.
   */
  useEffect(() => {
    let cancelled = false

    void fetchAccountLocale().then(locale => {
      if (cancelled || chosenByHand.current) return

      const resolved = matchCode(locale)

      if (resolved) setCode(current => (resolved === current ? current : resolved))
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSetCode = useCallback((c: I18nCode) => {
    chosenByHand.current = true
    setCode(c)
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
