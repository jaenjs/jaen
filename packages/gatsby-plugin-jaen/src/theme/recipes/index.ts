/**
 * Single-part recipes.
 *
 * `mergeConfigs` makes each of these EXTEND v3's own recipe of the same name
 * rather than replace it, so only the delta is declared here. Verified: after
 * defining just `variants.variant.primary` on button, the resolved recipe still
 * offers solid/subtle/surface/outline/ghost/plain and all seven sizes.
 *
 * v2's `defaultProps.colorScheme` has no v3 equivalent, because `colorPalette`
 * is a style prop rather than a recipe variant. Setting it in `base` writes the
 * palette variables onto the element itself, and an explicit `colorPalette`
 * prop still wins because props merge after the recipe.
 *
 * Six v2 recipes are gone entirely, each verified to have no consumer:
 * close-button (v3's CloseButton is an IconButton with no recipe at all),
 * custom-select (146 lines, referenced only by its own registration),
 * radio-card, popover (both <Popover> sites are Radix, not Chakra), divider
 * (it only undid v2's 0.6 opacity, which v3 never applies), and tabs/ (171
 * lines whose two variants indexed sizes[md|lg] while the only two call sites
 * pass size="sm" and no variant, so the lookup never ran).
 */
import {defineRecipe} from '@chakra-ui/react'

/**
 * The size axis changed meaning in v3, which is why this must be ported
 * verbatim rather than dropped. v2 mapped size="md" to fontSize 4xl; v3 maps it
 * to textStyle md, which is 1rem. Without this remap all 38 headings in the CMS
 * would silently collapse to body size.
 */
export const headingRecipe = defineRecipe({
  base: {
    fontWeight: 'semibold'
  },
  variants: {
    size: {
      '2xl': {fontSize: '7xl', lineHeight: '5.625rem', letterSpacing: 'tight'},
      xl: {fontSize: '6xl', lineHeight: '4.5rem', letterSpacing: 'tight'},
      lg: {fontSize: '5xl', lineHeight: '3.75rem', letterSpacing: 'tight'},
      md: {fontSize: '4xl', lineHeight: '2.75rem', letterSpacing: 'tight'},
      sm: {fontSize: '3xl', lineHeight: '2.375rem'},
      xs: {fontSize: '2xl', lineHeight: '2rem'}
    }
  }
})

/**
 * v2 carried a `pill` variant built on defineCssVars and transparentize. It has
 * no consumer, and its `textTransform: 'normal'` was not a legal CSS value in
 * the first place, so nothing is lost by dropping it. v3's badge is already
 * non-uppercase, so there is nothing to restore either.
 */
export const badgeRecipe = defineRecipe({
  base: {colorPalette: 'brand'},
  variants: {
    size: {
      sm: {textStyle: 'xs', px: 2, py: 0.5},
      md: {textStyle: 'sm', px: 2.5, py: 0.5},
      lg: {textStyle: 'sm', px: 3, py: 1}
    }
  },
  defaultVariants: {size: 'md'}
})

export const containerRecipe = defineRecipe({
  base: {
    maxW: '7xl',
    px: {base: '4', md: '8'}
  }
})

/**
 * The underline slides in from the left on hover. v2 drove the colour through a
 * defineCssVars pair purely to switch it in dark mode; a semantic token does the
 * same thing without the indirection.
 *
 * The `menu` variant is dropped: no consumer.
 */
export const linkRecipe = defineRecipe({
  variants: {
    variant: {
      underline: {
        position: 'relative',
        color: 'brand.fg',
        textDecoration: 'none',
        _before: {
          content: '""',
          position: 'absolute',
          width: 'full',
          height: '1.5px',
          borderRadius: 'sm',
          backgroundColor: 'accent',
          bottom: '0',
          left: '0',
          transformOrigin: 'right',
          transform: 'scaleX(0)',
          transition: 'transform .20s ease-in-out'
        },
        _hover: {
          textDecoration: 'none',
          _before: {
            transformOrigin: 'left',
            transform: 'scaleX(1)'
          }
        }
      }
    }
  },
  defaultVariants: {variant: 'underline'}
})

/**
 * In v3 Input is a single-part recipe: v2's `field` slot IS the recipe, and the
 * `addon` slot becomes its own `inputAddon`.
 *
 * The `filled.accent` variant is dropped (no consumer), and the focus ring no
 * longer needs to reach into `props.theme.colors[colorScheme]` because
 * `colorPalette.focusRing` resolves the same value declaratively.
 */
export const inputRecipe = defineRecipe({
  base: {
    colorPalette: 'brand',
    _disabled: {opacity: 1.0},
    _placeholder: {opacity: 1, color: 'fg.subtle'},
    _placeholderShown: {bg: 'bg.subtle'}
  },
  variants: {
    variant: {
      outline: {
        // radii.control, design-consistency.md rule 1: the same corner as the
        // button beside it.
        borderRadius: 'control',
        borderColor: 'border.emphasized',
        // bg.subtle is jaen's gray.800 in dark, the literal that stood here,
        // and a site's own dark surface where the site defines one.
        bg: {base: 'white', _dark: 'bg.subtle'},
        _hover: {borderColor: 'border.active'},
        _focusVisible: {
          zIndex: 1,
          borderColor: 'colorPalette.focusRing',
          boxShadow: '0 0 0 1px var(--jaen-colors-color-palette-focus-ring)'
        }
      }
    },
    size: {
      sm: {px: 2.5, h: 9, fontSize: 'sm'},
      md: {px: 3, h: 10, fontSize: 'md'},
      lg: {px: 3.5, h: 11, fontSize: 'md'},
      xl: {px: 4, h: 12, fontSize: 'md'}
    }
  }
})

export const inputAddonRecipe = defineRecipe({
  base: {
    borderRadius: 'control',
    borderColor: 'border.emphasized',
    bg: 'bg.subtle'
  }
})

/**
 * v2 spread `inputTheme.baseStyle?.field` in to share the placeholder rules;
 * with Input now single-part that spread would pull in the whole recipe base,
 * so the three shared declarations are restated instead.
 */
export const textareaRecipe = defineRecipe({
  base: {
    _disabled: {opacity: 1.0},
    _placeholder: {opacity: 1, color: 'fg.subtle'},
    _placeholderShown: {bg: 'bg.subtle'},
    paddingY: '2',
    minHeight: '20',
    lineHeight: 'short',
    verticalAlign: 'top'
  },
  variants: {
    variant: {
      outline: {
        borderRadius: 'control',
        borderColor: 'border.emphasized',
        bg: 'bg.surface',
        _hover: {borderColor: 'border.active'},
        // v2 built this with transparentize(colour, 1.0), which is the colour
        // itself. The opacity argument never did anything.
        _focus: {
          borderColor: {base: 'brand.500', _dark: 'brand.200'},
          boxShadow: {
            base: '0px 0px 0px 1px var(--jaen-colors-brand-500)',
            _dark: '0px 0px 0px 1px var(--jaen-colors-brand-200)'
          }
        }
      }
    }
  }
})
