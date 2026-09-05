# gatsby-plugin-jaen

The Gatsby plugin that mounts jaen's CMS around a site: the providers, the
frame, the CMS routes and the theme. The options are declared and validated in
`gatsby/gatsby-node.ts`, the browser side reads them through
`src/gatsby/types.ts`.

## Colour mode

The public website has no colour mode. Only jaen's own pages (the `/cms` tree,
`/login`, `/logout`, `/settings`, `/signup`) and an app plugin's pages under
`/app` have one, and the mode a visitor lands on there is the site's choice:

```ts
{
  resolve: 'gatsby-plugin-jaen',
  options: {
    colorMode: {default: 'dark'} // 'light' | 'dark' | 'system'
  }
}
```

The option applies to the CMS and the app areas, the public pages have no
colour mode. `light` is the default when the option is absent, and it is what
every site shipped before the option existed. `dark` puts the dark class on
`<html>` before the first paint of those areas through the no-flash script in
`gatsby-ssr.tsx`, so there is no white flash. `system` follows the OS. A
visitor's own toggle is stored by next-themes under the `theme` key and wins
over the default on the next visit, whichever the site chose.

The split is one provider with a route-dependent `forcedTheme`, see
`src/gatsby/color-mode-scope.tsx`: outside the listed routes next-themes is
forced to light and persists nothing, so a stored choice made inside the app
survives a detour over the public pages. The route list lives there once and
the no-flash script reads the same list.

The dark palette is the site's as well. Every screen inside jaen's frame, the
CMS and an app plugin alike, reads the semantic names `bg.*`, `fg.*` and
`border.*` and the `brand` palette from jaen's system, which takes them from
the site's theme shadow at `src/gatsby-plugin-jaen/theme/theme.ts` and falls
back to jaen's own grey halves for whatever the site leaves out. Since the
public pages are forced light, a `_dark` half defined there only ever renders
inside jaen and the app. A name Chakra v3 defines itself (`bg.subtle`,
`bg.muted`, `fg.muted`, `fg.subtle`, `fg.inverted`, `border.emphasized`) has
to be spelled with `_light` rather than `base`, or v3's own light value wins
the selector fight; `src/theme/foundations/semantic-tokens.ts` explains why.
