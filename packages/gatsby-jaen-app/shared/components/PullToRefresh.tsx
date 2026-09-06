/**
 * Pull down to refresh, the way every native list does it.
 *
 * Below md a pull on the page while it is scrolled to the top refetches the
 * view's registered query (hooks/view-refresh.ts, the same registration the
 * RefreshButton reads). The frame's top bar never moves: it is sticky and
 * outside this component, only the page content is translated down, and the
 * indicator lives in the gap that opens between the bar and the content,
 * the way iOS lists do it under a fixed navigation bar. The pull is a
 * transform on the content box, not a scroll of the document, so the bar
 * and the drawers are untouched (design-consistency.md, rule 5b).
 *
 * The indicator follows the finger: an arrow that turns as the pull
 * approaches the threshold of 64 px and becomes the spinning refresh icon
 * past it. Release past the threshold refetches and holds the indicator for
 * at least 500 ms (useSpinning, the button's own timing), release before it
 * snaps back. The document carries `overscroll-behavior-y: contain` under the
 * app (src/styles/app.css) so the browser's own pull to refresh never
 * reloads the page, and the touchmove of a pull is cancelled here for the
 * same reason.
 *
 * No effect from md up, none while a dialog or a drawer is open, none on
 * the map screen and none on a touch that starts on a map (the map owns the
 * gesture, mapbox sets touch-action none on its canvas). Reduced motion
 * turns the snap and the hold into fades, in app.css.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react'
import {Box} from '@chakra-ui/react'
import {FaArrowDown} from '@react-icons/all-files/fa/FaArrowDown'
import {FaSyncAlt} from '@react-icons/all-files/fa/FaSyncAlt'
import {useRegisteredRefresh} from '../hooks/view-refresh'
import {useSpinning} from './RefreshButton'

/** The pull, in px of content travel, that refetches on release. */
export const PULL_THRESHOLD = 64
/** The content never travels further than this. */
export const PULL_MAX = 112
/** Finger travel before a pull is a pull and not a tap. */
const SLOP = 6
/**
 * Past the threshold the content follows the finger at this fraction, the
 * resistance of a native list. Up to the threshold it follows one to one, so
 * a pull of 120 px of finger travel is a refresh and one of 40 px is not.
 */
const RESISTANCE = 0.4

const BELOW_MD = '(max-width: 47.99em)'
const OPEN_LAYER =
  '[data-scope="dialog"][data-part="content"][data-state="open"], [data-scope="drawer"][data-part="content"][data-state="open"]'
const MAP_SCREEN = /\/app\/locations\/?$/

/** True when nothing between the target and the wrapper is scrolled down. */
const atTop = (target: Element | null, wrapper: HTMLElement): boolean => {
  const doc = document.scrollingElement ?? document.documentElement
  if (doc.scrollTop > 0 || window.scrollY > 0) return false
  for (let el = target; el && el !== wrapper; el = el.parentElement) {
    if (el.scrollTop > 0) return false
  }
  return true
}

export interface PullToRefreshProps {
  children: React.ReactNode
}

export function PullToRefresh({children}: PullToRefreshProps) {
  const registered = useRegisteredRefresh()
  const wrapper = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [pulling, setPulling] = useState(false)
  const [holding, setHolding] = useState(false)
  const [spinning, start] = useSpinning(registered?.isFetching ?? false)

  // The listeners read the latest values through refs, they are bound once.
  const live = useRef({registered, holding})
  live.current = {registered, holding}
  const gesture = useRef({startY: 0, active: false, pull: 0, eligible: false})

  // The hold ends when the fetch has ended and the minimum has passed.
  useEffect(() => {
    if (holding && !spinning) {
      setHolding(false)
      setPull(0)
    }
  }, [holding, spinning])

  const onTouchStart = useCallback((e: TouchEvent) => {
    const g = gesture.current
    g.eligible = false
    g.active = false
    const {registered: reg, holding: held} = live.current
    if (!reg || held || e.touches.length !== 1 || !wrapper.current) return
    if (!window.matchMedia(BELOW_MD).matches) return
    if (MAP_SCREEN.test(window.location.pathname)) return
    if (document.querySelector(OPEN_LAYER)) return
    const target = e.target as Element | null
    if (target?.closest?.('.mapboxgl-map')) return
    if (!atTop(target, wrapper.current)) return
    g.eligible = true
    g.startY = e.touches[0]!.clientY
    g.pull = 0
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    const g = gesture.current
    if (!g.eligible || e.touches.length !== 1) return
    const dy = e.touches[0]!.clientY - g.startY
    if (!g.active) {
      if (dy < -SLOP) {
        g.eligible = false
        return
      }
      if (dy <= SLOP) return
      if (
        !wrapper.current ||
        !atTop(e.target as Element | null, wrapper.current)
      ) {
        g.eligible = false
        return
      }
      g.active = true
      setPulling(true)
    }
    // The browser must not scroll or run its own pull while the content
    // follows the finger. The listener is registered non passive for this.
    if (e.cancelable) e.preventDefault()
    const travel = Math.max(0, dy - SLOP)
    g.pull = Math.min(
      PULL_MAX,
      travel <= PULL_THRESHOLD
        ? travel
        : PULL_THRESHOLD + (travel - PULL_THRESHOLD) * RESISTANCE
    )
    setPull(g.pull)
  }, [])

  const onTouchEnd = useCallback(() => {
    const g = gesture.current
    const wasActive = g.active
    g.eligible = false
    g.active = false
    if (!wasActive) return
    setPulling(false)
    if (g.pull >= PULL_THRESHOLD && live.current.registered) {
      setHolding(true)
      setPull(PULL_THRESHOLD)
      start()
      live.current.registered.refetch()
    } else {
      setPull(0)
    }
    g.pull = 0
  }, [start])

  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, {passive: true})
    el.addEventListener('touchmove', onTouchMove, {passive: false})
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  const progress = Math.min(1, pull / PULL_THRESHOLD)
  const armed = holding || pull >= PULL_THRESHOLD
  const shown = pull > 0 || holding

  return (
    <Box
      ref={wrapper}
      position="relative"
      data-pull-to-refresh={holding ? 'holding' : pulling ? 'pulling' : 'idle'}>
      {/* The gap between the bar and the content, exactly as tall as the
          pull, with the indicator centred in it. Height and opacity change on
          every frame of a pull and are inline for that, not a class per value. */}
      <Box
        position="absolute"
        top="0"
        insetX="0"
        display="flex"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        pointerEvents="none"
        aria-hidden={!shown}
        data-pull-indicator={shown ? (armed ? 'armed' : 'pulling') : 'hidden'}
        className={`app-pull-indicator${pulling ? ' app-pull-live' : ''}`}
        style={{
          height: `${pull}px`,
          opacity: shown ? Math.max(0.3, progress) : 0
        }}
        color={armed ? 'colorPalette.solid' : 'fg.muted'}
        colorPalette="brand"
        fontSize="lg">
        {armed ? (
          <FaSyncAlt
            className={holding || spinning ? 'app-refresh-spinning' : undefined}
          />
        ) : (
          <FaArrowDown
            style={{transform: `rotate(${Math.round(progress * 180)}deg)`}}
          />
        )}
      </Box>
      <Box
        className={`app-pull-content${pulling ? ' app-pull-live' : ''}`}
        data-pull-content
        style={{transform: pull ? `translateY(${pull}px)` : undefined}}>
        {children}
      </Box>
    </Box>
  )
}
