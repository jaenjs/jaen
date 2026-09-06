/**
 * The driver's own page: their colour, whether they share their position,
 * whether their phone is told about a new ride.
 *
 * Three cards, three decisions, all of them the driver's. The colour is
 * saved on the driver's own account with setDriverColor, which the backend
 * allows for the owner and an admin. Position sharing is on by default and
 * the switch here is the opt-out, persisted in localStorage under
 * `limosen:shareLocationEnabled`. The sending itself is not this page's:
 * useDriverPositionSender in hooks/tracking.ts runs one loop per tab, only
 * while the driver has a live ride, and this card shows what that loop is
 * doing and why it is not, in the driver's language. Push is the Web Push
 * subscription against the pylon's VAPID key, see
 * okf/architecture/notifications.md section 7.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  ColorPicker,
  HStack,
  Portal,
  Skeleton,
  Stack,
  Switch,
  Text,
  parseColor,
} from '@chakra-ui/react'
import { FaBell } from '@react-icons/all-files/fa/FaBell'
import { FaCheck } from '@react-icons/all-files/fa/FaCheck'
import { useCaller } from '../auth'
import { fetchDriverColor, setDriverColorMutation } from '../hooks'
import { useDriverPositionSender } from '../hooks/tracking'
import { usePushNotifications } from '../hooks/push'
import { DriverColorDot, EmptyState, ErrorBanner, toaster, PageHeader} from '../components'
import { useI18nCode } from '../i18n'
import { getI18nMe } from '../locales/i18nMe'
import { getI18nTabBar } from '../locales/i18nTabBar'
// The bar's two gates live with the bar, in the plugin's src, so the switch
// here and the shell's padding read the same answers the bar reads.
import { setGlassTabBarEnabled, useAppMode, useGlassTabBarEnabled } from '../../src/components/GlassTabBar'

// ---------------------------------------------------------------------------
// The colours a driver can pick. A driver may type any hex, these are the
// ones that read well as a border and as a dot on both themes.
// ---------------------------------------------------------------------------

const SWATCHES = [
  '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#319795', '#3182CE',
  '#5A67D8', '#805AD5', '#D53F8C', '#718096', '#2D3748', '#000000',
]

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

export function MeView() {
  const caller = useCaller()
  const code = useI18nCode()
  const { strings: t } = getI18nMe(code)

  // ----- colour -----
  const [savedColor, setSavedColor] = useState<string | undefined>(undefined)
  const [color, setColor] = useState('#3182CE')
  const [colorLoading, setColorLoading] = useState(true)
  const [colorSaving, setColorSaving] = useState(false)

  useEffect(() => {
    if (!caller.userId) return
    let cancelled = false
    setColorLoading(true)
    fetchDriverColor(caller.userId).then(c => {
      if (cancelled) return
      setSavedColor(c)
      if (c && isHex(c)) setColor(c)
      setColorLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [caller.userId])

  const saveColor = async () => {
    if (!caller.userId || !isHex(color)) return
    setColorSaving(true)
    try {
      await setDriverColorMutation(caller.userId, color)
      setSavedColor(color)
      toaster.success({ title: t.ColorSaved })
    } catch (err) {
      toaster.error({ title: t.ColorFailed, description: err instanceof Error ? err.message : undefined })
    } finally {
      setColorSaving(false)
    }
  }

  const colorValue = useMemo(() => {
    try {
      return parseColor(color)
    } catch {
      return parseColor('#3182CE')
    }
  }, [color])

  // ----- position -----
  const sender = useDriverPositionSender()

  const timeFormat = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(code, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return null
    }
  }, [code])

  // ----- push -----
  const push = usePushNotifications()

  const togglePush = async (on: boolean) => {
    if (on) {
      const ok = await push.subscribe()
      if (ok) toaster.success({ title: t.PushEnabled })
      else if (push.permission === 'denied' || (typeof Notification !== 'undefined' && Notification.permission === 'denied')) {
        toaster.error({ title: t.PushDenied })
      } else {
        toaster.error({ title: t.PushFailed })
      }
    } else {
      await push.unsubscribe()
      toaster.info({ title: t.PushDisabled })
    }
  }

  const sendTest = async () => {
    try {
      await push.showLocalNotification(t.PushTestTitle, caller.isAdmin ? t.PushTestBodyAdmin : t.PushTestBody)
    } catch (err) {
      toaster.error({ title: t.PushTestFailed, description: err instanceof Error ? err.message : undefined })
    }
  }

  // ----- the glass tab bar, app mode only -----
  const appMode = useAppMode()
  const tabBarOn = useGlassTabBarEnabled()
  const { strings: tb } = getI18nTabBar(code)

  /**
   * The switch "Untere Leiste", shown only when the PWA runs installed: in a
   * browser tab there is no bar to switch on, so there is no switch either.
   * Per device, see GlassTabBar.tsx.
   */
  const tabBarCard = appMode ? (
    <Card.Root variant="outline" bg="bg.surface" data-testid="glass-tab-bar-card">
      <Card.Header>
        <Card.Title>{tb.Heading}</Card.Title>
        <Card.Description>{tb.Body}</Card.Description>
      </Card.Header>
      <Card.Body>
        <Switch.Root
          size="lg"
          colorPalette="brand"
          checked={tabBarOn}
          onCheckedChange={e => setGlassTabBarEnabled(e.checked)}>
          <Switch.HiddenInput data-testid="glass-tab-bar-switch" />
          <Switch.Control />
          <Switch.Label>{tb.Switch}</Switch.Label>
        </Switch.Root>
      </Card.Body>
    </Card.Root>
  ) : null

  /**
   * The push card, for the driver and for the office alike: a dispatcher
   * hears every new booking and every assignment, section 8 of
   * notifications.md, so the card says so to an admin and the same switch
   * subscribes the same browser. One card, drawn by both branches below.
   */
  const forOffice = caller.isAdmin
  const pushCard = (
    <Card.Root variant="outline" bg="bg.surface">
      <Card.Header>
        <Card.Title>{t.PushHeading}</Card.Title>
        <Card.Description>{forOffice ? t.PushBodyAdmin : t.PushBody}</Card.Description>
      </Card.Header>
      <Card.Body gap="3">
        <Switch.Root
          size="lg"
          colorPalette="brand"
          checked={push.isSubscribed}
          disabled={!push.isSupported || push.isBusy}
          onCheckedChange={e => {
            void togglePush(e.checked)
          }}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>{t.PushSwitch}</Switch.Label>
        </Switch.Root>
        {!push.isSupported && (
          <Text textStyle="sm" color="fg.muted">
            {push.needsHomeScreen ? t.PushInstallHint : t.PushUnsupported}
          </Text>
        )}
        {push.isSupported && push.permission === 'denied' && (
          <Text textStyle="sm" color="fg.error">
            {t.PushDenied}
          </Text>
        )}
        {push.error && <ErrorBanner title={t.PushFailed} message={push.error} />}
      </Card.Body>
      <Card.Footer justifyContent="flex-end">
        <Button
          variant="outline"
          onClick={sendTest}
          disabled={typeof window === 'undefined' || !('Notification' in window) || push.permission === 'denied'}>
          <FaBell /> {t.PushTest}
        </Button>
      </Card.Footer>
    </Card.Root>
  )

  if (caller.loading) return null

  if (!caller.isDriver && !caller.isAdmin) {
    return (
      <Stack gap="6" p={{ base: '4', md: '6' }} maxW="full">
        <PageHeader title={t.Heading} />
        {tabBarCard}
        <EmptyState title={t.Heading} description={t.NotADriver} />
      </Stack>
    )
  }

  if (!caller.isDriver) {
    // The office without a car: no colour, no position, the notifications only.
    return (
      <Stack gap="6" p={{ base: '4', md: '6' }} maxW="full">
        <PageHeader title={t.Heading} />
        {pushCard}
        {tabBarCard}
      </Stack>
    )
  }

  return (
    <Stack gap="6" p={{ base: '4', md: '6' }} maxW="full">
      <PageHeader title={t.Heading} subtitle={t.Subtitle} />

      {/* Colour */}
      <Card.Root variant="outline" bg="bg.surface">
        <Card.Header>
          <HStack gap="3">
            <DriverColorDot color={savedColor} size="4" />
            <Card.Title>{t.ColorHeading}</Card.Title>
          </HStack>
          <Card.Description>{t.ColorBody}</Card.Description>
        </Card.Header>
        <Card.Body>
          {colorLoading ? (
            <Skeleton h="10" rounded="control" />
          ) : (
            <ColorPicker.Root
              value={colorValue}
              format="rgba"
              onValueChange={e => setColor(e.value.toString('hex'))}
              maxW="sm">
              <ColorPicker.HiddenInput />
              <ColorPicker.Label>{t.ColorLabel}</ColorPicker.Label>
              <ColorPicker.Control>
                <ColorPicker.Input />
                <ColorPicker.Trigger />
              </ColorPicker.Control>
              <ColorPicker.SwatchGroup mt="3">
                {SWATCHES.map(item => (
                  <ColorPicker.SwatchTrigger key={item} value={item}>
                    <ColorPicker.Swatch value={item} boxSize="7">
                      <ColorPicker.SwatchIndicator>
                        <FaCheck size={10} />
                      </ColorPicker.SwatchIndicator>
                    </ColorPicker.Swatch>
                  </ColorPicker.SwatchTrigger>
                ))}
              </ColorPicker.SwatchGroup>
              <Portal>
                <ColorPicker.Positioner>
                  <ColorPicker.Content>
                    <ColorPicker.Area />
                    <ColorPicker.Sliders />
                  </ColorPicker.Content>
                </ColorPicker.Positioner>
              </Portal>
            </ColorPicker.Root>
          )}
        </Card.Body>
        <Card.Footer justifyContent="flex-end">
          <Button
            colorPalette="brand"
            onClick={saveColor}
            loading={colorSaving}
            disabled={colorLoading || !isHex(color) || color.toUpperCase() === (savedColor ?? '').toUpperCase()}>
            {t.ColorSave}
          </Button>
        </Card.Footer>
      </Card.Root>

      {/* Position */}
      <Card.Root variant="outline" bg="bg.surface">
        <Card.Header>
          <Card.Title>{t.LocationHeading}</Card.Title>
          <Card.Description>{t.LocationBody}</Card.Description>
        </Card.Header>
        <Card.Body gap="3">
          <Switch.Root
            size="lg"
            colorPalette="brand"
            checked={sender.enabled}
            disabled={!sender.supported}
            onCheckedChange={e => sender.setEnabled(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>{t.LocationSwitch}</Switch.Label>
          </Switch.Root>
          {!sender.supported ? (
            <Text textStyle="sm" color="fg.muted">
              {t.LocationUnsupported}
            </Text>
          ) : !sender.enabled ? (
            <Text textStyle="sm" color="fg.muted">
              {t.LocationOff}
            </Text>
          ) : sender.reason === 'denied' ? (
            <ErrorBanner message={t.LocationDenied} />
          ) : sender.reason === 'unavailable' ? (
            <ErrorBanner message={t.LocationUnavailable} />
          ) : sender.reason === 'timeout' ? (
            <ErrorBanner message={t.LocationTimeout} />
          ) : sender.sendError ? (
            <ErrorBanner title={t.LocationSendFailed} message={sender.sendError} />
          ) : !sender.active ? (
            <Text textStyle="sm" color="fg.muted">
              {sender.checkError ? t.LocationCheckFailed : t.LocationNoRide}
            </Text>
          ) : (
            <Text textStyle="sm" color="fg.muted">
              {sender.lastSentAt
                ? t.LocationLastSent.replace(
                    '{time}',
                    timeFormat?.format(sender.lastSentAt) ?? new Date(sender.lastSentAt).toLocaleTimeString()
                  )
                : t.LocationWaiting}
            </Text>
          )}
          {sender.enabled && sender.supported && sender.active && !sender.reason && (
            <Text textStyle="xs" color="fg.muted">
              {t.LocationRideHint}
            </Text>
          )}
        </Card.Body>
      </Card.Root>

      {/* Push */}
      {pushCard}

      {/* The bottom bar, app mode only */}
      {tabBarCard}
    </Stack>
  )
}
