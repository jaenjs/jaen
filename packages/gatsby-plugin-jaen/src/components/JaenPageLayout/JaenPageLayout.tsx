import {Box, Container} from '@chakra-ui/react'

import {Footer} from './components/Footer/Footer'

export interface JaenPageLayoutProps {
  layout?: 'full' | 'form' | 'content' | 'bare'
  children: React.ReactNode
}

export const JaenPageLayout: React.FC<JaenPageLayoutProps> = ({
  layout = 'content',
  ...props
}) => {
  /*
    A bare page is the children and nothing else: no offset for the frame
    (the pages that ask for it set withoutJaenFrame), no container and no
    footer. The OIDC callback page uses it: on a phone that screen is visible
    for a second between the login and the app, and a footer with imprint
    and privacy links on it reads as if the app had failed to load.
  */
  if (layout === 'bare') {
    return (
      <Box id="momo" minH="100dvh">
        {props.children}
      </Box>
    )
  }

  return (
    <Box
      id="momo"
      pt={layout === 'full' ? '0' : '4rem'}
      minH="calc(100dvh - 4rem)">
      {layout === 'full' ? (
        <Box>{props.children}</Box>
      ) : (
        <Container maxW={layout === 'form' ? 'container.md' : 'container.xl'}>
          {props.children}
        </Container>
      )}

      <Container maxW={layout === 'full' ? 'full' : 'container.xl'}>
        <Footer
          links={[
            {
              label: 'Imprint',
              path: '/imprint'
            },
            {
              label: 'Privacy Policy',
              path: '/privacy-policy'
            },
            {
              label: 'Terms of Service',
              path: '/terms-of-service'
            },
            {
              label: 'Contact',
              path: '/contact'
            },
            {
              label: 'About',
              path: '/about'
            }
          ]}
        />
      </Container>
    </Box>
  )
}
