/**
 * The words of the driver's cash, dispatch.md section 14.3.
 *
 * A catalogue of its own, the way i18nPeople is one, because the same fact is
 * written and read on three screens whose catalogues are three: the driver's
 * ride screen (i18nTransfers), the dispatcher's money section (i18nOffers) and
 * the billing screen's Fahrer half (i18nFinance). One catalogue is what keeps
 * "Bar erhalten" from becoming three strings that drift apart.
 *
 * German is the product language and the other three are typed against it, so
 * a key added to `de` and forgotten in `ar` fails the typecheck rather than
 * showing a key on a screen.
 */
import type {I18nCode} from '../i18n'

const de = {
  /** The button on the driver's ride, and the heading of the card it sits in. */
  Action: 'Bar erhalten',
  Title: 'Barzahlung',
  /** The amount field, prefilled with the fare. */
  AmountLabel: 'Betrag',
  Hint: 'Der Fahrgast hat bar bezahlt. Der Betrag wird in der Abrechnung als bar erhalten geführt.',
  ConfirmTitle: 'Bar erhalten?',
  ConfirmBody:
    'Sie bestätigen, {amount} bar vom Fahrgast erhalten zu haben. Der Betrag steht in Ihrer Abrechnung und wird von der Auszahlung abgezogen.',
  Received: '{amount} bar erhalten',
  /** The record, once it stands: the amount, the instant, and who wrote it. */
  ReceivedOn: 'Bar erhalten am {date}',
  RecordedBy: 'erfasst von {name}',
  /** The admin's two corrections. */
  Correct: 'Betrag korrigieren',
  Clear: 'Zurücknehmen',
  ClearTitle: 'Bareingang zurücknehmen?',
  ClearBody:
    'Der Bareingang wird von der Fahrt entfernt und die Abrechnung rechnet ihn nicht mehr an. Die Fahrt gilt danach nicht mehr als bar bezahlt.',
  Cleared: 'Bareingang zurückgenommen',
  /** The column of the month's rides in the billing screen's Fahrer half. */
  Column: 'Bar',
  /** The three refusals the pylon answers, in the reader's language. */
  NotOffered: 'Diese Fahrt zahlt nicht der Fahrgast',
  TooEarly: 'Erst ab „Unterwegs“ möglich',
  Failed: 'Der Bareingang konnte nicht gespeichert werden',
  /** An amount that is not one, before anything is sent. */
  AmountInvalid: 'Bitte einen Betrag größer als 0 eingeben',
  /** No cash on this ride yet, on the dispatcher's screen. */
  None: 'Kein Bareingang'
}

export type CashStrings = typeof de

const en: CashStrings = {
  Action: 'Cash received',
  Title: 'Cash payment',
  AmountLabel: 'Amount',
  Hint: 'The passenger paid in cash. The amount is carried in the settlement as cash received.',
  ConfirmTitle: 'Cash received?',
  ConfirmBody:
    'You confirm having received {amount} in cash from the passenger. The amount appears in your settlement and is deducted from the payout.',
  Received: '{amount} received in cash',
  ReceivedOn: 'Cash received on {date}',
  RecordedBy: 'recorded by {name}',
  Correct: 'Correct the amount',
  Clear: 'Take it back',
  ClearTitle: 'Take the cash record back?',
  ClearBody:
    'The cash record is removed from the ride and the settlement stops counting it. The ride no longer counts as paid in cash.',
  Cleared: 'Cash record taken back',
  Column: 'Cash',
  NotOffered: 'The passenger is not the paying party of this ride',
  TooEarly: 'Only from "On the way" on',
  Failed: 'The cash record could not be saved',
  AmountInvalid: 'Please enter an amount greater than 0',
  None: 'No cash recorded'
}

const tr: CashStrings = {
  Action: 'Nakit alındı',
  Title: 'Nakit ödeme',
  AmountLabel: 'Tutar',
  Hint: 'Yolcu nakit ödedi. Tutar hesapta nakit alındı olarak görünür.',
  ConfirmTitle: 'Nakit alındı mı?',
  ConfirmBody:
    'Yolcudan {amount} nakit aldığınızı onaylıyorsunuz. Tutar hesabınızda görünür ve ödemeden düşülür.',
  Received: '{amount} nakit alındı',
  ReceivedOn: '{date} tarihinde nakit alındı',
  RecordedBy: '{name} tarafından kaydedildi',
  Correct: 'Tutarı düzelt',
  Clear: 'Geri al',
  ClearTitle: 'Nakit kaydı geri alınsın mı?',
  ClearBody:
    'Nakit kaydı transferden kaldırılır ve hesap bunu artık saymaz. Transfer bundan sonra nakit ödenmiş sayılmaz.',
  Cleared: 'Nakit kaydı geri alındı',
  Column: 'Nakit',
  NotOffered: 'Bu transferde ödemeyi yolcu yapmıyor',
  TooEarly: 'Yalnızca „Yolda“ durumundan itibaren',
  Failed: 'Nakit kaydı kaydedilemedi',
  AmountInvalid: 'Lütfen 0’dan büyük bir tutar girin',
  None: 'Nakit kaydı yok'
}

const ar: CashStrings = {
  Action: 'تم استلام النقد',
  Title: 'الدفع نقداً',
  AmountLabel: 'المبلغ',
  Hint: 'دفع الراكب نقداً. يُدرج المبلغ في الحساب كنقد مستلم.',
  ConfirmTitle: 'هل تم استلام النقد؟',
  ConfirmBody:
    'أنت تؤكد استلام {amount} نقداً من الراكب. يظهر المبلغ في حسابك ويُخصم من الدفعة.',
  Received: 'تم استلام {amount} نقداً',
  ReceivedOn: 'تم استلام النقد في {date}',
  RecordedBy: 'سُجل بواسطة {name}',
  Correct: 'تصحيح المبلغ',
  Clear: 'التراجع',
  ClearTitle: 'هل تريد التراجع عن تسجيل النقد؟',
  ClearBody:
    'يُزال تسجيل النقد من الرحلة ولن يحتسبه الحساب بعد الآن. لن تُعد الرحلة مدفوعة نقداً.',
  Cleared: 'تم التراجع عن تسجيل النقد',
  Column: 'نقد',
  NotOffered: 'الراكب ليس الطرف الدافع في هذه الرحلة',
  TooEarly: 'فقط اعتباراً من «في الطريق»',
  Failed: 'تعذر حفظ تسجيل النقد',
  AmountInvalid: 'يرجى إدخال مبلغ أكبر من 0',
  None: 'لا يوجد نقد مسجل'
}

export function getI18nCash(code: I18nCode): {
  code: I18nCode
  strings: CashStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

export {fill} from './i18nCommon'
