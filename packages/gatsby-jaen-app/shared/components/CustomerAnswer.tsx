/**
 * The customer's yes and no, taken on the telephone by the office.
 * okf/architecture/dispatch.md section 14.1.
 *
 * "Kunden können genauso wie Fahrer natürlich auch telefonisch bestätigen":
 * an admin already answers for a driver (section 9a), and this is the same
 * door on the customer's side. It sits beside the customer status, calls
 * `confirmBooking` on a NEW ride and `confirmOffer` on an OFFERED one, and
 * `declineOffer` for the no, all three on the customer's behalf. The pylon
 * records the admin as the author beside the instant, and the customer's mail
 * goes out either way, because a paper is owed whoever pressed the button.
 *
 * What it does not draw: a decline on a NEW ride. There is no offer to
 * decline before one was sent, `declineOffer` refuses it with
 * INVALID_TRANSITION, and a booking nobody offered is withdrawn with the
 * ride's own "Fahrt stornieren".
 */
import {useState} from 'react'
import {Button, ButtonGroup, type ButtonGroupProps} from '@chakra-ui/react'
import {FaCheck} from '@react-icons/all-files/fa/FaCheck'
import {FaTimes} from '@react-icons/all-files/fa/FaTimes'

import {useCaller} from '../auth'
import {useI18nCode} from '../i18n'
import {getI18nOffers} from '../locales/i18nOffers'
import {asCustomerStatus} from '../hooks/offers'
import {
  confirmAsAdmin,
  confirmBooking,
  declineForCustomer
} from '../hooks/documents'
import type {TransferRow} from '../hooks/transfers'
import {isClosed} from '../hooks/transfers'
import {ConfirmDialog} from './ConfirmDialog'
import {ErrorBanner} from './ErrorBanner'
import {toaster} from './toaster'
import {failureText} from '../errors'

/** The two statuses an answer is still open on. */
const ANSWERABLE = new Set(['NEW', 'OFFERED'])

/** Whether the office may still answer for the customer on this ride. */
export const canAnswerForCustomer = (row: {
  state?: string
  customerStatus?: string
}): boolean =>
  !isClosed(row.state ?? '') &&
  ANSWERABLE.has(String(asCustomerStatus(row.customerStatus) ?? ''))

export interface CustomerAnswerActionsProps extends ButtonGroupProps {
  transfer: TransferRow
  onAnswered: (row: TransferRow) => void
  /** `sm` on a card and in a section header, `md` where the page has the room. */
  size?: 'xs' | 'sm' | 'md'
}

export function CustomerAnswerActions({
  transfer,
  onAnswered,
  size = 'sm',
  ...rest
}: CustomerAnswerActionsProps) {
  const code = useI18nCode()
  const {strings: s} = getI18nOffers(code)
  const caller = useCaller()
  const [pending, setPending] = useState<'confirm' | 'decline' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = asCustomerStatus(transfer.customerStatus)
  if (!caller.isAdmin || !canAnswerForCustomer(transfer)) return null

  const answer = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      // NEW has no offer, so the yes is the office's own confirmation of the
      // booking; OFFERED is the offer's own yes. One button, the ride's
      // status decides which mutation it is.
      const row =
        pending === 'decline'
          ? await declineForCustomer(transfer.id)
          : status === 'NEW'
            ? await confirmBooking(transfer.id)
            : await confirmAsAdmin(transfer.id)
      if (row) onAnswered(row)
      toaster.success({
        title: pending === 'decline' ? s.DeclinedForCustomer : s.Confirmed
      })
      setPending(null)
    } catch (err) {
      setError(
        failureText(
          err,
          pending === 'decline' ? s.DeclineFailed : s.MarkPaidFailed
        )
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && <ErrorBanner message={error} />}
      {/* Two controls in a row are never closer than a thumb, and 44 px where a thumb taps them. */}
      <ButtonGroup
        size={size}
        gap="2"
        flexWrap="wrap"
        data-testid="customer-answer"
        onClick={e => e.stopPropagation()}
        {...rest}>
        <Button
          variant="outline"
          colorPalette="brand"
          minH={{base: '44px', md: '8'}}
          data-testid="confirm-for-customer"
          onClick={() => {
            setError(null)
            setPending('confirm')
          }}>
          <FaCheck /> {s.ConfirmForCustomer}
        </Button>
        {/* The no exists where an offer does: a booking nobody offered is cancelled, not declined. */}
        {status === 'OFFERED' && (
          <Button
            variant="outline"
            colorPalette="red"
            minH={{base: '44px', md: '8'}}
            data-testid="decline-for-customer"
            onClick={() => {
              setError(null)
              setPending('decline')
            }}>
            <FaTimes /> {s.DeclineForCustomer}
          </Button>
        )}
      </ButtonGroup>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => {
          if (!busy) setPending(null)
        }}
        onConfirm={answer}
        loading={busy}
        destructive={pending === 'decline'}
        title={
          pending === 'decline'
            ? s.DeclineForCustomerTitle
            : s.ConfirmForCustomerTitle
        }
        body={
          pending === 'decline'
            ? s.DeclineForCustomerBody
            : s.ConfirmForCustomerBody
        }
        confirmLabel={
          pending === 'decline' ? s.DeclineForCustomer : s.ConfirmForCustomer
        }
      />
    </>
  )
}
