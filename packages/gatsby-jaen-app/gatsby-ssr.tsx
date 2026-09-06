import './src/styles/app.css'
import React from 'react'
import {I18nProvider} from './shared/i18n'
import {AppFrameMenu} from './src/components/AppFrameMenu'
import {OfflineSession} from './shared/offline'
import type {GatsbySSR} from 'gatsby'

export const wrapRootElement = ({element}: {element: React.ReactNode}) => (
  <I18nProvider code="de-AT">{element}</I18nProvider>
)

/**
 * The app's entries in the frame, on every page and not only under /app.
 * wrapPageElement runs inside every plugin's wrapRootElement, so jaen's
 * JaenFrameMenuProvider and AuthenticationProvider are in scope here.
 */
export const wrapPageElement = ({element}: {element: React.ReactNode}) => (
  <>
    {element}
    <AppFrameMenu />
    {/* The offline store is cleared when the session is removed, on /logout
        as on any page, see shared/offline.ts. */}
    <OfflineSession />
  </>
)

/**
 * The app does not zoom (design-consistency.md, rule 7).
 *
 * Both sites emit their own viewport meta from their gatsby-ssr.tsx, keyed
 * "viewport", with viewport-fit=cover on the /app routes so the safe-area
 * insets are real numbers. A second viewport element would leave the browser
 * to pick one, so on the app's routes that element is replaced, not joined:
 * every onRenderBody has run by the time onPreRenderHTML is called, the
 * site's included, and the head is rewritten here with the one meta that
 * forbids the pinch. Installed web apps honour maximum-scale and
 * user-scalable, Safari in a tab ignores them, which is right: the public
 * pages keep their meta and their zoom untouched, this never runs for them.
 */
const APP_VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'

const isViewportMeta = (node: React.ReactNode): boolean =>
  React.isValidElement(node) &&
  (node.key === 'viewport' ||
    (node.type === 'meta' &&
      (node.props as {name?: string})?.name === 'viewport'))

export const onPreRenderHTML: GatsbySSR['onPreRenderHTML'] = ({
  pathname,
  getHeadComponents,
  replaceHeadComponents
}) => {
  if (!pathname?.startsWith('/app')) return
  const head = getHeadComponents().filter(node => !isViewportMeta(node))
  replaceHeadComponents([
    <meta key="viewport" name="viewport" content={APP_VIEWPORT} />,
    ...head
  ])
}
