/**
 * The offer's JSON, built from a transfer.
 *
 * The contract is the invoice JSON the two LuaLaTeX pipelines read today
 * (okf/architecture/offers-and-documents.md, "The layout is the house
 * invoice"): `sender`, `meta`, `recipient[]`, `intro`, `items[]`,
 * `totals`, `payment`, extended for the offer by `meta.validUntil`,
 * `meta.code`, `links` and `language`. One JSON per document, stored on
 * the TransferDocument row, so an offer is reproducible from its data and
 * the customer block is one query away for the invoice written outside
 * the app.
 *
 * What fills it: `sender` is the brand file (templates/brands/<brand>.json,
 * the same file the template reads, so the PDF and the JSON agree),
 * `recipient` the customer's profile when it names a person and the first
 * passenger with a mail address otherwise, one item per leg of the booking
 * in the booking's language, the intro and the terms the language file's
 * defaults (templates/lang/<language>.json), the totals brutto with 20 %
 * inside like the rental invoices, `validUntil` 24 hours before the pickup
 * or one hour from now when the pickup is closer, and the two links.
 * Nothing about the company is written here: a brand file without a bank
 * gives an empty bank block, invented is nothing.
 *
 * Pure: no fetch, no React, no window. The browser hands in the template
 * bundle it already fetched (`files`, see ./compile.ts templateFiles), the
 * node check hands in the files read from disk, see ./data.test.ts.
 */
import {getI18nTransfers} from '../locales/i18nTransfers'
import type {I18nCode} from '../i18n'
import {formatPhone} from '../phone'

// --------------- The contract ---------------

/** de | en | tr | ar, the languages a booking can be in. German first. */
export type DocumentLanguage = 'de' | 'en' | 'tr' | 'ar'

export type OfferBrand = 'limosen' | 'booklimo'

/** The sender block as templates/brands/<brand>.json carries it. */
export interface SenderBlock {
  company: string
  line: string
  address: string[]
  contact: string[]
  legal: string[]
  bank: string[]
}

export interface OfferItem {
  title: string
  /** Multi-line, the lines the positions table prints under the title. */
  description: string
  qty: number
  unitPrice: number
  discountPercent?: number
}

export interface OfferData {
  language: DocumentLanguage
  sender: SenderBlock
  meta: {
    id: string
    title: string
    date: string
    deliveryDate: string
    reference: string
    servicePeriod: string
    customerId: string
    contactPerson: string
    vatId?: string
    validUntil: string
    code: string
  }
  recipient: string[]
  intro: {greeting: string; text: string}
  items: OfferItem[]
  totals: {taxRate: number; taxInclusive: boolean}
  payment: {terms: string; status: string}
  links: {confirm: string; decline: string}
}

// --------------- What goes in ---------------

/** The slice of a transfer row the offer reads, one per leg. */
export interface OfferLeg {
  code: string
  customerId: string
  /** ISO. */
  pickupDateTime: string
  pickup: string
  dropoff: string
  price: number | null
  passengers: Array<{
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    language?: string
  }>
  details?: {
    luggage?: string
    childSeats?: string
    preferredCarClass?: string
    flightNumber?: string
  }
  car?: {carClass?: string}
}

export interface RecipientSource {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

/** The template family's language file, the part the JSON reads. */
export interface LanguageFile {
  offer: {title: string}
  defaults: {
    offer: {greeting: string; text: string; terms: string; status: string}
  }
}

export interface BuildOfferOptions {
  /** AN-260001, reserved through the pylon before the compile. */
  number: string
  /** ISO. Computed from the pickup when absent, see validUntilOf. */
  validUntil?: string
  links: {confirm: string; decline: string}
  /** The customer's profile, the addressee when it names a person. */
  customer?: RecipientSource
  /** The dispatcher who signs, "Ihr Ansprechpartner". */
  signer?: string
  /** The return legs of the booking, further items after the origin. */
  legs?: OfferLeg[]
  now?: Date
  /** The template bundle, keyed by path under app/shared/typst, for the brand and language files. */
  files?: Record<string, string | Uint8Array>
  /** The two files read already, when the caller has them. */
  sender?: Partial<SenderBlock>
  labels?: LanguageFile
}

// --------------- Words and dates ---------------

const VIENNA = 'Europe/Vienna'

const I18N_OF: Record<DocumentLanguage, I18nCode> = {
  de: 'de-AT',
  en: 'en-US',
  tr: 'tr-TR',
  ar: 'ar-EG'
}

/** The few words the app itself puts on the document, in its language. */
type Plural = [one: string, many: string]

interface Words {
  transfer: string
  persons: Plural
  luggage: Plural
  childSeats: Plural
  flight: string
}

const WORDS: Record<DocumentLanguage, Words> = {
  de: {
    transfer: 'Transfer',
    persons: ['Person', 'Personen'],
    luggage: ['Gepäckstück', 'Gepäckstücke'],
    childSeats: ['Kindersitz', 'Kindersitze'],
    flight: 'Flug'
  },
  en: {
    transfer: 'Transfer',
    persons: ['person', 'persons'],
    luggage: ['piece of luggage', 'pieces of luggage'],
    childSeats: ['child seat', 'child seats'],
    flight: 'Flight'
  },
  tr: {
    transfer: 'Transfer',
    persons: ['kişi', 'kişi'],
    luggage: ['bagaj', 'bagaj'],
    childSeats: ['çocuk koltuğu', 'çocuk koltuğu'],
    flight: 'Uçuş'
  },
  ar: {
    transfer: 'نقل',
    persons: ['شخص', 'أشخاص'],
    luggage: ['قطعة أمتعة', 'قطع أمتعة'],
    childSeats: ['مقعد أطفال', 'مقاعد أطفال'],
    flight: 'رحلة'
  }
}

const counted = (n: number, word: Plural): string =>
  `${n} ${n === 1 ? word[0] : word[1]}`

const clean = (v: string | undefined | null): string => (v ?? '').trim()

/** 'de', 'de-AT', 'DE_de' all read as de. Anything unknown is German, the product language. */
export const documentLanguage = (
  raw: string | null | undefined
): DocumentLanguage => {
  const base = String(raw ?? '')
    .replace('_', '-')
    .split('-')[0]
    ?.toLowerCase()
  return base === 'en' || base === 'tr' || base === 'ar' ? base : 'de'
}

/** 06.09.2026, the house date, in Vienna's calendar. */
export const houseDate = (d: Date): string => {
  const parts = new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VIENNA
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')}`
}

/** The pickup as the document's language writes a date and a time, Vienna time. */
export const dateTimeIn = (iso: string, language: DocumentLanguage): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(I18N_OF[language], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: VIENNA
  }).format(d)
}

/**
 * The instant an offer stops being valid: 24 hours before the pickup, and
 * one hour from now when the pickup is closer than that, the rule of
 * "Cancelled 24 hours before, unless confirmed".
 */
export const validUntilOf = (pickupISO: string, now = new Date()): Date => {
  const pickup = new Date(pickupISO).getTime()
  const dayBefore = pickup - 24 * 3600 * 1000
  if (!Number.isFinite(pickup) || dayBefore <= now.getTime())
    return new Date(now.getTime() + 3600 * 1000)
  return new Date(dayBefore)
}

/** `{name}` placeholders, filled in. */
const fillIn = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.split(`{${k}}`).join(v),
    template
  )

// --------------- The pieces ---------------

/**
 * The passenger the offer is addressed to: the first one with a mail
 * address, else the first with a name, else the first. The website's form
 * puts the visitor, who has the mail address, among the passengers.
 */
export const primaryPassenger = (
  leg: OfferLeg
): OfferLeg['passengers'][number] | undefined =>
  leg.passengers.find(p => clean(p.email)) ??
  leg.passengers.find(p => clean(p.firstName) || clean(p.lastName)) ??
  leg.passengers[0]

const nameOf = (p?: RecipientSource) =>
  [clean(p?.firstName), clean(p?.lastName)].filter(Boolean).join(' ')

/** The addressee block: the customer's profile when it names a person, the first passenger otherwise. */
export const recipientLines = (
  customer: RecipientSource | undefined,
  passenger: RecipientSource | undefined
): string[] => {
  const chosen = nameOf(customer) ? customer : passenger
  // The paper is read by a person, so the number carries its groups
  // (dispatch.md section 13). What is stored is E.164.
  return [
    nameOf(chosen),
    clean(chosen?.email),
    formatPhone(clean(chosen?.phone))
  ].filter(Boolean)
}

/** The mail address the offer goes to, the same choice as the addressee. */
export const recipientEmail = (
  customer: RecipientSource | undefined,
  passenger: RecipientSource | undefined
): string =>
  clean(nameOf(customer) ? customer?.email : passenger?.email) ||
  clean(customer?.email) ||
  clean(passenger?.email)

const count = (raw: string | undefined): number | undefined => {
  const n = parseInt(clean(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** One positions row per leg, "Transfer BQ7Q4W-1" with the when, the route and the who on the lines under it. */
export const offerItem = (
  leg: OfferLeg,
  language: DocumentLanguage,
  fallbackPrice: number | null
): OfferItem => {
  const words = WORDS[language]
  const t = getI18nTransfers(I18N_OF[language]).strings
  const carClass = leg.car?.carClass ?? leg.details?.preferredCarClass
  const classLabel = carClass
    ? ((t[`Class_${carClass}` as keyof typeof t] as string | undefined) ??
      carClass)
    : ''
  const people = leg.passengers.length
  const luggage = count(leg.details?.luggage)
  const seats = count(leg.details?.childSeats)
  const flight = clean(leg.details?.flightNumber)
  const description = [
    dateTimeIn(leg.pickupDateTime, language),
    `${leg.pickup} → ${leg.dropoff}`,
    [
      classLabel,
      people ? counted(people, words.persons) : '',
      luggage ? counted(luggage, words.luggage) : '',
      seats ? counted(seats, words.childSeats) : '',
      flight ? `${words.flight} ${flight}` : ''
    ]
      .filter(Boolean)
      .join(', ')
  ]
    .filter(Boolean)
    .join('\n')
  return {
    title: `${words.transfer} ${leg.code}`,
    description,
    qty: 1,
    unitPrice: leg.price ?? fallbackPrice ?? 0
  }
}

const parseJson = (raw: string | Uint8Array | undefined): unknown => {
  if (raw === undefined) return undefined
  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const lines = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => String(x)) : []

/** The sender block of a brand file, every list present even when the file leaves it empty. */
export const senderOf = (raw: unknown): SenderBlock => {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  return {
    company: String(b.company ?? ''),
    line: String(b.line ?? b.company ?? ''),
    address: lines(b.address),
    contact: lines(b.contact),
    legal: lines(b.legal),
    bank: lines(b.bank)
  }
}

/** The language file's offer defaults, empty strings where the file has none. */
export const labelsOf = (raw: unknown): LanguageFile => {
  const l = (raw && typeof raw === 'object' ? raw : {}) as any
  const d = l?.defaults?.offer ?? {}
  return {
    offer: {title: String(l?.offer?.title ?? 'Angebot Nr. {id}')},
    defaults: {
      offer: {
        greeting: String(d.greeting ?? ''),
        text: String(d.text ?? ''),
        terms: String(d.terms ?? ''),
        status: String(d.status ?? '')
      }
    }
  }
}

// --------------- The document ---------------

/**
 * The offer's JSON for a transfer. `transfer` is the origin leg and the
 * first item, `options.legs` the return legs after it, one item each under
 * one number. The service period runs from the first pickup to the last.
 */
export function buildOfferData(
  transfer: OfferLeg,
  brand: OfferBrand,
  language: DocumentLanguage,
  options: BuildOfferOptions
): OfferData {
  const now = options.now ?? new Date()
  const files = options.files ?? {}
  const sender = senderOf(
    options.sender ?? parseJson(files[`templates/brands/${brand}.json`])
  )
  const labels =
    options.labels ??
    labelsOf(parseJson(files[`templates/lang/${language}.json`]))
  const legs = [transfer, ...(options.legs ?? [])]
  const validUntil = options.validUntil
    ? new Date(options.validUntil)
    : validUntilOf(transfer.pickupDateTime, now)
  const validUntilText = houseDate(validUntil)
  const days = legs.map(l => houseDate(new Date(l.pickupDateTime)))
  const first = days[0] ?? ''
  const last = days[days.length - 1] ?? first
  const passenger = primaryPassenger(transfer)
  const defaults = labels.defaults.offer

  return {
    language,
    sender,
    meta: {
      id: options.number,
      title: fillIn(labels.offer.title, {id: options.number}),
      date: houseDate(now),
      deliveryDate: first,
      reference: transfer.code,
      servicePeriod: first === last ? first : `${first} - ${last}`,
      customerId: transfer.customerId,
      contactPerson: clean(options.signer),
      validUntil: validUntilText,
      code: transfer.code
    },
    recipient: recipientLines(options.customer, passenger),
    intro: {greeting: defaults.greeting, text: defaults.text},
    items: legs.map(leg => offerItem(leg, language, transfer.price)),
    // The taxi prices are brutto like the rental ones, 20 % inside.
    totals: {taxRate: 20, taxInclusive: true},
    payment: {
      terms: defaults.terms,
      status: defaults.status
        ? fillIn(defaults.status, {validUntil: validUntilText})
        : ''
    },
    links: {confirm: options.links.confirm, decline: options.links.decline}
  }
}

/** The gross total of the items, what the offer asks for. */
export const offerTotal = (
  data: Pick<OfferData, 'items' | 'totals'>
): number => {
  const net = data.items.reduce(
    (sum, i) =>
      sum + i.qty * i.unitPrice * (1 - (i.discountPercent ?? 0) / 100),
    0
  )
  const gross = data.totals.taxInclusive
    ? net
    : net * (1 + data.totals.taxRate / 100)
  return Math.round(gross * 100) / 100
}
