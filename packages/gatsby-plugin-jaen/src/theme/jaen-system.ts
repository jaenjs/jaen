/**
 * jaen's own half of the theme. The consuming site contributes only its brand
 * palette, which ../index.ts reads off the shadowed system.
 *
 * Two settings here are load-bearing and neither is obvious.
 *
 * cssVarsPrefix: 'jaen'
 *   v2 scoped the CMS variables with `cssVarsRoot="#coco"`. That cannot be
 *   carried forward: in v3 only the `base` bucket honours cssVarsRoot, while
 *   `_dark` always lands on the raw condition selector `.dark, .dark
 *   .chakra-theme:not(.light)`. Since `.dark` sits on <html> and the scoped root
 *   is a descendant, the scoped block wins and dark mode dies inside the CMS.
 *   Two systems with different variable prefixes cannot collide whatever
 *   selector they land on, which is the same isolation without the trap. The
 *   site keeps the `chakra` prefix because roughly forty of its strings hard-code
 *   var(--chakra-colors-brand-500), including every locale catalogue.
 *
 * disableLayers: true
 *   gatsby-browser and gatsby-ssr both import dist/jaen.css, which still carries
 *   Tailwind's UNLAYERED preflight: h1..h6 {font-size: inherit}, a {color:
 *   inherit}, ol,ul {list-style: none}. An unlayered normal declaration beats
 *   every cascade layer regardless of specificity, so with layers on, every
 *   Heading and Link in both repos would flatten. This can be removed once the
 *   Tailwind bundle is gone. It does not weaken the style-prop-over-recipe
 *   guarantee: those are merged in JS before serialisation, so their precedence
 *   never came from the cascade.
 */
import {defineConfig} from '@chakra-ui/react'

import {globalCss} from './foundations/global-css'
import {semanticTokens} from './foundations/semantic-tokens'
import {textStyles} from './foundations/text-styles'
import {breakpoints, tokens} from './foundations/tokens'
import {buttonRecipe} from './recipes/button'
import {
  badgeRecipe,
  containerRecipe,
  headingRecipe,
  inputAddonRecipe,
  inputRecipe,
  linkRecipe,
  textareaRecipe
} from './recipes'
import {
  accordionSlotRecipe,
  cardSlotRecipe,
  checkboxSlotRecipe,
  dialogSlotRecipe,
  drawerSlotRecipe,
  fieldSlotRecipe,
  listSlotRecipe,
  menuSlotRecipe,
  popoverSlotRecipe,
  progressSlotRecipe,
  tableSlotRecipe,
  tabsSlotRecipe
} from './slot-recipes'

export const jaenConfig = defineConfig({
  cssVarsPrefix: 'jaen',
  disableLayers: true,
  /**
   * Scoped to jaen's own root, not the document.
   *
   * jaen's provider mounts on every route, so an unscoped preflight is jaen
   * restyling the consuming site, which is the thing jaen is least allowed to
   * do. v2 got away with it because v2's CSSReset only set border, box-sizing
   * and word-wrap on `*`. v3's preflight adds `font: inherit` there, and SVG
   * presentation attributes lose to any CSS declaration, so every inline SVG
   * that sizes its own text with `font-size="7.8"` was silently reset to the
   * inherited 16px. The hero illustration on netsnek.com is where that shows.
   *
   * A consuming site that wants v3's reset can set preflight on its own system
   * and decide that for itself. What it cannot do is opt out of one it never
   * asked for.
   *
   * :where(), not the bare id. Chakra takes the scope string verbatim and
   * nests every preflight selector under it, so `#momo` produces `#momo *
   * {font-size: inherit}` at specificity (1,0,1) and `#momo button
   * {background-color: transparent}` at (1,0,1). Both outrank the (0,1,0)
   * emotion class every recipe emits, which silently unstyled the entire CMS:
   * headings at body size, buttons with no fill, checkboxes invisible. v2 had
   * the same reset at `:where(h1, h2, ...)` and bare element selectors, all of
   * which lose to a class. Wrapping the scope in :where() contributes zero
   * specificity, so the reset still reaches only jaen's own root and recipes
   * win inside it again.
   */
  preflight: {scope: ':where(#momo)'},
  globalCss,
  theme: {
    breakpoints,
    tokens,
    semanticTokens,
    textStyles,
    recipes: {
      badge: badgeRecipe,
      button: buttonRecipe,
      container: containerRecipe,
      heading: headingRecipe,
      input: inputRecipe,
      inputAddon: inputAddonRecipe,
      link: linkRecipe,
      textarea: textareaRecipe
    },
    slotRecipes: {
      accordion: accordionSlotRecipe,
      card: cardSlotRecipe,
      checkbox: checkboxSlotRecipe,
      dialog: dialogSlotRecipe,
      drawer: drawerSlotRecipe,
      field: fieldSlotRecipe,
      list: listSlotRecipe,
      menu: menuSlotRecipe,
      popover: popoverSlotRecipe,
      progress: progressSlotRecipe,
      table: tableSlotRecipe,
      tabs: tabsSlotRecipe
    }
  }
})
