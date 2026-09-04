import type { I18nCode } from '../i18n'

export function getI18nDashboard(code: I18nCode) {
  if (code === 'en-US') {
    return {
      code,
      strings: {
        Heading: 'Dashboard',
        Subtitle: 'Manage your journeys and operations',
        AlertNotAssigned: '{count} journeys for today are not assigned yet!',
        AlertNotAssignedBody: 'There are {count} journeys without a driver or vehicle assigned, out of {total} scheduled for today.',
        AlertActionNeeded: 'Action needed: Please assign a driver and vehicle.',
        UpcomingTransfers: 'Upcoming transfers',
        UpcomingTransfersBody: '{today} transfers today, {tomorrow} transfers tomorrow',
        StatTotalTransfers: 'Total Transfers',
        StatInProgress: 'In Progress',
        StatCompleted: 'Completed',
        StatPlanned: 'Planned',
        TodayHeading: "Today's Transfers ({count})",
        ViewAll: 'View all',
        NoTransfersToday: 'No transfers scheduled for today',
        Unassigned: 'Unassigned',
      },
    }
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
        Heading: 'Panel',
        Subtitle: 'Yolculukları ve operasyonları yönetin',
        AlertNotAssigned: 'Bugün için {count} yolculuk henüz atanmadı!',
        AlertNotAssignedBody: 'Bugün planlanan {total} yolculuktan {count} tanesine şoför veya araç atanmamış.',
        AlertActionNeeded: 'İşlem gerekli: Lütfen bir şoför ve araç atayın.',
        UpcomingTransfers: 'Yaklaşan transferler',
        UpcomingTransfersBody: 'Bugün {today} transfer, yarın {tomorrow} transfer',
        StatTotalTransfers: 'Toplam Transfer',
        StatInProgress: 'Devam ediyor',
        StatCompleted: 'Tamamlandı',
        StatPlanned: 'Planlandı',
        TodayHeading: 'Bugünkü Transferler ({count})',
        ViewAll: 'Tümünü gör',
        NoTransfersToday: 'Bugün için planlanmış transfer yok',
        Unassigned: 'Atanmamış',
      },
    }
  }

  if (code === 'ar-EG') {
    return {
      code,
      strings: {
        Heading: 'لوحة التحكم',
        Subtitle: 'إدارة الرحلات والعمليات',
        AlertNotAssigned: '{count} رحلات لم يتم تعيينها اليوم بعد!',
        AlertNotAssignedBody: 'هناك {count} رحلة بدون سائق أو مركبة من أصل {total} مجدولة اليوم.',
        AlertActionNeeded: 'مطلوب إجراء: يرجى تعيين سائق ومركبة.',
        UpcomingTransfers: 'التحويلات القادمة',
        UpcomingTransfersBody: '{today} تحويلات اليوم، {tomorrow} تحويلات غداً',
        StatTotalTransfers: 'إجمالي التحويلات',
        StatInProgress: 'قيد التنفيذ',
        StatCompleted: 'مكتمل',
        StatPlanned: 'مخطط',
        TodayHeading: 'تحويلات اليوم ({count})',
        ViewAll: 'عرض الكل',
        NoTransfersToday: 'لا توجد تحويلات مجدولة اليوم',
        Unassigned: 'غير معيّن',
      },
    }
  }

  // de-AT (default)
  return {
    code,
    strings: {
      Heading: 'Dashboard',
      Subtitle: 'Fahrten und Betrieb verwalten',
      AlertNotAssigned: '{count} Fahrten für heute sind noch nicht zugewiesen!',
      AlertNotAssignedBody: 'Es gibt {count} Fahrten ohne zugewiesenen Fahrer oder Fahrzeug, von {total} für heute geplanten.',
      AlertActionNeeded: 'Handlung erforderlich: Bitte weisen Sie einen Fahrer und ein Fahrzeug zu.',
      UpcomingTransfers: 'Anstehende Transfers',
      UpcomingTransfersBody: '{today} Transfers heute, {tomorrow} Transfers morgen',
      StatTotalTransfers: 'Transfers gesamt',
      StatInProgress: 'In Bearbeitung',
      StatCompleted: 'Abgeschlossen',
      StatPlanned: 'Geplant',
      TodayHeading: 'Heutige Transfers ({count})',
      ViewAll: 'Alle anzeigen',
      NoTransfersToday: 'Keine Transfers für heute geplant',
      Unassigned: 'Nicht zugewiesen',
    },
  }
}
