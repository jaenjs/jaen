/**
 * Every word of the billing screen, /app/statements/, "Abrechnungen"
 * (okf/architecture/finance.md, "The billing screen, both sides"): the
 * page, its two halves Kunden and Fahrer, the Fahrer table with the payout
 * status and its two actions, and the customer's own half with the rides'
 * invoice and payment status. The offers table keeps its words in
 * i18nOffers.ts, the statement months and their rides keep theirs in
 * i18nBookings.ts. German is the product language and the other three are
 * typed against it, so a key added to `de` and forgotten in `ar` fails the
 * typecheck.
 */
import type {I18nCode} from '../i18n'

const de = {
  // The page
  Heading: 'Abrechnungen',
  Subtitle: 'Angebote und Rechnungen der Kunden, Auszahlungen der Fahrer',
  SubtitleDriver: 'Ihre Monatsabrechnungen und deren Auszahlung',
  SubtitleCustomer: 'Ihre Monatsabrechnungen, Rechnungen und Zahlungen',
  TabCustomers: 'Kunden',
  TabDrivers: 'Fahrer',

  // The Fahrer half
  ColDriver: 'Fahrer',
  ColMonth: 'Monat',
  ColRides: 'Fahrten',
  ColRevenue: 'Umsatz',
  ColCash: 'Bar erhalten',
  ColShare: 'Anteil',
  ColExpenses: 'Spesen',
  ColPayout: 'Auszahlung',
  ColStatus: 'Status',
  ColFiles: 'Monatsabrechnung',
  ColAction: 'Aktion',
  StatusOpen: 'offen',
  StatusPaid: 'ausbezahlt am {date}',
  PaidNote: 'Notiz: {note}',
  MonthLabel: 'Monat',
  MonthAll: 'Letzte zwölf Monate',
  DriversCount: '{count} Fahrerabrechnungen',
  DriversEmpty: 'Keine Fahrerabrechnungen',
  DriversEmptyHint:
    'Eine Zeile erscheint, sobald ein Fahrer in einem Monat Fahrten abgeschlossen hat.',
  DownloadPdf: 'PDF',
  DownloadXlsx: 'Excel',
  DownloadError: 'Download fehlgeschlagen',
  RidesShow: 'Fahrten',
  RidesHide: 'Fahrten ausblenden',
  MarkPaid: 'Als ausbezahlt markieren',
  MarkPaidTitle: 'Als ausbezahlt markieren?',
  MarkPaidBody:
    '{month}, {name}: {amount} gilt danach als ausbezahlt. Die Markierung kann heute noch zurückgenommen werden.',
  NoteLabel: 'Notiz',
  NotePlaceholder: 'z. B. bar übergeben, Überweisung vom 3.',
  MarkedPaid: 'Als ausbezahlt markiert',
  MarkPaidFailed: 'Das hat nicht geklappt',
  Revoke: 'Zurücknehmen',
  RevokeTitle: 'Markierung zurücknehmen?',
  RevokeBody:
    'Der Monat gilt danach wieder als offen. Das geht nur am Tag der Markierung.',
  Revoked: 'Markierung zurückgenommen',
  RevokeFailed: 'Das hat nicht geklappt',
  RevokeLocked:
    'Die Markierung stammt von einem früheren Tag und bleibt bestehen',
  Forbidden: 'Nur Administratoren dürfen das',

  // The customer's own half
  MyStatements: 'Monatsabrechnungen',
  MyRides: 'Rechnungen und Zahlungen',
  RidesColCode: 'Code',
  RidesColDate: 'Abholung',
  RidesColRoute: 'Strecke',
  RidesColAmount: 'Betrag',
  RidesColStatus: 'Status',
  RidesColInvoice: 'Rechnung',
  RidesColPaid: 'Bezahlt',
  RidesColDocuments: 'Dokumente',
  RidesCount: '{total} Fahrten gesamt, {count} auf dieser Seite',
  RidesEmpty: 'Noch keine Fahrten',
  RidesEmptyHint: 'Rechnung und Zahlung erscheinen hier pro Fahrt.',
  InvoiceNotYet: 'noch keine Rechnung',
  PaidNotYet: 'offen'
}

export type FinanceStrings = typeof de

const en: FinanceStrings = {
  Heading: 'Billing',
  Subtitle: "The customers' offers and invoices, the drivers' payouts",
  SubtitleDriver: 'Your monthly settlements and their payout',
  SubtitleCustomer: 'Your monthly statements, invoices and payments',
  TabCustomers: 'Customers',
  TabDrivers: 'Drivers',

  ColDriver: 'Driver',
  ColMonth: 'Month',
  ColRides: 'Rides',
  ColRevenue: 'Revenue',
  ColCash: 'Cash taken',
  ColShare: 'Share',
  ColExpenses: 'Expenses',
  ColPayout: 'Payout',
  ColStatus: 'Status',
  ColFiles: 'Monthly statement',
  ColAction: 'Action',
  StatusOpen: 'open',
  StatusPaid: 'paid out on {date}',
  PaidNote: 'Note: {note}',
  MonthLabel: 'Month',
  MonthAll: 'Last twelve months',
  DriversCount: '{count} driver settlements',
  DriversEmpty: 'No driver settlements',
  DriversEmptyHint:
    'A row appears once a driver has completed rides in a month.',
  DownloadPdf: 'PDF',
  DownloadXlsx: 'Excel',
  DownloadError: 'Download failed',
  RidesShow: 'Rides',
  RidesHide: 'Hide rides',
  MarkPaid: 'Mark as paid out',
  MarkPaidTitle: 'Mark as paid out?',
  MarkPaidBody:
    '{month}, {name}: {amount} then counts as paid out. The mark can still be taken back today.',
  NoteLabel: 'Note',
  NotePlaceholder: 'e.g. handed over in cash, transfer of the 3rd',
  MarkedPaid: 'Marked as paid out',
  MarkPaidFailed: 'That did not work',
  Revoke: 'Take back',
  RevokeTitle: 'Take the mark back?',
  RevokeBody:
    'The month then counts as open again. This works on the day of the mark only.',
  Revoked: 'Mark taken back',
  RevokeFailed: 'That did not work',
  RevokeLocked: 'The mark is from an earlier day and stands',
  Forbidden: 'Only administrators may do this',

  MyStatements: 'Monthly statements',
  MyRides: 'Invoices and payments',
  RidesColCode: 'Code',
  RidesColDate: 'Pickup',
  RidesColRoute: 'Route',
  RidesColAmount: 'Amount',
  RidesColStatus: 'Status',
  RidesColInvoice: 'Invoice',
  RidesColPaid: 'Paid',
  RidesColDocuments: 'Documents',
  RidesCount: '{total} rides in total, {count} on this page',
  RidesEmpty: 'No rides yet',
  RidesEmptyHint: 'The invoice and the payment appear here per ride.',
  InvoiceNotYet: 'no invoice yet',
  PaidNotYet: 'open'
}

const tr: FinanceStrings = {
  Heading: 'Faturalama',
  Subtitle: 'Müşterilerin teklif ve faturaları, sürücülerin ödemeleri',
  SubtitleDriver: 'Aylık hakedişleriniz ve ödemeleri',
  SubtitleCustomer: 'Aylık hesap özetleriniz, faturalarınız ve ödemeleriniz',
  TabCustomers: 'Müşteriler',
  TabDrivers: 'Sürücüler',

  ColDriver: 'Sürücü',
  ColMonth: 'Ay',
  ColRides: 'Yolculuk',
  ColRevenue: 'Ciro',
  ColCash: 'Nakit alınan',
  ColShare: 'Pay',
  ColExpenses: 'Masraflar',
  ColPayout: 'Ödeme',
  ColStatus: 'Durum',
  ColFiles: 'Aylık hesap özeti',
  ColAction: 'İşlem',
  StatusOpen: 'açık',
  StatusPaid: '{date} tarihinde ödendi',
  PaidNote: 'Not: {note}',
  MonthLabel: 'Ay',
  MonthAll: 'Son on iki ay',
  DriversCount: '{count} sürücü hakedişi',
  DriversEmpty: 'Sürücü hakedişi yok',
  DriversEmptyHint:
    'Bir sürücü bir ayda yolculuk tamamladığında burada bir satır görünür.',
  DownloadPdf: 'PDF',
  DownloadXlsx: 'Excel',
  DownloadError: 'İndirme başarısız',
  RidesShow: 'Yolculuklar',
  RidesHide: 'Yolculukları gizle',
  MarkPaid: 'Ödendi olarak işaretle',
  MarkPaidTitle: 'Ödendi olarak işaretlensin mi?',
  MarkPaidBody:
    '{month}, {name}: {amount} bundan sonra ödenmiş sayılır. İşaret bugün hâlâ geri alınabilir.',
  NoteLabel: 'Not',
  NotePlaceholder: 'örn. nakit verildi, ayın 3’ündeki havale',
  MarkedPaid: 'Ödendi olarak işaretlendi',
  MarkPaidFailed: 'Bu işe yaramadı',
  Revoke: 'Geri al',
  RevokeTitle: 'İşaret geri alınsın mı?',
  RevokeBody:
    'Ay bundan sonra yeniden açık sayılır. Bu yalnızca işaretin konduğu gün mümkündür.',
  Revoked: 'İşaret geri alındı',
  RevokeFailed: 'Bu işe yaramadı',
  RevokeLocked: 'İşaret önceki bir güne ait ve geçerli kalır',
  Forbidden: 'Bunu yalnızca yöneticiler yapabilir',

  MyStatements: 'Aylık hesap özetleri',
  MyRides: 'Faturalar ve ödemeler',
  RidesColCode: 'Kod',
  RidesColDate: 'Alış',
  RidesColRoute: 'Güzergah',
  RidesColAmount: 'Tutar',
  RidesColStatus: 'Durum',
  RidesColInvoice: 'Fatura',
  RidesColPaid: 'Ödendi',
  RidesColDocuments: 'Belgeler',
  RidesCount: 'Toplam {total} yolculuk, bu sayfada {count}',
  RidesEmpty: 'Henüz yolculuk yok',
  RidesEmptyHint: 'Fatura ve ödeme burada yolculuk başına görünür.',
  InvoiceNotYet: 'henüz fatura yok',
  PaidNotYet: 'açık'
}

const ar: FinanceStrings = {
  Heading: 'الفوترة',
  Subtitle: 'عروض العملاء وفواتيرهم، ومستحقات السائقين',
  SubtitleDriver: 'كشوف حسابك الشهرية ومدفوعاتها',
  SubtitleCustomer: 'كشوف حسابك الشهرية وفواتيرك ومدفوعاتك',
  TabCustomers: 'العملاء',
  TabDrivers: 'السائقون',

  ColDriver: 'السائق',
  ColMonth: 'الشهر',
  ColRides: 'الرحلات',
  ColRevenue: 'الإيراد',
  ColCash: 'نقداً مستلم',
  ColShare: 'الحصة',
  ColExpenses: 'المصاريف',
  ColPayout: 'المستحق',
  ColStatus: 'الحالة',
  ColFiles: 'كشف الحساب الشهري',
  ColAction: 'الإجراء',
  StatusOpen: 'مفتوح',
  StatusPaid: 'دُفع في {date}',
  PaidNote: 'ملاحظة: {note}',
  MonthLabel: 'الشهر',
  MonthAll: 'آخر اثني عشر شهراً',
  DriversCount: '{count} كشوف حساب للسائقين',
  DriversEmpty: 'لا توجد كشوف حساب للسائقين',
  DriversEmptyHint: 'يظهر صف حالما يُكمل سائق رحلات في شهر ما.',
  DownloadPdf: 'PDF',
  DownloadXlsx: 'Excel',
  DownloadError: 'فشل التنزيل',
  RidesShow: 'الرحلات',
  RidesHide: 'إخفاء الرحلات',
  MarkPaid: 'تعليم كمدفوع',
  MarkPaidTitle: 'هل تريد التعليم كمدفوع؟',
  MarkPaidBody:
    '{month}، {name}: يُعدّ {amount} مدفوعاً بعد ذلك. يمكن التراجع عن العلامة اليوم فقط.',
  NoteLabel: 'ملاحظة',
  NotePlaceholder: 'مثلاً سُلّم نقداً، تحويل بتاريخ 3',
  MarkedPaid: 'تم التعليم كمدفوع',
  MarkPaidFailed: 'لم ينجح ذلك',
  Revoke: 'تراجع',
  RevokeTitle: 'هل تريد التراجع عن العلامة؟',
  RevokeBody:
    'يُعدّ الشهر مفتوحاً من جديد بعد ذلك. هذا ممكن في يوم التعليم فقط.',
  Revoked: 'تم التراجع عن العلامة',
  RevokeFailed: 'لم ينجح ذلك',
  RevokeLocked: 'العلامة من يوم سابق وتبقى قائمة',
  Forbidden: 'يحق للمسؤولين فقط القيام بذلك',

  MyStatements: 'كشوف الحساب الشهرية',
  MyRides: 'الفواتير والمدفوعات',
  RidesColCode: 'الرمز',
  RidesColDate: 'الاستلام',
  RidesColRoute: 'المسار',
  RidesColAmount: 'المبلغ',
  RidesColStatus: 'الحالة',
  RidesColInvoice: 'الفاتورة',
  RidesColPaid: 'مدفوع',
  RidesColDocuments: 'المستندات',
  RidesCount: '{total} رحلة في المجمل، {count} في هذه الصفحة',
  RidesEmpty: 'لا رحلات بعد',
  RidesEmptyHint: 'تظهر الفاتورة والدفعة هنا لكل رحلة.',
  InvoiceNotYet: 'لا فاتورة بعد',
  PaidNotYet: 'مفتوح'
}

export function getI18nFinance(code: I18nCode): {
  code: I18nCode
  strings: FinanceStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

export {fill} from './i18nCommon'
