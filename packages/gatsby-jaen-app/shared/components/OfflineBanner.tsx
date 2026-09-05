/**
 * The one line that says the screen is not current.
 *
 * Rendered above the driver's rides and on the ride screen while the state
 * is offline: "Offline, Stand 14:32" from the instant of the newest stored
 * answer served since the connection went, or a bare "Offline" before any
 * stored answer has been shown. It goes away by itself when the connection
 * returns, because it renders from the same state the layer publishes, see
 * shared/offline.ts and okf/architecture/offline.md.
 */
import {Alert, type AlertRootProps} from '@chakra-ui/react'
import {useI18nCode, type I18nCode} from '../i18n'
import {fillOffline, getI18nOffline} from '../locales/i18nOffline'
import {useOnline} from '../offline'

/** HH:mm in the account's language, the ISO instant otherwise. */
export const formatStoredAt = (iso: string, code: I18nCode): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(code, {hour: '2-digit', minute: '2-digit'}).format(d)
  } catch {
    return d.toTimeString().slice(0, 5)
  }
}

export type OfflineBannerProps = Omit<AlertRootProps, 'title'>

export function OfflineBanner(props: OfflineBannerProps) {
  const {online, storedAt} = useOnline()
  const code = useI18nCode()
  if (online) return null
  const {strings} = getI18nOffline(code)
  const title = storedAt ? fillOffline(strings.Banner, {time: formatStoredAt(storedAt, code)}) : strings.BannerNoData

  return (
    <Alert.Root
      status="warning"
      variant="subtle"
      alignItems="center"
      data-testid="offline-banner"
      data-stored-at={storedAt ?? ''}
      {...props}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{strings.BannerHint}</Alert.Description>
      </Alert.Content>
    </Alert.Root>
  )
}
