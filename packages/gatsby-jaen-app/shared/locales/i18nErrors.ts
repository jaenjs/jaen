/**
 * Every sentence the app says when something failed, design-consistency.md
 * rule 14.
 *
 * Owner, 2026-09-08: "Alerts sind noch alle in Englisch." They were, and not
 * because a screen forgot its catalogue. Measured on the live booklimo.at as
 * the human admin with every `transfers` read answered `FORBIDDEN`: the board
 * drew "Etwas ist schiefgelaufen / Forbidden / Erneut versuchen" in German,
 * "Bir şeyler ters gitti / Forbidden" in Turkish and "حدث خطأ ما / Forbidden"
 * in Arabic. The banner's own title and its button were the reader's language
 * and the sentence between them was the backend's English, passed through the
 * whole app untouched: the pylon's `ServiceError` message, the browser's own
 * failure text, or one of the app's own English throws ("no link in the
 * answer", "Notifications are not supported").
 *
 * So a failure is a word of this catalogue from the moment it becomes an
 * `Error`, not from the moment a screen draws it: see ../errors.ts, which is
 * the one place a machine answer turns into a sentence. Every toast
 * description, every error banner and every empty state that shows a failure
 * reads what that produced, so no screen carries a translation of its own and
 * a screen that already passes its own catalogue string keeps passing it.
 *
 * The keys are the codes the pylon answers with (okf: `pylon/src/errors`,
 * `pylon/src/auth`), plus the handful of failures the app itself raises. A
 * code the pylon adds tomorrow and this catalogue does not know falls to
 * `Unknown`, and the machine text goes to the console rather than to a person.
 *
 * German is the product language and the other three are typed against it,
 * so a key added to `de` and forgotten in `ar` fails the typecheck rather
 * than showing a key on a screen.
 */
import type {I18nCode} from '../i18n'

const de = {
  // --------------- what the pylon refuses with ---------------
  /** AUTH_REQUIRED: no valid token at all. Kept apart from Forbidden on purpose. */
  AuthRequired: 'Bitte neu anmelden.',
  /** FORBIDDEN: signed in, and it is still not yours. */
  Forbidden: 'Dafür fehlt die Berechtigung.',
  /** NOT_FOUND and USER_NOT_FOUND. */
  NotFound: 'Das gibt es nicht mehr.',
  /** INVALID_INPUT. */
  InvalidInput: 'Die Eingabe passt nicht.',
  /** CONFIRMATION_REQUIRED, dispatch.md section 11. */
  ConfirmationRequired: 'Die Buchung ist noch nicht bestätigt.',
  /** PICKUP_IN_PAST, dispatch.md section 12. */
  PickupInPast: 'Die Abholzeit liegt in der Vergangenheit.',
  /** INVALID_PHONE, dispatch.md section 13. */
  InvalidPhone: 'Bitte die Nummer mit Landesvorwahl eingeben.',
  /** INVALID_TRANSITION: the step is not one this ride can take from here. */
  InvalidTransition: 'Dieser Schritt ist von hier aus nicht möglich.',
  /** PAYOUT_LOCKED, finance.md: the money left on an earlier day. */
  PayoutLocked: 'Die Auszahlung ist bereits abgeschlossen.',
  /** LINK_EXPIRED: a statement or a ride link past its hour. */
  LinkExpired: 'Der Link ist abgelaufen.',
  /** CODE_EXHAUSTED: the code minter found no free stem. */
  CodeExhausted: 'Es konnte kein Code vergeben werden.',
  /** MISCONFIGURED and every 5xx of the platform itself. */
  Server: 'Beim Server ist etwas schiefgelaufen.',
  /** A refusal the app has no sentence for. The machine text goes to the console. */
  Unknown: 'Unbekannter Fehler.',

  // --------------- what the app itself raises ---------------
  /** The answer carried no download link (documents, statements). */
  NoLink: 'Die Datei konnte nicht erstellt werden.',
  /** The storage gateway answered without a file. */
  NoFile: 'Die Datei ist nicht verfügbar.',
  /** A month argument that is not YYYY-MM. */
  InvalidMonth: 'Der Monat ist ungültig.',
  /** A pickup date or time that cannot be read. */
  InvalidDate: 'Datum oder Uhrzeit sind ungültig.',
  /** A share that is not between 0 and 100. */
  InvalidPercent: 'Der Anteil muss zwischen 0 und 100 liegen.',
  /** The browser has no push at all. */
  PushUnsupported: 'Dieses Gerät unterstützt keine Benachrichtigungen.',
  /** The person said no to the permission prompt. */
  PushDenied: 'Benachrichtigungen wurden nicht erlaubt.',
  /** The subscription came back without its keys, or without the server's key. */
  PushIncomplete: 'Die Anmeldung für Benachrichtigungen ist unvollständig.',
  /** The geocoder did not answer. */
  GeocodingFailed: 'Die Adresse konnte nicht gefunden werden.',
  /** The browser has no worker, no wasm, nothing this needs. */
  BrowserUnsupported: 'Dieser Browser kann das nicht.'
}

export type ErrorStrings = typeof de

const en: ErrorStrings = {
  AuthRequired: 'Please sign in again.',
  Forbidden: 'You are not allowed to do that.',
  NotFound: 'That does not exist any more.',
  InvalidInput: 'The input does not fit.',
  ConfirmationRequired: 'The booking is not confirmed yet.',
  PickupInPast: 'The pickup time is in the past.',
  InvalidPhone: 'Please enter the number with its country code.',
  InvalidTransition: 'That step is not possible from here.',
  PayoutLocked: 'The payout is already closed.',
  LinkExpired: 'The link has expired.',
  CodeExhausted: 'No code could be issued.',
  Server: 'Something went wrong on the server.',
  Unknown: 'Unknown error.',
  NoLink: 'The file could not be created.',
  NoFile: 'The file is not available.',
  InvalidMonth: 'The month is not valid.',
  InvalidDate: 'The date or the time is not valid.',
  InvalidPercent: 'The share has to be between 0 and 100.',
  PushUnsupported: 'This device does not support notifications.',
  PushDenied: 'Notifications were not allowed.',
  PushIncomplete: 'The notification sign-up is incomplete.',
  GeocodingFailed: 'The address could not be found.',
  BrowserUnsupported: 'This browser cannot do that.'
}

const tr: ErrorStrings = {
  AuthRequired: 'Lütfen tekrar giriş yap.',
  Forbidden: 'Bunun için yetkin yok.',
  NotFound: 'Bu artık mevcut değil.',
  InvalidInput: 'Girilen bilgi uygun değil.',
  ConfirmationRequired: 'Rezervasyon henüz onaylanmadı.',
  PickupInPast: 'Alış zamanı geçmişte kalıyor.',
  InvalidPhone: 'Lütfen numarayı ülke koduyla gir.',
  InvalidTransition: 'Bu adım buradan mümkün değil.',
  PayoutLocked: 'Ödeme zaten kapatıldı.',
  LinkExpired: 'Bağlantının süresi doldu.',
  CodeExhausted: 'Kod verilemedi.',
  Server: 'Sunucuda bir şeyler ters gitti.',
  Unknown: 'Bilinmeyen hata.',
  NoLink: 'Dosya oluşturulamadı.',
  NoFile: 'Dosya mevcut değil.',
  InvalidMonth: 'Ay geçersiz.',
  InvalidDate: 'Tarih veya saat geçersiz.',
  InvalidPercent: 'Pay 0 ile 100 arasında olmalı.',
  PushUnsupported: 'Bu cihaz bildirimleri desteklemiyor.',
  PushDenied: 'Bildirimlere izin verilmedi.',
  PushIncomplete: 'Bildirim kaydı eksik.',
  GeocodingFailed: 'Adres bulunamadı.',
  BrowserUnsupported: 'Bu tarayıcı bunu yapamıyor.'
}

const ar: ErrorStrings = {
  AuthRequired: 'يرجى تسجيل الدخول من جديد.',
  Forbidden: 'ليست لديك صلاحية لذلك.',
  NotFound: 'لم يعد هذا موجوداً.',
  InvalidInput: 'المُدخل غير صالح.',
  ConfirmationRequired: 'الحجز لم يُؤكَّد بعد.',
  PickupInPast: 'وقت الاستلام في الماضي.',
  InvalidPhone: 'يرجى إدخال الرقم مع رمز الدولة.',
  InvalidTransition: 'هذه الخطوة غير ممكنة من هنا.',
  PayoutLocked: 'تمت تسوية الدفعة بالفعل.',
  LinkExpired: 'انتهت صلاحية الرابط.',
  CodeExhausted: 'تعذّر إصدار رمز.',
  Server: 'حدث خطأ في الخادم.',
  Unknown: 'خطأ غير معروف.',
  NoLink: 'تعذّر إنشاء الملف.',
  NoFile: 'الملف غير متاح.',
  InvalidMonth: 'الشهر غير صالح.',
  InvalidDate: 'التاريخ أو الوقت غير صالح.',
  InvalidPercent: 'يجب أن تكون النسبة بين 0 و100.',
  PushUnsupported: 'هذا الجهاز لا يدعم الإشعارات.',
  PushDenied: 'لم يُسمح بالإشعارات.',
  PushIncomplete: 'تسجيل الإشعارات غير مكتمل.',
  GeocodingFailed: 'تعذّر العثور على العنوان.',
  BrowserUnsupported: 'هذا المتصفح لا يستطيع ذلك.'
}

export function getI18nErrors(code: I18nCode): {
  code: I18nCode
  strings: ErrorStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

/** Every catalogue, for a check that asks whether a sentence is one of them. */
export const ALL_ERROR_STRINGS: ErrorStrings[] = [de, en, tr, ar]
