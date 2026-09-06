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
import {FaFileContract} from '@react-icons/all-files/fa/FaFileContract'
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
    order: 10
  },
  {
    id: 'transfers',
    menu: 'app',
    path: '/app/transfers/',
    label: 'NavTransfers',
    icon: FaExchangeAlt,
    roles: ['admin'],
    order: 20
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
    order: 20
  },
  {
    id: 'booking',
    menu: 'app',
    path: '/app/booking/',
    label: 'NavBookings',
    icon: FaCalendarCheck,
    roles: ['admin', 'customer'],
    order: 30
  },
  // The offers screen, one row per offer document, admins only (offers-and-documents.md).
  {
    id: 'offers',
    menu: 'app',
    path: '/app/offers/',
    label: 'NavOffers',
    icon: FaFileContract,
    roles: ['admin'],
    order: 35
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
    order: 40
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
    label: 'NavStatements',
    icon: FaFileInvoice,
    roles: ['admin', 'driver', 'customer'],
    order: 70
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
    order: 10
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
