import type { I18nCode } from '../i18n'

export function getI18nCommon(code: I18nCode) {
  if (code === 'en-US') {
    return {
      code,
      strings: {
        Refresh: 'Refresh',
        Search: 'Search...',
        Details: 'Details',
        Cancel: 'Cancel',
        Save: 'Save',
        Edit: 'Edit',
        Loading: 'Loading...',
        NoDataFound: 'No data found',
        Previous: 'Previous',
        Next: 'Next',
        PaginationOf: 'of {totalPages} ({totalCount} total)',

        StatusCompleted: 'Completed',
        StatusPlanned: 'Planned',
        StatusCancelled: 'Cancelled',
        StatusInProgress: 'In Progress',
        StatusLabel: 'Status',

        ColumnsLabel: 'Columns',
        ColumnsCustomize: 'Customize Columns',
        ColumnsReset: 'Reset',
        ColumnsDragHint: 'Drag to reorder, toggle visibility',

        SortEarliest: 'Pickup: Earliest first',
        SortLatest: 'Pickup: Latest first',

        DateToday: 'Today',
        DateTomorrow: 'Tomorrow',
        DateAll: 'All',
        DateCustom: 'Custom',

        WeekdaySu: 'Su',
        WeekdayMo: 'Mo',
        WeekdayTu: 'Tu',
        WeekdayWe: 'We',
        WeekdayTh: 'Th',
        WeekdayFr: 'Fr',
        WeekdaySa: 'Sa',
      },
    }
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
        Refresh: 'Yenile',
        Search: 'Ara...',
        Details: 'Detaylar',
        Cancel: 'İptal',
        Save: 'Kaydet',
        Edit: 'Düzenle',
        Loading: 'Yükleniyor...',
        NoDataFound: 'Veri bulunamadı',
        Previous: 'Önceki',
        Next: 'Sonraki',
        PaginationOf: '{totalPages} sayfa ({totalCount} toplam)',

        StatusCompleted: 'Tamamlandı',
        StatusPlanned: 'Planlandı',
        StatusCancelled: 'İptal edildi',
        StatusInProgress: 'Devam ediyor',
        StatusLabel: 'Durum',

        ColumnsLabel: 'Sütunlar',
        ColumnsCustomize: 'Sütunları özelleştir',
        ColumnsReset: 'Sıfırla',
        ColumnsDragHint: 'Sıralamak için sürükle, görünürlüğü değiştir',

        SortEarliest: 'Alış: En erken önce',
        SortLatest: 'Alış: En geç önce',

        DateToday: 'Bugün',
        DateTomorrow: 'Yarın',
        DateAll: 'Tümü',
        DateCustom: 'Özel',

        WeekdaySu: 'Pz',
        WeekdayMo: 'Pt',
        WeekdayTu: 'Sa',
        WeekdayWe: 'Ça',
        WeekdayTh: 'Pe',
        WeekdayFr: 'Cu',
        WeekdaySa: 'Ct',
      },
    }
  }

  if (code === 'ar-EG') {
    return {
      code,
      strings: {
        Refresh: 'تحديث',
        Search: 'بحث...',
        Details: 'التفاصيل',
        Cancel: 'إلغاء',
        Save: 'حفظ',
        Edit: 'تعديل',
        Loading: 'جاري التحميل...',
        NoDataFound: 'لا توجد بيانات',
        Previous: 'السابق',
        Next: 'التالي',
        PaginationOf: 'من {totalPages} ({totalCount} إجمالي)',

        StatusCompleted: 'مكتمل',
        StatusPlanned: 'مخطط',
        StatusCancelled: 'ملغى',
        StatusInProgress: 'قيد التنفيذ',
        StatusLabel: 'الحالة',

        ColumnsLabel: 'الأعمدة',
        ColumnsCustomize: 'تخصيص الأعمدة',
        ColumnsReset: 'إعادة تعيين',
        ColumnsDragHint: 'اسحب لإعادة الترتيب، بدّل الرؤية',

        SortEarliest: 'الاستلام: الأقدم أولاً',
        SortLatest: 'الاستلام: الأحدث أولاً',

        DateToday: 'اليوم',
        DateTomorrow: 'غداً',
        DateAll: 'الكل',
        DateCustom: 'مخصص',

        WeekdaySu: 'أحد',
        WeekdayMo: 'إثن',
        WeekdayTu: 'ثلا',
        WeekdayWe: 'أرب',
        WeekdayTh: 'خمي',
        WeekdayFr: 'جمع',
        WeekdaySa: 'سبت',
      },
    }
  }

  // de-AT (default)
  return {
    code,
    strings: {
      Refresh: 'Aktualisieren',
      Search: 'Suchen...',
      Details: 'Details',
      Cancel: 'Abbrechen',
      Save: 'Speichern',
      Edit: 'Bearbeiten',
      Loading: 'Laden...',
      NoDataFound: 'Keine Daten gefunden',
      Previous: 'Zurück',
      Next: 'Weiter',
      PaginationOf: 'von {totalPages} ({totalCount} gesamt)',

      StatusCompleted: 'Abgeschlossen',
      StatusPlanned: 'Geplant',
      StatusCancelled: 'Storniert',
      StatusInProgress: 'In Bearbeitung',
      StatusLabel: 'Status',

      ColumnsLabel: 'Spalten',
      ColumnsCustomize: 'Spalten anpassen',
      ColumnsReset: 'Zurücksetzen',
      ColumnsDragHint: 'Zum Umsortieren ziehen, Sichtbarkeit umschalten',

      SortEarliest: 'Abholung: Früheste zuerst',
      SortLatest: 'Abholung: Späteste zuerst',

      DateToday: 'Heute',
      DateTomorrow: 'Morgen',
      DateAll: 'Alle',
      DateCustom: 'Benutzerdefiniert',

      WeekdaySu: 'So',
      WeekdayMo: 'Mo',
      WeekdayTu: 'Di',
      WeekdayWe: 'Mi',
      WeekdayTh: 'Do',
      WeekdayFr: 'Fr',
      WeekdaySa: 'Sa',
    },
  }
}
