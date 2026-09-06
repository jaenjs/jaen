/**
 * The customer's status as a chip, beside the ride state everywhere a
 * transfer is shown: gray for a booking nobody has answered, blue while an
 * offer is out, teal once the customer said yes, purple with the invoice
 * out, green when it is paid, red when it was declined or the offer ran out.
 *
 * `audience` picks the words: the dispatcher reads "Angebot gesendet", the
 * customer reads "Angebot erhalten" on their own booking list, the same
 * chip either way. A value the catalogue does not know is shown as it is,
 * in gray, and no chip at all is drawn for a row from before the column,
 * so the board of an older pylon looks as it did.
 */
import {Badge, type BadgeProps} from '@chakra-ui/react'
import {useI18nCode} from '../i18n'
import {asCustomerStatus, type CustomerStatus} from '../hooks/offers'
import {getI18nOffers} from '../locales/i18nOffers'

export const CUSTOMER_STATUS_PALETTE: Record<
  CustomerStatus,
  NonNullable<BadgeProps['colorPalette']>
> = {
  NEW: 'gray',
  OFFERED: 'blue',
  CONFIRMED: 'teal',
  INVOICED: 'purple',
  PAID: 'green',
  DECLINED: 'red'
}

export interface CustomerStatusBadgeProps extends Omit<BadgeProps, 'children'> {
  status: string | null | undefined
  /** Whose words: the dispatcher's by default, the customer's on the booking screens. */
  audience?: 'dispatcher' | 'customer'
}

/** The words for a status, in the account's language, for the two audiences. */
export function useCustomerStatusLabel(
  audience: 'dispatcher' | 'customer' = 'dispatcher'
) {
  const code = useI18nCode()
  const {strings} = getI18nOffers(code)
  return (status: string | null | undefined): string => {
    const known = asCustomerStatus(status)
    if (!known) return status || ''
    return audience === 'customer'
      ? strings[`Customer_${known}`]
      : strings[`Status_${known}`]
  }
}

export function CustomerStatusBadge({
  status,
  audience = 'dispatcher',
  ...rest
}: CustomerStatusBadgeProps) {
  const label = useCustomerStatusLabel(audience)
  if (status === undefined || status === null || status === '') return null
  const known = asCustomerStatus(status)
  return (
    <Badge
      variant="subtle"
      colorPalette={known ? CUSTOMER_STATUS_PALETTE[known] : 'gray'}
      whiteSpace="nowrap"
      data-customer-status={known ?? status}
      {...rest}>
      {label(status)}
    </Badge>
  )
}
