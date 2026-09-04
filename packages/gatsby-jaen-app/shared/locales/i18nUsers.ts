import type { I18nCode } from '../i18n'

export function getI18nUsers(code: I18nCode) {
  if (code === 'en-US') {
    return {
      code,
      strings: {
        Heading: 'Users',
        Subtitle: 'Manage user accounts',
        StatTotalUsers: 'Total Users',
        StatActivePage: 'Active (page)',
        StatInactivePage: 'Inactive (page)',
        SearchPlaceholder: 'Search users...',
        EmptyMessage: 'No users found',

        ColUser: 'User',
        ColEmail: 'Email',
        ColStatus: 'Status',
        ColCreated: 'Created',
        StatusActive: 'Active',
        StatusInactive: 'Inactive',

        DetailBackLink: 'Back to Users',
        DetailNotFound: 'User not found',
        SectionAccountDetails: 'Account Details',
        LabelEmail: 'Email',
        LabelUsername: 'Username',
        LabelUserId: 'User ID',
        LabelCreated: 'Created',
        SectionStatistics: 'Statistics',
        StatTotalRevenue: 'Total Revenue',
        StatTotalTransfers: 'Total Transfers',
        StatMonthlyRevenue: 'Monthly Revenue',
        StatMonthlyTransfers: 'Monthly Transfers',
        SectionRoles: 'Roles',
        SectionDriverColor: 'Driver Color',
        DriverColorNotSet: 'Not set (default)',
        DriverColorHint: 'Used to identify this driver in transfers and lists',
        DriverColorChange: 'Change',
        DriverColorSaved: 'Color saved',
        DriverColorFailed: 'Failed to save',
      },
    }
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
        Heading: 'Kullanıcılar',
        Subtitle: 'Kullanıcı hesaplarını yönetin',
        StatTotalUsers: 'Toplam Kullanıcı',
        StatActivePage: 'Aktif (sayfa)',
        StatInactivePage: 'Pasif (sayfa)',
        SearchPlaceholder: 'Kullanıcı ara...',
        EmptyMessage: 'Kullanıcı bulunamadı',

        ColUser: 'Kullanıcı',
        ColEmail: 'E-posta',
        ColStatus: 'Durum',
        ColCreated: 'Oluşturulma',
        StatusActive: 'Aktif',
        StatusInactive: 'Pasif',

        DetailBackLink: 'Kullanıcılara dön',
        DetailNotFound: 'Kullanıcı bulunamadı',
        SectionAccountDetails: 'Hesap Detayları',
        LabelEmail: 'E-posta',
        LabelUsername: 'Kullanıcı adı',
        LabelUserId: 'Kullanıcı ID',
        LabelCreated: 'Oluşturulma',
        SectionStatistics: 'İstatistikler',
        StatTotalRevenue: 'Toplam Gelir',
        StatTotalTransfers: 'Toplam Transfer',
        StatMonthlyRevenue: 'Aylık Gelir',
        StatMonthlyTransfers: 'Aylık Transfer',
        SectionRoles: 'Roller',
        SectionDriverColor: 'Şoför Rengi',
        DriverColorNotSet: 'Ayarlanmadı (varsayılan)',
        DriverColorHint: 'Bu şoförü transferlerde ve listelerde tanımlamak için kullanılır',
        DriverColorChange: 'Değiştir',
        DriverColorSaved: 'Renk kaydedildi',
        DriverColorFailed: 'Kaydetme başarısız',
      },
    }
  }

  if (code === 'ar-EG') {
    return {
      code,
      strings: {
        Heading: 'المستخدمون',
        Subtitle: 'إدارة حسابات المستخدمين',
        StatTotalUsers: 'إجمالي المستخدمين',
        StatActivePage: 'نشط (الصفحة)',
        StatInactivePage: 'غير نشط (الصفحة)',
        SearchPlaceholder: 'بحث عن مستخدمين...',
        EmptyMessage: 'لا يوجد مستخدمون',

        ColUser: 'المستخدم',
        ColEmail: 'البريد الإلكتروني',
        ColStatus: 'الحالة',
        ColCreated: 'تاريخ الإنشاء',
        StatusActive: 'نشط',
        StatusInactive: 'غير نشط',

        DetailBackLink: 'العودة إلى المستخدمين',
        DetailNotFound: 'المستخدم غير موجود',
        SectionAccountDetails: 'تفاصيل الحساب',
        LabelEmail: 'البريد الإلكتروني',
        LabelUsername: 'اسم المستخدم',
        LabelUserId: 'معرف المستخدم',
        LabelCreated: 'تاريخ الإنشاء',
        SectionStatistics: 'الإحصائيات',
        StatTotalRevenue: 'إجمالي الإيرادات',
        StatTotalTransfers: 'إجمالي التحويلات',
        StatMonthlyRevenue: 'الإيرادات الشهرية',
        StatMonthlyTransfers: 'التحويلات الشهرية',
        SectionRoles: 'الأدوار',
      },
    }
  }

  // de-AT (default)
  return {
    code,
    strings: {
      Heading: 'Benutzer',
      Subtitle: 'Benutzerkonten verwalten',
      StatTotalUsers: 'Benutzer gesamt',
      StatActivePage: 'Aktiv (Seite)',
      StatInactivePage: 'Inaktiv (Seite)',
      SearchPlaceholder: 'Benutzer suchen...',
      EmptyMessage: 'Keine Benutzer gefunden',

      ColUser: 'Benutzer',
      ColEmail: 'E-Mail',
      ColStatus: 'Status',
      ColCreated: 'Erstellt',
      StatusActive: 'Aktiv',
      StatusInactive: 'Inaktiv',

      DetailBackLink: 'Zurück zu Benutzer',
      DetailNotFound: 'Benutzer nicht gefunden',
      SectionAccountDetails: 'Kontodetails',
      LabelEmail: 'E-Mail',
      LabelUsername: 'Benutzername',
      LabelUserId: 'Benutzer-ID',
      LabelCreated: 'Erstellt',
      SectionStatistics: 'Statistiken',
      StatTotalRevenue: 'Umsatz gesamt',
      StatTotalTransfers: 'Transfers gesamt',
      StatMonthlyRevenue: 'Monatlicher Umsatz',
      StatMonthlyTransfers: 'Monatliche Transfers',
      SectionRoles: 'Rollen',
      SectionDriverColor: 'Fahrerfarbe',
      DriverColorNotSet: 'Nicht gesetzt (Standard)',
      DriverColorHint: 'Wird verwendet, um diesen Fahrer in Transfers und Listen zu kennzeichnen',
      DriverColorChange: 'Ändern',
      DriverColorSaved: 'Farbe gespeichert',
      DriverColorFailed: 'Speichern fehlgeschlagen',
    },
  }
}
