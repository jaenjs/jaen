/**
 * The words on the fleet screen. German is the product language and the
 * other three follow it. The class labels are keyed on the Prisma enum
 * CarClass so a class the backend knows always has a word.
 */
import type {I18nCode} from '../i18n'

const de = {
  Heading: 'Flotte',
  Subtitle: 'Fahrzeuge und wer sie fährt',
  EmptyMessage: 'Noch kein Fahrzeug angelegt',
  StatTotal: 'Fahrzeuge',
  StatAssigned: 'Zugewiesen',
  StatUnassigned: 'Ohne Fahrer',

  CreateCar: 'Fahrzeug anlegen',
  CreateCarTitle: 'Neues Fahrzeug',
  EditCarTitle: 'Fahrzeug bearbeiten',
  ColPlate: 'Kennzeichen',
  ColName: 'Bezeichnung',
  ColClass: 'Klasse',
  ColColor: 'Farbe',
  ColDriver: 'Fahrer',
  CountLabel: '{count} Fahrzeuge',
  NoDriver: 'Kein Fahrer',

  FieldPlate: 'Kennzeichen',
  FieldName: 'Bezeichnung',
  FieldNamePlaceholder: 'z. B. Mercedes E-Klasse',
  FieldClass: 'Klasse',
  FieldColor: 'Farbe',
  FieldDriver: 'Fahrer',
  ClassNone: 'Keine Klasse',
  Class_BUSINESS_CLASS: 'Business Class',
  Class_ELECTRIC_CLASS: 'Electric Class',
  Class_FIRST_CLASS: 'First Class',
  Class_BUSINESS_VAN: 'Business Van',
  ValidationPlate: 'Kennzeichen ist ein Pflichtfeld',

  CarCreated: 'Fahrzeug angelegt',
  CarUpdated: 'Fahrzeug gespeichert',
  CarSaveFailed: 'Fahrzeug konnte nicht gespeichert werden',
  DriverAssigned: 'Fahrer zugewiesen',
  DriverUnassigned: 'Fahrer entfernt',
  AssignFailed: 'Zuweisung fehlgeschlagen',
  AssignDriver: 'Fahrer zuweisen',
  Unassign: 'Fahrer entfernen'
}

export type FleetStrings = typeof de

const en: FleetStrings = {
  Heading: 'Fleet',
  Subtitle: 'The cars and who drives them',
  EmptyMessage: 'No car yet',
  StatTotal: 'Cars',
  StatAssigned: 'Assigned',
  StatUnassigned: 'Without a driver',

  CreateCar: 'Add car',
  CreateCarTitle: 'New car',
  EditCarTitle: 'Edit car',
  ColPlate: 'Plate',
  ColName: 'Name',
  ColClass: 'Class',
  ColColor: 'Colour',
  ColDriver: 'Driver',
  CountLabel: '{count} vehicles',
  NoDriver: 'No driver',

  FieldPlate: 'Licence plate',
  FieldName: 'Name',
  FieldNamePlaceholder: 'e.g. Mercedes E-Class',
  FieldClass: 'Class',
  FieldColor: 'Colour',
  FieldDriver: 'Driver',
  ClassNone: 'No class',
  Class_BUSINESS_CLASS: 'Business Class',
  Class_ELECTRIC_CLASS: 'Electric Class',
  Class_FIRST_CLASS: 'First Class',
  Class_BUSINESS_VAN: 'Business Van',
  ValidationPlate: 'The plate is required',

  CarCreated: 'Car added',
  CarUpdated: 'Car saved',
  CarSaveFailed: 'The car could not be saved',
  DriverAssigned: 'Driver assigned',
  DriverUnassigned: 'Driver removed',
  AssignFailed: 'Assignment failed',
  AssignDriver: 'Assign driver',
  Unassign: 'Remove driver'
}

const tr: FleetStrings = {
  Heading: 'Filo',
  Subtitle: 'Araçlar ve onları kim sürüyor',
  EmptyMessage: 'Henüz araç yok',
  StatTotal: 'Araçlar',
  StatAssigned: 'Atanmış',
  StatUnassigned: 'Şoförsüz',

  CreateCar: 'Araç ekle',
  CreateCarTitle: 'Yeni araç',
  EditCarTitle: 'Aracı düzenle',
  ColPlate: 'Plaka',
  ColName: 'Ad',
  ColClass: 'Sınıf',
  ColColor: 'Renk',
  ColDriver: 'Şoför',
  CountLabel: '{count} araç',
  NoDriver: 'Şoför yok',

  FieldPlate: 'Plaka',
  FieldName: 'Ad',
  FieldNamePlaceholder: 'örn. Mercedes E-Serisi',
  FieldClass: 'Sınıf',
  FieldColor: 'Renk',
  FieldDriver: 'Şoför',
  ClassNone: 'Sınıf yok',
  Class_BUSINESS_CLASS: 'Business Class',
  Class_ELECTRIC_CLASS: 'Electric Class',
  Class_FIRST_CLASS: 'First Class',
  Class_BUSINESS_VAN: 'Business Van',
  ValidationPlate: 'Plaka zorunludur',

  CarCreated: 'Araç eklendi',
  CarUpdated: 'Araç kaydedildi',
  CarSaveFailed: 'Araç kaydedilemedi',
  DriverAssigned: 'Şoför atandı',
  DriverUnassigned: 'Şoför kaldırıldı',
  AssignFailed: 'Atama başarısız',
  AssignDriver: 'Şoför ata',
  Unassign: 'Şoförü kaldır'
}

const ar: FleetStrings = {
  Heading: 'الأسطول',
  Subtitle: 'السيارات ومن يقودها',
  EmptyMessage: 'لا توجد سيارات بعد',
  StatTotal: 'السيارات',
  StatAssigned: 'مُسندة',
  StatUnassigned: 'بدون سائق',

  CreateCar: 'إضافة سيارة',
  CreateCarTitle: 'سيارة جديدة',
  EditCarTitle: 'تعديل السيارة',
  ColPlate: 'اللوحة',
  ColName: 'الاسم',
  ColClass: 'الفئة',
  ColColor: 'اللون',
  ColDriver: 'السائق',
  CountLabel: '{count} مركبات',
  NoDriver: 'بدون سائق',

  FieldPlate: 'رقم اللوحة',
  FieldName: 'الاسم',
  FieldNamePlaceholder: 'مثال: مرسيدس الفئة E',
  FieldClass: 'الفئة',
  FieldColor: 'اللون',
  FieldDriver: 'السائق',
  ClassNone: 'بدون فئة',
  Class_BUSINESS_CLASS: 'Business Class',
  Class_ELECTRIC_CLASS: 'Electric Class',
  Class_FIRST_CLASS: 'First Class',
  Class_BUSINESS_VAN: 'Business Van',
  ValidationPlate: 'رقم اللوحة إلزامي',

  CarCreated: 'تمت إضافة السيارة',
  CarUpdated: 'تم حفظ السيارة',
  CarSaveFailed: 'تعذّر حفظ السيارة',
  DriverAssigned: 'تم إسناد السائق',
  DriverUnassigned: 'تمت إزالة السائق',
  AssignFailed: 'فشل الإسناد',
  AssignDriver: 'إسناد سائق',
  Unassign: 'إزالة السائق'
}

export function getI18nFleet(code: I18nCode): {
  code: I18nCode
  strings: FleetStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}
