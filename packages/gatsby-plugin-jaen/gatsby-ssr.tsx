import {GatsbySSR} from 'gatsby'

import './dist/jaen.css'

export {wrapPageElement} from './src/gatsby/wrap-page-element'
export {wrapRootElement} from './src/gatsby/wrap-root-element'

import {
  COLOR_MODE_ROUTE_PREFIXES,
  COLOR_MODE_STORAGE_KEY
} from './src/gatsby/color-mode-scope'

/**
 * The no-flash script, hand-written because next-themes only ships a Next.js
 * one. It has to agree with next-themes' storage contract exactly, or the two
 * disagree for one paint: the key is COLOR_MODE_STORAGE_KEY (`jaen:colorMode`,
 * the provider's `storageKey`), values light|dark|system, class on the <html>
 * element. The class is what v3's conditions select on
 * (`.dark, .dark .chakra-theme:not(.light)`), and `color-scheme` is what stops
 * the browser painting white scrollbars over a dark page.
 *
 * The public website has no colour mode. Outside the routes listed in
 * color-mode-scope.tsx the script writes light and reads nothing, exactly as
 * ColorModeScope's forcedTheme will once React is up. Inside them the fallback
 * is the site's `colorMode.default` plugin option, 'light' when the site says
 * nothing, in lockstep with the provider that reads the same option: v2's
 * effective default was the literal "light" that extendTheme put in
 * theme.config, so an unconfigured visitor gets light here whatever the OS
 * says. A site that sets 'dark' gets the dark class on <html> before the
 * first paint of its CMS and app, which is the whole point of this script.
 * See the comment over the provider for why the site's
 * initialColorMode:'system' never counted.
 *
 * Nothing else is read. Two older keys sit in most returning browsers:
 * next-themes' default `theme`, which this script used to read, and Chakra
 * v2's `chakra-ui-color-mode`, which v2's ColorModeScript WROTE as the
 * resolved mode on every first paint, so it holds 'light' for nearly every
 * desktop browser that ever opened the old site. Until 2026-09-06 the script
 * copied the second into the first when the first was empty, and the result
 * was that limosen's dark default never reached a desktop browser while the
 * phone's PWA, installed after the change, was dark. Both legacy keys are
 * left alone now, neither read nor deleted, and only the toggle writes the
 * new one. A visitor who chose light on purpose chooses it once more.
 *
 * It moves from setPreBodyComponents to setHeadComponents so it runs before the
 * first paint rather than after the opening body tag.
 *
 * No suppressHydrationWarning is needed, unlike in Next.js: Gatsby renders
 * <html> from its own default-html.js and hydrates only #___gatsby, so React
 * never diffs the class this writes.
 */
const noFlash = (defaultMode: 'light' | 'dark' | 'system') => `(function(){try{
var d=document.documentElement,p=location.pathname.replace(/\\/+$/,'')||'/',
scoped=${JSON.stringify([...COLOR_MODE_ROUTE_PREFIXES])}.some(function(x){return p===x||p.indexOf(x+'/')===0}),
s=scoped?localStorage.getItem(${JSON.stringify(COLOR_MODE_STORAGE_KEY)}):'light';
if(s!=='light'&&s!=='dark'&&s!=='system')s=${JSON.stringify(defaultMode)};
var m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',
r=s==='system'?m:s;
d.classList.remove('light','dark','c_darkmode');d.classList.add(r);
if(r==='dark')d.classList.add('c_darkmode');
d.style.colorScheme=r;
}catch(e){}})()`

/**
 * The consent banner's first layer is React and comes out of the static HTML
 * (jaen's contexts/cookie-consent.tsx), so its two states have to be decided
 * before the first paint, without the bundle.
 *
 * The stylesheet vanilla-cookieconsent ships starts `#cm` at `visibility:
 * hidden` and `opacity: 0`, because the plugin used to reveal it from script
 * after building it. The first rule undoes that for the banner jaen renders,
 * and only for that one: the plugin's own modals, settings modal included,
 * keep being driven by the classes the plugin puts on <html>. Two ids and an
 * attribute outrank every selector the plugin has for `#cm`, so the rule wins
 * wherever gatsby happens to place this block.
 *
 * The second rule takes the banner away again for a visitor who has already
 * answered. That decision needs the cookie, hence the script below, and it has
 * to be made before anything is drawn — a banner that paints at 1.4 s and
 * disappears at hydration would be worse than the late one it replaces.
 *
 * The attribute name is jaen's `STATIC_BANNER_ATTRIBUTE`, repeated here rather
 * than imported, the same way noFlash above repeats next-themes' storage
 * contract. Both sides say so.
 */
const COOKIE_CONSENT_STYLE = `#cc--main[data-jaen-cc-banner] #cm{opacity:1;transform:scale(1);visibility:visible}
[data-jaen-cc-consented] #cc--main[data-jaen-cc-banner]{display:none}`

/**
 * Decide the banner's state from the cookie, before the first paint.
 *
 * The validity test is vanilla-cookieconsent 2.9.2's own, read out of
 * dist/cookieconsent.js: a stored consent counts only with `consent_uuid`,
 * `consent_date` and `last_consent_update` all present. Get it wrong in either
 * direction and either every visitor who has consented is asked again, or a
 * visitor who has not is never asked. `revision` is written as 0 and a cookie
 * from before that field existed is treated as 0 too, because the plugin skips
 * the comparison entirely unless `revision` is passed to run(), which it is
 * not. The value is stored raw by the plugin and percent-encoded by jaen, so
 * both parses have to be tried, in the plugin's order.
 *
 * The click listener closes the gap the static banner opens: it is on screen
 * from the first paint but cannot answer until React has hydrated, seconds
 * later on this site. It records the last consent button pressed in that
 * window and the banner replays it on mount, which also sets the property to
 * undefined and puts this listener to sleep.
 */
const COOKIE_CONSENT_STATE = `(function(){try{
var m=document.cookie.match(/(?:^|;)\\s*cc_cookie\\s*=\\s*([^;]+)/);
if(m){var c;try{c=JSON.parse(m[1])}catch(e){c=JSON.parse(decodeURIComponent(m[1]))}
if(c&&c.consent_uuid&&c.consent_date&&c.last_consent_update&&(c.revision||0)===0)
document.documentElement.setAttribute('data-jaen-cc-consented','')}
}catch(e){}
try{window.__JAEN_COOKIE_CONSENT_EARLY_CLICK__=null;
document.addEventListener('click',function(e){
var t=e.target,b=t&&t.closest&&t.closest('#c-p-bn,#c-s-bn,[data-cc="c-settings"]');
if(b&&window.__JAEN_COOKIE_CONSENT_EARLY_CLICK__!==undefined)
window.__JAEN_COOKIE_CONSENT_EARLY_CLICK__=b.id||'c-settings'},true)}catch(e){}})()`

interface I18nRenderOptions {
  siteUrl?: string
  i18n?: {
    defaultLocale: string
  }
  colorMode?: {
    default?: 'light' | 'dark' | 'system'
  }
}

interface LocalePageContext {
  locale?: string
  translations?: Array<{locale: string; path: string}>
}

export const onRenderBody: GatsbySSR['onRenderBody'] = (
  args,
  pluginOptions
) => {
  const {setHtmlAttributes, setHeadComponents, pathname} = args

  const {colorMode} = (pluginOptions ?? {}) as I18nRenderOptions

  setHeadComponents([
    <script
      key="jaen-color-mode"
      dangerouslySetInnerHTML={{__html: noFlash(colorMode?.default ?? 'light')}}
    />,
    <style
      key="jaen-cookie-consent-style"
      dangerouslySetInnerHTML={{__html: COOKIE_CONSENT_STYLE}}
    />,
    <script
      key="jaen-cookie-consent-state"
      dangerouslySetInnerHTML={{__html: COOKIE_CONSENT_STATE}}
    />
  ])

  // Localized pages: <html lang>, hreflang alternates and og:locale, built
  // from the locale context the page generator wrote. loadPageDataSync only
  // exists during build-html, hence the guard.
  const loadPageDataSync = (args as {loadPageDataSync?: (path: string) => any})
    .loadPageDataSync

  if (!loadPageDataSync || !pathname) return

  let pageContext: LocalePageContext | undefined

  try {
    pageContext = loadPageDataSync(pathname)?.result?.pageContext
  } catch {
    return
  }

  const locale = pageContext?.locale

  if (!locale) return

  setHtmlAttributes({lang: locale})

  const {siteUrl, i18n} = (pluginOptions ?? {}) as I18nRenderOptions
  const base = siteUrl?.replace(/\/+$/, '')

  if (!base) return

  const absolute = (path: string): string =>
    path === '/' ? `${base}/` : `${base}${path}`

  const translations = pageContext?.translations ?? []
  const variants = new Map<string, string>([[locale, pathname]])

  for (const translation of translations) {
    if (translation.locale && translation.path) {
      variants.set(translation.locale, translation.path)
    }
  }

  const headComponents = [
    <meta
      id="og-locale"
      property="og:locale"
      content={locale.replace('-', '_')}
      key="jaen-og-locale"
    />
  ]

  if (variants.size > 1) {
    for (const [variantLocale, variantPath] of Array.from(
      variants.entries()
    ).sort(([a], [b]) => a.localeCompare(b))) {
      headComponents.push(
        <link
          rel="alternate"
          hrefLang={variantLocale}
          href={absolute(variantPath)}
          key={`jaen-hreflang-${variantLocale}`}
        />
      )

      if (variantLocale !== locale) {
        headComponents.push(
          <meta
            property="og:locale:alternate"
            content={variantLocale.replace('-', '_')}
            key={`jaen-og-locale-alt-${variantLocale}`}
          />
        )
      }
    }

    const defaultPath = i18n?.defaultLocale
      ? variants.get(i18n.defaultLocale)
      : undefined

    if (defaultPath) {
      headComponents.push(
        <link
          rel="alternate"
          hrefLang="x-default"
          href={absolute(defaultPath)}
          key="jaen-hreflang-x-default"
        />
      )
    }
  }

  setHeadComponents(headComponents)
}
