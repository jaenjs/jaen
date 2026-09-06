/**
 * The glass tab bar, the one from okf/architecture/navigation.md, "A bottom
 * bar again, only if it feels native".
 *
 * It exists in app mode only, that is when the PWA runs installed
 * (`display-mode: standalone`, or `navigator.standalone` on an iPhone), never
 * in a browser tab, and only while the switch "Untere Leiste" on the Me page
 * is on, per device, `localStorage limosen:glassTabBar`, default off. Both
 * gates live in this file as hooks, so the Me page's switch and the shell's
 * bottom padding read the very same two answers the bar reads.
 *
 * The bar that was removed on 2026-09-05 is no model for it. This one is a
 * floating capsule 56px tall, 16px above the safe area with 12px side
 * margins, frosted with `blur(24px) saturate(1.6)` over a translucent tint
 * that follows the colour mode (`bg/70` light, `bg/60` dark), one 0.5px
 * highlight along its top edge, 24px icons over 11px labels, and an active
 * pill in `colorPalette.solid/20` that slides to the tapped entry with a
 * 320ms spring. Scrolling down past 24px collapses it to a compact pill,
 * scrolling up or reaching the top expands it, and it steps out of the way
 * while a dialog or a drawer is open. Reduced motion turns the spring into a
 * fade. Below `md` only, the drawers stay as they are, and the bar carries
 * the same role-filtered entries they do, see nav.ts.
 *
 * The styles are one inline slot recipe, `useSlotRecipe({recipe})`, so the
 * collapsed and the hidden state are variants and not a pile of ternaries,
 * and nothing is registered into jaen's system: the app mounts no provider
 * of its own, see AppShell.tsx.
 *
 * What a browser cannot do is the refraction of real Liquid Glass. The owner's
 * thumb on the phone decides whether this stays, not a screenshot.
 */
import {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import {Box, chakra, defineSlotRecipe, useSlotRecipe, type SystemStyleObject} from '@chakra-ui/react'
import {navigate} from 'gatsby'
import {useCaller, type Caller} from '../../shared/auth'
import {useI18nCode} from '../../shared/i18n'
import {getI18nCommon} from '../../shared/locales/i18nCommon'
import {getI18nTabBar} from '../../shared/locales/i18nTabBar'
import {isActivePath, navFor, type NavItem} from './nav'

// --------------- The two gates ---------------

/** The per-device switch, `'1'` while on. Read by the Me page and the shell too. */
export const GLASS_TAB_BAR_KEY = 'limosen:glassTabBar'

/** The bar's height plus its 16px above the safe area, plus a little air. */
export const GLASS_TAB_BAR_HEIGHT = 56
export const GLASS_TAB_BAR_CLEARANCE = `calc(${GLASS_TAB_BAR_HEIGHT + 16 + 12}px + env(safe-area-inset-bottom, 0px))`

const STANDALONE_QUERY = '(display-mode: standalone)'

const isAppModeNow = (): boolean => {
  try {
    if (window.matchMedia?.(STANDALONE_QUERY).matches) return true
    // Safari on iOS: no display-mode until iOS 26, but this flag since forever.
    return (navigator as Navigator & {standalone?: boolean}).standalone === true
  } catch {
    return false
  }
}

const subscribeAppMode = (onChange: () => void) => {
  try {
    const mq = window.matchMedia(STANDALONE_QUERY)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  } catch {
    return () => {}
  }
}

const never = () => false

/**
 * True when the PWA runs installed. False on the server and during hydration,
 * so the markup agrees with what was rendered, and true from the first client
 * render after it.
 */
export const useAppMode = (): boolean => useSyncExternalStore(subscribeAppMode, isAppModeNow, never)

const listeners = new Set<() => void>()

const readEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(GLASS_TAB_BAR_KEY) === '1'
  } catch {
    // No storage, no bar: the default is off and that is what is returned.
    return false
  }
}

const subscribeEnabled = (onChange: () => void) => {
  listeners.add(onChange)
  // Another tab of the same site flipping the switch.
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

export const setGlassTabBarEnabled = (on: boolean) => {
  try {
    if (on) window.localStorage.setItem(GLASS_TAB_BAR_KEY, '1')
    else window.localStorage.removeItem(GLASS_TAB_BAR_KEY)
  } catch {
    // Storage refused: the switch springs back, because the read below says off.
  }
  listeners.forEach(fn => fn())
}

/** The switch's own value, off by default and off on the server. */
export const useGlassTabBarEnabled = (): boolean => useSyncExternalStore(subscribeEnabled, readEnabled, never)

/**
 * The one answer the shell needs: app mode and the switch on. The breakpoint
 * is not part of it, the bar and the padding both hide themselves at `md`
 * in CSS so a rotation never has to re-render the page.
 */
export const useGlassTabBarActive = (): boolean => {
  const appMode = useAppMode()
  const enabled = useGlassTabBarEnabled()
  return appMode && enabled
}

// --------------- The entries ---------------

/** iOS gives a tab bar five places. The app menu's first four by order, then Me. */
const MAX_TABS = 5

/**
 * The same table as the drawers, role filtered, both menus, hash entries
 * dropped (the notifications entry is a card on the Me page and would be a
 * second tab to the same screen), the app menu first and the person's page
 * last.
 */
export const tabsFor = (caller: Caller): NavItem[] => {
  const seen = new Set<string>()
  const app = navFor(caller, 'app').filter(item => !item.path.includes('#'))
  const me = navFor(caller, 'user').filter(item => !item.path.includes('#'))
  return [...app.slice(0, MAX_TABS - Math.min(1, me.length)), ...me.slice(0, 1)].filter(item => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}

// --------------- The recipe ---------------

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const FROST = 'blur(24px) saturate(1.6)'

/**
 * Safari still wants the prefix on backdrop-filter, and the style object's
 * type knows the standard name only, so the prefixed one is passed through
 * untyped. The css function hands unknown properties on as they are.
 */
const FROST_PREFIXED = {WebkitBackdropFilter: FROST} as unknown as SystemStyleObject

const tabBarRecipe = defineSlotRecipe({
  className: 'glass-tab-bar',
  slots: ['root', 'list', 'pill', 'item', 'icon', 'label'],
  base: {
    root: {
      position: 'fixed',
      zIndex: 'docked',
      insetInline: 0,
      marginInline: 'auto',
      // 16px above the home indicator, the side margins come out of the width.
      bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      width: 'calc(100% - 24px)',
      height: `${GLASS_TAB_BAR_HEIGHT}px`,
      padding: '6px',
      // Above md the drawers alone carry the navigation.
      display: {base: 'flex', md: 'none'},
      alignItems: 'stretch',
      borderRadius: 'full',
      overflow: 'hidden',
      // The frosting, both spellings.
      backdropFilter: FROST,
      ...FROST_PREFIXED,
      bg: 'bg/70',
      // One 0.5px highlight along the top edge, and a soft lift off the page.
      boxShadow: 'inset 0 0.5px 0 0 rgba(255, 255, 255, 0.65), 0 8px 32px rgba(0, 0, 0, 0.12)',
      _dark: {
        bg: 'bg/60',
        boxShadow: 'inset 0 0.5px 0 0 rgba(255, 255, 255, 0.18), 0 8px 32px rgba(0, 0, 0, 0.45)'
      },
      transitionProperty: 'width, height, transform, opacity',
      transitionDuration: '320ms',
      transitionTimingFunction: SPRING,
      _motionReduce: {transitionProperty: 'opacity', transitionDuration: '200ms', transitionTimingFunction: 'ease'}
    },
    list: {
      position: 'relative',
      flex: 1,
      display: 'flex',
      alignItems: 'stretch',
      minWidth: 0
    },
    pill: {
      position: 'absolute',
      insetBlock: 0,
      insetInlineStart: 0,
      borderRadius: 'full',
      bg: 'colorPalette.solid/20',
      pointerEvents: 'none',
      transitionProperty: 'transform, width',
      transitionDuration: '320ms',
      transitionTimingFunction: SPRING,
      _motionReduce: {
        transitionProperty: 'none',
        animationName: 'fade-in',
        animationDuration: '200ms',
        animationTimingFunction: 'ease-out'
      }
    },
    item: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2px',
      color: 'fg.muted',
      bg: 'transparent',
      border: 'none',
      borderRadius: 'full',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      userSelect: 'none',
      transitionProperty: 'color',
      transitionDuration: '200ms',
      '&[aria-current="page"]': {color: 'colorPalette.fg'},
      _focusVisible: {outline: '2px solid', outlineColor: 'colorPalette.focusRing', outlineOffset: '-2px'}
    },
    icon: {
      display: 'inline-flex',
      flexShrink: 0,
      boxSize: '24px',
      fontSize: '24px',
      lineHeight: 1,
      '& svg': {boxSize: 'full'},
      transitionProperty: 'width, height, font-size',
      transitionDuration: '320ms',
      transitionTimingFunction: SPRING
    },
    label: {
      fontSize: '11px',
      lineHeight: 1,
      fontWeight: 'medium',
      letterSpacing: 'tight',
      maxWidth: 'full',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      maxHeight: '11px',
      transitionProperty: 'opacity, max-height',
      transitionDuration: '200ms'
    }
  },
  variants: {
    collapsed: {
      true: {
        // The compact pill: narrower, lower, icons only.
        root: {width: 'calc(60% - 24px)', height: '40px', padding: '4px'},
        icon: {boxSize: '20px', fontSize: '20px'},
        label: {opacity: 0, maxHeight: 0}
      },
      false: {}
    },
    hidden: {
      true: {
        // Out of the way under the home indicator while a dialog or drawer is open.
        root: {
          transform: 'translateY(calc(100% + 32px + env(safe-area-inset-bottom, 0px)))',
          opacity: 0,
          pointerEvents: 'none'
        }
      },
      false: {}
    }
  },
  defaultVariants: {collapsed: false, hidden: false}
})

// --------------- The three observers ---------------

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const reducedNow = (): boolean => {
  try {
    return window.matchMedia(REDUCED_QUERY).matches
  } catch {
    return false
  }
}
const subscribeReduced = (onChange: () => void) => {
  try {
    const mq = window.matchMedia(REDUCED_QUERY)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  } catch {
    return () => {}
  }
}
const useReducedMotion = (): boolean => useSyncExternalStore(subscribeReduced, reducedNow, never)

/**
 * Collapse on the way down once past 24px, expand on the way up or at the
 * top. Listened for in the capture phase on the document, so a screen that
 * scrolls inside its own box counts as much as the page.
 */
const useCollapsedOnScroll = (on: boolean): boolean => {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    if (!on) return
    const last = new WeakMap<EventTarget, number>()
    const onScroll = (event: Event) => {
      const target = event.target
      if (!target) return
      const y = target === document ? window.scrollY : (target as HTMLElement).scrollTop
      if (typeof y !== 'number' || Number.isNaN(y)) return
      // A box not seen before counts from the top, so one jump of 200px
      // (a programmatic scrollBy, a hash) reads as a move down and not as
      // the place where counting starts.
      const before = last.get(target) ?? 0
      last.set(target, y)
      if (y <= 24) setCollapsed(false)
      else if (y > before) setCollapsed(true)
      else if (y < before) setCollapsed(false)
    }
    document.addEventListener('scroll', onScroll, {capture: true, passive: true})
    return () => document.removeEventListener('scroll', onScroll, {capture: true})
  }, [on])
  return on && collapsed
}

const OVERLAY_OPEN =
  '[data-scope="dialog"][data-part="content"][data-state="open"], [data-scope="drawer"][data-part="content"][data-state="open"]'

/** True while a Chakra dialog or drawer is open anywhere on the page. */
const useOverlayOpen = (on: boolean): boolean => {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!on) return
    let frame = 0
    const look = () => {
      frame = 0
      setOpen(document.querySelector(OVERLAY_OPEN) !== null)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(look)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-state']})
    look()
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [on])
  return on && open
}

/**
 * Where the pill stood when the last bar unmounted. Every /app page mounts
 * its own shell (src/AppWrapper.tsx), so a navigation is a new bar, and
 * without this the pill would appear at the new entry instead of sliding
 * there: the new bar renders once at the remembered place and moves in its
 * first effect, so the 320ms spring plays across the page change.
 */
let lastIndex = -1

const usePillIndex = (index: number): number => {
  const [shown, setShown] = useState(lastIndex >= 0 && index >= 0 ? lastIndex : index)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(index))
    return () => window.cancelAnimationFrame(frame)
  }, [index])
  useEffect(() => {
    if (index >= 0) lastIndex = index
  }, [index])
  return shown
}

/** The path of the page, read on mount and after every history move. */
const usePathname = (): string => {
  const [path, setPath] = useState('')
  useEffect(() => {
    const read = () => setPath(window.location.pathname)
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])
  return path
}

// --------------- The bar ---------------

export function GlassTabBar() {
  const active = useGlassTabBarActive()
  return active ? <Bar /> : null
}

function Bar() {
  const caller = useCaller()
  const code = useI18nCode()
  const {strings: common} = getI18nCommon(code)
  const {strings} = getI18nTabBar(code)
  const items = useMemo(() => tabsFor(caller), [caller])
  const pathname = usePathname()
  const collapsed = useCollapsedOnScroll(true)
  const hidden = useOverlayOpen(true)
  const reduced = useReducedMotion()

  // The tapped entry wins over the path until the route has moved, so the
  // pill sets off with the tap and not with the page.
  const [tapped, setTapped] = useState<string | null>(null)
  useEffect(() => setTapped(null), [pathname])
  const index = useMemo(() => {
    const byTap = tapped ? items.findIndex(item => item.path === tapped) : -1
    if (byTap >= 0) return byTap
    return items.findIndex(item => isActivePath(pathname, item))
  }, [items, pathname, tapped])

  const pillIndex = usePillIndex(index)

  const recipe = useSlotRecipe({recipe: tabBarRecipe})
  const styles = recipe({collapsed, hidden})

  const rtl = code === 'ar-EG'
  const count = Math.max(1, items.length)

  const go = useCallback(
    (item: NavItem) => {
      setTapped(item.path)
      void navigate(item.path)
    },
    []
  )

  if (items.length === 0) return null

  return (
    <chakra.nav
      aria-label={strings.NavLabel}
      aria-hidden={hidden || undefined}
      data-testid="glass-tab-bar"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-hidden={hidden ? 'true' : 'false'}
      colorPalette="brand"
      css={styles.root}>
      <Box css={styles.list}>
        {pillIndex >= 0 && (
          <Box
            data-testid="glass-tab-bar-pill"
            data-index={pillIndex}
            // Under reduced motion the pill is remounted per entry, so the
            // fade plays instead of the slide. With motion the key is fixed
            // and the transform transition carries it across.
            key={reduced ? pillIndex : 'pill'}
            css={styles.pill}
            style={{
              width: `${100 / count}%`,
              transform: `translateX(${(rtl ? -1 : 1) * pillIndex * 100}%)`
            }}
          />
        )}
        {items.map((item, i) => {
          const label = common[item.label]
          const Icon = item.icon
          return (
            <chakra.button
              key={item.path}
              type="button"
              css={styles.item}
              aria-current={i === index ? 'page' : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              onClick={() => go(item)}>
              <Box as="span" css={styles.icon} aria-hidden>
                <Icon />
              </Box>
              <Box as="span" css={styles.label}>
                {label}
              </Box>
            </chakra.button>
          )
        })}
      </Box>
    </chakra.nav>
  )
}
