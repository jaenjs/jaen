/**
 * A spinner over whatever is loading.
 *
 * `overlay` lays it over a `position: relative` parent and dims the stale
 * content underneath, which is the right shape for a list that is refreshing.
 * Without it the spinner is a block of its own, for a screen that has nothing
 * to show yet.
 */
import {Center, Spinner, Text, type CenterProps} from '@chakra-ui/react'
import {useI18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'

export interface LoadingOverlayProps extends Omit<CenterProps, 'overlay'> {
  overlay?: boolean
  label?: string
}

export function LoadingOverlay({overlay = false, label, ...rest}: LoadingOverlayProps) {
  const code = useI18nCode()
  const {strings} = getI18nCommon(code)

  return (
    <Center
      flexDirection="column"
      gap="3"
      role="status"
      aria-live="polite"
      {...(overlay
        ? {
            position: 'absolute',
            inset: 0,
            zIndex: 'docked',
            bg: 'bg.canvas/70',
            backdropFilter: 'blur(1px)'
          }
        : {py: '12'})}
      {...rest}>
      <Spinner size="lg" colorPalette="brand" color="colorPalette.solid" />
      <Text textStyle="sm" color="fg.muted">
        {label ?? strings.Loading}
      </Text>
    </Center>
  )
}
