# gatsby-plugin-jaen

The Gatsby plugin that mounts jaen's CMS around a site: the providers, the
frame, the CMS routes and the theme. The options are declared and validated in
`gatsby/gatsby-node.ts`, the browser side reads them through
`src/gatsby/types.ts`.

## Colour mode

jaen mounts one `next-themes` provider for the whole site and writes the
resolved mode as a class onto `<html>`, which is what Chakra v3's dark
condition selects on. The mode a visitor lands on is the site's choice:

```ts
{
  resolve: 'gatsby-plugin-jaen',
  options: {
    colorMode: {default: 'dark'} // 'light' | 'dark' | 'system'
  }
}
```

`light` is the default when the option is absent, and it is what every site
shipped before the option existed. `dark` puts the dark class on `<html>`
before the first paint through the no-flash script in `gatsby-ssr.tsx`, so
there is no white flash. `system` follows the OS. A visitor's own toggle is
stored by next-themes under the `theme` key and wins over the default on the
next visit, whichever the site chose.

The dark palette is the site's as well. Every screen inside jaen's frame, the
CMS and an app plugin alike, reads the semantic names `bg.*`, `fg.*` and
`border.*` and the `brand` palette from jaen's system, which takes them from
the site's theme shadow at `src/gatsby-plugin-jaen/theme/theme.ts` and falls
back to jaen's own grey halves for whatever the site leaves out. A brand that
turns dark on by default also decides what dark looks like, in its own theme,
without touching jaen or the app. A name Chakra v3 defines itself (`bg.subtle`,
`bg.muted`, `fg.muted`, `fg.subtle`, `fg.inverted`, `border.emphasized`) has
to be spelled with `_light` rather than `base`, or v3's own light value wins
the selector fight; `src/theme/foundations/semantic-tokens.ts` explains why.
