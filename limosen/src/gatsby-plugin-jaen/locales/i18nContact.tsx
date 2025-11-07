// src/vars/i18nContact.tsx
export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG'

/** Contact modal i18n only */
export function getI18nContact(code: I18nCode) {

  if (code === 'de-AT') {
    return {
      code,
      strings: {
        ContactHeading: 'Kontaktieren Sie uns',
        ContactIntro: 'Wir freuen uns über Ihre Nachricht und melden uns schnellstmöglich bei Ihnen.',
        FirstName: 'Vorname',
        LastName: 'Nachname',
        Email: 'E-Mail',
        Phone: 'Telefonnummer',
        HowCanWeHelp: 'Wie können wir Ihnen helfen?',
        MessagePlaceholder: 'Nachricht',
        ConsentText: 'Sie willigen ein, dass Ihre Angaben zur Kontaktaufnahme und für Rückfragen gespeichert werden.',
        ConsentError: 'Bitte bestätigen Sie die Bedingungen zur Kontaktaufnahme',
        SendCta: 'Senden',
        ToastErrorTitle: 'Fehler',
        ToastErrorDesc: 'Es ist ein Fehler aufgetreten.',
        ToastSuccessTitle: 'Erfolg',
        ToastSuccessDesc: 'Ihre Reservierungsanfrage wurde erfolgreich versendet.'
      }
    }
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
        ContactHeading: 'Bizimle iletişime geçin',
        ContactIntro: 'Mesajınızı memnuniyetle alırız ve size en kısa sürede döneriz.',
        FirstName: 'Ad',
        LastName: 'Soyad',
        Email: 'E-posta',
        Phone: 'Telefon',
        HowCanWeHelp: 'Size nasıl yardımcı olabiliriz?',
        MessagePlaceholder: 'Mesaj',
        ConsentText: 'İletişim ve geri dönüş için verilerinizin saklanmasına izin veriyorsunuz.',
        ConsentError: 'Lütfen iletişim koşullarını onaylayın',
        SendCta: 'Gönder',
        ToastErrorTitle: 'Hata',
        ToastErrorDesc: 'Bir hata oluştu.',
        ToastSuccessTitle: 'Başarılı',
        ToastSuccessDesc: 'Rezervasyon talebiniz başarıyla gönderildi.'
      }
    }
  }

  // EN fallback
  return {
    code,
    strings: {
      ContactHeading: 'Contact us',
      ContactIntro: 'We’re happy to hear from you and will get back to you as soon as possible.',
      FirstName: 'First name',
      LastName: 'Last name',
      Email: 'Email',
      Phone: 'Phone',
      HowCanWeHelp: 'How can we help?',
      MessagePlaceholder: 'Message',
      ConsentText: 'You agree that your details may be stored for contact and follow-up.',
      ConsentError: 'Please confirm the contact permission',
      SendCta: 'Send',
      ToastErrorTitle: 'Error',
      ToastErrorDesc: 'Something went wrong.',
      ToastSuccessTitle: 'Success',
      ToastSuccessDesc: 'Your reservation request has been sent successfully.'
    }
  }
}
