/**
 * Composes jaen's system: v3's defaults, jaen's own config, the brand palette
 * the consuming site hands over through the shadow at ./theme, and whatever
 * the site says about the surfaces, the text and the borders.
 *
 * v2 did this by mutating a shared object (`jaenTheme.colors.brand =
 * userTheme.colors.brand`). Reading a public field off a validated system is
 * the same idea without the mutation, and it can say what went wrong.
 */
import {
  createSystem,
  defaultConfig,
  defineConfig,
  isValidSystem
} from '@chakra-ui/react'

import {jaenConfig} from './jaen-system'
import userSystem from './theme'

/**
 * The failure this guards against is silent by nature. A v2 `extendTheme()`
 * result is a plain object with `colors` at the top level, where v3 wants
 * `theme.tokens.colors`. mergeConfigs would deep-merge it, find nothing it
 * recognises, drop it all, and build a site that is entirely correct except
 * that every brand-coloured thing is pink.
 *
 * isValidSystem is Chakra's own discriminator: it checks for the `$$chakra`
 * marker that only createSystem() sets.
 */
if (!isValidSystem(userSystem)) {
  throw new Error(
    '[gatsby-plugin-jaen] src/gatsby-plugin-jaen/theme/theme.ts must ' +
      'default-export a Chakra v3 SystemContext created with createSystem(), ' +
      'not a v2 theme object. Replace `export default extendTheme(...)` with ' +
      '`export default createSystem(...)`.'
  )
}

const userTheme = userSystem._config.theme ?? {}
const brand = userTheme.tokens?.colors?.brand

if (!brand) {
  throw new Error(
    '[gatsby-plugin-jaen] the system exported from ' +
      'src/gatsby-plugin-jaen/theme/theme.ts defines no ' +
      'theme.tokens.colors.brand. The CMS chrome is coloured from it.'
  )
}

/**
 * The site owns its palette, dark half included.
 *
 * Every screen mounted inside jaen's frame, the CMS and a consuming app plugin
 * alike, reads the semantic names `bg.*`, `fg.*` and `border.*` from THIS
 * system, not from the site's own, because the site's system is mounted only
 * on the routes outside the frame (see ../gatsby/Layout.tsx). jaen's
 * foundations give every one of those names a light and a dark half, which is
 * what a site gets by saying nothing. A site that wants its own dark surfaces,
 * say charcoal under a gold brand rather than jaen's grey, defines the same
 * names in its theme shadow and they are merged in here, over jaen's, so the
 * brand decides what dark looks like without a line in jaen or in the app.
 *
 * `gray` is taken too, as the eight palette slots and nothing else. The frame
 * says `html {colorPalette: gray}`, so every component that is not a button,
 * the avatar in the bar, a close button, a segment control, a spinner, resolves
 * `gray.fg`, `gray.muted` and their siblings, and v3 fills those off the grey
 * ramp, which never passes through `bg.*` or `fg.*`. A site with its own dark
 * surfaces defines the slots beside them or its avatar keeps sitting on v3's
 * grey. The ramp itself stays jaen's: the numbered steps a site defines are
 * NOT merged, they would recolour every literal `gray.700` in the CMS.
 *
 * `shadows` is the same story for the focus halo. The frame's buttons read
 * `boxShadow: 'focus'`, jaen's dark half is a ring of gray.700, and a site
 * whose dark is not jaen's grey has no other way to move it.
 *
 * Only these groups are taken. A site's other semantic tokens (limosen.*, and
 * whatever else it names) stay in the site's system, as before. A name v3
 * defines itself (bg.subtle, bg.muted, fg.muted, fg.subtle, fg.inverted,
 * border.emphasized, every gray slot) has to be spelled `_light`, not `base`,
 * or v3's own light value outranks it; foundations/semantic-tokens.ts says why.
 */
/**
 * `radii.control` and `radii.surface` are NOT read from the site. They are
 * jaen's, declared in foundations/tokens.ts and carried in through jaenConfig
 * above, so both brands' frames and the app inside them round every control
 * and every surface the same way without a line in either site (see
 * design-consistency.md, rule 1). A site that mounts its own system beside
 * the frame, as the search does, declares the two names itself.
 */
const userSemanticColors = userTheme.semanticTokens?.colors ?? {}
const userSemanticShadows = userTheme.semanticTokens?.shadows ?? {}

export const system = createSystem(
  defaultConfig,
  jaenConfig,
  defineConfig({
    theme: {
      tokens: {colors: {brand}},
      semanticTokens: {
        colors: {
          brand: userSemanticColors.brand ?? {},
          gray: userSemanticColors.gray ?? {},
          bg: userSemanticColors.bg ?? {},
          fg: userSemanticColors.fg ?? {},
          border: userSemanticColors.border ?? {}
        },
        shadows: userSemanticShadows
      }
    }
  })
)
