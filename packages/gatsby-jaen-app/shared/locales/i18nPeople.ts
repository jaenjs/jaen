/**
 * The words of the people card, dispatch.md section 13.
 *
 * They live in a catalogue of their own rather than in i18nTransfers and
 * i18nBookings, because the card is one card drawn on two screens whose
 * catalogues are two: the transfer detail the dispatcher reads and the
 * booking detail the customer reads. One catalogue is what keeps "Gebucht
 * von" from being two strings that drift apart.
 *
 * German is the product language and the other three are typed against it,
 * so a key added to `de` and forgotten in `ar` fails the typecheck rather
 * than showing a key on a screen.
 */
import type {I18nCode} from '../i18n'

const de = {
  /** The label of the quieter line under the passenger. */
  BookedBy: 'Gebucht von',
  /** The line a ride carries when the person riding is the account that booked. */
  PassengerIsCustomer: 'Fahrgast ist Kunde',
  /** The two actions of a contact value. */
  ActionMail: 'E-Mail schreiben',
  ActionCall: 'Anrufen'
}

export type PeopleStrings = typeof de

const en: PeopleStrings = {
  BookedBy: 'Booked by',
  PassengerIsCustomer: 'The passenger is the customer',
  ActionMail: 'Write an e-mail',
  ActionCall: 'Call'
}

const tr: PeopleStrings = {
  BookedBy: 'Rezervasyonu yapan',
  PassengerIsCustomer: 'Yolcu müşterinin kendisi',
  ActionMail: 'E-posta yaz',
  ActionCall: 'Ara'
}

const ar: PeopleStrings = {
  BookedBy: 'حجز بواسطة',
  PassengerIsCustomer: 'الراكب هو العميل',
  ActionMail: 'كتابة بريد إلكتروني',
  ActionCall: 'اتصال'
}

export function getI18nPeople(code: I18nCode): {
  code: I18nCode
  strings: PeopleStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}
