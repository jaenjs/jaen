/**
 * The navigation, as one table.
 *
 * Every entry says which of jaen's two frame menus it lives in and which
 * roles may use it. AppFrameMenu registers an entry when the caller holds any
 * of its roles, so a person who is both a driver and a customer sees both
 * sets. The backend enforces what each screen may then read, this table only
 * decides what is offered. See okf/architecture/navigation.md.
 *
 * `app` is the TOP LEFT menu of the jaen frame, the application: the screens.
 * `user` is the TOP RIGHT menu, the person: their own page and what the
 * frame itself puts there (Einstellungen, Abmelden).
 *
 * The glass tab bar (GlassTabBar.tsx) is a third place with a composition of
 * its own: `bar` names the place, 1 to 5, an entry takes for a role. It is
 * not "the first four of the drawer": the owner wants the billing screen in
 * the middle of the dispatcher's bar and Standorte within reach of the thumb
 * while Buchungen stays in the drawer, see navigation.md, "The bar's five
 * places, by role". `barFor` composes the bar for a caller.
 *
 * Paths are absolute and carry the trailing slash the sites build with
 * (`trailingSlash: 'always'`), because the frame marks the entry of the page
 * you are on by comparing `location.pathname` with the path verbatim.
 */
import type {IconType} from '@react-icons/all-files/lib'
import {FaTachometerAlt} from '@react-icons/all-files/fa/FaTachometerAlt'
import {FaExchangeAlt} from '@react-icons/all-files/fa/FaExchangeAlt'
import {FaUsers} from '@react-icons/all-files/fa/FaUsers'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaMapMarkerAlt} from '@react-icons/all-files/fa/FaMapMarkerAlt'
import {FaRoute} from '@react-icons/all-files/fa/FaRoute'
import {FaUserCircle} from '@react-icons/all-files/fa/FaUserCircle'
import {FaCalendarCheck} from '@react-icons/all-files/fa/FaCalendarCheck'
import {FaFileInvoice} from '@react-icons/all-files/fa/FaFileInvoice'
import {FaBell} from '@react-icons/all-files/fa/FaBell'
import type {Caller} from '../../shared/auth'
import type {getI18nCommon} from '../../shared/locales/i18nCommon'

type CommonStrings = ReturnType<typeof getI18nCommon>['strings']

export type NavRole = 'admin' | 'driver' | 'customer'

export type NavMenu = 'app' | 'user'

export interface NavItem {
  /** The item id inside the frame's group. Stable, so re-registering merges. */
  id: string
  /** Which of the frame's two menus. */
  menu: NavMenu
  /** Absolute, with the trailing slash. A hash is allowed and ignored for matching. */
  path: string
  /** The key into the common catalogue, so the label follows the language. */
  label: keyof CommonStrings
  icon: IconType
  roles: NavRole[]
  /** Sort key inside the group, ascending. */
  order: number
  /**
   * The place in the glass tab bar per role, 1 to 5, absent when the entry is
   * not in that role's bar. Ordered by place, not by `order`.
   */
  bar?: Partial<Record<NavRole, number>>
}

export const NAV_ITEMS: NavItem[] = [
  // The app, top left.
  {
    id: 'dashboard',
    menu: 'app',
    path: '/app/dashboard/',
    label: 'NavDashboard',
    icon: FaTachometerAlt,
    roles: ['admin'],
    order: 10,
    bar: {admin: 1}
  },
  {
    id: 'transfers',
    menu: 'app',
    path: '/app/transfers/',
    label: 'NavTransfers',
    icon: FaExchangeAlt,
    roles: ['admin'],
    order: 20,
    bar: {admin: 2}
  },
  // The driver's list is the transfers screen scoped to them by the backend,
  // so it is the same route under a different name. Deduped by path, first
  // entry wins, so an admin who also drives reads "Transfers".
  {
    id: 'transfers',
    menu: 'app',
    path: '/app/transfers/',
    label: 'NavMyRides',
    icon: FaRoute,
    roles: ['driver'],
    order: 20,
    bar: {driver: 1}
  },
  {
    id: 'booking',
    menu: 'app',
    path: '/app/booking/',
    label: 'NavBookings',
    icon: FaCalendarCheck,
    roles: ['admin', 'customer'],
    order: 30,
    // The admin keeps Buchungen in the drawer and not in the bar, where the
    // middle place is the billing screen's. The offers screen has no entry of
    // its own any more: it is the customer half of the billing screen, and
    // /app/offers/ redirects there (finance.md, "The billing screen").
    bar: {customer: 1}
  },
  {
    id: 'locations',
    menu: 'app',
    path: '/app/locations/',
    label: 'NavLocations',
    icon: FaMapMarkerAlt,
    // A customer sees the drivers of their own live rides on the same route,
    // scoped by the backend per booking (customer-experience.md, section 2).
    roles: ['admin', 'driver', 'customer'],
    order: 40,
    bar: {admin: 4, driver: 2, customer: 2}
  },
  {
    id: 'fleet',
    menu: 'app',
    path: '/app/fleet/',
    label: 'NavFleet',
    icon: FaCar,
    roles: ['admin'],
    order: 50
  },
  {
    id: 'users',
    menu: 'app',
    path: '/app/users/',
    label: 'NavUsers',
    icon: FaUsers,
    roles: ['admin'],
    order: 60
  },
  {
    id: 'statements',
    menu: 'app',
    path: '/app/statements/',
    // The billing screen, Abrechnungen: the dispatcher's middle place.
    label: 'NavStatements',
    icon: FaFileInvoice,
    roles: ['admin', 'driver', 'customer'],
    order: 70,
    bar: {admin: 3, driver: 3, customer: 3}
  },

  // The person, top right. Einstellungen and Abmelden are the frame's own
  // entries (gatsby-plugin-jaen/src/pages/settings.tsx and logout.tsx
  // register themselves through their pageConfig), so they are not repeated
  // here.
  {
    id: 'me',
    menu: 'user',
    path: '/app/me/',
    label: 'NavMe',
    icon: FaUserCircle,
    roles: ['admin', 'driver', 'customer'],
    order: 10,
    bar: {admin: 5, driver: 4, customer: 4}
  },
  // The push switch is a card on the Me page, not a page of its own.
  {
    id: 'notifications',
    menu: 'user',
    path: '/app/me/#notifications',
    label: 'NavNotifications',
    icon: FaBell,
    roles: ['driver'],
    order: 20
  }
]

export const rolesOf = (caller: Caller): NavRole[] => {
  const roles: NavRole[] = []
  if (caller.isAdmin) roles.push('admin')
  if (caller.isDriver) roles.push('driver')
  if (caller.isCustomer) roles.push('customer')
  return roles
}

/** The entries this caller may use, first come first served on a shared path. */
export const navFor = (caller: Caller, menu?: NavMenu): NavItem[] => {
  const roles = rolesOf(caller)
  const seen = new Set<string>()
  return NAV_ITEMS.filter(item => {
    if (menu && item.menu !== menu) return false
    if (!item.roles.some(r => roles.includes(r))) return false
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}

/**
 * The glass tab bar's entries for this caller, by place. The composition is
 * the one of the caller's first role in the order admin, driver, customer,
 * the same precedence the drawers give a shared path, so an admin who also
 * drives reads the dispatcher's bar. A caller without any of the three roles
 * has no bar.
 */
export const barFor = (caller: Caller): NavItem[] => {
  const role = rolesOf(caller)[0]
  if (!role) return []
  return NAV_ITEMS.filter(
    item => item.roles.includes(role) && item.bar?.[role] !== undefined
  ).sort((a, b) => (a.bar?.[role] ?? 0) - (b.bar?.[role] ?? 0))
}

const pathOf = (item: NavItem): string => item.path.split('#')[0] ?? item.path

/** /app/transfers/abc/ is inside /app/transfers/, /app/transfersx/ is not. */
export const isActivePath = (currentPath: string, item: NavItem): boolean => {
  const base = pathOf(item).replace(/\/$/, '')
  return (
    currentPath === base ||
    currentPath === `${base}/` ||
    currentPath.startsWith(`${base}/`)
  )
}

/**
 * The entry the current path belongs to, for the page title. Both menus are
 * searched, so /app/me/ is titled "Ich" although it lives in the user menu.
 */
export const activeItem = (
  currentPath: string,
  caller: Caller
): NavItem | undefined =>
  navFor(caller).find(item => isActivePath(currentPath, item))
