/**
 * Every word of the tracking pieces: the "where is the driver" card on a
 * booking and on a transfer, the small map under it, and the dispatcher's
 * map of everybody. The driver's own sharing switch has its words in
 * i18nMe, because it sits on the Me page.
 *
 * German is the product language and the other three are typed against it,
 * so a key added to `de` and forgotten in `ar` fails the typecheck rather
 * than showing a key on a screen.
 */
import type {I18nCode} from '../i18n'

const de = {
  // The card
  CardTitleCustomer: 'Ihr Fahrer',
  CardTitleAdmin: 'Wo der Fahrer ist',
  NotAssignedYet: 'Fahrer wird noch zugeteilt',
  NotAssignedYetHint:
    'Sobald die Zentrale einen Fahrer eingeteilt hat, sehen Sie ihn hier.',
  DriverLabel: 'Fahrer',
  CarLabel: 'Fahrzeug',
  PlateLabel: 'Kennzeichen',
  CarClassLabel: 'Klasse',
  CarColorLabel: 'Farbe',
  NoCarYet: 'Fahrzeug folgt',

  // The position line under the map
  PositionAge: 'Position vor {age}',
  AgeSeconds: '{n} s',
  AgeMinutes: '{n} min',
  AgeHours: '{n} h',
  NoPositionYet: 'Noch keine Position vom Fahrer',
  NoPositionHint: 'Der Fahrer teilt seinen Standort, sobald er unterwegs ist.',
  RideOver: 'Die Fahrt ist abgeschlossen, die Karte wird nicht mehr gezeigt.',
  TrackingUnavailable: 'Die Position ist im Moment nicht abrufbar',
  Updating: 'Wird aktualisiert',
  Pickup: 'Abholung',

  // Every map
  MapNoToken:
    'Karte nicht verfügbar: kein Mapbox-Token konfiguriert (GATSBY_MAPBOX_TOKEN).',
  MapLoadFailed: 'Die Karte konnte nicht geladen werden',
  MapLoading: 'Karte wird geladen',
  MapRejected: 'Mapbox hat den Token abgelehnt, die Karte bleibt leer.',
  GeocodeFailed: 'Die Abholadresse konnte nicht auf der Karte gefunden werden',

  // The dispatcher's map
  FilterAll: 'Alle',
  FilterDrivers: 'Fahrer',
  FilterCustomers: 'Kunden',
  KindDriver: 'Fahrer',
  KindCustomer: 'Kunde',
  Refresh: 'Aktualisieren',
  CountOne: '1 Standort',
  CountMany: '{count} Standorte',
  Latitude: 'Breitengrad',
  Longitude: 'Längengrad',
  Accuracy: 'Genauigkeit',
  UpdatedAt: 'Aktualisiert',
  RecordedAt: 'Aufgezeichnet',
  PlanRoute: 'Route planen',
  Close: 'Schließen',

  // The customer's map: the drivers of their own live rides
  CustomerSubtitle: 'Die Fahrer Ihrer laufenden Fahrten',
  NoRideUnderway: 'Keine Fahrt unterwegs',
  NoRideUnderwayHint:
    'Sobald ein Fahrer zu einer Ihrer Fahrten unterwegs ist, sehen Sie ihn hier.',
  UnderwayFrom: 'unterwegs ab {time}',
  AcceptedRides: 'Bestätigte Fahrten',
  LiveRidesOne: '1 Fahrt unterwegs',
  LiveRidesMany: '{count} Fahrten unterwegs'
}

export type TrackingStrings = typeof de

const en: TrackingStrings = {
  CardTitleCustomer: 'Your driver',
  CardTitleAdmin: 'Where the driver is',
  NotAssignedYet: 'A driver is being assigned',
  NotAssignedYetHint:
    'As soon as the office has assigned a driver, you will see them here.',
  DriverLabel: 'Driver',
  CarLabel: 'Vehicle',
  PlateLabel: 'Plate',
  CarClassLabel: 'Class',
  CarColorLabel: 'Colour',
  NoCarYet: 'Vehicle to follow',

  PositionAge: 'Position {age} ago',
  AgeSeconds: '{n} s',
  AgeMinutes: '{n} min',
  AgeHours: '{n} h',
  NoPositionYet: 'No position from the driver yet',
  NoPositionHint: 'The driver shares their position once they are on the way.',
  RideOver: 'The ride is over, the map is no longer shown.',
  TrackingUnavailable: 'The position cannot be read right now',
  Updating: 'Updating',
  Pickup: 'Pickup',

  MapNoToken:
    'Map unavailable: no Mapbox token configured (GATSBY_MAPBOX_TOKEN).',
  MapLoadFailed: 'The map could not be loaded',
  MapLoading: 'Loading map',
  MapRejected: 'Mapbox rejected the token, the map stays empty.',
  GeocodeFailed: 'The pickup address could not be found on the map',

  FilterAll: 'All',
  FilterDrivers: 'Drivers',
  FilterCustomers: 'Customers',
  KindDriver: 'Driver',
  KindCustomer: 'Customer',
  Refresh: 'Refresh',
  CountOne: '1 location',
  CountMany: '{count} locations',
  Latitude: 'Latitude',
  Longitude: 'Longitude',
  Accuracy: 'Accuracy',
  UpdatedAt: 'Updated',
  RecordedAt: 'Recorded',
  PlanRoute: 'Plan route',
  Close: 'Close',

  CustomerSubtitle: 'The drivers of your rides under way',
  NoRideUnderway: 'No ride under way',
  NoRideUnderwayHint:
    'As soon as a driver is on the way to one of your rides, you will see them here.',
  UnderwayFrom: 'under way from {time}',
  AcceptedRides: 'Confirmed rides',
  LiveRidesOne: '1 ride under way',
  LiveRidesMany: '{count} rides under way'
}

const tr: TrackingStrings = {
  CardTitleCustomer: 'Şoförünüz',
  CardTitleAdmin: 'Şoför nerede',
  NotAssignedYet: 'Şoför atanıyor',
  NotAssignedYetHint: 'Ofis bir şoför atar atmaz onu burada göreceksiniz.',
  DriverLabel: 'Şoför',
  CarLabel: 'Araç',
  PlateLabel: 'Plaka',
  CarClassLabel: 'Sınıf',
  CarColorLabel: 'Renk',
  NoCarYet: 'Araç belirlenecek',

  PositionAge: 'Konum {age} önce',
  AgeSeconds: '{n} sn',
  AgeMinutes: '{n} dk',
  AgeHours: '{n} sa',
  NoPositionYet: 'Şoförden henüz konum yok',
  NoPositionHint: 'Şoför yola çıktığında konumunu paylaşır.',
  RideOver: 'Yolculuk tamamlandı, harita artık gösterilmiyor.',
  TrackingUnavailable: 'Konum şu anda okunamıyor',
  Updating: 'Güncelleniyor',
  Pickup: 'Alış',

  MapNoToken:
    'Harita kullanılamıyor: Mapbox anahtarı yapılandırılmamış (GATSBY_MAPBOX_TOKEN).',
  MapLoadFailed: 'Harita yüklenemedi',
  MapLoading: 'Harita yükleniyor',
  MapRejected: 'Mapbox anahtarı reddetti, harita boş kalıyor.',
  GeocodeFailed: 'Alış adresi haritada bulunamadı',

  FilterAll: 'Tümü',
  FilterDrivers: 'Şoförler',
  FilterCustomers: 'Müşteriler',
  KindDriver: 'Şoför',
  KindCustomer: 'Müşteri',
  Refresh: 'Yenile',
  CountOne: '1 konum',
  CountMany: '{count} konum',
  Latitude: 'Enlem',
  Longitude: 'Boylam',
  Accuracy: 'Doğruluk',
  UpdatedAt: 'Güncellendi',
  RecordedAt: 'Kaydedildi',
  PlanRoute: 'Rota planla',
  Close: 'Kapat',

  CustomerSubtitle: 'Yoldaki yolculuklarınızın şoförleri',
  NoRideUnderway: 'Yolda yolculuk yok',
  NoRideUnderwayHint:
    'Bir şoför yolculuklarınızdan birine doğru yola çıkar çıkmaz onu burada göreceksiniz.',
  UnderwayFrom: '{time} itibarıyla yolda',
  AcceptedRides: 'Onaylanmış yolculuklar',
  LiveRidesOne: '1 yolculuk yolda',
  LiveRidesMany: '{count} yolculuk yolda'
}

const ar: TrackingStrings = {
  CardTitleCustomer: 'سائقك',
  CardTitleAdmin: 'أين السائق',
  NotAssignedYet: 'يجري تعيين سائق',
  NotAssignedYetHint: 'بمجرد أن يعيّن المكتب سائقًا ستراه هنا.',
  DriverLabel: 'السائق',
  CarLabel: 'المركبة',
  PlateLabel: 'اللوحة',
  CarClassLabel: 'الفئة',
  CarColorLabel: 'اللون',
  NoCarYet: 'المركبة لاحقًا',

  PositionAge: 'الموقع قبل {age}',
  AgeSeconds: '{n} ث',
  AgeMinutes: '{n} د',
  AgeHours: '{n} س',
  NoPositionYet: 'لا يوجد موقع من السائق بعد',
  NoPositionHint: 'يشارك السائق موقعه فور انطلاقه.',
  RideOver: 'انتهت الرحلة ولم تعد الخريطة تُعرض.',
  TrackingUnavailable: 'تعذّر قراءة الموقع الآن',
  Updating: 'جارٍ التحديث',
  Pickup: 'الاستلام',

  MapNoToken: 'الخريطة غير متاحة: لم يُضبط رمز Mapbox ‏(GATSBY_MAPBOX_TOKEN).',
  MapLoadFailed: 'تعذّر تحميل الخريطة',
  MapLoading: 'جارٍ تحميل الخريطة',
  MapRejected: 'رفض Mapbox الرمز، وتبقى الخريطة فارغة.',
  GeocodeFailed: 'تعذّر العثور على عنوان الاستلام على الخريطة',

  FilterAll: 'الكل',
  FilterDrivers: 'السائقون',
  FilterCustomers: 'العملاء',
  KindDriver: 'سائق',
  KindCustomer: 'عميل',
  Refresh: 'تحديث',
  CountOne: 'موقع واحد',
  CountMany: '{count} مواقع',
  Latitude: 'خط العرض',
  Longitude: 'خط الطول',
  Accuracy: 'الدقة',
  UpdatedAt: 'آخر تحديث',
  RecordedAt: 'وقت التسجيل',
  PlanRoute: 'تخطيط المسار',
  Close: 'إغلاق',

  CustomerSubtitle: 'سائقو رحلاتك الجارية',
  NoRideUnderway: 'لا توجد رحلة جارية',
  NoRideUnderwayHint: 'بمجرد أن ينطلق سائق نحو إحدى رحلاتك ستراه هنا.',
  UnderwayFrom: 'في الطريق اعتبارًا من {time}',
  AcceptedRides: 'الرحلات المؤكدة',
  LiveRidesOne: 'رحلة واحدة جارية',
  LiveRidesMany: '{count} رحلات جارية'
}

export function getI18nTracking(code: I18nCode): {
  code: I18nCode
  strings: TrackingStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

/** `{name}` style placeholders, filled in. */
export const fillTracking = (
  template: string,
  values: Record<string, string | number>
): string =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
    template
  )

/**
 * "vor 20 s", "vor 3 min", "vor 2 h": how old a position is, in the
 * account's language. Seconds up to a minute, minutes up to an hour.
 */
export const formatAge = (t: TrackingStrings, ageMs: number): string => {
  const s = Math.max(0, Math.round(ageMs / 1000))
  if (s < 60) return fillTracking(t.AgeSeconds, {n: s})
  const m = Math.round(s / 60)
  if (m < 60) return fillTracking(t.AgeMinutes, {n: m})
  return fillTracking(t.AgeHours, {n: Math.round(m / 60)})
}
