/**
 * The one place the colour mode is read from.
 *
 * v3 has no colour mode of its own; it delegates to next-themes, which knows
 * nothing about Chakra. This module keeps the four v2 names alive on top of it,
 * so the swap cost one file instead of the forty-odd call sites across jaen,
 * netsnek.com and the example site.
 *
 * Import from `jaen`, not from `@chakra-ui/react` or `next-themes` directly, in
 * the packages and in the sites alike. The colour mode belongs to the provider
 * that gatsby-plugin-jaen mounts, so it is jaen's to hand out.
 *
 * The default it hands out is 'light', and that is v2's default, not a new
 * one. gatsby-ssr rendered <ColorModeScript initialColorMode={theme.config
 * .initialColorMode}/>, jaen's theme set no config, so extendTheme filled in
 * @chakra-ui/theme's own "light" and that literal is what the script emitted.
 * The site's initialColorMode:'system' was only ever read by v2's
 * ColorModeProvider, and the sole provider in the tree was jaen's, so the
 * site's setting never applied — its own source says as much:
 * `//? This doesnt sync`. Following the OS instead would be a redesign, so the
 * arrangement is kept: see NextThemeProvider in wrap-root-element.tsx.
 */
import {Theme} from '@chakra-ui/react'
import {useTheme} from 'next-themes'
import {useCallback, useSyncExternalStore, type ReactNode} from 'react'

/** v3 exports neither of these; they described a v2 concept. */
export type ColorMode = 'light' | 'dark'
export type ColorModeWithSystem = ColorMode | 'system'

export interface UseColorModeReturn {
  colorMode: ColorMode
  setColorMode: (mode: ColorModeWithSystem) => void
  toggleColorMode: () => void
}

const subscribeNever = () => () => {}
const snapshotHydrated = () => true
const snapshotServer = () => false

/**
 * False while React is producing the markup the server produced, true from the
 * moment hydration has finished — and true straight away for anything mounted
 * later, which is what a plain useEffect flag gets wrong.
 */
const useIsHydrated = (): boolean =>
  useSyncExternalStore(subscribeNever, snapshotHydrated, snapshotServer)

export function useColorMode(): UseColorModeReturn {
  const {resolvedTheme, setTheme, forcedTheme} = useTheme()
  const isHydrated = useIsHydrated()

  // resolvedTheme is NOT undefined on the client's first render, contrary to
  // what this comment used to claim. next-themes decides that with a
  // module-scope `typeof window == "undefined"`, which is false in the browser
  // bundle, so its useState initialiser reads localStorage synchronously and
  // the systemTheme initialiser calls matchMedia in the same render. Measured
  // against next-themes 0.4.6 as installed: server render gives undefined,
  // while the first browser render gives 'dark' for a dark-OS visitor with
  // dark or system stored under the provider's storageKey (jaen:colorMode,
  // gatsby-plugin-jaen's color-mode-scope.tsx). Rendering that value during hydration
  // is a mismatch React 18 does not repair in production, so the SSR classes
  // stick and the JS-derived colours stay on the wrong branch.
  //
  // v2 had no such gap and this reproduces it exactly: ColorModeProvider's
  // getTheme() returned the fallback for the localStorage manager and let a
  // useEffect correct it, so the first client render always agreed with SSR.
  // Gate on hydration and do the same. Pure-CSS colour is unaffected either
  // way — the no-flash script has already put the class on <html> before the
  // first paint. forcedTheme is a prop, identical on both sides, so it is not
  // gated.
  const colorMode = (forcedTheme ??
    (isHydrated ? resolvedTheme : undefined) ??
    'light') as ColorMode

  const toggleColorMode = useCallback(() => {
    setTheme(colorMode === 'dark' ? 'light' : 'dark')
  }, [colorMode, setTheme])

  return {colorMode, setColorMode: setTheme, toggleColorMode}
}

export function useColorModeValue<L, D>(light: L, dark: D): L | D {
  return useColorMode().colorMode === 'dark' ? dark : light
}

/**
 * v2's DarkMode and LightMode were context-only and rendered no DOM. v3 has no
 * colour-mode context at all, its conditions are plain class selectors, so an
 * element is unavoidable: <Theme> emits `class="chakra-theme dark"` and
 * re-declares the token block for the subtree.
 *
 * `display: contents` keeps the new element out of layout, which matters at the
 * two call sites that wrap a flex child (TopNav's search control and
 * ThemeChooser's menu list). `hasBackground={false}` stops it painting a
 * surface v2 never painted.
 *
 * `color` and `colorPalette` are cleared for the same reason, and they need
 * spelling out because Theme hard-codes `color: "fg"` and `colorPalette:
 * "gray"` ahead of its own `...rest`. Left alone, the wrapper repaints the
 * subtree in the token foreground and re-points every
 * `--*-colors-color-palette-*` variable at gray, overriding whatever palette
 * the host set on <html> — netsnek.com's `html { colorPalette: brand }`, for
 * one, which is the migration's own replacement for withDefaultColorScheme.
 * undefined is the right value rather than some other palette: the factory runs
 * props through compact(), so an undefined prop drops out entirely and the
 * subtree inherits, which is what a context-only v2 wrapper did. Measured, both
 * systems: the element's own rule goes from `color:var(--<prefix>-colors-fg)`
 * plus 19 (jaen) / 20 (site) palette declarations down to `display:contents`.
 */
export const DarkMode = ({children}: {children: ReactNode}) => (
  <Theme
    appearance="dark"
    hasBackground={false}
    display="contents"
    color={undefined}
    colorPalette={undefined}>
    {children}
  </Theme>
)

export const LightMode = ({children}: {children: ReactNode}) => (
  <Theme
    appearance="light"
    hasBackground={false}
    display="contents"
    color={undefined}
    colorPalette={undefined}>
    {children}
  </Theme>
)
