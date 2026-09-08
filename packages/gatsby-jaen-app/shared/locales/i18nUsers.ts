/**
 * The words on the people screens: the directory, the account, the driver's
 * money settings. German is the product language and the other three follow
 * it. Every catalogue is typed against the German one, so a key added in one
 * language is a compile error until it exists in all four.
 */
import type {I18nCode} from '../i18n'

const de = {
  Heading: 'Benutzer',
  Subtitle: 'Konten, Rollen und Fahrer verwalten',
  SearchPlaceholder: 'Name, E-Mail oder Benutzername suchen',
  EmptyMessage: 'Keine Benutzer gefunden',
  StatTotalUsers: 'Benutzer gesamt',
  StatActivePage: 'Aktiv (Seite)',
  StatInactivePage: 'Inaktiv (Seite)',

  ColUser: 'Benutzer',
  ColEmail: 'E-Mail',
  ColRoles: 'Rollen',
  ColStatus: 'Status',
  ColCreated: 'Erstellt',
  CountLabel: '{total} Benutzer, {count} auf dieser Seite',
  StatusActive: 'Aktiv',
  StatusInactive: 'Inaktiv',

  RoleAdmin: 'Disponent',
  RoleDriver: 'Fahrer',
  RoleCustomer: 'Kunde',
  RoleNone: 'Keine Rolle',

  CreateDriver: 'Fahrer anlegen',
  CreateDriverTitle: 'Neuen Fahrer anlegen',
  CreateDriverBody:
    'Das Konto wird in Zitadel angelegt und erhält die Fahrerrolle.',
  FieldEmail: 'E-Mail',
  FieldGivenName: 'Vorname',
  FieldFamilyName: 'Nachname',
  FieldPhone: 'Telefon',
  FieldPassword: 'Passwort',
  FieldPasswordHint:
    'Leer lassen, dann setzt der Fahrer sein Passwort selbst über die E-Mail.',
  ValidationRequired: 'Pflichtfeld',
  ValidationEmail: 'Keine gültige E-Mail-Adresse',
  CreateDriverSuccess: 'Fahrer angelegt',
  CreateDriverFailed: 'Fahrer konnte nicht angelegt werden',
  TemporaryPasswordLabel: 'Vorläufiges Passwort',
  TemporaryPasswordHint:
    'Wird nur jetzt angezeigt. Bitte dem Fahrer übergeben, er ändert es beim ersten Anmelden.',
  RoleNotGranted:
    'Das Konto wurde angelegt, die Fahrerrolle konnte aber nicht vergeben werden. Bitte unten in den Rollen nachholen.',
  OpenAccount: 'Konto öffnen',

  // The customer beside the driver, dispatch.md section 14.4.
  CreateUser: 'Benutzer anlegen',
  CreateCustomer: 'Kunde anlegen',
  CreateCustomerTitle: 'Neuen Kunden anlegen',
  CreateCustomerBody:
    'Das Konto wird in Zitadel angelegt, erhält die Kundenrolle und bekommt eine Einladung in seiner Sprache.',
  FieldLanguage: 'Sprache',
  FieldLanguageHint: 'Die Sprache der Einladung und aller weiteren E-Mails.',
  LanguageGerman: 'Deutsch',
  LanguageEnglish: 'Englisch',
  LanguageTurkish: 'Türkisch',
  LanguageArabic: 'Arabisch',
  SectionBilling: 'Rechnungsdaten',
  BillingHint:
    'Für ein Hotel oder eine Firma. Bei Privatkunden bleibt der Block leer.',
  FieldCompany: 'Firma oder Hotel',
  FieldVatId: 'UID-Nummer',
  FieldStreet: 'Straße und Hausnummer',
  FieldPostalCode: 'PLZ',
  FieldCity: 'Ort',
  FieldCountry: 'Land',
  ValidationPhone: 'Bitte mit Landesvorwahl',
  CreateCustomerSuccess: 'Kunde angelegt',
  CreateCustomerFailed: 'Kunde konnte nicht angelegt werden',
  InvitationSent:
    'Die Einladung ist unterwegs. Der Kunde setzt sein Passwort selbst.',
  InvitationNotSent:
    'Das Konto wurde angelegt, die Einladung konnte aber nicht verschickt werden. Bitte sie im Identitätsserver erneut senden.',
  CustomerRoleNotGranted:
    'Das Konto wurde angelegt, die Kundenrolle konnte aber nicht vergeben werden. Bitte unten in den Rollen nachholen.',

  DetailBackLink: 'Zurück zu Benutzer',
  DetailNotFound: 'Benutzer nicht gefunden',
  SectionAccountDetails: 'Kontodetails',
  LabelEmail: 'E-Mail',
  LabelUsername: 'Benutzername',
  LabelUserId: 'Benutzer-ID',
  LabelPhone: 'Telefon',
  LabelLanguage: 'Sprache',
  LabelCreated: 'Erstellt',

  SectionRoles: 'Rollen',
  RolesHint: 'Was dieses Konto in der App sehen und tun darf.',
  RolesSaved: 'Rollen gespeichert',
  RolesFailed: 'Rollen konnten nicht gespeichert werden',

  SectionAccountState: 'Kontostatus',
  Deactivate: 'Deaktivieren',
  Reactivate: 'Reaktivieren',
  DeactivateConfirmTitle: 'Konto deaktivieren?',
  DeactivateConfirmBody:
    'Die Person kann sich nicht mehr anmelden. Zugewiesene Fahrten bleiben bestehen.',
  ReactivateConfirmTitle: 'Konto reaktivieren?',
  ReactivateConfirmBody: 'Die Person kann sich wieder anmelden.',
  DeactivateSuccess: 'Konto deaktiviert',
  ReactivateSuccess: 'Konto reaktiviert',
  StateChangeFailed: 'Kontostatus konnte nicht geändert werden',

  SectionDriverColor: 'Fahrerfarbe',
  DriverColorNotSet: 'Nicht gesetzt (Standard)',
  DriverColorHint: 'Kennzeichnet diesen Fahrer in Transfers und Listen',
  DriverColorChange: 'Ändern',
  DriverColorSaved: 'Farbe gespeichert',
  DriverColorFailed: 'Farbe konnte nicht gespeichert werden',

  SectionPayout: 'Fahreranteil',
  PayoutLabel: 'Anteil am Fahrpreis',
  PayoutHint:
    'Prozent des Fahrpreises, der dem Fahrer zusteht. Bar kassierte Beträge und Spesen werden abgezogen.',
  PayoutSaved: 'Anteil gespeichert',
  PayoutFailed: 'Anteil konnte nicht gespeichert werden',
  PayoutNotDriver: 'Dieses Konto hat keine Fahrerrolle.',

  SectionExpenses: 'Spesen',
  ExpensesHint:
    'Auslagen des Fahrers, die von der Auszahlung abgezogen werden.',
  ExpenseDate: 'Datum',
  ExpenseAmount: 'Betrag',
  ExpenseNote: 'Notiz',
  ExpenseAdd: 'Spesen erfassen',
  ExpenseAdded: 'Spesen erfasst',
  ExpenseFailed: 'Spesen konnten nicht erfasst werden',
  ExpensesEmpty: 'Keine Spesen in diesem Monat',
  ExpensesListUnavailable:
    'Die Spesenliste ist in dieser Version noch nicht abrufbar. Was Sie jetzt eintragen, wird gespeichert und hier bis zum Neuladen angezeigt.',
  ValidationAmount: 'Betrag muss größer als 0 sein',

  SectionStatistics: 'Dieser Monat',
  StatCompleted: 'Erledigte Fahrten',
  StatRevenue: 'Umsatz',
  StatCash: 'Bar kassiert',
  StatPayoutDue: 'Auszahlung',
  StatsNoRow: 'Für dieses Konto gibt es in diesem Monat keine Fahrerzahlen.',

  SectionStatements: 'Abrechnungen'
}

export type UsersStrings = typeof de

const en: UsersStrings = {
  Heading: 'Users',
  Subtitle: 'Manage accounts, roles and drivers',
  SearchPlaceholder: 'Search by name, email or username',
  EmptyMessage: 'No users found',
  StatTotalUsers: 'Total users',
  StatActivePage: 'Active (page)',
  StatInactivePage: 'Inactive (page)',

  ColUser: 'User',
  ColEmail: 'Email',
  ColRoles: 'Roles',
  ColStatus: 'Status',
  ColCreated: 'Created',
  CountLabel: '{total} users, {count} on this page',
  StatusActive: 'Active',
  StatusInactive: 'Inactive',

  RoleAdmin: 'Dispatcher',
  RoleDriver: 'Driver',
  RoleCustomer: 'Customer',
  RoleNone: 'No role',

  CreateDriver: 'Create driver',
  CreateDriverTitle: 'Create a new driver',
  CreateDriverBody:
    'The account is created in Zitadel and receives the driver role.',
  FieldEmail: 'Email',
  FieldGivenName: 'First name',
  FieldFamilyName: 'Last name',
  FieldPhone: 'Phone',
  FieldPassword: 'Password',
  FieldPasswordHint:
    'Leave empty and the driver sets their own password through the email.',
  ValidationRequired: 'Required',
  ValidationEmail: 'Not a valid email address',
  CreateDriverSuccess: 'Driver created',
  CreateDriverFailed: 'The driver could not be created',
  TemporaryPasswordLabel: 'Temporary password',
  TemporaryPasswordHint:
    'Shown only now. Hand it to the driver, they change it at their first sign-in.',
  RoleNotGranted:
    'The account was created but the driver role could not be granted. Please set it under Roles.',
  OpenAccount: 'Open account',

  CreateUser: 'Create user',
  CreateCustomer: 'Create customer',
  CreateCustomerTitle: 'Create a new customer',
  CreateCustomerBody:
    'The account is created in Zitadel, receives the customer role and is invited in its own language.',
  FieldLanguage: 'Language',
  FieldLanguageHint:
    'The language of the invitation and of every mail after it.',
  LanguageGerman: 'German',
  LanguageEnglish: 'English',
  LanguageTurkish: 'Turkish',
  LanguageArabic: 'Arabic',
  SectionBilling: 'Billing details',
  BillingHint:
    'For a hotel or a company. Leave it empty for a private customer.',
  FieldCompany: 'Company or hotel',
  FieldVatId: 'VAT id',
  FieldStreet: 'Street and number',
  FieldPostalCode: 'Postcode',
  FieldCity: 'City',
  FieldCountry: 'Country',
  ValidationPhone: 'Please include the country code',
  CreateCustomerSuccess: 'Customer created',
  CreateCustomerFailed: 'The customer could not be created',
  InvitationSent:
    'The invitation is on its way. The customer sets their own password.',
  InvitationNotSent:
    'The account was created but the invitation could not be sent. Please send it again in the identity server.',
  CustomerRoleNotGranted:
    'The account was created but the customer role could not be granted. Please set it under Roles.',

  DetailBackLink: 'Back to users',
  DetailNotFound: 'User not found',
  SectionAccountDetails: 'Account details',
  LabelEmail: 'Email',
  LabelUsername: 'Username',
  LabelUserId: 'User ID',
  LabelPhone: 'Phone',
  LabelLanguage: 'Language',
  LabelCreated: 'Created',

  SectionRoles: 'Roles',
  RolesHint: 'What this account may see and do in the app.',
  RolesSaved: 'Roles saved',
  RolesFailed: 'The roles could not be saved',

  SectionAccountState: 'Account state',
  Deactivate: 'Deactivate',
  Reactivate: 'Reactivate',
  DeactivateConfirmTitle: 'Deactivate this account?',
  DeactivateConfirmBody:
    'The person can no longer sign in. Assigned rides stay as they are.',
  ReactivateConfirmTitle: 'Reactivate this account?',
  ReactivateConfirmBody: 'The person can sign in again.',
  DeactivateSuccess: 'Account deactivated',
  ReactivateSuccess: 'Account reactivated',
  StateChangeFailed: 'The account state could not be changed',

  SectionDriverColor: 'Driver colour',
  DriverColorNotSet: 'Not set (default)',
  DriverColorHint: 'Marks this driver in transfers and lists',
  DriverColorChange: 'Change',
  DriverColorSaved: 'Colour saved',
  DriverColorFailed: 'The colour could not be saved',

  SectionPayout: 'Driver share',
  PayoutLabel: 'Share of the fare',
  PayoutHint:
    'Percent of the fare that belongs to the driver. Cash taken and expenses are deducted.',
  PayoutSaved: 'Share saved',
  PayoutFailed: 'The share could not be saved',
  PayoutNotDriver: 'This account does not hold the driver role.',

  SectionExpenses: 'Expenses',
  ExpensesHint: 'What the driver laid out, deducted from the payout.',
  ExpenseDate: 'Date',
  ExpenseAmount: 'Amount',
  ExpenseNote: 'Note',
  ExpenseAdd: 'Add expense',
  ExpenseAdded: 'Expense added',
  ExpenseFailed: 'The expense could not be added',
  ExpensesEmpty: 'No expenses this month',
  ExpensesListUnavailable:
    'The expense list is not available in this version yet. What you enter now is saved and shown here until the page is reloaded.',
  ValidationAmount: 'The amount must be greater than 0',

  SectionStatistics: 'This month',
  StatCompleted: 'Completed rides',
  StatRevenue: 'Revenue',
  StatCash: 'Cash taken',
  StatPayoutDue: 'Payout due',
  StatsNoRow: 'There are no driver figures for this account this month.',

  SectionStatements: 'Statements'
}

const tr: UsersStrings = {
  Heading: 'Kullanıcılar',
  Subtitle: 'Hesapları, rolleri ve şoförleri yönetin',
  SearchPlaceholder: 'Ad, e-posta veya kullanıcı adı ara',
  EmptyMessage: 'Kullanıcı bulunamadı',
  StatTotalUsers: 'Toplam kullanıcı',
  StatActivePage: 'Aktif (sayfa)',
  StatInactivePage: 'Pasif (sayfa)',

  ColUser: 'Kullanıcı',
  ColEmail: 'E-posta',
  ColRoles: 'Roller',
  ColStatus: 'Durum',
  ColCreated: 'Oluşturulma',
  CountLabel: '{total} kullanıcı, bu sayfada {count}',
  StatusActive: 'Aktif',
  StatusInactive: 'Pasif',

  RoleAdmin: 'Sevkiyatçı',
  RoleDriver: 'Şoför',
  RoleCustomer: 'Müşteri',
  RoleNone: 'Rol yok',

  CreateDriver: 'Şoför oluştur',
  CreateDriverTitle: 'Yeni şoför oluştur',
  CreateDriverBody: 'Hesap Zitadel içinde oluşturulur ve şoför rolünü alır.',
  FieldEmail: 'E-posta',
  FieldGivenName: 'Ad',
  FieldFamilyName: 'Soyad',
  FieldPhone: 'Telefon',
  FieldPassword: 'Şifre',
  FieldPasswordHint:
    'Boş bırakılırsa şoför şifresini e-posta üzerinden kendisi belirler.',
  ValidationRequired: 'Zorunlu alan',
  ValidationEmail: 'Geçerli bir e-posta adresi değil',
  CreateDriverSuccess: 'Şoför oluşturuldu',
  CreateDriverFailed: 'Şoför oluşturulamadı',
  TemporaryPasswordLabel: 'Geçici şifre',
  TemporaryPasswordHint:
    'Yalnızca şimdi gösterilir. Şoföre iletin, ilk girişte kendisi değiştirir.',
  RoleNotGranted:
    'Hesap oluşturuldu ancak şoför rolü verilemedi. Lütfen Roller altında ayarlayın.',
  OpenAccount: 'Hesabı aç',

  CreateUser: 'Kullanıcı ekle',
  CreateCustomer: 'Müşteri ekle',
  CreateCustomerTitle: 'Yeni müşteri ekle',
  CreateCustomerBody:
    'Hesap Zitadel üzerinde oluşturulur, müşteri rolünü alır ve kendi dilinde bir davet gönderilir.',
  FieldLanguage: 'Dil',
  FieldLanguageHint: 'Davetin ve sonraki tüm e-postaların dili.',
  LanguageGerman: 'Almanca',
  LanguageEnglish: 'İngilizce',
  LanguageTurkish: 'Türkçe',
  LanguageArabic: 'Arapça',
  SectionBilling: 'Fatura bilgileri',
  BillingHint: 'Otel veya şirket için. Bireysel müşteride boş bırakın.',
  FieldCompany: 'Şirket veya otel',
  FieldVatId: 'Vergi numarası',
  FieldStreet: 'Cadde ve numara',
  FieldPostalCode: 'Posta kodu',
  FieldCity: 'Şehir',
  FieldCountry: 'Ülke',
  ValidationPhone: 'Lütfen ülke kodunu ekleyin',
  CreateCustomerSuccess: 'Müşteri eklendi',
  CreateCustomerFailed: 'Müşteri eklenemedi',
  InvitationSent: 'Davet gönderildi. Müşteri şifresini kendisi belirler.',
  InvitationNotSent:
    'Hesap oluşturuldu ancak davet gönderilemedi. Lütfen kimlik sunucusundan yeniden gönderin.',
  CustomerRoleNotGranted:
    'Hesap oluşturuldu ancak müşteri rolü verilemedi. Lütfen aşağıdaki Roller bölümünden ekleyin.',

  DetailBackLink: 'Kullanıcılara dön',
  DetailNotFound: 'Kullanıcı bulunamadı',
  SectionAccountDetails: 'Hesap bilgileri',
  LabelEmail: 'E-posta',
  LabelUsername: 'Kullanıcı adı',
  LabelUserId: 'Kullanıcı kimliği',
  LabelPhone: 'Telefon',
  LabelLanguage: 'Dil',
  LabelCreated: 'Oluşturulma',

  SectionRoles: 'Roller',
  RolesHint: 'Bu hesabın uygulamada görebilecekleri ve yapabilecekleri.',
  RolesSaved: 'Roller kaydedildi',
  RolesFailed: 'Roller kaydedilemedi',

  SectionAccountState: 'Hesap durumu',
  Deactivate: 'Devre dışı bırak',
  Reactivate: 'Yeniden etkinleştir',
  DeactivateConfirmTitle: 'Hesap devre dışı bırakılsın mı?',
  DeactivateConfirmBody:
    'Kişi artık giriş yapamaz. Atanmış yolculuklar olduğu gibi kalır.',
  ReactivateConfirmTitle: 'Hesap yeniden etkinleştirilsin mi?',
  ReactivateConfirmBody: 'Kişi yeniden giriş yapabilir.',
  DeactivateSuccess: 'Hesap devre dışı bırakıldı',
  ReactivateSuccess: 'Hesap yeniden etkinleştirildi',
  StateChangeFailed: 'Hesap durumu değiştirilemedi',

  SectionDriverColor: 'Şoför rengi',
  DriverColorNotSet: 'Ayarlanmadı (varsayılan)',
  DriverColorHint: 'Bu şoförü transferlerde ve listelerde işaretler',
  DriverColorChange: 'Değiştir',
  DriverColorSaved: 'Renk kaydedildi',
  DriverColorFailed: 'Renk kaydedilemedi',

  SectionPayout: 'Şoför payı',
  PayoutLabel: 'Ücretten pay',
  PayoutHint:
    'Ücretin şoföre ait yüzdesi. Nakit tahsilatlar ve masraflar düşülür.',
  PayoutSaved: 'Pay kaydedildi',
  PayoutFailed: 'Pay kaydedilemedi',
  PayoutNotDriver: 'Bu hesabın şoför rolü yok.',

  SectionExpenses: 'Masraflar',
  ExpensesHint: 'Şoförün yaptığı harcamalar, ödemeden düşülür.',
  ExpenseDate: 'Tarih',
  ExpenseAmount: 'Tutar',
  ExpenseNote: 'Not',
  ExpenseAdd: 'Masraf ekle',
  ExpenseAdded: 'Masraf eklendi',
  ExpenseFailed: 'Masraf eklenemedi',
  ExpensesEmpty: 'Bu ay masraf yok',
  ExpensesListUnavailable:
    'Masraf listesi bu sürümde henüz görüntülenemiyor. Şimdi girdikleriniz kaydedilir ve sayfa yenilenene kadar burada gösterilir.',
  ValidationAmount: 'Tutar 0’dan büyük olmalı',

  SectionStatistics: 'Bu ay',
  StatCompleted: 'Tamamlanan yolculuklar',
  StatRevenue: 'Ciro',
  StatCash: 'Nakit tahsilat',
  StatPayoutDue: 'Ödenecek',
  StatsNoRow: 'Bu hesap için bu ay şoför verisi yok.',

  SectionStatements: 'Hesap özetleri'
}

const ar: UsersStrings = {
  Heading: 'المستخدمون',
  Subtitle: 'إدارة الحسابات والأدوار والسائقين',
  SearchPlaceholder: 'البحث بالاسم أو البريد الإلكتروني أو اسم المستخدم',
  EmptyMessage: 'لا يوجد مستخدمون',
  StatTotalUsers: 'إجمالي المستخدمين',
  StatActivePage: 'نشط (الصفحة)',
  StatInactivePage: 'غير نشط (الصفحة)',

  ColUser: 'المستخدم',
  ColEmail: 'البريد الإلكتروني',
  ColRoles: 'الأدوار',
  ColStatus: 'الحالة',
  ColCreated: 'تاريخ الإنشاء',
  CountLabel: '{total} مستخدمين، {count} في هذه الصفحة',
  StatusActive: 'نشط',
  StatusInactive: 'غير نشط',

  RoleAdmin: 'موزّع الرحلات',
  RoleDriver: 'سائق',
  RoleCustomer: 'عميل',
  RoleNone: 'بدون دور',

  CreateDriver: 'إنشاء سائق',
  CreateDriverTitle: 'إنشاء سائق جديد',
  CreateDriverBody: 'يُنشأ الحساب في Zitadel ويحصل على دور السائق.',
  FieldEmail: 'البريد الإلكتروني',
  FieldGivenName: 'الاسم الأول',
  FieldFamilyName: 'اسم العائلة',
  FieldPhone: 'الهاتف',
  FieldPassword: 'كلمة المرور',
  FieldPasswordHint:
    'اتركه فارغًا ليضبط السائق كلمة المرور بنفسه عبر البريد الإلكتروني.',
  ValidationRequired: 'حقل إلزامي',
  ValidationEmail: 'عنوان بريد إلكتروني غير صالح',
  CreateDriverSuccess: 'تم إنشاء السائق',
  CreateDriverFailed: 'تعذّر إنشاء السائق',
  TemporaryPasswordLabel: 'كلمة مرور مؤقتة',
  TemporaryPasswordHint:
    'تُعرض الآن فقط. سلّمها للسائق، وسيغيّرها عند أول تسجيل دخول.',
  RoleNotGranted:
    'تم إنشاء الحساب لكن تعذّر منح دور السائق. يرجى ضبطه ضمن الأدوار.',
  OpenAccount: 'فتح الحساب',

  CreateUser: 'إضافة مستخدم',
  CreateCustomer: 'إضافة عميل',
  CreateCustomerTitle: 'إضافة عميل جديد',
  CreateCustomerBody:
    'يُنشأ الحساب في Zitadel ويحصل على دور العميل وتُرسل إليه دعوة بلغته.',
  FieldLanguage: 'اللغة',
  FieldLanguageHint: 'لغة الدعوة وكل رسالة بعدها.',
  LanguageGerman: 'الألمانية',
  LanguageEnglish: 'الإنجليزية',
  LanguageTurkish: 'التركية',
  LanguageArabic: 'العربية',
  SectionBilling: 'بيانات الفوترة',
  BillingHint: 'للفندق أو الشركة. اتركها فارغة للعميل الخاص.',
  FieldCompany: 'الشركة أو الفندق',
  FieldVatId: 'الرقم الضريبي',
  FieldStreet: 'الشارع ورقم المبنى',
  FieldPostalCode: 'الرمز البريدي',
  FieldCity: 'المدينة',
  FieldCountry: 'البلد',
  ValidationPhone: 'يرجى إضافة رمز الدولة',
  CreateCustomerSuccess: 'تمت إضافة العميل',
  CreateCustomerFailed: 'تعذّرت إضافة العميل',
  InvitationSent: 'أُرسلت الدعوة. يضبط العميل كلمة المرور بنفسه.',
  InvitationNotSent:
    'أُنشئ الحساب لكن تعذّر إرسال الدعوة. يرجى إرسالها مجددًا من خادم الهوية.',
  CustomerRoleNotGranted:
    'أُنشئ الحساب لكن تعذّر منح دور العميل. يرجى ضبطه في الأدوار أدناه.',

  DetailBackLink: 'العودة إلى المستخدمين',
  DetailNotFound: 'المستخدم غير موجود',
  SectionAccountDetails: 'تفاصيل الحساب',
  LabelEmail: 'البريد الإلكتروني',
  LabelUsername: 'اسم المستخدم',
  LabelUserId: 'معرّف المستخدم',
  LabelPhone: 'الهاتف',
  LabelLanguage: 'اللغة',
  LabelCreated: 'تاريخ الإنشاء',

  SectionRoles: 'الأدوار',
  RolesHint: 'ما يمكن لهذا الحساب رؤيته وفعله في التطبيق.',
  RolesSaved: 'تم حفظ الأدوار',
  RolesFailed: 'تعذّر حفظ الأدوار',

  SectionAccountState: 'حالة الحساب',
  Deactivate: 'تعطيل',
  Reactivate: 'إعادة التفعيل',
  DeactivateConfirmTitle: 'تعطيل هذا الحساب؟',
  DeactivateConfirmBody:
    'لن يتمكن الشخص من تسجيل الدخول بعد الآن. تبقى الرحلات المسندة كما هي.',
  ReactivateConfirmTitle: 'إعادة تفعيل هذا الحساب؟',
  ReactivateConfirmBody: 'سيتمكن الشخص من تسجيل الدخول مجددًا.',
  DeactivateSuccess: 'تم تعطيل الحساب',
  ReactivateSuccess: 'تمت إعادة تفعيل الحساب',
  StateChangeFailed: 'تعذّر تغيير حالة الحساب',

  SectionDriverColor: 'لون السائق',
  DriverColorNotSet: 'غير محدد (افتراضي)',
  DriverColorHint: 'يميّز هذا السائق في التحويلات والقوائم',
  DriverColorChange: 'تغيير',
  DriverColorSaved: 'تم حفظ اللون',
  DriverColorFailed: 'تعذّر حفظ اللون',

  SectionPayout: 'حصة السائق',
  PayoutLabel: 'الحصة من الأجرة',
  PayoutHint:
    'النسبة المئوية من الأجرة التي تخص السائق. تُخصم المبالغ النقدية المحصّلة والمصاريف.',
  PayoutSaved: 'تم حفظ الحصة',
  PayoutFailed: 'تعذّر حفظ الحصة',
  PayoutNotDriver: 'هذا الحساب لا يحمل دور السائق.',

  SectionExpenses: 'المصاريف',
  ExpensesHint: 'ما دفعه السائق من ماله، ويُخصم من المستحقات.',
  ExpenseDate: 'التاريخ',
  ExpenseAmount: 'المبلغ',
  ExpenseNote: 'ملاحظة',
  ExpenseAdd: 'إضافة مصروف',
  ExpenseAdded: 'تمت إضافة المصروف',
  ExpenseFailed: 'تعذّرت إضافة المصروف',
  ExpensesEmpty: 'لا مصاريف هذا الشهر',
  ExpensesListUnavailable:
    'قائمة المصاريف غير متاحة في هذا الإصدار بعد. ما تدخله الآن يُحفظ ويُعرض هنا حتى إعادة تحميل الصفحة.',
  ValidationAmount: 'يجب أن يكون المبلغ أكبر من 0',

  SectionStatistics: 'هذا الشهر',
  StatCompleted: 'الرحلات المكتملة',
  StatRevenue: 'الإيرادات',
  StatCash: 'النقد المحصّل',
  StatPayoutDue: 'المستحق للدفع',
  StatsNoRow: 'لا توجد أرقام سائق لهذا الحساب في هذا الشهر.',

  SectionStatements: 'كشوف الحساب'
}

export function getI18nUsers(code: I18nCode): {
  code: I18nCode
  strings: UsersStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}
