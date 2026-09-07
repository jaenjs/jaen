/**
 * The words of the two sources the app registers on jaen's Media tab, the
 * vehicle pictures and the brand's documents. See
 * okf/architecture/media.md, "Sources".
 *
 * These are the tab labels and what a card and its two actions say. The
 * words of the vehicle form itself (Bild hochladen, Bild ersetzen, Bild
 * entfernen) live with the fleet, in i18nFleet, because that is where the
 * form is; the words of the invoice dropzone live with the money, in
 * i18nOffers. German is the product language and the other three are typed
 * against it, so a key added to `de` and forgotten in `ar` fails the
 * typecheck.
 */
import type {I18nCode} from '../i18n'

const de = {
  // The tabs
  TabVehicles: 'Fahrzeuge',
  TabDocuments: 'Dokumente',

  // The two kinds of paper
  Kind_OFFER: 'Angebot',
  Kind_INVOICE: 'Rechnung',

  // The filters
  FilterAll: 'Alle',
  SearchPlaceholder: 'Nummer oder Code',
  MonthLabel: 'Monat',
  MonthAny: 'Alle Monate',

  // What a card says
  CountDocuments: '{total} Dokumente, {count} auf dieser Seite',
  CountVehicles: '{count} Fahrzeuge, {withImage} mit Bild',
  NoImage: 'Kein Bild',
  SentTo: 'gesendet an {email}',
  NotSentYet: 'noch nicht gesendet',
  PageOf: 'Seite {page} von {pages}',

  // The two actions
  Open: 'Öffnen',
  OpenVehicle: 'Fahrzeug öffnen',
  Remove: 'Entfernen',
  OpenFailed: 'Die Datei konnte nicht geöffnet werden',

  RemoveDocumentTitle: 'Dokument löschen?',
  RemoveDocumentBody:
    '{name} wird endgültig gelöscht. Der Kunde erreicht den Link danach nicht mehr.',
  RemoveDocumentFailed: 'Das Dokument konnte nicht gelöscht werden',
  RemoveImageTitle: 'Fahrzeugbild entfernen?',
  RemoveImageBody:
    'Das Bild von {plate} wird entfernt. Das Fahrzeug zeigt danach wieder die Silhouette seiner Klasse.',
  RemoveImageFailed: 'Das Bild konnte nicht entfernt werden',

  // The empty and the unavailable list
  EmptyDocuments: 'Keine Dokumente gefunden',
  EmptyDocumentsHint: 'Ändere die Art, den Monat oder die Suche',
  EmptyVehicles: 'Kein Fahrzeug hat ein Bild',
  EmptyVehiclesHint:
    'Lade das Bild eines Fahrzeugs im Fuhrpark hoch, dann steht es hier',
  Unavailable: 'Dieser Server kennt die Liste noch nicht',
  LoadFailed: 'Die Liste konnte nicht geladen werden',

  // Who may look
  AdminsOnly: 'Diese Ansicht ist für die Verwaltung.'
}

export type MediaSourcesStrings = typeof de

const en: MediaSourcesStrings = {
  TabVehicles: 'Vehicles',
  TabDocuments: 'Documents',

  Kind_OFFER: 'Offer',
  Kind_INVOICE: 'Invoice',

  FilterAll: 'All',
  SearchPlaceholder: 'Number or code',
  MonthLabel: 'Month',
  MonthAny: 'All months',

  CountDocuments: '{total} documents, {count} on this page',
  CountVehicles: '{count} vehicles, {withImage} with a picture',
  NoImage: 'No picture',
  SentTo: 'sent to {email}',
  NotSentYet: 'not sent yet',
  PageOf: 'Page {page} of {pages}',

  Open: 'Open',
  OpenVehicle: 'Open the vehicle',
  Remove: 'Remove',
  OpenFailed: 'The file could not be opened',

  RemoveDocumentTitle: 'Delete the document?',
  RemoveDocumentBody:
    '{name} is deleted for good. The customer will not reach the link any more.',
  RemoveDocumentFailed: 'The document could not be deleted',
  RemoveImageTitle: 'Remove the vehicle picture?',
  RemoveImageBody:
    'The picture of {plate} is removed. The vehicle then shows the silhouette of its class again.',
  RemoveImageFailed: 'The picture could not be removed',

  EmptyDocuments: 'No documents found',
  EmptyDocumentsHint: 'Change the kind, the month or the search',
  EmptyVehicles: 'No vehicle has a picture',
  EmptyVehiclesHint:
    'Upload the picture of a vehicle in the fleet and it stands here',
  Unavailable: 'This server does not know the list yet',
  LoadFailed: 'The list could not be loaded',

  AdminsOnly: 'This view is for the office.'
}

const tr: MediaSourcesStrings = {
  TabVehicles: 'Araçlar',
  TabDocuments: 'Belgeler',

  Kind_OFFER: 'Teklif',
  Kind_INVOICE: 'Fatura',

  FilterAll: 'Tümü',
  SearchPlaceholder: 'Numara veya kod',
  MonthLabel: 'Ay',
  MonthAny: 'Tüm aylar',

  CountDocuments: 'Toplam {total} belge, bu sayfada {count}',
  CountVehicles: '{count} araç, {withImage} tanesinde fotoğraf var',
  NoImage: 'Fotoğraf yok',
  SentTo: '{email} adresine gönderildi',
  NotSentYet: 'henüz gönderilmedi',
  PageOf: 'Sayfa {page} / {pages}',

  Open: 'Aç',
  OpenVehicle: 'Aracı aç',
  Remove: 'Kaldır',
  OpenFailed: 'Dosya açılamadı',

  RemoveDocumentTitle: 'Belge silinsin mi?',
  RemoveDocumentBody:
    '{name} kalıcı olarak silinir. Müşteri bağlantıya artık ulaşamaz.',
  RemoveDocumentFailed: 'Belge silinemedi',
  RemoveImageTitle: 'Araç fotoğrafı kaldırılsın mı?',
  RemoveImageBody:
    '{plate} aracının fotoğrafı kaldırılır. Araç yeniden sınıfının silüetini gösterir.',
  RemoveImageFailed: 'Fotoğraf kaldırılamadı',

  EmptyDocuments: 'Belge bulunamadı',
  EmptyDocumentsHint: 'Türü, ayı veya aramayı değiştirin',
  EmptyVehicles: 'Hiçbir aracın fotoğrafı yok',
  EmptyVehiclesHint: 'Filodaki bir aracın fotoğrafını yükleyin, burada görünür',
  Unavailable: 'Bu sunucu listeyi henüz tanımıyor',
  LoadFailed: 'Liste yüklenemedi',

  AdminsOnly: 'Bu görünüm yönetim içindir.'
}

const ar: MediaSourcesStrings = {
  TabVehicles: 'المركبات',
  TabDocuments: 'المستندات',

  Kind_OFFER: 'عرض',
  Kind_INVOICE: 'فاتورة',

  FilterAll: 'الكل',
  SearchPlaceholder: 'الرقم أو الرمز',
  MonthLabel: 'الشهر',
  MonthAny: 'كل الأشهر',

  CountDocuments: '{total} مستنداً في المجمل، {count} في هذه الصفحة',
  CountVehicles: '{count} مركبة، {withImage} منها بصورة',
  NoImage: 'بدون صورة',
  SentTo: 'أُرسل إلى {email}',
  NotSentYet: 'لم يُرسل بعد',
  PageOf: 'الصفحة {page} من {pages}',

  Open: 'فتح',
  OpenVehicle: 'فتح المركبة',
  Remove: 'إزالة',
  OpenFailed: 'تعذّر فتح الملف',

  RemoveDocumentTitle: 'حذف المستند؟',
  RemoveDocumentBody: 'سيُحذف {name} نهائياً، ولن يصل العميل إلى الرابط بعدها.',
  RemoveDocumentFailed: 'تعذّر حذف المستند',
  RemoveImageTitle: 'إزالة صورة المركبة؟',
  RemoveImageBody:
    'ستُزال صورة {plate}، وستعود المركبة إلى إظهار شكل فئتها الظلّي.',
  RemoveImageFailed: 'تعذّرت إزالة الصورة',

  EmptyDocuments: 'لم يُعثر على مستندات',
  EmptyDocumentsHint: 'غيّر النوع أو الشهر أو البحث',
  EmptyVehicles: 'لا توجد صورة لأي مركبة',
  EmptyVehiclesHint: 'ارفع صورة مركبة في الأسطول لتظهر هنا',
  Unavailable: 'هذا الخادم لا يعرف القائمة بعد',
  LoadFailed: 'تعذّر تحميل القائمة',

  AdminsOnly: 'هذه الصفحة مخصصة للإدارة.'
}

export function getI18nMediaSources(code: I18nCode): {
  code: I18nCode
  strings: MediaSourcesStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

export {fill} from './i18nCommon'
