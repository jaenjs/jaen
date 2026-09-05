/**
 * Every word the app says about having no connection: the banner over the
 * driver's rides, the refusal on the slider, and the error a screen shows
 * when there is nothing stored to fall back on. See
 * okf/architecture/offline.md.
 *
 * German is the product language and the other three are typed against it,
 * so a key added to `de` and forgotten in `ar` fails the typecheck rather
 * than showing a key on a screen. The wording of NoConnectionNoData and
 * NotPossibleOffline is the decided one, verbatim from the brief.
 */
import type {I18nCode} from '../i18n'

const de = {
  /** The banner while a stored answer is on the screen. `{time}` is HH:mm. */
  Banner: 'Offline, Stand {time}',
  /** The banner while offline and nothing stored has been shown yet. */
  BannerNoData: 'Offline',
  BannerHint: 'Du siehst den letzten gespeicherten Stand. Änderungen sind erst mit Verbindung möglich.',
  /** The error where the hook shows one today, when there is no stored answer either. */
  NoConnectionNoData: 'Keine Verbindung und keine gespeicherten Daten',
  /** The slider's message, and the refusal of any write while offline. */
  NotPossibleOffline: 'Ohne Verbindung nicht möglich'
}

export type OfflineStrings = typeof de

const en: OfflineStrings = {
  Banner: 'Offline, as of {time}',
  BannerNoData: 'Offline',
  BannerHint: 'You are looking at the last stored state. Changes need a connection.',
  NoConnectionNoData: 'No connection and no stored data',
  NotPossibleOffline: 'Not possible without a connection'
}

const tr: OfflineStrings = {
  Banner: 'Çevrimdışı, {time} itibarıyla',
  BannerNoData: 'Çevrimdışı',
  BannerHint: 'Kaydedilmiş son durumu görüyorsun. Değişiklikler için bağlantı gerekir.',
  NoConnectionNoData: 'Bağlantı yok ve kayıtlı veri yok',
  NotPossibleOffline: 'Bağlantı olmadan mümkün değil'
}

const ar: OfflineStrings = {
  Banner: 'غير متصل، آخر تحديث {time}',
  BannerNoData: 'غير متصل',
  BannerHint: 'أنت ترى آخر حالة محفوظة. التغييرات تحتاج إلى اتصال.',
  NoConnectionNoData: 'لا يوجد اتصال ولا توجد بيانات محفوظة',
  NotPossibleOffline: 'غير ممكن بدون اتصال'
}

export function getI18nOffline(code: I18nCode): {code: I18nCode; strings: OfflineStrings} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

/** `{name}` style placeholders, filled in. */
export const fillOffline = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template)
