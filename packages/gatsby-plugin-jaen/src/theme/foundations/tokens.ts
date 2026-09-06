/**
 * Base tokens: raw values, no light/dark axis. The semantic layer in
 * `semantic-tokens.ts` is what reads these.
 *
 * Only deltas against v3's defaults are declared. Everything jaen used to
 * restate and v3 already provides identically has been dropped, so what remains
 * is exactly the set of values jaen actually disagrees with.
 */
import {defineTokens} from '@chakra-ui/react'

export const tokens = defineTokens({
  colors: {
    /**
     * v2's gray, pinned in full.
     *
     * Only 25/50/950 were jaen's own; 100-900 came from @chakra-ui/theme and
     * were never written down, which is why they went missing. v2's ramp is
     * blue-tinted (500 #718096) and v3's is neutral zinc (500 #71717a), so
     * inheriting v3's silently re-tints every neutral surface and every line of
     * body text in the CMS: fg.default, fg.emphasized, fg.muted, fg.subtle,
     * all three border.* and bg.subtle/bg.muted resolve through these.
     *
     * Read out of /home/snekmin/git/jaen/node_modules/@chakra-ui/theme, not
     * copied from a docs page.
     */
    gray: {
      // jaen's own three. v3 has no 25 at all, and its 50/950 (#fafafa,
      // #111111) are neutral where jaen's carry the same blue cast as the ramp.
      25: {value: '#fcfdfe'},
      50: {value: '#f4f8fa'},
      // v2 @chakra-ui/theme, verbatim.
      100: {value: '#EDF2F7'},
      200: {value: '#E2E8F0'},
      300: {value: '#CBD5E0'},
      400: {value: '#A0AEC0'},
      500: {value: '#718096'},
      600: {value: '#4A5568'},
      700: {value: '#2D3748'},
      800: {value: '#1A202C'},
      900: {value: '#171923'},
      950: {value: '#14151e'}
    }
  },
  /**
   * v2's `borders` scale, pinned.
   *
   * v3 renamed the whole scale to xs/sm/md/lg/xl and dropped the pixel keys, so
   * `border="1px"` stops resolving. An unresolvable token is not an error: the
   * literal `1px` is emitted, `border: 1px` resets border-style to its initial
   * `none`, and nothing paints. Five call sites in these packages rely on it
   * (JaenFrame, DangerZone, TuneSelector, SectionBlockSelector, emailwerk's
   * email index), and v3's own `xs`/`sm`/`md` keep their meanings alongside.
   */
  borders: {
    '1px': {value: '1px solid'},
    '2px': {value: '2px solid'},
    '4px': {value: '4px solid'},
    '8px': {value: '8px solid'}
  },
  /**
   * v2's `radii.base`, pinned.
   *
   * v3's scale is shifted one name down (v2 sm 0.125 -> v3 xs, v2 base 0.25 ->
   * v3 sm) and has no `base` at all, so `card` size=sm, `checkbox` size=md and
   * `progress` emitted the literal `border-radius: base` and the browser
   * dropped the declaration. md/lg/xl/full hold the same value in both, which
   * is why they were never noticed. Two consequences of the same shift are
   * fixed in the slot recipes rather than here: `checkbox` size=sm had to move
   * from `sm` to `xs` to keep v2's 0.125rem, and `progress` had to move its
   * radius into v3's `shape` variant to win over it.
   */
  radii: {
    base: {value: '0.25rem'},
    /**
     * The two radii of design-consistency.md, rule 1.
     *
     * `control` is the corner of everything a hand operates: buttons, icon
     * buttons, chips, inputs, the frame's menu button and search. `surface`
     * is the corner of everything that holds content: cards, dialogs, sheets,
     * drawers, menus, popovers and the table frame. The values are written
     * out rather than referenced, because the brief names them by the pixel
     * (8 px and 12 px) and v3's scale spells those `lg` and `xl`, a name
     * nobody should have to remember: the measured majority of the app was
     * 8 px, so that is `control`, and the cards were 12 px, so that is
     * `surface`. The avatar stays `full`.
     */
    control: {value: '0.5rem'},
    surface: {value: '0.75rem'}
  },
  /**
   * v2's `shadows.base`, pinned, for the same reason: `card` variant=elevated
   * asks for it and v3 has no raw shadow tokens at all. The five jaen shadows
   * that DO carry a light/dark axis stay in semantic-tokens.ts; this one had
   * none in v2 either.
   */
  shadows: {
    base: {
      value: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
    }
  },
  fonts: {
    heading: {
      value: '"Spline Sans Variable", -apple-system, system-ui, sans-serif'
    },
    body: {value: '"Open Sans Variable", -apple-system, system-ui, sans-serif'}
  },
  sizes: {
    // v3 stops at 12/14/16, so `size="2xl"` on a Button would emit `height: 15`
    // and render at the browser default. sizes.11 needs no override: v3 already
    // has it at the same 2.75rem.
    15: {value: '3.75rem'},
    /**
     * v3 dropped the whole `container.*` namespace, and JaenPageLayout picks
     * between container.md and container.xl on every CMS page. An unresolvable
     * size is not an error in v3: `maxW` would receive the literal string
     * 'container.xl' and the layout would go full-bleed. v2's four values.
     */
    container: {
      sm: {value: '640px'},
      md: {value: '768px'},
      lg: {value: '1024px'},
      xl: {value: '1280px'}
    }
  },
  spacing: {
    // v3's scale steps 4 -> 5 with nothing between.
    4.5: {value: '1.125rem'}
  }
})

/**
 * v2's breakpoints, pinned.
 *
 * v3 moved `lg` from 62em (992px) to 1024px and switched the unit to px. The
 * other four are unchanged. Every responsive array in both repos was authored
 * against 992, so adopting v3's value would shift layouts at a width nobody
 * chose. The px spelling is v3's own; only the lg value is jaen's.
 */
export const breakpoints = {
  sm: '480px',
  md: '768px',
  lg: '992px',
  xl: '1280px',
  '2xl': '1536px'
}
