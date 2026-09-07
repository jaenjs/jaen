/**
 * The offer: compiled in the dispatcher's browser, previewed, sent.
 * okf/architecture/offers-and-documents.md, "The offer, generated with
 * Typst in the browser".
 *
 * Opening the dialog does four things in a row, each with its own words on
 * the status line and its own error in words: the number is reserved
 * through the pylon (`reserveOfferNumber`, which also answers the links and
 * the validity, or the plain `nextDocumentNumber` counter while the offer
 * backend is not deployed), the data is built from the transfer, the
 * compiler and the template family are loaded (the first time on a page,
 * a chunk of their own, see ../../typst/compile.ts), and the PDF is
 * compiled and shown in an `<object>` the browser renders itself, no pdf.js.
 * "Senden" uploads the PDF to the storage gateway, stores the answer as
 * the ride's OFFER document with its JSON and
 * then calls `sendOffer(args:{documentId})`, which mails it and sets the
 * customer status.
 *
 * The document's language is the booking's (`Transfer.language`, the first
 * passenger's while the column is not deployed), never the dispatcher's:
 * the words on the PDF come from the template's language files, the words
 * of this dialog from the dispatcher's catalogue below. What the app puts
 * into the item line (the date, the car class, "2 Personen") is spelled in
 * the document's language here.
 *
 * Every document field of the pylon takes its arguments under `args`, the
 * way the store's fields do (`transferDocuments(args:{transferId})`,
 * `nextDocumentNumber(args:{kind})`, `uploadTransferDocument(args:{...})`),
 * and the two fields of the offer backend are called the same way.
 *
 * INTEGRATOR: the detail page opens this from "Angebot senden" once a price
 * is set and the customer status is NEW or OFFERED. `reserveOfferNumber
 * (args:{transferId})` is the contract with the offer backend: `{number,
 * validUntil, confirmUrl, declineUrl}`, the existing offer's number when
 * the ride already has one, and `sendOffer(args:{documentId})` mails it.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Box, Link, Skeleton, Stack, Text} from '@chakra-ui/react'
import {uploadFile} from 'jaen'
import {useI18nCode, type I18nCode} from '../../i18n'
import {fill} from '../../locales/i18nCommon'
import {getI18nTransfers} from '../../locales/i18nTransfers'
import {fetchGraphQL} from '../../../client/limosen'
import {useCaller} from '../../auth'
import {fullName, mutate, useUserDetail} from '../../hooks/users'
import {GraphQLRequestError, type TransferRow} from '../../hooks/transfers'
import {gatewayFileOf} from '../../hooks/documents'
import {isOfflineError} from '../../offline'
import {DialogActions} from '../DialogActions'
import {ErrorBanner} from '../ErrorBanner'
import {toaster} from '../toaster'
import {Sheet, enumLabel} from '../../views/TransfersView'
import type {TypstFiles} from '../../typst/compile'

// --------------- The dispatcher's words ---------------

const de = {
  Title: 'Angebot senden',
  Preparing: 'Angebotsnummer wird vergeben …',
  Loading: 'PDF-Compiler wird geladen (einmalig, etwa 10 MB) …',
  Compiling: 'Angebot wird erstellt …',
  Ready: 'Angebot {number}, erstellt in {seconds} s',
  Sending: 'Angebot wird gesendet …',
  Send: 'Senden',
  Open: 'PDF öffnen',
  NoPreview:
    'Dieser Browser zeigt keine PDF-Vorschau an. Öffne die Datei über den Link.',
  Recipient: 'Wird gesendet an {email}, Sprache {language}',
  NoEmail:
    'Die Buchung hat keine E-Mail-Adresse, das Angebot kann nicht gesendet werden',
  NoPrice: 'Zuerst einen Preis festlegen',
  Sent: 'Angebot {number} gesendet',
  ErrorNumber: 'Die Angebotsnummer konnte nicht vergeben werden: {reason}',
  ErrorLoad: 'Der PDF-Compiler konnte nicht geladen werden: {reason}',
  ErrorTemplate: 'Die Vorlage lässt sich nicht übersetzen: {reason}',
  ErrorUpload: 'Das Angebot konnte nicht gespeichert werden: {reason}',
  ErrorSend: 'Das Angebot wurde gespeichert, aber nicht gesendet: {reason}',
  Forbidden: 'nur Administratoren dürfen Angebote senden',
  AuthRequired: 'bitte neu anmelden',
  Offline: 'keine Verbindung',
  Unknown: 'unbekannter Fehler',
  LanguageDe: 'Deutsch',
  LanguageEn: 'Englisch',
  LanguageTr: 'Türkisch',
  LanguageAr: 'Arabisch'
}

type OfferStrings = typeof de

const en: OfferStrings = {
  Title: 'Send offer',
  Preparing: 'Reserving the offer number …',
  Loading: 'Loading the PDF compiler (once, about 10 MB) …',
  Compiling: 'Compiling the offer …',
  Ready: 'Offer {number}, compiled in {seconds} s',
  Sending: 'Sending the offer …',
  Send: 'Send',
  Open: 'Open PDF',
  NoPreview:
    'This browser shows no PDF preview. Open the file through the link.',
  Recipient: 'Will be sent to {email}, language {language}',
  NoEmail: 'The booking has no e-mail address, the offer cannot be sent',
  NoPrice: 'Set a price first',
  Sent: 'Offer {number} sent',
  ErrorNumber: 'The offer number could not be reserved: {reason}',
  ErrorLoad: 'The PDF compiler could not be loaded: {reason}',
  ErrorTemplate: 'The template does not compile: {reason}',
  ErrorUpload: 'The offer could not be stored: {reason}',
  ErrorSend: 'The offer was stored but not sent: {reason}',
  Forbidden: 'only administrators may send offers',
  AuthRequired: 'please sign in again',
  Offline: 'no connection',
  Unknown: 'unknown error',
  LanguageDe: 'German',
  LanguageEn: 'English',
  LanguageTr: 'Turkish',
  LanguageAr: 'Arabic'
}

const tr: OfferStrings = {
  Title: 'Teklif gönder',
  Preparing: 'Teklif numarası ayrılıyor …',
  Loading: 'PDF derleyicisi yükleniyor (bir kez, yaklaşık 10 MB) …',
  Compiling: 'Teklif oluşturuluyor …',
  Ready: 'Teklif {number}, {seconds} s içinde oluşturuldu',
  Sending: 'Teklif gönderiliyor …',
  Send: 'Gönder',
  Open: 'PDF aç',
  NoPreview:
    'Bu tarayıcı PDF önizlemesi göstermiyor. Dosyayı bağlantıdan açın.',
  Recipient: '{email} adresine gönderilecek, dil {language}',
  NoEmail: 'Rezervasyonda e-posta adresi yok, teklif gönderilemez',
  NoPrice: 'Önce bir fiyat belirleyin',
  Sent: 'Teklif {number} gönderildi',
  ErrorNumber: 'Teklif numarası ayrılamadı: {reason}',
  ErrorLoad: 'PDF derleyicisi yüklenemedi: {reason}',
  ErrorTemplate: 'Şablon derlenemiyor: {reason}',
  ErrorUpload: 'Teklif kaydedilemedi: {reason}',
  ErrorSend: 'Teklif kaydedildi ancak gönderilemedi: {reason}',
  Forbidden: 'yalnızca yöneticiler teklif gönderebilir',
  AuthRequired: 'lütfen yeniden giriş yapın',
  Offline: 'bağlantı yok',
  Unknown: 'bilinmeyen hata',
  LanguageDe: 'Almanca',
  LanguageEn: 'İngilizce',
  LanguageTr: 'Türkçe',
  LanguageAr: 'Arapça'
}

const ar: OfferStrings = {
  Title: 'إرسال العرض',
  Preparing: 'جارٍ حجز رقم العرض …',
  Loading: 'جارٍ تحميل مترجم PDF (مرة واحدة، نحو 10 ميغابايت) …',
  Compiling: 'جارٍ إنشاء العرض …',
  Ready: 'العرض {number}، أُنشئ خلال {seconds} ث',
  Sending: 'جارٍ إرسال العرض …',
  Send: 'إرسال',
  Open: 'فتح PDF',
  NoPreview: 'هذا المتصفح لا يعرض معاينة PDF. افتح الملف من الرابط.',
  Recipient: 'سيُرسل إلى {email}، اللغة {language}',
  NoEmail: 'لا يحتوي الحجز على عنوان بريد إلكتروني، لا يمكن إرسال العرض',
  NoPrice: 'حدّد السعر أولاً',
  Sent: 'تم إرسال العرض {number}',
  ErrorNumber: 'تعذّر حجز رقم العرض: {reason}',
  ErrorLoad: 'تعذّر تحميل مترجم PDF: {reason}',
  ErrorTemplate: 'تعذّر ترجمة القالب: {reason}',
  ErrorUpload: 'تعذّر حفظ العرض: {reason}',
  ErrorSend: 'حُفظ العرض لكنه لم يُرسل: {reason}',
  Forbidden: 'يحق للمسؤولين فقط إرسال العروض',
  AuthRequired: 'يرجى تسجيل الدخول مجدداً',
  Offline: 'لا يوجد اتصال',
  Unknown: 'خطأ غير معروف',
  LanguageDe: 'الألمانية',
  LanguageEn: 'الإنجليزية',
  LanguageTr: 'التركية',
  LanguageAr: 'العربية'
}

const strings = (code: I18nCode): OfferStrings =>
  code === 'en-US' ? en : code === 'tr-TR' ? tr : code === 'ar-EG' ? ar : de

// --------------- The document's words ---------------

const clean = (v: string | undefined | null): string => (v ?? '').trim()

/** de | en | tr | ar, the languages a booking can be in. German first. */
export type DocumentLanguage = 'de' | 'en' | 'tr' | 'ar'

/** The few words the app itself puts on the document, in its language. */
const DOCUMENT_WORDS: Record<
  DocumentLanguage,
  {transfer: string; persons: string; returnTrip: string}
> = {
  de: {transfer: 'Transfer', persons: 'Personen', returnTrip: 'Rückfahrt'},
  en: {transfer: 'Transfer', persons: 'persons', returnTrip: 'Return trip'},
  tr: {transfer: 'Transfer', persons: 'kişi', returnTrip: 'Dönüş yolculuğu'},
  ar: {transfer: 'نقل', persons: 'أشخاص', returnTrip: 'رحلة العودة'}
}

const I18N_OF: Record<DocumentLanguage, I18nCode> = {
  de: 'de-AT',
  en: 'en-US',
  tr: 'tr-TR',
  ar: 'ar-EG'
}

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

/**
 * The passenger the offer is addressed to: the first one with a mail
 * address, else the first with a name, else the first. The pylon answers
 * the passengers in no particular order, and the website's form puts the
 * visitor, who has the mail address, among them.
 */
export const primaryPassenger = (
  row: TransferRow
): TransferRow['passengers'][number] | undefined =>
  row.passengers.find(p => clean(p.email)) ??
  row.passengers.find(p => clean(p.firstName) || clean(p.lastName)) ??
  row.passengers[0]

/**
 * The booking's language: the column when the schema has it, otherwise the
 * first passenger who carries one, the rule createTransfer writes it by.
 */
export const transferLanguage = (row: TransferRow): DocumentLanguage =>
  documentLanguage(
    (row as {language?: string}).language ??
      row.passengers.find(p => clean(p.language))?.language
  )

// --------------- The brand ---------------

declare const __JAEN_APP_PYLON_URL__: string | undefined

/**
 * `limosen` or `booklimo`, read off the pylon's hostname the way
 * gatsby-node derives the brand for /app/version.json, and off the page's
 * own hostname when the define is missing. The brand names the template
 * file that holds the sender block, never a value in this code.
 */
export const brandKey = (): 'limosen' | 'booklimo' => {
  const hosts = [
    typeof __JAEN_APP_PYLON_URL__ !== 'undefined' ? __JAEN_APP_PYLON_URL__ : '',
    typeof window !== 'undefined' ? window.location.href : ''
  ]
  for (const raw of hosts) {
    try {
      const host = new URL(raw).hostname
      if (host.endsWith('booklimo.at')) return 'booklimo'
      if (host.endsWith('limosen.at')) return 'limosen'
    } catch {
      // Not a URL, the next candidate decides.
    }
  }
  return 'limosen'
}

// --------------- The data ---------------

/**
 * The offer's JSON, the invoice contract of the two LuaLaTeX pipelines
 * plus `meta.validUntil`, `meta.code`, `links` and `language`. `sender`
 * comes from the brand file inside the template, `intro` and `payment`
 * from its language file, so they are not here. Stored on the
 * TransferDocument row as `data`, so an offer is reproducible from it.
 */
export interface OfferData {
  language: DocumentLanguage
  brand: 'limosen' | 'booklimo'
  meta: {
    id: string
    date: string
    validUntil: string
    code: string
    reference: string
    servicePeriod: string
    customerId: string
    contactPerson?: string
  }
  recipient: string[]
  items: Array<{
    title: string
    description: string
    qty: number
    unitPrice: number
  }>
  totals: {taxRate: number; taxInclusive: boolean}
  links: {confirm: string; decline: string}
}

/** The reservation the pylon answers, or what the dialog assembles without the offer backend. */
export interface OfferReservation {
  number: string
  validUntil: string
  confirmUrl: string
  declineUrl: string
  /** Where the number came from, shown in the console only. */
  source: 'reserveOfferNumber' | 'existing' | 'nextDocumentNumber'
}

const VIENNA = 'Europe/Vienna'

/** 06.09.2026, the house date. */
const houseDate = (d: Date): string => {
  const parts = new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VIENNA
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')}`
}

const dateTimeIn = (iso: string, language: DocumentLanguage): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(I18N_OF[language], {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: VIENNA
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

/**
 * The instant an offer stops being valid, when the pylon did not say:
 * 24 hours before the pickup, and one hour from now when the pickup is
 * closer than that, the rule of "Cancelled 24 hours before, unless
 * confirmed".
 */
export const validUntilOf = (pickupISO: string, now = new Date()): Date => {
  const pickup = new Date(pickupISO).getTime()
  const dayBefore = pickup - 24 * 3600 * 1000
  if (!Number.isFinite(pickup) || dayBefore <= now.getTime())
    return new Date(now.getTime() + 3600 * 1000)
  return new Date(dayBefore)
}

export interface RecipientSource {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

/** The addressee block: the customer's profile when it names a person, the first passenger otherwise. */
export const recipientLines = (
  customer: RecipientSource | undefined,
  passenger: RecipientSource | undefined
): string[] => {
  const name = (p?: RecipientSource) =>
    [clean(p?.firstName), clean(p?.lastName)].filter(Boolean).join(' ')
  const chosen = name(customer) ? customer : passenger
  return [name(chosen), clean(chosen?.email), clean(chosen?.phone)].filter(
    Boolean
  )
}

/** The mail address the offer goes to, the same choice as the addressee. */
export const recipientEmail = (
  customer: RecipientSource | undefined,
  passenger: RecipientSource | undefined
): string => {
  const named = [clean(customer?.firstName), clean(customer?.lastName)].some(
    Boolean
  )
  return (
    clean(named ? customer?.email : passenger?.email) ||
    clean(customer?.email) ||
    clean(passenger?.email)
  )
}

/**
 * One item per leg. A return booking sends one offer for both legs, so the
 * origin's `returns` (the detail read carries them) become further items
 * with the words swapped. Their price is the origin's until each leg carries
 * its own on the row the dialog was given, which is what the detail page
 * hands over.
 */
export const offerItems = (
  row: TransferRow,
  language: DocumentLanguage
): OfferData['items'] => {
  const words = DOCUMENT_WORDS[language]
  const t = getI18nTransfers(I18N_OF[language]).strings
  const carClass = row.car?.carClass ?? row.details?.preferredCarClass
  const people = row.passengers.length
  const description = [
    dateTimeIn(row.pickupDateTime, language),
    // An en dash, not an arrow: Open Sans carries no U+2192 and the PDF would show a blank.
    `${row.pickup} – ${row.dropoff}`,
    [
      carClass ? enumLabel(t, 'Class_', carClass) : '',
      people ? `${people} ${words.persons}` : ''
    ]
      .filter(Boolean)
      .join(', ')
  ]
    .filter(Boolean)
    .join('\n')
  return [
    {
      title: `${words.transfer} ${row.code}`,
      description,
      qty: 1,
      unitPrice: row.price ?? 0
    }
  ]
}

/**
 * `contactPerson` is the house invoice's "Ihr Ansprechpartner", the person
 * at the company who signs the letter, so it is the dispatcher who makes
 * the offer, never the passenger. Blank when the account carries no name,
 * and the template then prints the row and the signature empty.
 */
export const offerData = (
  row: TransferRow,
  reservation: OfferReservation,
  customer: RecipientSource | undefined,
  signer: string,
  now = new Date()
): OfferData => {
  const language = transferLanguage(row)
  const passenger = primaryPassenger(row)
  return {
    language,
    brand: brandKey(),
    meta: {
      id: reservation.number,
      date: houseDate(now),
      validUntil: houseDate(new Date(reservation.validUntil)),
      code: row.code,
      reference: row.code,
      servicePeriod: houseDate(new Date(row.pickupDateTime)),
      customerId: row.customerId,
      contactPerson: signer
    },
    recipient: recipientLines(customer, passenger),
    items: offerItems(row, language),
    // The taxi prices are brutto like the rental ones, 20 % inside.
    totals: {taxRate: 20, taxInclusive: true},
    links: {confirm: reservation.confirmUrl, decline: reservation.declineUrl}
  }
}

// --------------- The pylon ---------------

/** A GraphQL literal. The same shape as the renderer in ../../hooks/transfers.ts, which is not exported. */
const literal = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  )
    return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${literal(v)}`)
      .join(', ')}}`
  }
  return 'null'
}

/**
 * One field, its arguments as literals, the answer under the field. A
 * refusal is thrown as GraphQLRequestError with the backend's code, so the
 * dialog can say "only administrators" for FORBIDDEN and "sign in again"
 * for AUTH_REQUIRED rather than the backend's one word.
 */
const call = async (
  field: string,
  args: Record<string, unknown>,
  selection: string,
  kind: 'query' | 'mutation'
): Promise<any> => {
  const rendered = Object.entries(args)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${literal(v)}`)
    .join(', ')
  const refusal = (errors: any[]): GraphQLRequestError => {
    const first = errors[0]
    return new GraphQLRequestError(
      String(first?.message || 'GraphQL error'),
      typeof first?.extensions?.code === 'string'
        ? first.extensions.code
        : undefined
    )
  }
  let result: any
  try {
    result = await fetchGraphQL(
      {
        query: `${kind} { ${field}(${rendered}) ${selection} }`,
        variables: undefined,
        operationName: undefined
      },
      {}
    )
  } catch (err) {
    // GQty's response handler throws when an answer carries errors and no
    // data, as a validation error does, with the errors under
    // `graphQLErrors` and, for more than one, the message "GraphQL Errors".
    // The first error's own words are what the dialog shows.
    const errors = (err as {graphQLErrors?: unknown})?.graphQLErrors
    if (Array.isArray(errors) && errors.length) throw refusal(errors)
    throw err
  }
  if (result?.errors?.length) throw refusal(result.errors)
  return result?.data?.[field]
}

/**
 * The numbers drawn from the plain counter on this page, per ride, kept
 * for the ten minutes the brief reserves a number for: a dialog closed
 * without sending and opened again shows the same number rather than
 * spending the next one. The offer backend's reservation replaces this.
 */
const DRAWN = new Map<string, {number: string; at: number}>()
const RESERVATION_MS = 10 * 60 * 1000

/** The schema does not know the field: the offer backend is not deployed, not a failure of this ride. */
const isUnknownField = (err: unknown): boolean =>
  err instanceof Error &&
  /Cannot query field|Unknown argument|Unknown field|is not defined|Unknown type/i.test(
    err.message
  )

/**
 * The number, the links and the validity for this ride. The offer
 * backend's `reserveOfferNumber` first, and while it is not deployed the
 * ride's existing OFFER document's number or the plain counter, with links
 * to the brand's confirmation page that carry no token, which the offer
 * backend replaces the moment it answers.
 */
async function reserveOffer(row: TransferRow): Promise<OfferReservation> {
  try {
    const node = await call(
      'reserveOfferNumber',
      {args: {transferId: row.id}},
      '{ number validUntil confirmUrl declineUrl }',
      'mutation'
    )
    if (node?.number) {
      return {
        number: String(node.number),
        validUntil: String(
          node.validUntil ?? validUntilOf(row.pickupDateTime).toISOString()
        ),
        confirmUrl: String(node.confirmUrl ?? ''),
        declineUrl: String(node.declineUrl ?? ''),
        source: 'reserveOfferNumber'
      }
    }
  } catch (err) {
    if (!isUnknownField(err)) throw err
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const links = {
    confirmUrl: `${origin}/angebot/`,
    declineUrl: `${origin}/angebot/ablehnen/`
  }
  const validUntil = validUntilOf(row.pickupDateTime).toISOString()

  const documents: any[] =
    (await call(
      'transferDocuments',
      {args: {transferId: row.id}},
      '{ id kind number }',
      'query'
    )) ?? []
  const existing = documents.find(d => d?.kind === 'OFFER' && d?.number)
  if (existing)
    return {
      number: String(existing.number),
      validUntil,
      ...links,
      source: 'existing'
    }

  const drawn = DRAWN.get(row.id)
  if (drawn && Date.now() - drawn.at < RESERVATION_MS)
    return {number: drawn.number, validUntil, ...links, source: 'existing'}

  const number = String(
    await call('nextDocumentNumber', {args: {kind: 'OFFER'}}, '', 'mutation')
  )
  DRAWN.set(row.id, {number, at: Date.now()})
  return {number, validUntil, ...links, source: 'nextDocumentNumber'}
}

// --------------- The dialog ---------------

export interface OfferDocument {
  id: string
  number: string
  filename: string
}

export interface OfferDialogProps {
  open: boolean
  onClose: () => void
  transfer: TransferRow | null
  /** After `sendOffer` answered: the document, for the timeline. */
  onSent?: (document: OfferDocument) => void
}

type Phase =
  | 'idle'
  | 'preparing'
  | 'loading'
  | 'compiling'
  | 'ready'
  | 'sending'
  | 'failed'

interface Preview {
  reservation: OfferReservation
  data: OfferData
  pdf: Uint8Array
  url: string
  /** The compile alone, the number the acceptance measures. */
  compileMs: number
  thread: 'worker' | 'main'
}

/** The template's main file and the files it needs, in one place for the tests to read. */
export const OFFER_TEMPLATE = 'templates/offer.typ'

const reasonOf = (err: unknown, s: OfferStrings): string => {
  if (isOfflineError(err)) return s.Offline
  const code = (err as {code?: unknown})?.code
  if (code === 'FORBIDDEN') return s.Forbidden
  if (code === 'AUTH_REQUIRED') return s.AuthRequired
  if (err instanceof Error && err.message) return err.message
  return s.Unknown
}

export function OfferDialog({
  open,
  onClose,
  transfer,
  onSent
}: OfferDialogProps) {
  const code = useI18nCode()
  const s = useMemo(() => strings(code), [code])
  const {user: customer} = useUserDetail(
    open && transfer ? transfer.customerId : ''
  )
  const caller = useCaller()
  const {user: me} = useUserDetail(open && caller.userId ? caller.userId : '')
  const signer = me
    ? fullName({firstName: me.firstName, lastName: me.lastName, username: ''})
    : ''

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  // The run that is current. A dialog closed and reopened while a compile
  // was out must not show the old run's PDF.
  const run = useRef(0)

  const revoke = useCallback((p: Preview | null) => {
    if (p) URL.revokeObjectURL(p.url)
  }, [])

  const language = transfer ? transferLanguage(transfer) : 'de'
  const languageName = {
    de: s.LanguageDe,
    en: s.LanguageEn,
    tr: s.LanguageTr,
    ar: s.LanguageAr
  }[language]
  const email = transfer
    ? recipientEmail(customer, primaryPassenger(transfer))
    : ''

  useEffect(() => {
    if (!open || !transfer) return
    const mine = ++run.current
    setError(null)
    setPreview(p => {
      revoke(p)
      return null
    })

    if (transfer.price == null) {
      setPhase('failed')
      setError(s.NoPrice)
      return
    }

    const current = () => run.current === mine

    void (async () => {
      let reservation: OfferReservation
      setPhase('preparing')
      try {
        reservation = await reserveOffer(transfer)
      } catch (err) {
        if (!current()) return
        setPhase('failed')
        setError(fill(s.ErrorNumber, {reason: reasonOf(err, s)}))
        return
      }
      if (!current()) return

      setPhase('loading')
      let typst: typeof import('../../typst/compile')
      let files: TypstFiles
      let thread: 'worker' | 'main'
      try {
        typst = await import('../../typst/compile')
        const [compiler, bundle] = await Promise.all([
          typst.loadTypst(),
          typst.templateFiles()
        ])
        thread = compiler.thread
        files = bundle
      } catch (err) {
        if (!current()) return
        setPhase('failed')
        setError(fill(s.ErrorLoad, {reason: reasonOf(err, s)}))
        return
      }
      if (!current()) return

      setPhase('compiling')
      const data = offerData(transfer, reservation, customer, signer)
      const started = performance.now()
      try {
        const pdf = await typst.compileToPdf(OFFER_TEMPLATE, files, data, {
          brand: data.brand
        })
        const compileMs = Math.round(performance.now() - started)
        if (!current()) return
        setPreview({
          reservation,
          data,
          pdf,
          url: typst.pdfObjectUrl(pdf),
          compileMs,
          thread
        })
        setPhase('ready')
        console.info(
          `offer: ${reservation.number} (${reservation.source}) compiled in ${compileMs} ms on the ${thread} thread`
        )
      } catch (err) {
        if (!current()) return
        setPhase('failed')
        setError(fill(s.ErrorTemplate, {reason: reasonOf(err, s)}))
      }
    })()
    // The customer profile arriving later does not restart the run: the
    // addressee is read when the data is built, and a profile that comes
    // after the compile is the next open's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transfer?.id, transfer?.price])

  useEffect(() => {
    if (open) return
    run.current += 1
    setPhase('idle')
    setError(null)
    setPreview(p => {
      revoke(p)
      return null
    })
  }, [open, revoke])

  const send = async () => {
    if (!transfer || !preview) return
    if (!email) {
      setError(s.NoEmail)
      return
    }
    setPhase('sending')
    setError(null)
    const {reservation, data, pdf} = preview

    const filename = `${reservation.number}.pdf`

    // The compiled PDF goes to the storage gateway from here, with jaen's
    // own uploadFile, the same call a page image and a car's picture go
    // through (okf/architecture/media.md, "Everything uploads to the
    // gateway"). The pylon is then told what came back and never sees the
    // bytes; the base64 field it used to take is gone with the private
    // bucket.
    let uploaded: Awaited<ReturnType<typeof uploadFile>>
    try {
      uploaded = await uploadFile(
        new File([pdf.slice().buffer as ArrayBuffer], filename, {
          type: 'application/pdf'
        }),
        filename
      )
      if (!uploaded?.data?.file_id || !uploaded?.fileUrl) {
        throw new Error('the storage gateway answered no file')
      }
    } catch (err) {
      setPhase('ready')
      setError(fill(s.ErrorUpload, {reason: reasonOf(err, s)}))
      return
    }

    let document: OfferDocument
    try {
      const node = await call(
        'uploadTransferDocument',
        {
          args: {
            transferId: transfer.id,
            kind: 'OFFER',
            ...gatewayFileOf(uploaded, {
              name: filename,
              size: pdf.byteLength,
              type: 'application/pdf'
            }),
            filename,
            number: reservation.number,
            language: data.language,
            data
          }
        },
        '{ id number filename }',
        'mutation'
      )
      document = {
        id: String(node?.id ?? ''),
        number: String(node?.number ?? reservation.number),
        filename: String(node?.filename ?? '')
      }
      if (!document.id) throw new Error('no document id in the answer')
    } catch (err) {
      setPhase('ready')
      setError(fill(s.ErrorUpload, {reason: reasonOf(err, s)}))
      return
    }

    try {
      await mutate(
        'sendOffer',
        {args: {documentId: document.id}},
        '{ __typename }'
      )
    } catch (err) {
      setPhase('ready')
      setError(fill(s.ErrorSend, {reason: reasonOf(err, s)}))
      return
    }

    toaster.success({title: fill(s.Sent, {number: document.number})})
    onSent?.(document)
    onClose()
  }

  const busy = phase === 'sending'
  const status =
    phase === 'preparing'
      ? s.Preparing
      : phase === 'loading'
        ? s.Loading
        : phase === 'compiling'
          ? s.Compiling
          : phase === 'sending'
            ? s.Sending
            : preview
              ? fill(s.Ready, {
                  number: preview.reservation.number,
                  seconds: (preview.compileMs / 1000).toFixed(1)
                })
              : ''

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={s.Title}
      size="xl"
      busy={busy}
      footer={
        <DialogActions
          onCancel={onClose}
          confirmLabel={s.Send}
          onConfirm={send}
          loading={busy}
          confirmDisabled={phase !== 'ready' || !preview}
          data-testid="offer-actions"
        />
      }>
      <Stack gap="3" data-testid="offer-dialog" data-phase={phase}>
        {error && <ErrorBanner message={error} data-testid="offer-error" />}
        {status && (
          <Text
            fontSize="sm"
            color="fg.muted"
            data-testid="offer-status"
            data-compile-ms={preview?.compileMs ?? ''}
            data-thread={preview?.thread ?? ''}
            data-number={preview?.reservation.number ?? ''}>
            {status}
          </Text>
        )}
        {transfer && (
          <Text fontSize="sm" color="fg.muted" data-testid="offer-recipient">
            {email
              ? fill(s.Recipient, {email, language: languageName})
              : s.NoEmail}
          </Text>
        )}
        <Box
          borderWidth="1px"
          borderColor="border"
          rounded="surface"
          bg="bg.subtle"
          overflow="hidden"
          h={{base: '60vh', md: '70vh'}}
          minH="320px">
          {preview ? (
            <object
              data={preview.url}
              type="application/pdf"
              data-testid="offer-preview"
              style={{width: '100%', height: '100%', display: 'block'}}>
              <Stack p="4" gap="2">
                <Text fontSize="sm">{s.NoPreview}</Text>
                <Link
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  colorPalette="brand">
                  {s.Open}
                </Link>
              </Stack>
            </object>
          ) : (
            <Skeleton w="full" h="full" data-testid="offer-skeleton" />
          )}
        </Box>
        {preview && (
          <Link
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            fontSize="sm"
            colorPalette="brand"
            data-testid="offer-open">
            {s.Open}
          </Link>
        )}
      </Stack>
    </Sheet>
  )
}
