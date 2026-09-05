/**
 * Puts the app's navigation into jaen's frame.
 *
 * The frame has two menus and one documented way to fill them,
 * `useJaenFrameMenuContext().extendMenu(type, {group, label, items})` from
 * gatsby-plugin-jaen/src/contexts/jaen-frame-menu.tsx: `app` is the drawer
 * behind the bars icon TOP LEFT, `user` the drawer behind the avatar TOP
 * RIGHT. The CMS fills them the same way from src/slices/jaen-frame.tsx.
 *
 * extendMenu merges: a group is keyed by its name and an item by its id, so
 * registering the same ids again overwrites the same entries and nothing is
 * duplicated. That is what makes it safe to run this once per caller change
 * and once per language change, when the labels have to be rewritten. It
 * cannot remove: an entry stays until the page reloads, which a sign-out or
 * a sign-in does anyway through the OIDC redirect.
 *
 * Called from AppFrameMenu, which the plugin mounts on every page of the
 * site, so the entries are in the frame on the home page and under /cms as
 * much as under /app.
 *
 * The effect deliberately does not depend on extendMenu itself. The provider
 * recreates that function on every render, and every extendMenu call renders
 * the provider, so depending on it would register in a loop.
 */
import {useEffect, useRef} from 'react'
import {useJaenFrameMenuContext} from 'gatsby-plugin-jaen'
import {FaInfoCircle} from '@react-icons/all-files/fa/FaInfoCircle'
import type {Caller} from '../../shared/auth'
import {useI18nCode} from '../../shared/i18n'
import {getI18nCommon} from '../../shared/locales/i18nCommon'
import {versionLineText} from '../../shared/components/VersionLine'
import {navFor, type NavItem, type NavMenu} from './nav'

/** The group the app's entries share in the app menu, labelled with the brand. */
export const APP_MENU_GROUP = 'app'

/**
 * The frame's own settings entry lives in the unlabelled default group of
 * the user menu, and the person's entries belong beside it, not in a second
 * group above it: Ich, Benachrichtigungen, Einstellungen, then the separator
 * and Abmelden, which the frame keeps in its own group at the bottom.
 */
export const USER_MENU_GROUP = 'default'

type Registrable = Parameters<ReturnType<typeof useJaenFrameMenuContext>['extendMenu']>[1]

const toItems = (items: NavItem[], labels: ReturnType<typeof getI18nCommon>['strings']): Registrable['items'] =>
  Object.fromEntries(
    items.map(item => [
      item.id,
      {
        label: labels[item.label],
        path: item.path,
        icon: item.icon,
        order: item.order
      }
    ])
  )

export function useFrameMenu(caller: Caller, brand: string) {
  const {extendMenu} = useJaenFrameMenuContext()
  const code = useI18nCode()

  const latest = useRef({extendMenu, caller})
  latest.current = {extendMenu, caller}

  // The roles, flattened, so the effect keys on what decides the entries and
  // not on the caller object, which is a new one after every fetch.
  const {isAdmin, isDriver, isCustomer, loading} = caller

  useEffect(() => {
    if (loading) return

    const {strings} = getI18nCommon(code)
    const register = (menu: NavMenu, group: string, label?: string) => {
      const items = navFor(latest.current.caller, menu)
      if (items.length === 0) return
      latest.current.extendMenu(menu, {group, ...(label ? {label} : {}), items: toItems(items, strings)})
    }

    register('app', APP_MENU_GROUP, brand || undefined)
    register('user', USER_MENU_GROUP)

    // The version line, last in the user menu. The frame takes items with a
    // string label, not components, so the entry carries the text
    // VersionLine renders (`App 1.0.0 · abc1234`) and nothing to click: no
    // path, no onClick, the frame draws it as an inert ghost button after
    // Einstellungen and before the Abmelden group. Registered for every
    // signed-in person, roles or not, because "which app is this" is the
    // first question support asks.
    latest.current.extendMenu('user', {
      group: USER_MENU_GROUP,
      items: {
        version: {label: versionLineText(), icon: FaInfoCircle, order: 900}
      }
    })
  }, [isAdmin, isDriver, isCustomer, loading, code, brand])
}
