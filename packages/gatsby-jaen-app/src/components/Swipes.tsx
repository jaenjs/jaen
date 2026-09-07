/**
 * The swipes, okf/architecture/navigation.md, "Swipes".
 *
 * Owner, 2026-09-06: on a main view a swipe left or right changes the view,
 * in sub views the swipe back stays. This is the gesture layer around the
 * page content, mounted in AppShell inside the pull to refresh, and it does
 * two things, below `md` only.
 *
 * On a bar view, one of the places of the glass tab bar (the same table the
 * bar reads, `tabsFor` of GlassTabBar.tsx), a horizontal swipe of at least
 * 60 px with more horizontal than vertical travel moves to the neighbouring
 * place: right to left to the next place, left to right to the previous,
 * mirrored under rtl. The places form a ring (navigation.md, "The ring"):
 * the neighbour of the first place backwards is the last place, Ich, and
 * the neighbour of the last place forwards is the first, so no swipe on a
 * bar view is a dead end. The bar's pill follows the swipe place for place
 * (`dragPill`), on the two wrapping swipes out through the bar's edge and,
 * once the travel would commit, at the far end of the bar (`ringDrag`),
 * springs into the new place on release (`pressPill`, the very thing a tap
 * does) and the new view mounts as on a tap, through gatsby's navigate. The
 * view swipe exists while the bar is on: the places are the bar's, and
 * without the bar nothing on the screen would say where a swipe leads.
 *
 * On a sub view, anything whose path is not a place of the bar, a detail
 * page, a settings page, the horizontal swipe does nothing except the edge
 * swipe back: a drag that starts within 24 px of the leading edge and
 * travels 80 px towards the centre navigates back through `history.back`,
 * the page following the finger the way iOS does it, sliding out on release
 * past the threshold and snapping back before it. The edge swipe exists in
 * app mode, where the installed app has no browser gesture of its own. In a
 * tab the edge is the browser's.
 *
 * The gesture is not taken when it starts inside a horizontally scrollable
 * element (the DataTable's scroll area, a carousel), on the map, on a
 * slider, in a popover or a menu, in a text field, and never while a dialog
 * or a drawer is open. Vertical travel before the slop hands the touch to
 * the scroll. Once the layer has claimed a touch it cancels the browser's
 * scroll and stops the event before anything below sees it: the listeners
 * sit on the shell's `main` in the capture phase, so a horizontal swipe
 * with a little vertical drift never becomes a pull of PullToRefresh, and a
 * card under the finger never opens.
 *
 * Reduced motion: the page does not follow the finger and the back is
 * plain, the pill does not follow and fades into its place, the bar's own
 * rule.
 */
import React, {useEffect, useRef} from 'react'
import {Box} from '@chakra-ui/react'
import {navigate} from 'gatsby'
import {useCaller} from '../../shared/auth'
import {useI18nCode} from '../../shared/i18n'
import type {NavItem} from './nav'
import {
  dragPill,
  pressPill,
  tabsFor,
  useAppMode,
  useGlassTabBarActive
} from './GlassTabBar'

/** Finger travel that moves to the neighbouring bar place. */
export const VIEW_SWIPE_PX = 60
/** A back swipe starts this close to the leading edge. */
export const EDGE_ZONE_PX = 24
/** And travels this far towards the centre. */
export const EDGE_BACK_PX = 80
/** Finger travel before the direction of a touch is decided. */
const SLOP = 10
/** The page slides out this long past the threshold, and back this long before it. */
const LEAVE_MS = 220
const SNAP_MS = 200

const BELOW_MD = '(max-width: 47.99em)'
const REDUCED = '(prefers-reduced-motion: reduce)'
const OPEN_LAYER =
  '[data-scope="dialog"][data-part="content"][data-state="open"], [data-scope="drawer"][data-part="content"][data-state="open"]'
/** Where a horizontal touch belongs to the element and not to the layer. */
const NOT_TAKEN = [
  '.mapboxgl-map',
  '[role="slider"]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[data-scope="slider"]',
  '[data-scope="popover"]',
  '[data-scope="menu"]',
  '[data-scope="carousel"]',
  '[data-swipe="none"]'
].join(', ')

const matches = (query: string): boolean => {
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

const pathOf = (item: NavItem): string =>
  (item.path.split('#')[0] ?? item.path).replace(/\/$/, '')

/** The place of the page in the bar, -1 on a sub view. Exact, a detail route is no place. */
export const placeOf = (items: NavItem[], pathname: string): number => {
  const path = pathname.replace(/\/$/, '')
  return items.findIndex(item => pathOf(item) === path)
}

/**
 * The place a step lands on, around the ring: one past the last place is the
 * first, one before the first is the last.
 */
export const ringNeighbour = (
  from: number,
  count: number,
  step: 1 | -1
): number => (from + step + count) % count

/**
 * The pill's offset from its place, in places, under a finger. Between two
 * places it is the finger's travel. From the first place backwards and from
 * the last place forwards, the two swipes that wrap, the pill follows the
 * finger out through the bar's edge until the travel reaches the threshold
 * that commits the swipe, and from there it stands at the far end of the
 * bar, one whole ring away, so what the bar shows is always the place a
 * release lands on. The bar clips the pill at its edge, the capsule has
 * overflow hidden, and draws any offset, so nothing there needs to know.
 */
export const ringDrag = (
  travel: number,
  from: number,
  count: number,
  threshold: number
): number => {
  const wraps =
    count > 1 &&
    ((from === 0 && travel < 0) || (from === count - 1 && travel > 0))
  if (!wraps || Math.abs(travel) < threshold) return travel
  return travel < 0 ? travel + count : travel - count
}

/** True when something between the target and the host scrolls sideways. */
const scrollsSideways = (
  target: Element | null,
  host: HTMLElement
): boolean => {
  for (let el = target; el && el !== host; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const {overflowX} = getComputedStyle(el)
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
  }
  return false
}

/** The width of one place of the bar, measured on the pill, else derived. */
const placeWidth = (count: number): number => {
  const pill = document.querySelector('[data-testid="glass-tab-bar-pill"]')
  const measured = pill?.getBoundingClientRect().width ?? 0
  if (measured > 0) return measured
  // The bar's width less its side margins and padding, over the places.
  return Math.max(1, (window.innerWidth - 24 - 12) / Math.max(1, count))
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

type Mode = 'none' | 'view' | 'back'

interface Gesture {
  mode: Mode
  claimed: boolean
  reduced: boolean
  rtl: boolean
  x0: number
  y0: number
  dx: number
  dy: number
  /** View mode: the page's place, the bar's items and the width of a place. */
  from: number
  items: NavItem[]
  pillW: number
}

const idle = (): Gesture => ({
  mode: 'none',
  claimed: false,
  reduced: false,
  rtl: false,
  x0: 0,
  y0: 0,
  dx: 0,
  dy: 0,
  from: -1,
  items: [],
  pillW: 1
})

export interface SwipesProps {
  children: React.ReactNode
}

export function Swipes({children}: SwipesProps) {
  const caller = useCaller()
  const code = useI18nCode()
  const appMode = useAppMode()
  const barOn = useGlassTabBarActive()
  const box = useRef<HTMLDivElement>(null)

  // The listeners are bound once and read the latest values through the ref.
  const live = useRef({caller, rtl: code === 'ar-EG', appMode, barOn})
  live.current = {caller, rtl: code === 'ar-EG', appMode, barOn}
  const gesture = useRef<Gesture>(idle())
  // The slide out or the snap back that is still playing, and whether one is.
  const settling = useRef<number>(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    // The shell's main, so a touch on the canvas below a short page counts,
    // and the capture phase, so a claimed touch is stopped before the pull
    // and the content see it.
    const host: HTMLElement = el.closest('main') ?? el

    const clear = () => {
      el.style.transition = ''
      el.style.transform = ''
      el.style.boxShadow = ''
      el.style.willChange = ''
      el.dataset.swipes = 'idle'
    }

    const onStart = (e: TouchEvent) => {
      const g = (gesture.current = idle())
      if (e.touches.length !== 1 || settling.current) return
      if (!matches(BELOW_MD)) return
      if (document.querySelector(OPEN_LAYER)) return
      const target = e.target as Element | null
      if (target?.closest?.(NOT_TAKEN)) return
      if (target && scrollsSideways(target, host)) return
      const {caller: who, rtl, appMode: installed, barOn: bar} = live.current
      const touch = e.touches[0]!
      const items = tabsFor(who)
      const place = placeOf(items, window.location.pathname)
      if (place >= 0) {
        // A bar view: the swipe between the places, while the bar is there.
        if (!bar) return
        g.mode = 'view'
        g.from = place
        g.items = items
        g.pillW = placeWidth(items.length)
      } else {
        // A sub view: the edge swipe back, in the installed app.
        if (!installed) return
        const width = window.innerWidth
        const atEdge = rtl
          ? touch.clientX >= width - EDGE_ZONE_PX
          : touch.clientX <= EDGE_ZONE_PX
        if (!atEdge) return
        g.mode = 'back'
      }
      g.rtl = rtl
      g.reduced = matches(REDUCED)
      g.x0 = touch.clientX
      g.y0 = touch.clientY
    }

    const onMove = (e: TouchEvent) => {
      const g = gesture.current
      if (g.mode === 'none' || e.touches.length !== 1) return
      const touch = e.touches[0]!
      g.dx = touch.clientX - g.x0
      g.dy = touch.clientY - g.y0
      if (!g.claimed) {
        const ax = Math.abs(g.dx)
        const ay = Math.abs(g.dy)
        if (ay > SLOP && ay > ax) {
          // The scroll's, not ours.
          g.mode = 'none'
          return
        }
        if (ax <= SLOP || ax < ay) return
        if (!e.cancelable) {
          // The browser is already scrolling something, too late to take it.
          g.mode = 'none'
          return
        }
        g.claimed = true
        el.dataset.swipes = g.mode
        if (g.mode === 'back' && !g.reduced) {
          el.style.transition = 'none'
          el.style.willChange = 'transform'
        }
      }
      if (e.cancelable) e.preventDefault()
      e.stopPropagation()
      if (g.reduced) return
      const sign = g.rtl ? -1 : 1
      if (g.mode === 'view') {
        // Towards the next place is against the finger: the finger pulls the
        // next view in from the end side, the pill walks to the end side. On
        // the ring every place has a neighbour on both sides, so the pill
        // follows a whole place either way, out through the edge and on to
        // the far end when the swipe wraps.
        const towardNext = clamp((-g.dx * sign) / g.pillW, -1, 1)
        dragPill(
          ringDrag(towardNext, g.from, g.items.length, VIEW_SWIPE_PX / g.pillW)
        )
      } else {
        const travel = Math.max(0, g.dx * sign)
        el.style.transform = `translateX(${sign * travel}px)`
        el.style.boxShadow =
          travel > 0 ? `${-sign * 8}px 0 24px rgba(0, 0, 0, 0.18)` : ''
      }
    }

    const finish = (e: TouchEvent, cancelled: boolean) => {
      const g = gesture.current
      if (g.mode === 'none') return
      const mode = g.mode
      g.mode = 'none'
      if (!g.claimed) return
      e.stopPropagation()
      const sign = g.rtl ? -1 : 1
      const horizontal = !cancelled && Math.abs(g.dx) > Math.abs(g.dy)
      if (mode === 'view') {
        const towardNext = -g.dx * sign
        // The neighbour around the ring: past Ich comes the first place,
        // before the first place comes Ich. One place alone has no ring.
        const target =
          horizontal &&
          g.items.length > 1 &&
          Math.abs(towardNext) >= VIEW_SWIPE_PX
            ? g.items[
                ringNeighbour(g.from, g.items.length, towardNext > 0 ? 1 : -1)
              ]
            : undefined
        // The pill sets off with the release, as it does with a tap, and the
        // drag is let go in the same frame so it springs from where it stood.
        if (target) pressPill(target.path)
        dragPill(0)
        el.dataset.swipes = 'idle'
        if (target) void navigate(target.path)
        return
      }
      const back = horizontal && g.dx * sign >= EDGE_BACK_PX
      if (g.reduced) {
        clear()
        if (back) window.history.back()
        return
      }
      const ms = back ? LEAVE_MS : SNAP_MS
      el.style.transition = `transform ${ms}ms ${back ? 'ease-out' : 'ease'}, box-shadow ${ms}ms ease`
      el.style.transform = back ? `translateX(${sign * 100}%)` : 'translateX(0)'
      if (!back) el.style.boxShadow = ''
      el.dataset.swipes = back ? 'leaving' : 'snapping'
      settling.current = window.setTimeout(() => {
        settling.current = 0
        if (!back) {
          clear()
          return
        }
        // The page stays out while history moves, the new page mounts its
        // own shell and this one goes with the old. When nothing moves,
        // there was no page to go back to, the page comes back.
        const before = window.location.pathname
        window.history.back()
        settling.current = window.setTimeout(() => {
          settling.current = 0
          if (window.location.pathname === before) {
            el.style.transition = `transform ${SNAP_MS}ms ease`
            el.style.transform = 'translateX(0)'
            settling.current = window.setTimeout(() => {
              settling.current = 0
              clear()
            }, SNAP_MS + 20)
          }
        }, 700)
      }, ms + 20)
    }

    const onEnd = (e: TouchEvent) => finish(e, false)
    const onCancel = (e: TouchEvent) => finish(e, true)

    host.addEventListener('touchstart', onStart, {capture: true, passive: true})
    host.addEventListener('touchmove', onMove, {capture: true, passive: false})
    host.addEventListener('touchend', onEnd, {capture: true})
    host.addEventListener('touchcancel', onCancel, {capture: true})
    return () => {
      host.removeEventListener('touchstart', onStart, {capture: true})
      host.removeEventListener('touchmove', onMove, {capture: true})
      host.removeEventListener('touchend', onEnd, {capture: true})
      host.removeEventListener('touchcancel', onCancel, {capture: true})
      if (settling.current) window.clearTimeout(settling.current)
      dragPill(0)
    }
  }, [])

  return (
    <Box ref={box} data-swipes="idle">
      {children}
    </Box>
  )
}
