/**
 * The refresh button every screen carries, and the only one.
 *
 * Measured 2026-09-06: the icon button on the board did nothing visible
 * when tapped, the rows changed a second later and the tap felt lost. This
 * one turns: the icon spins while the view's query is fetching (TanStack's
 * `isFetching`, so a refetch behind cached rows counts, `isLoading` would
 * not) and for 500 ms after the answer, the button is `aria-busy` and takes
 * no click meanwhile, so a fast answer still reads as one turn. A
 * reader who asked for reduced motion sees the icon fade in and out instead
 * of turning. The label is the common catalogue's "Aktualisieren" in the
 * account's language (design-consistency.md, rule 5a).
 *
 * It reads the view's registration (hooks/view-refresh.ts) by default, the
 * same one the pull below md calls, so the two never disagree. A component
 * that has no registration in scope, or refreshes something other than the
 * view's query, passes `onClick` and `isFetching` itself.
 *
 * Size and variant are the board's: `sm`, outline. Nothing else in a header
 * row is at that size (rule 2a).
 */
import {useCallback, useEffect, useRef, useState} from 'react'
import {IconButton, type IconButtonProps} from '@chakra-ui/react'
import {FaSyncAlt} from '@react-icons/all-files/fa/FaSyncAlt'
import {useI18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'
import {useRegisteredRefresh} from '../hooks/view-refresh'

/** The least a turn lasts, so a cached answer still shows one. */
export const REFRESH_SPIN_MIN_MS = 500

export interface RefreshButtonProps
  extends Omit<IconButtonProps, 'onClick' | 'aria-label' | 'children'> {
  /** What a tap does. Defaults to the view's registered refetch. */
  onClick?: () => void
  /** Whether the query is on the wire. Defaults to the view's registration. */
  isFetching?: boolean
}

/**
 * True from the moment a fetch starts (or the button is tapped) until the
 * fetch has ended and at least the minimum has passed.
 */
export function useSpinning(
  isFetching: boolean,
  minMs = REFRESH_SPIN_MIN_MS
): [boolean, () => void] {
  const [spinning, setSpinning] = useState(false)
  const startedAt = useRef(0)
  const fetching = useRef(isFetching)
  fetching.current = isFetching
  const timer = useRef<number | undefined>(undefined)

  /**
   * Stop after `after` ms, unless a fetch is on the wire by then. A fetch
   * that ended is followed by the full minimum, so the turn is the answer's
   * time plus 500 ms and a fast answer still reads as one turn; a tap that
   * started no fetch ends once the minimum has passed since the tap.
   */
  const settle = useCallback((after: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (fetching.current) return
      startedAt.current = 0
      setSpinning(false)
    }, after)
  }, [])

  /**
   * A tap starts the turn before the query has flipped to fetching, and a
   * tap that starts no fetch at all (a disabled query) still ends after the
   * minimum, which is what the settle armed here is for.
   */
  const start = useCallback(() => {
    if (!startedAt.current) startedAt.current = Date.now()
    setSpinning(true)
    settle(Math.max(0, startedAt.current + minMs - Date.now()))
  }, [settle, minMs])

  useEffect(() => {
    if (isFetching) {
      window.clearTimeout(timer.current)
      if (!startedAt.current) startedAt.current = Date.now()
      setSpinning(true)
      return
    }
    if (startedAt.current) settle(minMs)
  }, [isFetching, settle, minMs])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return [spinning, start]
}

export function RefreshButton({
  onClick,
  isFetching,
  size = 'sm',
  variant = 'outline',
  ...rest
}: RefreshButtonProps) {
  const code = useI18nCode()
  const {strings: tc} = getI18nCommon(code)
  const registered = useRegisteredRefresh()
  const refetch = onClick ?? registered?.refetch
  const fetching = isFetching ?? registered?.isFetching ?? false
  const [spinning, start] = useSpinning(fetching)

  const tap = () => {
    if (spinning || !refetch) return
    start()
    refetch()
  }

  return (
    <IconButton
      size={size}
      variant={variant}
      aria-label={tc.Refresh}
      title={tc.Refresh}
      aria-busy={spinning}
      aria-disabled={spinning || !refetch}
      data-refresh={spinning ? 'busy' : 'idle'}
      // No `disabled`: a disabled button greys its icon, and the turning icon
      // is the feedback. The click is refused above and the pointer ignored.
      pointerEvents={spinning ? 'none' : undefined}
      onClick={tap}
      {...rest}>
      {/* The turn and its reduced-motion fade are the two keyframes in
          src/styles/app.css, on this class, so no stylesheet has to be
          generated for an animation and the same rule serves everywhere. */}
      <FaSyncAlt
        className={spinning ? 'app-refresh-spinning' : undefined}
        data-spinning={spinning ? 'true' : undefined}
      />
    </IconButton>
  )
}
