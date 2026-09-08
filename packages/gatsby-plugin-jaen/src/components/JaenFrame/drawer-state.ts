/**
 * Which of the frame's two drawers stands, and the gesture router that keeps
 * their buttons reachable while one of them does.
 *
 * Written 2026-09-08 against the measurement in
 * `docs/architecture/editing-performance.md`, "The drawer that would not
 * open". Three facts of that measurement are the whole reason this file
 * exists, and each one is answered below.
 *
 * 1. **While a drawer stands, a click on either drawer button reaches
 *    nothing.** 56 of 56 gestures produced no `pointerdown`, no `mousedown`
 *    and no `click` on the button, because Ark's modal dialog puts
 *    `pointer-events: none` on the body, `aria-hidden` on `#___gatsby` and a
 *    backdrop over the whole viewport, and because each 320px panel covers
 *    its own trigger. So the gesture is spent dismissing the standing drawer
 *    and the drawer the person asked for opens only on the next click.
 * 2. **A click inside the opening animation does nothing at all**, because
 *    the dismissable layer is not armed yet. An impatient burst therefore
 *    left the drawer exactly as the first click left it.
 * 3. **Nothing was remounting the drawers** (0 mounts in 177 windows), but the
 *    frame does re-render 53 to 59 times a second while edit mode is on, and
 *    `useDisclosure` state lives in the component that re-renders. A frame
 *    that re-renders is a normal thing, so the open state is put where a
 *    re-render, and a remount too, cannot reach it.
 *
 * The state is therefore module scope and is read through
 * `useSyncExternalStore`, which is the only React state that survives the
 * component being thrown away and built again. The two drawers share it, so
 * exactly one of them stands: a modal dialog makes the page inert, so "both
 * open" is not a state a person can reach, and making that explicit is what
 * lets one gesture go straight from one drawer to the other.
 *
 * The router is the part that could be argued with, so its reason is written
 * out. A trigger placed inside `Drawer.Root` (which is what the components do
 * now, and what they should always have done) is excluded from the layer's
 * idea of "outside" by `contains(trigger, target)`. That exclusion cannot fire
 * here: with the body inert the event's target is the `<html>` element and
 * never the button, so Ark cannot know a trigger was aimed at. Coordinates
 * survive where hit testing does not, so the frame hit tests its own two
 * trigger rectangles itself, on a `pointerdown` listener in the capture phase
 * of `window`. Capture runs window before document, and this listener is
 * registered when the frame mounts while Ark registers its own on the next
 * task after a drawer opens, so this one is reached first and
 * `stopImmediatePropagation` keeps the gesture whole instead of letting it
 * become a dismissal.
 *
 * Nothing here runs while no drawer stands. With the page not inert the
 * trigger is an ordinary button and Ark's own toggle is what opens it, which
 * is the path that already measured 109 of 109 first clicks.
 */
import {useCallback, useEffect, useSyncExternalStore} from 'react'

export type JaenFrameDrawerName = 'left' | 'right'

/**
 * How long after an open a gesture on a trigger is swallowed without changing
 * anything.
 *
 * The drawer's enter animation is 300 ms and the measurement saw the exit
 * animation finish 441 to 589 ms after a close, so a person who clicks twice
 * because the CMS answered late is inside the animation both times. Without
 * this window the second click of a burst would close what the first opened,
 * which is the behaviour the owner reported and is worse than the swallowed
 * click it replaces. 400 ms is the enter animation plus a frame's margin, and
 * it is only ever applied to a gesture aimed at a drawer's own trigger.
 */
const SETTLE_MS = 400

let openDrawer: JaenFrameDrawerName | null = null
let openedAt = 0

const listeners = new Set<() => void>()
const triggers = new Map<JaenFrameDrawerName, HTMLElement>()

const emit = () => {
  listeners.forEach(listener => {
    listener()
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => openDrawer

// The server renders no drawer, and a snapshot that is a fresh object would
// make React loop. Both of these are the same immutable value every time.
const getServerSnapshot = (): JaenFrameDrawerName | null => null

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

export const setJaenFrameDrawer = (next: JaenFrameDrawerName | null) => {
  if (next === openDrawer) return

  openDrawer = next
  openedAt = next ? now() : 0

  emit()
}

export const getJaenFrameDrawer = () => openDrawer

/**
 * The open state of one drawer, and the setter its `Drawer.Root` is given.
 *
 * The setter is stable for the life of the component, so handing it to Chakra
 * does not make the root's props change on every render of the frame.
 */
export const useJaenFrameDrawer = (name: JaenFrameDrawerName) => {
  const open =
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) === name

  const setOpen = useCallback(
    (next: boolean) => {
      setJaenFrameDrawer(next ? name : null)
    },
    [name]
  )

  return {open, setOpen}
}

/**
 * A ref callback that tells the router where this drawer's trigger is.
 *
 * The element is kept rather than its rectangle, because the header is sticky
 * and the viewport is resized, so the rectangle is read at the moment of the
 * gesture and never cached.
 */
export const useJaenFrameDrawerTrigger = (name: JaenFrameDrawerName) =>
  useCallback(
    (element: HTMLElement | null) => {
      if (element) {
        triggers.set(name, element)
      } else {
        triggers.delete(name)
      }
    },
    [name]
  )

const triggerAtPoint = (x: number, y: number): JaenFrameDrawerName | null => {
  for (const [name, element] of triggers) {
    if (!element.isConnected) continue

    const box = element.getBoundingClientRect()

    if (box.width === 0 || box.height === 0) continue

    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      return name
    }
  }

  return null
}

/**
 * The router. Mounted once by the frame, active only while a drawer stands.
 */
export const useJaenFrameDrawerRouter = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let releaseClick: (() => void) | null = null

    const swallow = (event: Event) => {
      event.preventDefault()
      event.stopImmediatePropagation()

      if (releaseClick) releaseClick()
    }

    const onPointerDown = (event: PointerEvent) => {
      const current = openDrawer

      // Nothing stands, so the page is not inert and the trigger is an
      // ordinary button. Ark opens it, as it always did.
      if (!current) return

      const aimedAt = triggerAtPoint(event.clientX, event.clientY)

      if (!aimedAt) return

      // The gesture is the frame's. Taking it here is what stops it from
      // being spent on dismissing the drawer that stands.
      event.preventDefault()
      event.stopImmediatePropagation()

      // The `click` that follows this `pointerdown` would land on the backdrop
      // and dismiss whatever this gesture just opened, so it is swallowed too.
      // A gesture that never becomes a click (a drag, a cancelled press) would
      // otherwise leave the listener behind, hence the timer beside it.
      if (releaseClick) releaseClick()

      window.addEventListener('click', swallow, true)

      const timer = window.setTimeout(() => {
        if (releaseClick) releaseClick()
      }, 1000)

      releaseClick = () => {
        releaseClick = null
        window.clearTimeout(timer)
        window.removeEventListener('click', swallow, true)
      }

      // Inside the opening animation a person is clicking again because the
      // CMS answered late, not because they want it shut again.
      if (now() - openedAt < SETTLE_MS) return

      setJaenFrameDrawer(aimedAt === current ? null : aimedAt)
    }

    window.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)

      if (releaseClick) releaseClick()
    }
  }, [])
}
