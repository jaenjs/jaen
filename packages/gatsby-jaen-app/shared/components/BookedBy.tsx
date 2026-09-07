/**
 * Who rides and who booked, on one card: dispatch.md section 13.
 *
 * The owner reads a transfer detail to find a person and reach them, and the
 * card that named the passenger named nobody else. A hotel books for its
 * guest, so the guest's number is on the ride while the front desk that has
 * to be called is not. The card names both now: the passenger first, each
 * value with its own action, and under it the booker as one quieter line.
 *
 * What lives here is the half the transfer detail and the customer's booking
 * detail share, because the two screens draw the same card for two different
 * readers and a fix belongs in one place:
 *
 * - `bookedBy`, the decision about who the booker is, so the two cards can
 *   never disagree about it,
 * - `BookedByLine`, the quieter line itself, `fg.muted` at `sm`, or the even
 *   quieter sentence when the two are one person.
 *
 * The actions are links rather than buttons on purpose. The line is the
 * quiet half of the card, and a mailto and a tel are the same action a
 * button would carry without the chrome of one; they sit `gap="3"` apart so
 * a thumb cannot take the wrong one (hard-rules.md, "Two controls are never
 * closer than a thumb").
 */
import {Flex, Link, Text} from '@chakra-ui/react'
import {Selectable} from './Selectable'

/** A person as a screen reaches them: what to call them, where to write, what to dial. */
export interface PersonContact {
  name?: string
  email?: string
  phone?: string
}

/** The account behind a ride, with the one thing about it that is not a contact detail. */
export interface BookerAccount extends PersonContact {
  /**
   * A machine account has no person behind it. The brand's website books
   * every anonymous booking on one (operations/test-accounts.md, "The
   * website account of each brand"), so the human behind such a ride is the
   * passenger whose name and address the form wrote.
   */
  isMachine?: boolean
}

export type BookedBy =
  | {kind: 'same'}
  | {kind: 'person'; person: PersonContact}
  | {kind: 'none'}

const mailbox = (value: string | undefined): string =>
  (value ?? '').trim().toLowerCase()

const digits = (value: string | undefined): string =>
  (value ?? '').replace(/\D/g, '')

/**
 * Who booked, read from the passenger on the row and the account it belongs
 * to. Four answers in this order, and the card has to be able to stand
 * behind every one of them:
 *
 * 1. no account at all, so nothing is said. The directory does not always
 *    answer for a customer id, see the comment in the pylon's `userNode`,
 *    and a card that invented a booker there would be worse than a quiet one.
 * 2. the same mailbox or the same number, whatever the two names say. The
 *    website's form writes the visitor's own address and number onto the
 *    passenger of the ride it books, so this is the ordinary self booking.
 * 3. the ride names nobody of its own. A booking made in the app writes one
 *    nameless `Passenger` row per seat (hooks/bookings.ts, `bookRide`), so a
 *    ride with no name, no address and no number on it was booked by the
 *    account for the account. A hotel's booking is not this case: the front
 *    desk types the guest into "Zimmer / Name", which is the name the card
 *    reads as the passenger's.
 * 4. a machine account. Nobody is reachable there, and the one that books in
 *    production is the website's own, whose booker is the passenger. This
 *    conflates the website with the machine test accounts, which book
 *    nothing outside a test run.
 *
 * Anything else is a booker of its own and gets the quieter line.
 */
export const bookedBy = (
  passenger: PersonContact,
  account: BookerAccount | undefined
): BookedBy => {
  if (!account || !(account.name || account.email || account.phone))
    return {kind: 'none'}

  if (
    mailbox(passenger.email) &&
    mailbox(passenger.email) === mailbox(account.email)
  )
    return {kind: 'same'}

  const dialled = digits(passenger.phone)
  if (dialled.length >= 6 && dialled === digits(account.phone))
    return {kind: 'same'}

  if (!passenger.name && !passenger.email && !passenger.phone)
    return {kind: 'same'}

  if (account.isMachine) return {kind: 'same'}

  return {kind: 'person', person: account}
}

export interface BookedByLineProps {
  result: BookedBy
  /** "Gebucht von". */
  label: string
  /** "Fahrgast ist Kunde". */
  sameLabel: string
  /** `mailto:` for an address, nothing for what is not one. */
  mailHref: (value: string | undefined) => string | undefined
  /** `tel:` for a number, nothing for what is not one. */
  telHref: (value: string | undefined) => string | undefined
  /** The number as a person reads it, the stored value by default. */
  formatPhone?: (value: string) => string
  /** What the two actions are called, for the tooltip of the two links. */
  mailLabel: string
  callLabel: string
}

/**
 * The booker under the passenger. One line, `fg.muted` at `sm`, wrapping
 * inside its card so a long address stays in its column (rule 9), every
 * value marked as data (rule 11). The sentence that the two are one person
 * is quieter still, `fg.subtle` at `xs`. Nothing at all when there is no
 * booker to name.
 */
export function BookedByLine({
  result,
  label,
  sameLabel,
  mailHref,
  telHref,
  formatPhone,
  mailLabel,
  callLabel
}: BookedByLineProps) {
  if (result.kind === 'none') return null

  if (result.kind === 'same')
    return (
      <Text
        mt="3"
        textStyle="xs"
        color="fg.subtle"
        data-testid="passenger-is-customer">
        {sameLabel}
      </Text>
    )

  const {person} = result
  const mail = mailHref(person.email)
  const tel = telHref(person.phone)
  const number = person.phone
    ? (formatPhone ?? ((value: string) => value))(person.phone)
    : undefined

  return (
    <Flex
      mt="3"
      gap="3"
      rowGap="1"
      flexWrap="wrap"
      align="baseline"
      minW="0"
      textStyle="sm"
      color="fg.muted"
      data-testid="booked-by">
      <Text flexShrink="0">{label}</Text>
      {person.name && (
        <Selectable minW="0" textStyle="sm" fontWeight="medium">
          {person.name}
        </Selectable>
      )}
      {person.email &&
        (mail ? (
          <Link
            href={mail}
            title={mailLabel}
            colorPalette="brand"
            minW="0"
            data-selectable>
            {person.email}
          </Link>
        ) : (
          <Selectable minW="0" textStyle="sm">
            {person.email}
          </Selectable>
        ))}
      {number &&
        (tel ? (
          <Link
            href={tel}
            title={callLabel}
            colorPalette="brand"
            minW="0"
            data-selectable>
            {number}
          </Link>
        ) : (
          <Selectable minW="0" textStyle="sm">
            {number}
          </Selectable>
        ))}
    </Flex>
  )
}
