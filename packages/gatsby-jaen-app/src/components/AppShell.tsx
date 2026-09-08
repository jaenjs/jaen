/**
 * The frame every app screen sits in: the content under the CMS frame, and
 * the two things that run on every screen, the driver's position sender and
 * the shift prefetch.
 *
 * There is no title bar of the shell's own any more. It repeated, at 3.5rem
 * under the frame's 4rem, the very word every view draws as its heading
 * through shared/components/PageHeader, so the frame is the chrome and the
 * page heading is the title.
 *
 * The navigation is not drawn here any more, and not registered here either.
 * AppFrameMenu.tsx puts it into jaen's frame from the plugin's root, on every
 * page of the site, into the two drawers that are the app TOP LEFT and the
 * person TOP RIGHT, see useFrameMenu.ts and okf/architecture/navigation.md.
 * The bottom bar
 * that used to sit on a phone is gone: Apple put the home indicator exactly
 * there, and nothing in this shell is fixed to the bottom of the viewport on
 * any breakpoint by default. The one exception is opt-in: the glass tab bar
 * of GlassTabBar.tsx, mounted here, which exists only in app mode (the PWA
 * installed) and only while the switch on the Me page is on. While it is on,
 * and only then, the content gets the bottom padding that clears it.
 *
 * Theme bridge, or rather the absence of one. There is nothing to provide
 * here and the app must not mount a provider of its own. gatsby-plugin-jaen's
 * wrapRootElement mounts next-themes and one ChakraProvider around every
 * route, and every /app page declares `layout: {name: 'jaen'}`, so the system
 * in scope is jaen's: Chakra's defaults, jaen's semantic tokens (bg.canvas,
 * bg.surface, fg.default, fg.muted, border.default and friends, each with a
 * dark half) and the brand ramp the site hands over through its theme shadow.
 * A second ChakraProvider here would emit a second global stylesheet and
 * re-declare every token for the subtree, which is exactly how the CMS chrome
 * and the site got out of step before. Colour mode is next-themes' `.dark`
 * class on <html>, read through `useColorMode` from 'jaen' when a component
 * needs the value, and never toggled from inside the app.
 *
 * Chrome is not selectable, data is (design-consistency.md, rule 11). The one
 * place the app says it is app.css, keyed on this shell's own class, and not a
 * style prop here: a dialog, a drawer, a sheet and a toast render into a
 * portal on `body`, outside this element, and a rule written on this Box would
 * miss every one of them. See "Chrome is not selectable" in src/styles/app.css
 * and shared/components/Selectable.tsx for the mark that says a value is data.
 *
 * The site's own `limosen.*` tokens are not in scope on this branch: jaen's
 * Layout mounts the site system only for pages outside the jaen layout, so a
 * `bg="limosen.bg.card"` here would resolve to nothing. The app looks like the
 * site through the brand ramp, which is the same gold in both systems.
 */
import React, {useEffect, useMemo} from 'react'
import {Box} from '@chakra-ui/react'
import {FaExclamationTriangle} from '@react-icons/all-files/fa/FaExclamationTriangle'
import {useCaller, resetCaller} from '../../shared/auth'
import {useI18nCode} from '../../shared/i18n'
import {getI18nCommon} from '../../shared/locales/i18nCommon'
import {EmptyState, ErrorBanner, PullToRefresh} from '../../shared/components'
import {ViewRefreshProvider} from '../../shared/hooks/view-refresh'
import {DriverPositionSender} from '../../shared/hooks/tracking'
import {gql} from '../../shared/hooks/bookings'
import {
  fetchTransfer,
  transferPath,
  transferSlug,
  useTransferList
} from '../../shared/hooks/transfers'
import {
  isOnline,
  isOfflineMessage,
  setOfflineLanguage
} from '../../shared/offline'
import {getI18nOffline} from '../../shared/locales/i18nOffline'
import {setErrorLanguage} from '../../shared/errors'
import {navFor} from './nav'
import {
  GlassTabBar,
  GLASS_TAB_BAR_CLEARANCE,
  useGlassTabBarActive
} from './GlassTabBar'
import {Swipes} from './Swipes'

export interface AppShellProps {
  children: React.ReactNode
}

// --------------- The shift, prefetched ---------------

/** A day as the list's chips spell it, local. */
const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * The exact document the driver's list sends for one chip, through the
 * exact code path, so the stored answer is the one the screen asks for. It
 * renders nothing, the hook's request is the whole point.
 */
function ListWarmer({day}: {day: string}) {
  useTransferList({pageSize: 50, fromISO: day, toISO: day})
  return null
}

/** The subjects whose shift has been prefetched in this tab. */
const prefetched = new Set<string>()

/**
 * Gatsby's own resources of one page, into the service worker's cache.
 *
 * A ride is a page of its own, /app/transfers/[transferId]/, with page-data,
 * a component chunk and static query results the list's page does not
 * carry. Gatsby loads them on a client-side navigation and, when it cannot,
 * hands the path to the browser as a full navigation, which offline is the
 * browser's error page: a driver who never opened a ride online could not
 * open one offline, whatever the store held. `loadPage` is the very call a
 * navigation makes, it fetches all three at once and the worker keeps what
 * it fetches (page-data StaleWhileRevalidate, chunks CacheFirst). Its
 * `prefetch` is not enough: it waits for an idle moment and fetches the
 * page-data only. Missing loader: nothing is fetched, and the ride opens as
 * it did before.
 */
const warmPage = (path: string) => {
  try {
    const loader = (
      window as {___loader?: {loadPage?: (p: string) => Promise<unknown>}}
    ).___loader
    void loader?.loadPage?.(path)?.catch?.(() => {
      // Swallowed on purpose: the page is a convenience of the store, see above.
    })
  } catch {
    // Same: no loader, no warm-up.
  }
}

/**
 * The driver's rides for the next 48 hours, once per session and only with
 * a connection, so the store holds the shift before the connection is lost
 * and not only the screens the driver happened to open. Two things go
 * through the layer: today's and tomorrow's list documents, by mounting the
 * list's own hook, and every ride's detail document by the same read the
 * ride screen makes, `fetchTransfer` by the ride's slug. See
 * okf/architecture/offline.md.
 */
function DriverShiftPrefetch({userId}: {userId: string}) {
  const days = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)
    return {today: localDay(today), tomorrow: localDay(tomorrow)}
  }, [])

  useEffect(() => {
    if (prefetched.has(userId) || !isOnline()) return
    prefetched.add(userId)
    let cancelled = false
    void (async () => {
      try {
        const now = new Date()
        const end = new Date(now.getTime() + 48 * 3_600_000)
        // The scope confines the list to the caller, no driverId is sent.
        const result = await gql(
          'transfers',
          {
            args: {
              first: 100,
              fromISO: now.toISOString(),
              toISO: end.toISOString()
            }
          },
          '{ edges { node { id code } } }'
        )
        const rows: Array<{id: string; code: string}> = (
          Array.isArray(result?.edges) ? result.edges : []
        )
          .map((e: any) => e?.node)
          .filter((n: any) => n && typeof n.id === 'string')
          .map((n: any) => ({id: String(n.id), code: String(n.code ?? '')}))
        for (const row of rows) {
          if (cancelled || !isOnline()) return
          await fetchTransfer(transferSlug(row))
          // The page's route is the literal the app's pages use, see src/pages/app.
          warmPage(`/app${transferPath(row)}/`)
        }
      } catch {
        // Swallowed on purpose: the prefetch is a convenience, the screens
        // read for themselves, and a failure here would only show as an
        // emptier store on the next outage. The set is left as it is so a
        // flaky start does not retry on every render.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <>
      <ListWarmer day={days.today} />
      <ListWarmer day={days.tomorrow} />
    </>
  )
}

export function AppShell({children}: AppShellProps) {
  const caller = useCaller()
  const code = useI18nCode()
  const {strings} = getI18nCommon(code)
  const offline = getI18nOffline(code).strings
  // The layer's refusals are thrown outside React, and read like the screen.
  setOfflineLanguage(code)
  // And so does every other failure: a machine answer becomes a sentence
  // where the error is made, not where a screen draws it (rule 14,
  // shared/errors.ts).
  setErrorLanguage(code)

  const nothingToOffer = !caller.loading && navFor(caller).length === 0
  // App mode and the switch on. The bar itself hides at md in CSS, and so
  // does the padding, so a tablet turned sideways is not re-rendered.
  const tabBar = useGlassTabBarActive()

  const retry = () => {
    resetCaller()
    window.location.reload()
  }

  // iOS runs a pinch as a gesture event on the document, whatever the
  // viewport meta says in a Safari tab, and the installed app honours the
  // meta but not touch-action. Cancelling gesturestart outside a map is the
  // one thing that stops both; the map keeps its own pinch (rule 7).
  useEffect(() => {
    const refuse = (e: Event) => {
      const target = e.target as Element | null
      if (target?.closest?.('.mapboxgl-map')) return
      e.preventDefault()
    }
    document.addEventListener('gesturestart', refuse, {passive: false})
    return () => document.removeEventListener('gesturestart', refuse)
  }, [])

  return (
    <Box
      // The class is a marker for app.css, which hides the CMS footer beneath
      // the app and zeroes the margins the site layout would add.
      className="jaen-app"
      dir={code === 'ar-EG' ? 'rtl' : 'ltr'}
      display="flex"
      flexDirection="column"
      minH="calc(100dvh - 4rem)"
      bg="bg.canvas"
      color="fg.default">
      {/* The driver's position sender, one engine per tab, mounted once here
          so it runs on every screen. It renders nothing, and for anybody
          without the driver role it starts nothing, see hooks/tracking.ts. */}
      {caller.isDriver ? <DriverPositionSender /> : null}
      {/* The driver's shift for the next 48 hours, into the offline store,
          once per session. A dispatcher who also drives gets it too. */}
      {caller.isDriver && caller.userId ? (
        <DriverShiftPrefetch userId={caller.userId} />
      ) : null}

      <Box
        as="main"
        flex="1"
        position="relative"
        pb={tabBar ? {base: GLASS_TAB_BAR_CLEARANCE, md: 0} : undefined}
        // The height a view gets when it wants the screen and nothing else,
        // the frame's 4rem off the top and the glass bar's clearance off the
        // bottom where the bar is on (design-consistency.md, rule 12). It is
        // declared here because this is the box that carries that padding, so
        // a view saying h="var(--app-view-h)" is exactly this box's content
        // and the document never grows past the viewport. The map screen is
        // the one that reads it; every other view is as tall as it likes.
        css={
          tabBar
            ? {
                '--app-view-h': `calc(100dvh - 4rem - ${GLASS_TAB_BAR_CLEARANCE})`,
                '@media (min-width: 48rem)': {
                  '--app-view-h': 'calc(100dvh - 4rem)'
                }
              }
            : {'--app-view-h': 'calc(100dvh - 4rem)'}
        }>
        {caller.error ? (
          <Box p="4">
            {/* Offline with nothing stored, the roles could not be read: the
                decided wording, not "who are you", see offline.md. */}
            {isOfflineMessage(caller.error) ? (
              <ErrorBanner
                title={offline.BannerNoData}
                message={caller.error}
                onRetry={retry}
              />
            ) : (
              <ErrorBanner
                title={strings.CallerErrorTitle}
                message={strings.CallerErrorBody}
                onRetry={retry}
              />
            )}
          </Box>
        ) : nothingToOffer ? (
          <EmptyState
            title={strings.NoAccessTitle}
            description={strings.NoAccessBody}
            icon={<FaExclamationTriangle />}
          />
        ) : (
          // The view registers its query with the provider, the pull below
          // md and the header's RefreshButton both read it (rules 5a, 5b).
          // The swipes below md sit inside the pull: between the bar's
          // places on a bar view, the edge swipe back on a sub view, see
          // Swipes.tsx.
          <ViewRefreshProvider>
            <PullToRefresh>
              <Swipes>{children}</Swipes>
            </PullToRefresh>
          </ViewRefreshProvider>
        )}
      </Box>
      {/* Renders nothing outside app mode or with the switch off. */}
      <GlassTabBar />
    </Box>
  )
}
