/**
 * A failed read or write, said out loud, with a way to try again.
 *
 * The message is whatever the backend or the network answered, unchanged: a
 * FORBIDDEN and an AUTH_REQUIRED are different answers and a screen must be
 * able to show which one it got.
 */
import {Alert, Button, type AlertRootProps} from '@chakra-ui/react'
import {useI18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'

export interface ErrorBannerProps extends Omit<AlertRootProps, 'title'> {
  title?: string
  message?: string | null
  onRetry?: () => void
}

export function ErrorBanner({title, message, onRetry, ...rest}: ErrorBannerProps) {
  const code = useI18nCode()
  const {strings} = getI18nCommon(code)

  return (
    <Alert.Root status="error" variant="subtle" alignItems="center" {...rest}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title ?? strings.ErrorTitle}</Alert.Title>
        {message && <Alert.Description>{message}</Alert.Description>}
      </Alert.Content>
      {onRetry && (
        <Button size="sm" variant="outline" colorPalette="red" onClick={onRetry}>
          {strings.Retry}
        </Button>
      )}
    </Alert.Root>
  )
}
