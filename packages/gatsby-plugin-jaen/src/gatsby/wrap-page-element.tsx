import {
  FieldHighlighterProvider,
  PageProps,
  useAuth,
  withAuthSecurity
} from 'jaen'
import {Flex} from '@chakra-ui/react'
import {GatsbyBrowser, Slice} from 'gatsby'
import {JaenIntlProvider} from './wrap-root-element'
import React from 'react'

// Deliberately not `import * as Sentry from '@sentry/gatsby'`. That single
// line put 159.6 KB of @sentry/core and @sentry/utils into the eagerly loaded
// app chunk of every consuming site, for one call that only ever runs for a
// signed-in admin. setSentryUser reaches the SDK only when consent has already
// started it. See its comment in on-client-entry.ts.
import {setSentryUser} from './on-client-entry'

import {DynamicPageRenderer} from './DynamicPageRenderer'
import Layout from './Layout'

// Import other necessary components here

interface CustomPageElementProps extends Omit<PageProps, 'children'> {
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>
}

const CustomPageElement: React.FC<CustomPageElementProps> = ({
  children,
  ...props
}) => {
  const auth = useAuth()

  if (auth.isAuthenticated && auth.user) {
    setSentryUser({
      email: auth.user.profile.email,
      id: auth.user.profile.sub,
      username: auth.user.profile.preferred_username,
      details: auth
    })
  }

  const withoutJaenFrame = props.pageContext?.pageConfig?.withoutJaenFrame

  if (!withoutJaenFrame) {
    return (
      <Flex
        pos="relative"
        flexDirection="column"
        visibility={
          props.pageContext?.pageConfig?.auth?.isRequired &&
          !auth.isAuthenticated
            ? 'hidden'
            : 'visible'
        }>
        {/* The frame follows the account's language, as the Layout below
            does for the page. Without this the nearest provider is the
            locale plugin's, which takes the language off the path prefix,
            en-US on every unprefixed route: measured 2026-09-05 on
            limosen.at, the drawer said Einstellungen on /de/ and Settings
            and Logout on /cms/ and /app/transfers/ beside a German page. */}
        {auth.isAuthenticated && (
          <JaenIntlProvider>
            <Slice
              alias="jaen-frame"
              jaenPageId={props.pageContext?.jaenPageId}
              pageConfig={props.pageContext?.pageConfig as any}
            />
          </JaenIntlProvider>
        )}

        <Layout pageProps={props}>{children}</Layout>
      </Flex>
    )
  }

  return <Layout pageProps={props}>{children}</Layout>
}

const SecureRendered = withAuthSecurity(DynamicPageRenderer)

const withJaenPageProvider = <
  P extends React.ComponentProps<typeof DynamicPageRenderer>
>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return props => {
    return <SecureRendered {...props} Component={Component} />
  }
}

const JaenPageElement = withJaenPageProvider(CustomPageElement)

export const wrapPageElement: GatsbyBrowser['wrapPageElement'] = ({
  element,
  props
}) => {
  return (
    <FieldHighlighterProvider path={props.location.pathname}>
      <JaenPageElement {...(props as any)} children={element} />
    </FieldHighlighterProvider>
  )
}

export interface UseTemplateReturn {}
