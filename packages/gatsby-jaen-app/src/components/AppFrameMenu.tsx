/**
 * The app's entries in jaen's frame, on every page of the site.
 *
 * The app is part of the ERP the frame is the front door of, not a site
 * inside the site. Registering the navigation from the shell meant a person
 * signed in on the home page, on /cms or on /settings opened the bars icon
 * and found no Transfers, no Buchungen, no Standorte: the entries existed
 * only once one already knew the URL of /app. So the registration lives here,
 * mounted by the plugin's wrapPageElement (gatsby-browser.tsx and
 * gatsby-ssr.tsx), which runs inside jaen's JaenFrameMenuProvider on every
 * page. The shell draws no title of its own, every view starts with its
 * PageHeader. See okf/architecture/navigation.md.
 *
 * Nothing is asked of the backend for a visitor who is not signed in: the
 * caller lookup starts only behind jaen's own isAuthenticated, so the
 * marketing pages stay as quiet as they were.
 */
import {useEffect, useState} from 'react'
import {useAuth} from 'jaen'
import {useCaller} from '../../shared/auth'
import {useFrameMenu} from './useFrameMenu'

declare const __JAEN_APP_BRAND_NAME__: string | null | undefined

/**
 * The brand, for the app menu's group label and as the shell's title when
 * no entry matches the path. The plugin option wins, the hostname is the
 * fallback, and both are right for exactly one brand, which is the rule:
 * nothing brand specific is hardcoded, see okf/decisions/hard-rules.md.
 */
export const useBrandName = (): string => {
  const configured = (() => {
    try {
      return typeof __JAEN_APP_BRAND_NAME__ !== 'undefined' && __JAEN_APP_BRAND_NAME__
        ? __JAEN_APP_BRAND_NAME__
        : undefined
    } catch {
      return undefined
    }
  })()

  const [host, setHost] = useState('')

  useEffect(() => {
    if (!configured) setHost(window.location.hostname.replace(/^www\./, ''))
  }, [configured])

  return configured ?? host
}

/** Reads the caller and registers the entries. Renders nothing. */
function Registrar() {
  const caller = useCaller()
  const brand = useBrandName()
  useFrameMenu(caller, brand)
  return null
}

export function AppFrameMenu() {
  const auth = useAuth()
  if (!auth.isAuthenticated) return null
  return <Registrar />
}
