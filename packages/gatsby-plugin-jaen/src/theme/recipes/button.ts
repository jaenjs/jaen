/**
 * 411 lines of v2 button, ported.
 *
 * Three v2-only mechanisms account for most of the shrinkage:
 *
 *   defineCssVars('button', ['bg', 'color']) existed so that a variant could set
 *   a value and a nested state could override it. v3 resolves states in JS, so a
 *   conditional value object does the same thing.
 *
 *   transparentize() is replaced by v3's token suffix: `brand.400/50` emits
 *   color-mix(in srgb, var(--jaen-colors-brand-400) 50%, transparent).
 *
 *   `...theme.components.Button?.variants?.ghost(props)` spread v2's own default
 *   variant to build on it. In v3 that spread becomes its ABSENCE: mergeConfigs
 *   makes this recipe extend v3's button rather than replace it, so declaring
 *   only the delta leaves solid/subtle/surface/outline/ghost/plain and all seven
 *   sizes intact underneath.
 *
 * Two pieces of v2 are dropped as measurably dead rather than translated:
 *
 *   The `colorScheme === 'gray'` branch of the `text` variant. All three
 *   `variant="text"` call sites take the default colorScheme of brand, so the
 *   branch never ran.
 *
 *   `_hover._disabled: {background: 'inerit'}` in `primary`. The typo made it
 *   invalid CSS, so it never applied.
 */
import {defineRecipe} from '@chakra-ui/react'

export const buttonRecipe = defineRecipe({
  /**
   * v2's `defaultProps: {colorScheme: 'brand'}` has no v3 equivalent, because
   * colorPalette is a style prop rather than a recipe variant. Declaring it in
   * `base` writes the palette variables onto the element itself; an explicit
   * colorPalette prop still wins, because props merge after the recipe.
   */
  /**
   * `gap: 2` is v2's icon gutter, restored.
   *
   * v2's Button declared no gap. It spaced icons with the wrapping
   * `chakra-button__icon` span, which carried `margin-inline-end: 0.5rem`. The
   * codemod turned every `leftIcon`/`rightIcon` into a plain child, so that
   * span and its margin are gone and only the button's own gap is left. v3's
   * default gap is size-dependent (4px at xs, 12px at md), which matched
   * neither.
   *
   * 8px is right for 33 of the 34 v2 call sites that put an icon beside a
   * label, counted rather than estimated. The one exception carried no icon
   * span in v2 either, and is a single button in the media gallery.
   */
  /**
   * `borderRadius: 'control'` is rule 1 of design-consistency.md: one radius
   * for every size and every variant, so the solid, outline and ghost buttons
   * of one row match. It sits in `base`, over v3's own `l2` (4 px), which is
   * what the frame's solid add button used to show beside 8 px everywhere
   * else. No variant below sets a radius of its own any more.
   */
  base: {colorPalette: 'brand', gap: 2, borderRadius: 'control'},

  variants: {
    variant: {
      primary: {
        flexShrink: 0,
        bg: 'colorPalette.solid',
        color: 'colorPalette.contrast',
        _hover: {bg: 'colorPalette.solidHover'},
        _active: {bg: 'colorPalette.solidActive'},
        _disabled: {_hover: {bg: 'colorPalette.solid'}},
        _focusVisible: {boxShadow: 'focus'}
      },

      /**
       * secondary and secondary.subtle differ in exactly one value, the hover
       * and active background in light mode: gray.50 against gray.100. The
       * light literals are kept so the rendering is identical rather than
       * nearly identical. The dark half is `bg.subtle`, whose value in jaen's
       * own foundations is the gray.800 that used to be written here, so jaen
       * renders as before and a site with its own dark surfaces (see
       * ../system.ts) gets its own hover under these buttons too.
       */
      secondary: secondaryVariant('gray.50'),
      'secondary.subtle': secondaryVariant('gray.100'),

      text: {
        padding: 0,
        height: 'auto',
        verticalAlign: 'baseline',
        justifyContent: 'flex-start',
        color: 'colorPalette.fg',
        _hover: {color: {base: 'brand.700', _dark: 'brand.300'}},
        _active: {color: {base: 'brand.700', _dark: 'brand.300'}},
        _focusVisible: {boxShadow: 'focus'},
        _disabled: {
          opacity: 1,
          color: {base: 'gray.400', _dark: 'gray.600'},
          _hover: {color: {base: 'gray.400', _dark: 'gray.600'}}
        }
      },

      /**
       * The three `.accent` variants sit on the brand-coloured hero band, so
       * they were written for light mode only and had no _dark branch at all.
       * They now read brand.subtle / brand.fg, which is identical in light and
       * finally gives dark mode a defined value instead of an unreadable one.
       */
      'primary.accent': {
        bg: 'brand.subtle',
        color: 'brand.fg',
        _hover: {bg: 'brand.muted'},
        _active: {bg: 'brand.muted'}
      },
      'secondary.accent': {
        color: 'white',
        borderColor: 'brand.subtle',
        borderWidth: '1px',
        _hover: {bg: 'whiteAlpha.200'},
        _active: {bg: 'whiteAlpha.200'}
      },
      'text.accent': {
        padding: 0,
        height: 'auto',
        lineHeight: 'normal',
        verticalAlign: 'baseline',
        color: 'brand.subtle',
        _hover: {color: 'white'},
        _active: {color: 'white'}
      },

      // Deltas on top of v3's own ghost and outline, which stay underneath.
      // v2's outline remapped a brand colorScheme to gray before spreading;
      // the explicit gray values do that without the branch.
      // The label colours are the semantic names whose jaen values are the
      // greys that used to be written here (fg.emphasized is gray.700 in light
      // and gray.200 in dark, fg.muted is gray.600 in light), so jaen renders
      // as before and a site that redefines the names in its theme shadow
      // recolours these labels with the rest of its dark mode.
      ghost: {
        color: 'fg.emphasized'
      },
      outline: {
        borderColor: 'border.emphasized',
        color: {base: 'fg.muted', _dark: 'fg.emphasized'},
        '& > svg': {color: 'fg.muted'}
      },

      /**
       * The two field-highlighter chips. `backdropBlur: 8` is carried over
       * verbatim including its non-effect: in v2 it set --chakra-backdrop-blur
       * to `blur(8)`, which is invalid for want of a unit, and it never set
       * backdrop-filter at all. Writing backdropFilter here would make the blur
       * appear for the first time, which is a visual change this migration is
       * not supposed to make. Worth fixing, separately.
       */
      'field-highlighter-tooltip': {
        bg: 'brand.400/50',
        backdropBlur: '8px',
        color: 'fg.emphasized',
        _hover: {bg: 'brand.200/70'},
        fontWeight: 'normal',
        fontSize: 'xs',
        height: '6',
        minWidth: '6',
        px: '2'
      },
      'field-highlighter-tooltip-text': {
        bg: 'brand.500/70',
        backdropBlur: '8px',
        color: 'fg.emphasized',
        fontWeight: 'normal',
        cursor: 'default',
        fontSize: 'xs',
        height: '6',
        minWidth: '6',
        px: '2',
        mr: '2'
      }
    },

    size: {
      // sizes.15 does not exist in v3 and is added in foundations/tokens.ts;
      // without it `2xl` would emit `height: 15` and fall back to auto.
      '2xs': {h: '6', minW: '6', fontSize: '2xs', px: '2', gap: 2},
      xs: {
        h: '8',
        minW: '8',
        fontSize: 'xs',
        lineHeight: '1.125rem',
        px: '2',
        gap: 2
      },
      sm: {
        h: '9',
        minW: '9',
        fontSize: 'sm',
        lineHeight: '1.25rem',
        px: '3.5',
        gap: 2
      },
      md: {
        h: '10',
        minW: '10',
        fontSize: 'sm',
        lineHeight: '1.25rem',
        px: '4',
        gap: 2
      },
      lg: {
        h: '11',
        minW: '11',
        fontSize: 'md',
        lineHeight: '1.5rem',
        px: '4.5',
        gap: 2
      },
      xl: {
        h: '12',
        minW: '12',
        fontSize: 'md',
        lineHeight: '1.5rem',
        px: '5',
        gap: 2
      },
      '2xl': {
        h: '15',
        minW: '15',
        fontSize: 'lg',
        gap: 2,
        lineHeight: '1.75rem',
        px: '7'
      }
    }
  }
})

/** The 65 lines `secondary` and `secondary.subtle` shared verbatim in v2. */
function secondaryVariant(hoverBg: string) {
  const active = {
    bg: {base: hoverBg, _dark: 'bg.subtle'},
    color: {base: 'gray.900', _dark: 'white'}
  }

  return {
    borderWidth: '1px',
    borderColor: 'border.emphasized',
    flexShrink: 0,
    color: 'fg.emphasized',
    '& > svg': {color: 'fg.muted'},
    _hover: {
      bg: {base: hoverBg, _dark: 'bg.subtle'},
      color: {base: 'gray.800', _dark: 'white'}
    },
    _checked: {bg: {base: hoverBg, _dark: 'bg.subtle'}},
    _active: active,
    _selected: active,
    _disabled: {
      opacity: 1,
      borderColor: 'border.default',
      color: {base: 'gray.400', _dark: 'gray.600'},
      '& > svg': {color: 'unset'},
      _hover: {color: {base: 'gray.400', _dark: 'gray.600'}}
    },
    _focusVisible: {boxShadow: 'focus'}
  }
}
