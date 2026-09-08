/**
 * "Bar erhalten": the driver marks their own ride paid in cash, and an admin
 * reads and corrects it. okf/architecture/dispatch.md section 14.3.
 *
 * One component for the three screens that carry the fact, so the amount, the
 * instant and the author cannot be drawn three different ways: the driver's
 * ride screen, the dispatcher's money section on the transfer detail, and the
 * month's rides under the billing screen's Fahrer half. Its words are
 * i18nCash, a catalogue of its own for the same reason.
 *
 * Who sees it: the driver of the ride, on their own ride, from ON_THE_WAY on,
 * and an admin on any ride. Who does not: everybody else, and nobody at all
 * on a ride whose paying party is not the passenger, because then nobody in
 * the car is paying. The pylon refuses the same two cases with
 * CASH_NOT_OFFERED and CASH_TOO_EARLY, so what is drawn here is a courtesy
 * and the refusal is the rule.
 */
import {useEffect, useState} from 'react'
import {Box, Button, Field, HStack, Stack, Text} from '@chakra-ui/react'
import {FaEuroSign} from '@react-icons/all-files/fa/FaEuroSign'

import {useCaller} from '../auth'
import {useI18nCode} from '../i18n'
import {getI18nCash} from '../locales/i18nCash'
import {fill} from '../locales/i18nCommon'
import {
  clearCashReceived,
  markCashReceived,
  type TransferRow
} from '../hooks/transfers'
import {AmountInput, formatAmount, parseAmount} from './AmountInput'
import {ConfirmDialog} from './ConfirmDialog'
import {ErrorBanner} from './ErrorBanner'
import {MoneyText} from './MoneyText'
import {Selectable} from './Selectable'
import {toaster} from './toaster'

/**
 * The states cash may be recorded from: the car has left. The same set the
 * pylon guards with (finance/cash.ts, CASH_STATES), and the same one the
 * driver is handed the fare from (Transfer.DRIVER_MONEY_STATES).
 */
const CASH_STATES = new Set(['ON_THE_WAY', 'AT_PICKUP', 'ONGOING', 'COMPLETED'])

/** Whether this ride offers the cash control to this caller at all. */
export const cashOffered = (
  transfer: {
    state?: string
    payingParty?: string | null
    driverId?: string
    cashReceivedAt?: string
  },
  caller: {userId?: string; isAdmin?: boolean}
): boolean => {
  // A ride the passenger does not pay for offers nothing, whatever its state.
  if (transfer.payingParty !== 'PASSENGER') return false
  const mine = !!caller.userId && transfer.driverId === caller.userId
  if (!caller.isAdmin && !mine) return false
  // An admin reads a record that already stands on a ride of any state, so a
  // correction is possible after the ride is over.
  if (transfer.cashReceivedAt) return true
  return CASH_STATES.has(String(transfer.state ?? ''))
}

/** The message of a refusal in the reader's language, the code deciding. */
const reasonOf = (
  err: unknown,
  s: ReturnType<typeof getI18nCash>['strings']
) => {
  const code = (err as {code?: unknown})?.code
  if (code === 'CASH_NOT_OFFERED') return s.NotOffered
  if (code === 'CASH_TOO_EARLY') return s.TooEarly
  if (err instanceof Error && err.message) return err.message
  return s.Failed
}

export interface CashReceivedProps {
  transfer: TransferRow
  onChanged: (row: TransferRow) => void
  /**
   * `card` is the driver's own screen and the dispatcher's money section, a
   * frame of its own with the heading. `inline` is a row inside another
   * frame, the amount and the actions and nothing else.
   */
  variant?: 'card' | 'inline'
}

export function CashReceived({
  transfer,
  onChanged,
  variant = 'card'
}: CashReceivedProps) {
  const code = useI18nCode()
  const {strings: s} = getI18nCash(code)
  const caller = useCaller()
  const recorded =
    typeof transfer.cashReceivedAmount === 'number'
      ? transfer.cashReceivedAmount
      : null

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [pending, setPending] = useState<'mark' | 'clear' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The field opens on the fare, which is the amount in the ordinary case and
  // the one the driver would otherwise type from the screen above it.
  useEffect(() => {
    setValue(
      recorded != null
        ? String(recorded)
        : transfer.price != null
          ? String(transfer.price)
          : ''
    )
    setEditing(false)
    setError(null)
  }, [transfer.id, recorded, transfer.price])

  if (!cashOffered(transfer, caller)) return null

  const typed = parseAmount(value)
  const mine = !!caller.userId && transfer.driverId === caller.userId

  const write = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      if (pending === 'clear') {
        onChanged(await clearCashReceived(transfer.id))
        toaster.success({title: s.Cleared})
      } else {
        if (typed === null || typed <= 0) {
          setError(s.AmountInvalid)
          return
        }
        onChanged(await markCashReceived(transfer.id, typed))
        toaster.success({
          title: fill(s.Received, {amount: formatAmount(code, typed)})
        })
      }
      setPending(null)
      setEditing(false)
    } catch (err) {
      setError(reasonOf(err, s))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const stamp = (iso: string | undefined): string => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    try {
      return new Intl.DateTimeFormat(code, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d)
    } catch {
      return d.toISOString()
    }
  }

  const form = (
    <Stack gap="3" data-testid="cash-form">
      <Field.Root invalid={!!error}>
        <Field.Label>{s.AmountLabel}</Field.Label>
        <AmountInput
          data-testid="cash-amount"
          value={value}
          onChange={setValue}
          maxW="48"
        />
      </Field.Root>
      <Text textStyle="sm" color="fg.muted">
        {s.Hint}
      </Text>
      <Button
        alignSelf="flex-start"
        size="lg"
        colorPalette="green"
        minH="12"
        data-testid="cash-mark"
        disabled={typed === null || typed <= 0}
        onClick={() => setPending('mark')}>
        <FaEuroSign /> {s.Action}
      </Button>
    </Stack>
  )

  const record = (
    <Stack gap="2" data-testid="cash-record">
      <HStack gap="3" flexWrap="wrap" align="baseline">
        <MoneyText
          value={recorded ?? 0}
          textStyle={variant === 'card' ? '3xl' : 'md'}
          fontWeight="bold"
          data-cash-amount={recorded ?? 0}
        />
        <Selectable textStyle="sm" color="fg.muted">
          {fill(s.ReceivedOn, {date: stamp(transfer.cashReceivedAt)})}
        </Selectable>
      </HStack>
      {caller.isAdmin && transfer.cashReceivedBy && (
        <Text textStyle="xs" color="fg.muted" data-testid="cash-by">
          {fill(s.RecordedBy, {name: transfer.cashReceivedBy})}
        </Text>
      )}
      {/* The correction is the admin's, on the ride and in the billing screen alike. */}
      {caller.isAdmin && (
        <HStack gap="2" flexWrap="wrap">
          <Button
            size="sm"
            variant="outline"
            minH={{base: '44px', md: '8'}}
            data-testid="cash-correct"
            onClick={() => setEditing(true)}>
            {s.Correct}
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorPalette="red"
            minH={{base: '44px', md: '8'}}
            data-testid="cash-clear"
            onClick={() => setPending('clear')}>
            {s.Clear}
          </Button>
        </HStack>
      )}
    </Stack>
  )

  const body = (
    <Stack gap="3">
      {error && <ErrorBanner message={error} />}
      {recorded != null && !editing
        ? record
        : mine || caller.isAdmin
          ? form
          : null}
    </Stack>
  )

  return (
    <>
      {variant === 'card' ? (
        <Box
          rounded="surface"
          borderWidth="1px"
          borderColor="border.default"
          bg="bg.surface"
          p="4"
          data-testid="cash-card">
          <HStack gap="2" mb="3" color="fg.muted">
            <FaEuroSign />
            <Text
              textStyle="xs"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wider">
              {s.Title}
            </Text>
          </HStack>
          {body}
        </Box>
      ) : (
        <Box data-testid="cash-inline">{body}</Box>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => {
          if (!busy) setPending(null)
        }}
        onConfirm={write}
        loading={busy}
        destructive={pending === 'clear'}
        title={pending === 'clear' ? s.ClearTitle : s.ConfirmTitle}
        body={
          pending === 'clear'
            ? s.ClearBody
            : fill(s.ConfirmBody, {
                amount: typed !== null ? formatAmount(code, typed) : ''
              })
        }
        confirmLabel={pending === 'clear' ? s.Clear : s.Action}
      />
    </>
  )
}
