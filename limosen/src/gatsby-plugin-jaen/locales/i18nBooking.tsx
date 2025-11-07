// src/vars/i18nBooking.tsx
export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG'

/** Booking modal i18n only */
export function getI18nBooking(code: I18nCode) {
  if (code === 'de-AT') {
    return {
      code,
      strings: {
        BookingHeading: 'Reservierungsanfrage',
        BookingIntro:
          'Bitte fülle die Fahrtdetails und deine Kontaktdaten aus. Wir melden uns schnellstmöglich.',
        SectionRide: 'Fahrt',
        LabelCategory: 'Kategorie',
        CategoryDistance: 'Distanz',
        CategoryHourly: 'Stündlich',
        CategoryFlatrate: 'Flatrate',
        LabelType: 'Art',
        TypeOneWay: 'Einweg',
        TypeReturn: 'Rückkehr',
        LabelDate: 'Datum',
        LabelTime: 'Abholzeit',
        LabelPickup: 'Abholadresse',
        LabelDestination: 'Zieladresse',
        LabelPassengers: 'Passagieranzahl',
        LabelLuggage: 'Gepäckanzahl',
        LabelChildSeats: 'Kindersitz',
        LabelExtraTime: 'Zusätzliche Zeit (Std.)',

        // section title (kept for compatibility, now includes payment)
        SectionVehiclePrice: 'Fahrzeug & Zahlung',
        LabelCarClass: 'Fahrzeugklasse',
        LabelCarTitle: 'Fahrzeug',

        // NEW payment labels
        LabelPaymentOption: 'Zahlungsart',
        PaymentCash: 'Bar',
        PaymentCard: 'Karte',
        PaymentTransfer: 'Überweisung',

        SectionContact: 'Kontaktdetails',
        // localized (were English before)
        LabelFirstName: 'Vorname',
        LabelLastName: 'Nachname',
        LabelEmail: 'E-Mail',
        LabelPhone: 'Telefon',
        LabelFlightNumber: 'Flugnummer',
        LabelWishes: 'Wünsche',
        WishesPlaceholder: 'Wünsche oder Hinweise',
        ConsentText:
          'Ich bin damit einverstanden, dass meine Angaben zur Kontaktaufnahme und für Rückfragen gespeichert werden.',
        ConsentError: 'Bitte bestätige die Bedingungen zur Kontaktaufnahme',
        SubmitCta: 'Reservieren'
      }
    }
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
        BookingHeading: 'Rezervasyon talebi',
        BookingIntro:
          'Lütfen yolculuk ve iletişim bilgilerini doldurun. En kısa sürede geri döneceğiz.',
        SectionRide: 'Yolculuk',
        LabelCategory: 'Kategori',
        CategoryDistance: 'Mesafe',
        CategoryHourly: 'Saatlik',
        CategoryFlatrate: 'Sabit ücret',
        LabelType: 'Tür',
        TypeOneWay: 'Tek yön',
        TypeReturn: 'Dönüş',
        LabelDate: 'Tarih',
        LabelTime: 'Alış saati',
        LabelPickup: 'Alış adresi',
        LabelDestination: 'Varış adresi',
        LabelPassengers: 'Yolcu sayısı',
        LabelLuggage: 'Bagaj sayısı',
        LabelChildSeats: 'Çocuk koltuğu',
        LabelExtraTime: 'Ek süre (saat)',

        // section title (kept for compatibility, now includes payment)
        SectionVehiclePrice: 'Araç & Ödeme',
        LabelCarClass: 'Araç sınıfı',
        LabelCarTitle: 'Araç',

        // NEW payment labels
        LabelPaymentOption: 'Ödeme yöntemi',
        PaymentCash: 'Nakit',
        PaymentCard: 'Kart',
        PaymentTransfer: 'Havale/EFT',

        SectionContact: 'İletişim bilgileri',
        // localized (were English before)
        LabelFirstName: 'Ad',
        LabelLastName: 'Soyad',
        LabelEmail: 'E-posta',
        LabelPhone: 'Telefon',
        LabelFlightNumber: 'Uçuş numarası',
        LabelWishes: 'İstekler',
        WishesPlaceholder: 'İstek veya not',
        ConsentText:
          'İletişim ve geri dönüş için verilerimin saklanmasına izin veriyorum.',
        ConsentError: 'Lütfen iletişim iznini onaylayın',
        SubmitCta: 'Rezervasyon'
      }
    }
  }

  if (code === 'ar-EG') {
    return {
      code,
      strings: {
        BookingHeading: 'طلب حجز',
        BookingIntro:
          'يرجى إدخال تفاصيل الرحلة ومعلومات الاتصال. سنعاود التواصل معك قريبًا.',
        SectionRide: 'الرحلة',
        LabelCategory: 'الفئة',
        CategoryDistance: 'بالـمسافة',
        CategoryHourly: 'بالساعة',
        CategoryFlatrate: 'سعر ثابت',
        LabelType: 'النوع',
        TypeOneWay: 'ذهاب فقط',
        TypeReturn: 'ذهاب وعودة',
        LabelDate: 'التاريخ',
        LabelTime: 'وقت الاستلام',
        LabelPickup: 'عنوان الاستلام',
        LabelDestination: 'عنوان الوجهة',
        LabelPassengers: 'عدد الركاب',
        LabelLuggage: 'عدد الحقائب',
        LabelChildSeats: 'مقاعد أطفال',
        LabelExtraTime: 'وقت إضافي (ساعات)',

        // section title (kept for compatibility, now includes payment)
        SectionVehiclePrice: 'المركبة والدفع',
        LabelCarClass: 'فئة المركبة',
        LabelCarTitle: 'المركبة',

        // NEW payment labels
        LabelPaymentOption: 'طريقة الدفع',
        PaymentCash: 'نقدًا',
        PaymentCard: 'بطاقة',
        PaymentTransfer: 'حوالة مصرفية',

        SectionContact: 'بيانات الاتصال',
        LabelFirstName: 'الاسم الأول',
        LabelLastName: 'اسم العائلة',
        LabelEmail: 'البريد الإلكتروني',
        LabelPhone: 'الهاتف',
        LabelFlightNumber: 'رقم الرحلة',
        LabelWishes: 'ملاحظات',
        WishesPlaceholder: 'ملاحظات أو طلبات خاصة',
        ConsentText:
          'أوافق على حفظ بياناتي لغرض التواصل والرد على الاستفسارات.',
        ConsentError: 'يرجى تأكيد إذن التواصل',
        SubmitCta: 'إرسال الحجز'
      }
    }
  }

  // EN fallback (defaults)
  return {
    code,
    strings: {
      BookingHeading: 'Reservation request',
      BookingIntro:
        'Please fill in ride details and your contact info. We’ll get back to you shortly.',
      SectionRide: 'Ride',
      LabelCategory: 'Category',
      CategoryDistance: 'Distance',
      CategoryHourly: 'Hourly',
      CategoryFlatrate: 'Flatrate',
      LabelType: 'Type',
      TypeOneWay: 'One-way',
      TypeReturn: 'Return',
      LabelDate: 'Date',
      LabelTime: 'Pickup time',
      LabelPickup: 'Pickup address',
      LabelDestination: 'Destination address',
      LabelPassengers: 'Passengers',
      LabelLuggage: 'Luggage',
      LabelChildSeats: 'Child seats',
      LabelExtraTime: 'Extra time (hrs)',

      // section title (kept for compatibility, now includes payment)
      SectionVehiclePrice: 'Vehicle & Payment',
      LabelCarClass: 'Car class',
      LabelCarTitle: 'Vehicle',

      // NEW payment labels
      LabelPaymentOption: 'Payment option',
      PaymentCash: 'Cash',
      PaymentCard: 'Card',
      PaymentTransfer: 'Bank transfer',

      SectionContact: 'Contact details',
      LabelFirstName: 'First name',
      LabelLastName: 'Last name',
      LabelEmail: 'Email',
      LabelPhone: 'Phone',
      LabelFlightNumber: 'Flight number',
      LabelWishes: 'Notes',
      WishesPlaceholder: 'Notes or requests',
      ConsentText: 'I agree that my details may be stored for contact and follow-up.',
      ConsentError: 'Please confirm the contact permission',
      SubmitCta: 'Reserve'
    }
  }
}
