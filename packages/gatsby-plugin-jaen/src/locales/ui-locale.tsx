import {useCallback, useSyncExternalStore} from 'react'

/**
 * The language of the screen, one store for every tree on the page.
 *
 * The settings page lets a user choose the account language. The choice used
 * to take effect only at the next login, because the frame followed the
 * account's profile and the app followed the OIDC locale claim, which is
 * minted once per session. So the owner changed the language, saw nothing,
 * and had to sign out and in again. Now the choice lands here the moment it
 * is made, before the identity server has answered, and everything that
 * draws a string subscribes: the frame (JaenIntlProvider), the CMS pages and
 * the app's own I18nProvider. The settings form reverts it when the write
 * fails.
 *
 * Persisted under `jaen:uiLocale` in localStorage, so a reload and the next
 * visit keep it without waiting for the profile. A device that has no value
 * yet is seeded once from the account (seedUiLocale), never overwritten by
 * it afterwards.
 *
 * Why a module-level store and not React state: the Jaen frame (the toolbar
 * and its drawers) is a Gatsby Slice, and Gatsby wraps a slice in its own
 * wrapRootElement, so it is a separate React tree with its own providers. A
 * context value set on the page's tree never reached it, and the page turned
 * German while the frame around it stayed English. Every tree on the page
 * shares this one module instance, so they all follow the same pick. The
 * `storage` event does the same across tabs of one origin.
 */
export const UI_LOCALE_STORAGE_KEY = 'jaen:uiLocale'

let uiLocale: string | null = null
let loaded = false

const listeners = new Set<() => void>()

const emit = (): void => {
  listeners.forEach(listener => listener())
}

const readStorage = (): string | null => {
  try {
    return window.localStorage.getItem(UI_LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

const writeStorage = (locale: string | null): void => {
  try {
    if (locale === null) {
      window.localStorage.removeItem(UI_LOCALE_STORAGE_KEY)
    } else {
      window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale)
    }
  } catch {
    // Storage can be unavailable (private mode, quota). The in-memory value
    // still drives the page, only the next visit forgets it.
  }
}

/**
 * The stored value is read once, on the first client-side access, not at
 * module evaluation: the module is also evaluated during the server render,
 * where there is no window and the snapshot has to be null.
 */
const load = (): void => {
  if (loaded || typeof window === 'undefined') return

  loaded = true
  uiLocale = readStorage()

  window.addEventListener('storage', event => {
    // A null key is localStorage.clear(), which takes this value with it.
    if (event.key !== null && event.key !== UI_LOCALE_STORAGE_KEY) return

    const next = event.key === null ? null : event.newValue

    if (next === uiLocale) return

    uiLocale = next
    emit()
  })
}

export const getUiLocale = (): string | null => {
  load()

  return uiLocale
}

// The server never has a pick; rendering with none keeps hydration identical.
const getServerUiLocale = (): null => null

export const subscribeUiLocale = (listener: () => void): (() => void) => {
  load()
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

/** Set the language of the screen now, and keep it for the next visit. */
export const setUiLocale = (locale: string | null): void => {
  load()

  const next = locale?.trim() || null

  if (next === uiLocale) return

  uiLocale = next
  writeStorage(next)
  emit()
}

/**
 * The account's language settles the store on a device that has none.
 * Returns whether it did. A device with a value keeps it, whatever the
 * account says: the value here is the one the person chose last, and the
 * account is written from it, not the other way round.
 *
 * Zitadel answers `und` for an account that never chose a language (the
 * BCP 47 tag for undetermined), and that is no language to seed with: the
 * device keeps falling back to the claim and the browser until a real one
 * is chosen or the account says one.
 */
export const seedUiLocale = (locale?: string | null): boolean => {
  load()

  if (uiLocale !== null) return false

  const next = locale?.trim()

  if (!next || next.toLowerCase() === 'und') return false

  setUiLocale(next)

  return true
}

export const useUiLocale = (): {
  uiLocale: string | null
  setUiLocale: (locale: string | null) => void
} => {
  const current = useSyncExternalStore(
    subscribeUiLocale,
    getUiLocale,
    getServerUiLocale
  )
  const set = useCallback((locale: string | null) => setUiLocale(locale), [])

  return {uiLocale: current, setUiLocale: set}
}
