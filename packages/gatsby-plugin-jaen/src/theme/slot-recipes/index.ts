/**
 * Multi-part recipes.
 *
 * Slot names are v3's, read off `defaultSystem._config.theme.slotRecipes[*].slots`
 * rather than taken from @chakra-ui/anatomy, because several of them were
 * renamed: container -> root, dialog -> content, list -> content, filledTrack ->
 * range, and the whole of table's th/td/tr vocabulary.
 *
 * As with the single-part recipes, each of these extends v3's own rather than
 * replacing it, so only the delta is declared.
 */
import {defineSlotRecipe} from '@chakra-ui/react'

/**
 * v2 drove card padding, radius and background through six cssVar() handles so
 * that size and variant could each set part of the same declaration. v3 resolves
 * variants in JS before serialising, so plain values compose the same way.
 *
 * `chakra-body-bg` and `chakra-subtle-bg` are v2-only built-ins and would have
 * resolved to nothing. `filled` maps onto v3's `subtle`; `unstyled` is dropped,
 * as every one of the ten <Card> call sites passes variant="outline".
 */
export const cardSlotRecipe = defineSlotRecipe({
  slots: ['root', 'header', 'body', 'footer', 'title', 'description'],
  base: {
    root: {
      backgroundColor: 'bg.surface',
      color: 'fg.default',
      borderWidth: '0'
    }
  },
  variants: {
    size: {
      // radii.surface on every size, design-consistency.md rule 1: a card is a
      // surface whatever its padding. v2's base/md/xl per size are gone.
      sm: {
        root: {borderRadius: 'surface'},
        body: {padding: '3'},
        header: {padding: '3'},
        footer: {padding: '3'}
      },
      md: {
        root: {borderRadius: 'surface'},
        body: {padding: '5'},
        header: {padding: '5'},
        footer: {padding: '5'}
      },
      lg: {
        root: {borderRadius: 'surface'},
        body: {padding: '7'},
        header: {padding: '7'},
        footer: {padding: '7'}
      }
    },
    variant: {
      // bg.muted is jaen's gray.700 in dark, the literal that stood here.
      elevated: {root: {boxShadow: 'base', bg: {_dark: 'bg.muted'}}},
      outline: {root: {borderWidth: '1px', borderColor: 'border.emphasized'}},
      subtle: {root: {bg: 'bg.subtle'}}
    }
  },
  defaultVariants: {variant: 'outline', size: 'lg'}
})

/**
 * v2 reached into `colors.${colorScheme}.500` through a cssVar to get the
 * checked background. colorPalette does that declaratively.
 *
 * The `icon` slot is `indicator` in v3, and its sm size asked for fontSize
 * '3xs', which v3 does not have. v2's own scale did, so this is a real loss of
 * a value: '3xs' was 0.45rem, and the nearest v3 offers is '2xs' at 0.625rem.
 * Keeping the literal preserves the rendering.
 */
export const checkboxSlotRecipe = defineSlotRecipe({
  slots: ['root', 'label', 'control', 'indicator', 'group'],
  base: {
    root: {colorPalette: 'brand'},
    label: {color: 'fg.emphasized', fontWeight: 'medium'},
    control: {
      borderWidth: '1px',
      borderColor: 'border.emphasized',
      _checked: {
        bg: 'colorPalette.solid',
        color: 'colorPalette.contrast',
        _hover: {bg: 'colorPalette.solidHover'}
      },
      _indeterminate: {bg: 'colorPalette.solid'}
    }
  },
  variants: {
    size: {
      sm: {
        label: {fontSize: 'xs', lineHeight: '1.125rem'},
        // v2 asked for `sm` and got 0.125rem. v3 shifted the whole radii scale
        // one name down (v2 sm 0.125 -> v3 xs; v2 base 0.25 -> v3 sm), so the
        // literal `sm` would round a 1rem control twice as far as v2 did.
        control: {borderRadius: 'xs'},
        indicator: {fontSize: '0.45rem'}
      },
      md: {
        label: {fontSize: 'sm', lineHeight: '1.25rem'},
        control: {borderRadius: 'base'},
        indicator: {fontSize: '2xs'}
      },
      lg: {
        label: {fontSize: 'md'},
        control: {borderRadius: 'md', lineHeight: '1.5rem'},
        indicator: {fontSize: 'xs'}
      }
    }
  }
})

/** v2 built this on modalAnatomy, so `dialog` is v3's `content`. */
export const drawerSlotRecipe = defineSlotRecipe({
  slots: [
    'trigger',
    'backdrop',
    'positioner',
    'content',
    'title',
    'description',
    'closeTrigger',
    'header',
    'body',
    'footer'
  ],
  base: {
    header: {
      px: {base: 4, md: 6},
      pt: 6,
      pb: 0,
      fontSize: 'md',
      fontWeight: 'normal',
      /**
       * `block`, because v2's was.
       *
       * v2's `chakra-modal__header` was a plain block, so the HStack inside it
       * filled the header's content box and `justifyContent: space-between`
       * pushed the close button to the right edge. v3's drawer header is a
       * flex container, which turns that same HStack into a flex item sized to
       * its own content: it shrank from 272px to 232px and took the close
       * button 40px away from the edge it used to sit against.
       */
      display: 'block'
    },
    body: {px: {base: 4, md: 6}, py: 6},
    footer: {px: {base: 4, md: 6}, py: 4, display: 'block'},
    content: {bg: 'bg.surface', boxShadow: 'lg'}
  }
})

/**
 * The two floating panels v3 rounds at `l3` (6 px). Both are surfaces in the
 * sense of design-consistency.md rule 1, so they read radii.surface like the
 * cards and the table frame, and a dialog beside a card shows one corner.
 * Only the radius is declared, the rest of v3's recipes stays underneath.
 */
export const dialogSlotRecipe = defineSlotRecipe({
  slots: ['content'],
  base: {content: {borderRadius: 'surface'}}
})

export const popoverSlotRecipe = defineSlotRecipe({
  slots: ['content'],
  base: {content: {borderRadius: 'surface'}}
})

export const menuSlotRecipe = defineSlotRecipe({
  slots: ['content', 'item', 'itemGroupLabel', 'separator', 'trigger'],
  base: {
    // radii.surface: a menu is a floating surface, v3's l2 (4 px) was the
    // third corner on one screen.
    content: {bg: 'bg.surface', boxShadow: 'lg', borderRadius: 'surface'},
    item: {
      // fg.emphasized: gray.700 in light and gray.200 in dark in jaen's own
      // foundations, the pair that stood here as literals.
      color: 'fg.emphasized',
      bg: 'transparent',
      _hover: {
        bg: {base: 'brand.50', _dark: 'brand.800'},
        color: {base: 'gray.800', _dark: 'white'}
      },
      _focus: {
        bg: {base: 'brand.100', _dark: 'brand.800'},
        color: {base: 'gray.900', _dark: 'white'}
      }
    }
  }
})

/**
 * v2's form-control and form-label were two configs against two anatomies; v3
 * merges both into `field`. The `floating` and `inline` label variants are
 * dropped, neither has a consumer.
 */
export const fieldSlotRecipe = defineSlotRecipe({
  slots: [
    'root',
    'errorText',
    'helperText',
    'input',
    'label',
    'select',
    'textarea',
    'requiredIndicator'
  ],
  base: {
    root: {width: '100%', position: 'relative'},
    label: {color: 'fg.emphasized', mb: '1.5', fontSize: 'sm'},
    requiredIndicator: {
      marginStart: '1',
      color: {base: 'red.500', _dark: 'red.300'}
    },
    helperText: {
      mt: '2',
      color: 'fg.muted',
      lineHeight: 'normal',
      fontSize: 'xs'
    }
  }
})

/**
 * The `fg.accent.default` variant is dropped: no consumer, and a dotted variant
 * name is a trap waiting for the first person who tries to select it.
 */
export const progressSlotRecipe = defineSlotRecipe({
  slots: ['root', 'label', 'track', 'range', 'valueText'],
  base: {
    root: {colorPalette: 'brand'},
    track: {bg: 'bg.muted'}
  },
  /**
   * The track radius has to be set HERE, not in `base`.
   *
   * v2 had no `shape` axis, so jaen's baseStyle radius was the only one and the
   * track rendered at radii.base, 0.25rem. v3 adds `shape` with a default of
   * `rounded`, whose `track: {borderRadius: 'l1'}` is applied after base and
   * therefore beats it — measured, `getSlotRecipeFn('progress')({}).track` came
   * back as l1 (radii.xs, 0.125rem) even with `base` declared and resolving.
   * Overriding the same variant is what puts v2's value back.
   */
  variants: {
    shape: {
      rounded: {track: {borderRadius: 'base'}}
    }
  }
})

/**
 * The largest rename in the set. v2's variant value `simple` is v3's `line`,
 * and `striped` stops being a variant VALUE and becomes a boolean variant of
 * its own, so the two can now combine.
 *
 * `textTransform: 'normal'` on th was never a legal CSS value; v3's table does
 * not uppercase, so dropping it changes nothing.
 */
export const tableSlotRecipe = defineSlotRecipe({
  slots: [
    'root',
    'header',
    'body',
    'row',
    'columnHeader',
    'cell',
    'footer',
    'caption'
  ],
  base: {
    root: {
      colorPalette: 'gray',
      bg: 'bg.surface',
      border: '1px solid',
      borderColor: 'border.emphasized',
      // The table frame is a surface, design-consistency.md rule 1.
      borderRadius: 'surface',
      borderSpacing: '0',
      borderCollapse: 'separate',
      overflow: 'hidden'
    },
    columnHeader: {
      border: 'none',
      fontWeight: 'medium',
      letterSpacing: 'normal',
      borderTopWidth: '1px',
      whiteSpace: 'nowrap',
      bg: 'bg.subtle',
      borderBottom: '1px solid',
      borderColor: 'border.emphasized',
      color: 'fg.muted',
      '&[data-is-numeric=true]': {textAlign: 'end'}
    },
    cell: {
      textAlign: 'start',
      borderBottom: '1px solid',
      borderColor: 'border.emphasized',
      '&[data-is-numeric=true]': {textAlign: 'end'}
    },
    caption: {
      mt: 4,
      fontFamily: 'heading',
      textAlign: 'center',
      fontWeight: 'medium',
      color: {base: 'gray.600', _dark: 'gray.100'}
    },
    footer: {
      '& tr:last-of-type th': {borderBottomWidth: 0}
    }
  },
  variants: {
    striped: {
      true: {
        body: {
          '& tr:nth-of-type(odd) td': {
            background: {base: 'colorPalette.100', _dark: 'colorPalette.700'},
            borderBottomWidth: '1px',
            borderColor: 'border.emphasized'
          }
        }
      }
    },
    size: {
      md: {columnHeader: {lineHeight: '1.25rem'}, cell: {fontSize: 'sm'}}
    }
  }
})

/**
 * All that survives of v2's 171-line tabs directory. Its two variants indexed
 * sizes[md|lg] while both call sites pass size="sm" and no variant, so nothing
 * but the default colour scheme ever reached the DOM.
 */
export const tabsSlotRecipe = defineSlotRecipe({
  slots: ['root', 'trigger', 'list', 'content', 'contentGroup', 'indicator'],
  base: {
    root: {colorPalette: 'brand'}
  }
})

/**
 * The one declaration jaen's accordions need, and the reason they need it.
 *
 * v2's accordion button was `{fontSize: 'md', px: 4, py: 2}` and declared no
 * gap, so the label and the chevron sat at the two ends of a flex row with
 * nothing between them. v3's `itemTrigger` adds `gap: 3`, which pushes twelve
 * pixels between them and, on the debug page's three panels, moved the label
 * away from the edge it used to align to.
 *
 * Measured on /cms/debug/: v2 renders the label with a 0px gutter, v3 with
 * 12px, on all three panels.
 */
export const accordionSlotRecipe = defineSlotRecipe({
  slots: [
    'root',
    'item',
    'itemTrigger',
    'itemContent',
    'itemIndicator',
    'itemBody'
  ],
  base: {
    itemTrigger: {gap: 0}
  }
})

/**
 * v2's List drew no markers and v3's does.
 *
 * v3's list recipe defaults to `variant: 'marker'`, whose root sets
 * `listStyle: revert`, and a class beats the `ol, ul {list-style: none}` that
 * the Tailwind reset still puts on the document. Every CMS menu grew bullet
 * points, which is most visible in the navigation drawer.
 *
 * A call site that wants markers still gets them: `listStyleType="disc"` as a
 * prop wins over the recipe, which is what the dashboard already does.
 */
export const listSlotRecipe = defineSlotRecipe({
  slots: ['root', 'item', 'indicator'],
  defaultVariants: {
    variant: 'plain'
  }
})
