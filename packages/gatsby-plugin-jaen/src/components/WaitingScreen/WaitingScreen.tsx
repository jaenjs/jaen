import {Box, Center, Stack, Text} from '@chakra-ui/react'
import React from 'react'
import {useIntl} from 'react-intl'

import Logo from '../Logo'

/**
 * The screen a person sees while the site is on its way somewhere else.
 *
 * The login page has nothing to draw of its own: it loads the OIDC runtime
 * and sends the browser to the identity server. That takes a moment, and on
 * a phone the moment used to be filled with jaen's page footer, imprint and
 * privacy links centred on an otherwise empty screen, which is the first
 * thing everybody saw when opening the app. This is what fills it instead:
 * the site's logo, centred, and one short line under it that changes every
 * moment and says what is going on, the way the sites' /loading page does
 * it after the sign-in. No spinner, no footer.
 *
 * The lines are product strings, German first, chosen by the intl locale the
 * page already carries. A caller may hand in its own lines.
 */
const LINES: Record<string, string[]> = {
  de: ['Anmeldung wird vorbereitet', 'Weiter zur Anmeldung', 'Gleich geht es los'],
  en: ['Preparing your sign-in', 'On to the sign-in', 'Almost there'],
  tr: ['Giriş hazırlanıyor', 'Girişe yönlendiriliyor', 'Neredeyse hazır'],
  ar: ['جارٍ تحضير تسجيل الدخول', 'جارٍ التحويل إلى تسجيل الدخول', 'أوشكنا على الانتهاء']
}

const LINE_MS = 1400

export interface WaitingScreenProps {
  /** Lines to cycle through, by language; the intl locale picks. */
  lines?: Record<string, string[]>
}

export const WaitingScreen: React.FC<WaitingScreenProps> = ({lines = LINES}) => {
  const intl = useIntl()
  const lang = (intl.locale || 'de').toLowerCase().slice(0, 2)
  const list = lines[lang] ?? lines.de ?? Object.values(lines)[0] ?? []
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    if (list.length < 2) return
    const ticker = window.setInterval(() => {
      setIndex(i => (i + 1) % list.length)
    }, LINE_MS)
    return () => window.clearInterval(ticker)
  }, [list.length])

  return (
    <Center minH="100dvh" bg="bg" px="8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Stack align="center" gap="10">
        <Logo width="min(60vw, 16rem)" height="auto" />
        {/* key on the index so every line mounts afresh and replays the pop. */}
        <Box
          key={index}
          css={{
            '@keyframes jaen-waiting-pop': {
              from: {opacity: 0, transform: 'translateY(0.5rem) scale(0.94)'},
              '60%': {opacity: 1, transform: 'translateY(0) scale(1.03)'},
              to: {opacity: 1, transform: 'translateY(0) scale(1)'}
            },
            animation: 'jaen-waiting-pop 520ms cubic-bezier(0.22, 1, 0.36, 1) both'
          }}>
          <Text
            textStyle="lg"
            fontWeight="medium"
            color="fg.muted"
            textAlign="center"
            role="status"
            aria-live="polite">
            {list[index] ?? ''}
            <Text as="span" aria-hidden="true">
              …
            </Text>
          </Text>
        </Box>
      </Stack>
    </Center>
  )
}

export default WaitingScreen
