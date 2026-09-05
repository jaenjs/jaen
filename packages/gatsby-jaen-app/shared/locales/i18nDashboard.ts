import type { I18nCode } from '../i18n'

/**
 * The dispatcher's dashboard, in the four languages of the app.
 *
 * German is the product language and the source of the other three. Every key
 * exists in every catalogue, so a missing translation is a type error rather
 * than an English word on a Turkish screen.
 */
export function getI18nDashboard(code: I18nCode) {
  if (code === 'en-US') {
    return {
      code,
      strings: {
        Heading: 'Dashboard',
        Subtitle: 'Today, tomorrow and the month at a glance',

        AlertNotAssigned: '{count} rides today have no driver',
        AlertNotAssignedBody: 'Assign a driver so the ride goes out.',
        AlertRejected: '{count} rides today were rejected',
        AlertRejectedBody: 'The driver said no. Somebody else has to take it.',

        SectionToday: 'Today',
        SectionTomorrow: 'Tomorrow',
        SectionMonth: 'This month',
        SectionDrivers: 'Per driver',

        KpiRidesToday: 'Rides today',
        KpiUnassigned: 'No driver',
        KpiOnTheRoad: 'On the road',
        KpiWaiting: 'Waiting for an answer',
        KpiRejected: 'Rejected',
        KpiRidesTomorrow: 'Rides tomorrow',
        KpiTomorrowUnassigned: 'Tomorrow, no driver',

        KpiRevenue: 'Revenue',
        KpiCompleted: 'Completed rides',
        KpiAverageFare: 'Average fare',
        KpiCash: 'Cash taken',
        KpiPayoutDue: 'Driver payout due',
        KpiCancellationRate: 'Cancellation rate',
        KpiSiteBookings: 'Bookings from the website',

        ColDriver: 'Driver',
        ColCompleted: 'Rides',
        ColRevenue: 'Revenue',
        ColCash: 'Cash',
        ColPayout: 'Payout',
        NoDrivers: 'No drivers with rides this month',

        PrevMonth: 'Previous month',
        NextMonth: 'Next month',

        TodayList: "Today's rides ({count})",
        TomorrowList: "Tomorrow's rides ({count})",
        ViewAll: 'View all',
        NoTransfersToday: 'No rides scheduled for today',
        NoTransfersTomorrow: 'No rides scheduled for tomorrow',
        Unassigned: 'Unassigned',
        NumbersUnavailable: 'The numbers could not be loaded',
      },
    }
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
        Heading: 'Panel',
        Subtitle: 'Bugün, yarın ve bu ay bir bakışta',

        AlertNotAssigned: 'Bugün {count} yolculuğun şoförü yok',
        AlertNotAssignedBody: 'Yolculuğun çıkabilmesi için bir şoför atayın.',
        AlertRejected: 'Bugün {count} yolculuk reddedildi',
        AlertRejectedBody: 'Şoför hayır dedi. Başka biri almalı.',

        SectionToday: 'Bugün',
        SectionTomorrow: 'Yarın',
        SectionMonth: 'Bu ay',
        SectionDrivers: 'Şoför başına',

        KpiRidesToday: 'Bugünkü yolculuklar',
        KpiUnassigned: 'Şoförsüz',
        KpiOnTheRoad: 'Yolda',
        KpiWaiting: 'Yanıt bekliyor',
        KpiRejected: 'Reddedildi',
        KpiRidesTomorrow: 'Yarınki yolculuklar',
        KpiTomorrowUnassigned: 'Yarın şoförsüz',

        KpiRevenue: 'Ciro',
        KpiCompleted: 'Tamamlanan yolculuklar',
        KpiAverageFare: 'Ortalama ücret',
        KpiCash: 'Nakit tahsilat',
        KpiPayoutDue: 'Ödenecek şoför payı',
        KpiCancellationRate: 'İptal oranı',
        KpiSiteBookings: 'Web sitesinden rezervasyonlar',

        ColDriver: 'Şoför',
        ColCompleted: 'Yolculuk',
        ColRevenue: 'Ciro',
        ColCash: 'Nakit',
        ColPayout: 'Ödeme',
        NoDrivers: 'Bu ay yolculuğu olan şoför yok',

        PrevMonth: 'Önceki ay',
        NextMonth: 'Sonraki ay',

        TodayList: 'Bugünkü yolculuklar ({count})',
        TomorrowList: 'Yarınki yolculuklar ({count})',
        ViewAll: 'Tümünü gör',
        NoTransfersToday: 'Bugün için planlanmış yolculuk yok',
        NoTransfersTomorrow: 'Yarın için planlanmış yolculuk yok',
        Unassigned: 'Atanmamış',
        NumbersUnavailable: 'Sayılar yüklenemedi',
      },
    }
  }

  if (code === 'ar-EG') {
    return {
      code,
      strings: {
        Heading: 'لوحة التحكم',
        Subtitle: 'اليوم وغدًا والشهر في نظرة واحدة',

        AlertNotAssigned: '{count} رحلات اليوم بدون سائق',
        AlertNotAssignedBody: 'عيّن سائقًا حتى تنطلق الرحلة.',
        AlertRejected: '{count} رحلات اليوم تم رفضها',
        AlertRejectedBody: 'السائق رفض. يجب أن يأخذها شخص آخر.',

        SectionToday: 'اليوم',
        SectionTomorrow: 'غدًا',
        SectionMonth: 'هذا الشهر',
        SectionDrivers: 'لكل سائق',

        KpiRidesToday: 'رحلات اليوم',
        KpiUnassigned: 'بدون سائق',
        KpiOnTheRoad: 'على الطريق',
        KpiWaiting: 'في انتظار الرد',
        KpiRejected: 'مرفوضة',
        KpiRidesTomorrow: 'رحلات الغد',
        KpiTomorrowUnassigned: 'غدًا بدون سائق',

        KpiRevenue: 'الإيرادات',
        KpiCompleted: 'الرحلات المكتملة',
        KpiAverageFare: 'متوسط الأجرة',
        KpiCash: 'المحصّل نقدًا',
        KpiPayoutDue: 'مستحقات السائقين',
        KpiCancellationRate: 'نسبة الإلغاء',
        KpiSiteBookings: 'حجوزات من الموقع',

        ColDriver: 'السائق',
        ColCompleted: 'رحلات',
        ColRevenue: 'الإيرادات',
        ColCash: 'نقدًا',
        ColPayout: 'المستحق',
        NoDrivers: 'لا يوجد سائقون برحلات هذا الشهر',

        PrevMonth: 'الشهر السابق',
        NextMonth: 'الشهر التالي',

        TodayList: 'رحلات اليوم ({count})',
        TomorrowList: 'رحلات الغد ({count})',
        ViewAll: 'عرض الكل',
        NoTransfersToday: 'لا توجد رحلات مجدولة اليوم',
        NoTransfersTomorrow: 'لا توجد رحلات مجدولة غدًا',
        Unassigned: 'غير معيّن',
        NumbersUnavailable: 'تعذّر تحميل الأرقام',
      },
    }
  }

  // de-AT (default)
  return {
    code,
    strings: {
      Heading: 'Dashboard',
      Subtitle: 'Heute, morgen und der Monat auf einen Blick',

      AlertNotAssigned: '{count} Fahrten heute ohne Fahrer',
      AlertNotAssignedBody: 'Bitte einen Fahrer zuweisen, damit die Fahrt rausgeht.',
      AlertRejected: '{count} Fahrten heute abgelehnt',
      AlertRejectedBody: 'Der Fahrer hat abgelehnt. Jemand anderer muss die Fahrt übernehmen.',

      SectionToday: 'Heute',
      SectionTomorrow: 'Morgen',
      SectionMonth: 'Dieser Monat',
      SectionDrivers: 'Pro Fahrer',

      KpiRidesToday: 'Fahrten heute',
      KpiUnassigned: 'Ohne Fahrer',
      KpiOnTheRoad: 'Unterwegs',
      KpiWaiting: 'Wartet auf Antwort',
      KpiRejected: 'Abgelehnt',
      KpiRidesTomorrow: 'Fahrten morgen',
      KpiTomorrowUnassigned: 'Morgen ohne Fahrer',

      KpiRevenue: 'Umsatz',
      KpiCompleted: 'Abgeschlossene Fahrten',
      KpiAverageFare: 'Durchschnittlicher Fahrpreis',
      KpiCash: 'Bar kassiert',
      KpiPayoutDue: 'Fällige Auszahlung',
      KpiCancellationRate: 'Stornoquote',
      KpiSiteBookings: 'Buchungen über die Website',

      ColDriver: 'Fahrer',
      ColCompleted: 'Fahrten',
      ColRevenue: 'Umsatz',
      ColCash: 'Bar',
      ColPayout: 'Auszahlung',
      NoDrivers: 'Keine Fahrer mit Fahrten in diesem Monat',

      PrevMonth: 'Vormonat',
      NextMonth: 'Nächster Monat',

      TodayList: 'Fahrten heute ({count})',
      TomorrowList: 'Fahrten morgen ({count})',
      ViewAll: 'Alle anzeigen',
      NoTransfersToday: 'Keine Fahrten für heute geplant',
      NoTransfersTomorrow: 'Keine Fahrten für morgen geplant',
      Unassigned: 'Nicht zugewiesen',
      NumbersUnavailable: 'Die Zahlen konnten nicht geladen werden',
    },
  }
}
