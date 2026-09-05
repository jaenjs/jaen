/**
 * The twelve transfer states, as the screens name them.
 *
 * The keys are the Prisma enum `TransferState` in pylon/prisma/schema.prisma,
 * one entry each, so a state the backend can produce always has a word here.
 * German is the product language and the other three follow it.
 */
import type {I18nCode} from '../i18n'

export const TRANSFER_STATES = [
  'PENDING',
  'ASSIGNED',
  'REJECTED',
  'ABORTED',
  'ON_THE_WAY',
  'AT_PICKUP',
  'NO_SHOW',
  'FAILED',
  'CANCELED',
  'TERMINATED',
  'ONGOING',
  'COMPLETED'
] as const

export type TransferState = (typeof TRANSFER_STATES)[number]

export type StateStrings = Record<TransferState, string>

const de: StateStrings = {
  PENDING: 'Offen',
  ASSIGNED: 'Zugewiesen',
  REJECTED: 'Abgelehnt',
  ABORTED: 'Abgebrochen',
  ON_THE_WAY: 'Unterwegs',
  AT_PICKUP: 'Am Abholort',
  NO_SHOW: 'Nicht erschienen',
  FAILED: 'Fehlgeschlagen',
  CANCELED: 'Storniert',
  TERMINATED: 'Beendet',
  ONGOING: 'Fahrt läuft',
  COMPLETED: 'Erledigt'
}

const en: StateStrings = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  REJECTED: 'Rejected',
  ABORTED: 'Aborted',
  ON_THE_WAY: 'On the way',
  AT_PICKUP: 'At pickup',
  NO_SHOW: 'No show',
  FAILED: 'Failed',
  CANCELED: 'Cancelled',
  TERMINATED: 'Terminated',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed'
}

const tr: StateStrings = {
  PENDING: 'Bekliyor',
  ASSIGNED: 'Atandı',
  REJECTED: 'Reddedildi',
  ABORTED: 'Yarıda kesildi',
  ON_THE_WAY: 'Yolda',
  AT_PICKUP: 'Alış noktasında',
  NO_SHOW: 'Gelmedi',
  FAILED: 'Başarısız',
  CANCELED: 'İptal edildi',
  TERMINATED: 'Sonlandırıldı',
  ONGOING: 'Sürüyor',
  COMPLETED: 'Tamamlandı'
}

const ar: StateStrings = {
  PENDING: 'قيد الانتظار',
  ASSIGNED: 'تم التعيين',
  REJECTED: 'مرفوض',
  ABORTED: 'أُلغي أثناء التنفيذ',
  ON_THE_WAY: 'في الطريق',
  AT_PICKUP: 'عند نقطة الاستلام',
  NO_SHOW: 'لم يحضر',
  FAILED: 'فشل',
  CANCELED: 'ملغى',
  TERMINATED: 'أُنهي',
  ONGOING: 'الرحلة جارية',
  COMPLETED: 'مكتمل'
}

export function getI18nStates(code: I18nCode): {code: I18nCode; strings: StateStrings} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

/**
 * `pending`, `Pending` and `PENDING` all have to find PENDING: the first
 * migration defaulted the column to lowercase and legacy rows still carry it.
 * Anything that is not one of the twelve comes back undefined, so the badge
 * can show the raw value rather than a wrong word.
 */
export const asTransferState = (raw: unknown): TransferState | undefined => {
  if (typeof raw !== 'string') return undefined
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return (TRANSFER_STATES as readonly string[]).includes(upper)
    ? (upper as TransferState)
    : undefined
}
