import type {I18nCode} from '../i18n'

/**
 * The driver's own page: colour, position sharing, notifications.
 *
 * German first, the other three follow it. The driver is addressed as "du",
 * the way the office talks to them, and the strings are short because this
 * screen is read on a phone at a hotel entrance.
 */
export function getI18nMe(code: I18nCode) {
  if (code === 'en-US') {
    return {
      code,
      strings: {
        Heading: 'Me',
        Subtitle: 'Your colour, your position, your notifications',
        NotADriver: 'This page is for drivers.',

        ColorHeading: 'My colour',
        ColorBody: 'The office sees your rides in this colour, and so do you.',
        ColorSave: 'Save colour',
        ColorSaved: 'Colour saved',
        ColorFailed: 'The colour could not be saved',
        ColorLabel: 'Colour',

        LocationHeading: 'Share my position',
        LocationBody:
          'While this is on, the office sees where you are during a ride. Only your latest position is kept, never a track, and nothing is sent between rides.',
        LocationSwitch: 'Share position',
        LocationUnsupported: 'This device cannot determine its position.',
        LocationDenied:
          'The browser has blocked access to your position. Allow it in the site settings and try again.',
        LocationUnavailable:
          'The device cannot find its position right now. Nothing is sent until it can.',
        LocationTimeout:
          'The device is taking too long to find its position. Nothing is sent until it does.',
        LocationOff: 'Off. The office does not see where you are.',
        LocationNoRide:
          'No ride at the moment. Sending starts with your next ride.',
        LocationCheckFailed:
          'Could not ask whether you have a ride. Trying again shortly.',
        LocationRideHint:
          'Sent at most every 15 seconds, when you have moved or a minute has passed.',
        LocationWaiting: 'Waiting for the first position',
        LocationLastSent: 'Last sent {time}',
        LocationSendFailed: 'The position could not be sent',

        PushHeading: 'Notifications',
        PushBody:
          'You are told the moment a ride is assigned to you, even with the app closed.',
        PushBodyAdmin:
          'New bookings and assignments: you are told the moment they arrive, even with the app closed.',
        PushSwitch: 'Notify me',
        PushUnsupported: 'This browser cannot show push notifications.',
        PushInstallHint: 'On an iPhone, add the app to the home screen first.',
        PushDenied:
          'Notifications are blocked in the browser. Allow them in the site settings and try again.',
        PushEnabled: 'Notifications are on',
        PushDisabled: 'Notifications are off',
        PushFailed: 'Notifications could not be turned on',
        PushTest: 'Send a test',
        PushTestTitle: 'Test notification',
        PushTestBody: 'This is what an assigned ride looks like.',
        PushTestBodyAdmin: 'This is what a new booking looks like.',
        PushHeadingCustomer: 'Status of my bookings',
        PushBodyCustomer:
          'Your offer, your driver on the way, your invoice: you are told the moment it happens, even with the app closed.',
        PushTestBodyCustomer:
          'This is what an update on your booking looks like.',
        PushTestFailed: 'The test could not be shown'
      }
    }
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
        Heading: 'Ben',
        Subtitle: 'Rengin, konumun, bildirimlerin',
        NotADriver: 'Bu sayfa şoförler içindir.',

        ColorHeading: 'Rengim',
        ColorBody: 'Ofis senin yolculuklarını bu renkte görür, sen de öyle.',
        ColorSave: 'Rengi kaydet',
        ColorSaved: 'Renk kaydedildi',
        ColorFailed: 'Renk kaydedilemedi',
        ColorLabel: 'Renk',

        LocationHeading: 'Konumumu paylaş',
        LocationBody:
          'Bu açıkken ofis bir yolculuk sırasında nerede olduğunu görür. Yalnızca son konumun saklanır, asla bir iz kaydı tutulmaz ve yolculuklar arasında hiçbir şey gönderilmez.',
        LocationSwitch: 'Konumu paylaş',
        LocationUnsupported: 'Bu cihaz konumunu belirleyemiyor.',
        LocationDenied:
          'Tarayıcı konum erişimini engelledi. Site ayarlarından izin ver ve tekrar dene.',
        LocationUnavailable:
          'Cihaz şu anda konumunu bulamıyor. Bulana kadar hiçbir şey gönderilmez.',
        LocationTimeout:
          'Cihazın konumunu bulması çok uzun sürüyor. Bulana kadar hiçbir şey gönderilmez.',
        LocationOff: 'Kapalı. Ofis nerede olduğunu görmüyor.',
        LocationNoRide:
          'Şu anda yolculuk yok. Gönderim bir sonraki yolculuğunla başlar.',
        LocationCheckFailed:
          'Yolculuğun olup olmadığı sorulamadı. Birazdan tekrar denenecek.',
        LocationRideHint:
          'En fazla 15 saniyede bir, hareket ettiğinde ya da bir dakika geçtiğinde gönderilir.',
        LocationWaiting: 'İlk konum bekleniyor',
        LocationLastSent: 'Son gönderim {time}',
        LocationSendFailed: 'Konum gönderilemedi',

        PushHeading: 'Bildirimler',
        PushBody:
          'Sana bir yolculuk atandığı anda, uygulama kapalıyken bile haber alırsın.',
        PushBodyAdmin:
          'Yeni rezervasyonlar ve atamalar: uygulama kapalıyken bile anında haber alırsın.',
        PushSwitch: 'Beni bilgilendir',
        PushUnsupported: 'Bu tarayıcı anlık bildirim gösteremiyor.',
        PushInstallHint:
          'iPhone kullanıyorsan uygulamayı önce ana ekrana ekle.',
        PushDenied:
          'Bildirimler tarayıcıda engellenmiş. Site ayarlarından izin ver ve tekrar dene.',
        PushEnabled: 'Bildirimler açık',
        PushDisabled: 'Bildirimler kapalı',
        PushFailed: 'Bildirimler açılamadı',
        PushTest: 'Test gönder',
        PushTestTitle: 'Test bildirimi',
        PushTestBody: 'Atanmış bir yolculuk böyle görünür.',
        PushTestBodyAdmin: 'Yeni bir rezervasyon böyle görünür.',
        PushHeadingCustomer: 'Rezervasyonlarımın durumu',
        PushBodyCustomer:
          'Teklifiniz, yoldaki şoförünüz, faturanız: uygulama kapalıyken bile anında haber alırsınız.',
        PushTestBodyCustomer:
          'Rezervasyonunuzla ilgili bir bildirim böyle görünür.',
        PushTestFailed: 'Test gösterilemedi'
      }
    }
  }

  if (code === 'ar-EG') {
    return {
      code,
      strings: {
        Heading: 'أنا',
        Subtitle: 'لونك وموقعك وإشعاراتك',
        NotADriver: 'هذه الصفحة للسائقين.',

        ColorHeading: 'لوني',
        ColorBody: 'يرى المكتب رحلاتك بهذا اللون، وأنت كذلك.',
        ColorSave: 'حفظ اللون',
        ColorSaved: 'تم حفظ اللون',
        ColorFailed: 'تعذّر حفظ اللون',
        ColorLabel: 'اللون',

        LocationHeading: 'مشاركة موقعي',
        LocationBody:
          'ما دام هذا مفعّلًا يرى المكتب أين أنت أثناء الرحلة. يُحفظ آخر موقع فقط، ولا يُسجَّل مسار أبدًا، ولا يُرسل شيء بين الرحلات.',
        LocationSwitch: 'مشاركة الموقع',
        LocationUnsupported: 'هذا الجهاز لا يستطيع تحديد موقعه.',
        LocationDenied:
          'المتصفح يمنع الوصول إلى موقعك. اسمح به من إعدادات الموقع وحاول مرة أخرى.',
        LocationUnavailable:
          'لا يستطيع الجهاز تحديد موقعه الآن. لن يُرسل شيء حتى يتمكن.',
        LocationTimeout:
          'يستغرق الجهاز وقتًا طويلًا لتحديد موقعه. لن يُرسل شيء حتى ينجح.',
        LocationOff: 'متوقف. لا يرى المكتب أين أنت.',
        LocationNoRide: 'لا توجد رحلة حاليًا. يبدأ الإرسال مع رحلتك التالية.',
        LocationCheckFailed:
          'تعذّر السؤال عمّا إذا كانت لديك رحلة. ستُعاد المحاولة قريبًا.',
        LocationRideHint:
          'يُرسل كل 15 ثانية على الأكثر، عندما تتحرك أو تمرّ دقيقة.',
        LocationWaiting: 'في انتظار أول موقع',
        LocationLastSent: 'آخر إرسال {time}',
        LocationSendFailed: 'تعذّر إرسال الموقع',

        PushHeading: 'الإشعارات',
        PushBody: 'تُخبَر فور تعيين رحلة لك، حتى والتطبيق مغلق.',
        PushBodyAdmin:
          'الحجوزات الجديدة والتعيينات: تُخبَر بها فور وصولها، حتى والتطبيق مغلق.',
        PushSwitch: 'أخبرني',
        PushUnsupported: 'هذا المتصفح لا يستطيع عرض إشعارات الدفع.',
        PushInstallHint: 'على iPhone أضف التطبيق إلى الشاشة الرئيسية أولًا.',
        PushDenied:
          'الإشعارات محظورة في المتصفح. اسمح بها من إعدادات الموقع وحاول مرة أخرى.',
        PushEnabled: 'الإشعارات مفعّلة',
        PushDisabled: 'الإشعارات متوقفة',
        PushFailed: 'تعذّر تفعيل الإشعارات',
        PushTest: 'إرسال اختبار',
        PushTestTitle: 'إشعار تجريبي',
        PushTestBody: 'هكذا تبدو الرحلة المعيّنة لك.',
        PushTestBodyAdmin: 'هكذا يبدو الحجز الجديد.',
        PushHeadingCustomer: 'حالة حجوزاتي',
        PushBodyCustomer:
          'عرضكم، سائقكم في الطريق، فاتورتكم: تُخبَرون فور حدوث ذلك، حتى والتطبيق مغلق.',
        PushTestBodyCustomer: 'هكذا يبدو تحديث حجزكم.',
        PushTestFailed: 'تعذّر عرض الاختبار'
      }
    }
  }

  // de-AT (default)
  return {
    code,
    strings: {
      Heading: 'Ich',
      Subtitle: 'Deine Farbe, dein Standort, deine Benachrichtigungen',
      NotADriver: 'Diese Seite ist für Fahrer.',

      ColorHeading: 'Meine Farbe',
      ColorBody:
        'Die Zentrale sieht deine Fahrten in dieser Farbe, und du auch.',
      ColorSave: 'Farbe speichern',
      ColorSaved: 'Farbe gespeichert',
      ColorFailed: 'Die Farbe konnte nicht gespeichert werden',
      ColorLabel: 'Farbe',

      LocationHeading: 'Standort teilen',
      LocationBody:
        'Solange das eingeschaltet ist, sieht die Zentrale während einer Fahrt, wo du bist. Es wird nur dein letzter Standort gespeichert, nie eine Spur, und zwischen den Fahrten wird nichts gesendet.',
      LocationSwitch: 'Standort teilen',
      LocationUnsupported: 'Dieses Gerät kann seinen Standort nicht bestimmen.',
      LocationDenied:
        'Der Browser blockiert den Zugriff auf deinen Standort. Erlaube ihn in den Website-Einstellungen und versuche es noch einmal.',
      LocationUnavailable:
        'Das Gerät findet seinen Standort gerade nicht. Es wird nichts gesendet, bis es ihn hat.',
      LocationTimeout:
        'Das Gerät braucht zu lange für den Standort. Es wird nichts gesendet, bis er da ist.',
      LocationOff: 'Aus. Die Zentrale sieht nicht, wo du bist.',
      LocationNoRide:
        'Gerade keine Fahrt. Das Senden beginnt mit deiner nächsten Fahrt.',
      LocationCheckFailed:
        'Ob du eine Fahrt hast, ließ sich nicht abfragen. Gleich noch ein Versuch.',
      LocationRideHint:
        'Höchstens alle 15 Sekunden, wenn du dich bewegt hast oder eine Minute vergangen ist.',
      LocationWaiting: 'Warte auf den ersten Standort',
      LocationLastSent: 'Zuletzt gesendet {time}',
      LocationSendFailed: 'Der Standort konnte nicht gesendet werden',

      PushHeading: 'Benachrichtigungen',
      PushBody:
        'Du erfährst sofort, wenn dir eine Fahrt zugewiesen wird, auch bei geschlossener App.',
      PushBodyAdmin:
        'Neue Buchungen und Zuweisungen: du erfährst sofort davon, auch bei geschlossener App.',
      PushSwitch: 'Benachrichtige mich',
      PushUnsupported:
        'Dieser Browser kann keine Push-Benachrichtigungen anzeigen.',
      PushInstallHint:
        'Am iPhone die App zuerst zum Home-Bildschirm hinzufügen.',
      PushDenied:
        'Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Website-Einstellungen und versuche es noch einmal.',
      PushEnabled: 'Benachrichtigungen sind eingeschaltet',
      PushDisabled: 'Benachrichtigungen sind ausgeschaltet',
      PushFailed: 'Benachrichtigungen konnten nicht eingeschaltet werden',
      PushTest: 'Test senden',
      PushTestTitle: 'Testbenachrichtigung',
      PushTestBody: 'So sieht eine zugewiesene Fahrt aus.',
      PushTestBodyAdmin: 'So sieht eine neue Buchung aus.',
      PushHeadingCustomer: 'Status meiner Buchungen',
      PushBodyCustomer:
        'Ihr Angebot, Ihr Fahrer unterwegs, Ihre Rechnung: Sie erfahren sofort davon, auch bei geschlossener App.',
      PushTestBodyCustomer: 'So sieht eine Statusmeldung zu Ihrer Buchung aus.',
      PushTestFailed: 'Der Test konnte nicht angezeigt werden'
    }
  }
}
