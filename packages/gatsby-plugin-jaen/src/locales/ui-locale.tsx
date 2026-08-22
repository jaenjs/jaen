import {useCallback, useSyncExternalStore} from 'react'

/**
 * A locale the visitor has picked but not yet saved.
 *
 * The settings page lets a user choose the account language. Saving writes it
 * to the identity server, and the account value then drives the CMS language
 * on every future visit. What was missing is the moment in between: picking a
 * language did nothing until Save, and a user who did not save saw no change
 * at all and could not tell whether the control worked.
 *
 * So the choice takes effect on the spot, in memory only. JaenIntlProvider
 * reads it ahead of the account's preferredLanguage. It lives exactly as long
 * as the page: leave without saving and the next visit is back on the
 * account's language, which is the behaviour asked for.
 *
 * Why a module-level store and not React state: the Jaen frame (the toolbar
 * and its drawers) is a Gatsby Slice, and Gatsby wraps a slice in its own
 * wrapRootElement, so it is a separate React tree with its own providers. A
 * context value set on the page's tree never reached it, and the page turned
 * German while the frame around it stayed English. Every tree on the page
 * shares this one module instance, so they all follow the same pick.
 */
let previewLocale: string | null = null

const listeners = new Set<() => void>()

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): string | null => previewLocale

// The server never has a pick; rendering with none keeps hydration identical.
const getServerSnapshot = (): null => null

export const setPreviewLocale = (locale: string | null): void => {
  if (locale === previewLocale) return

  previewLocale = locale
  listeners.forEach(listener => listener())
}

export const useUiLocale = (): {
  previewLocale: string | null
  setPreviewLocale: (locale: string | null) => void
} => {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
  const set = useCallback(
    (locale: string | null) => setPreviewLocale(locale),
    []
  )

  return {previewLocale: current, setPreviewLocale: set}
}
