// src/vars/i18nHomepage.tsx
import {
  ABOUT_IMAGE,
  BOOKING_BACKGROUND,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  FLAG_DE,
  FLAG_EN,
  FLAG_TR,
  FLEET_BASE,
  SERVICES_BASE,
  FAQ_BASE,
  SOCIAL_LINKS,
  HERO_SLIDES,
  GOOGLE_MAPS_EMBED,
  GOOGLE_MAPS_OPEN
} from '../vars/limosen';

export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG';

export function getI18nHomepage(code: I18nCode) {
  if (code === 'de-AT') {
    const strings = {
      TopNavFleet: 'Fahrzeugflotte',
      TopNavReviews: 'Rezensionen',
      TopNavBookNow: 'Online buchen',
      TopNavContact: 'Kontakt',
      TopNavFollowUs: 'Folgen Sie uns',
      TopNavAlwaysReachable: 'Immer erreichbar',
      TopNavCityCountry: 'Wien, Österreich',
      TopNavAccount: 'Konto',
      TopNavLanguage: 'Sprache',
      LangTooltipDE: 'Deutsch',
      LangTooltipEN: 'English',
      LangTooltipTR: 'Türkçe',
      LangTooltipAR: 'العربية',
      LangModalTitle: 'Sprache wählen',
      LanguageGerman: 'Deutsch',
      LanguageEnglish: 'English',
      LanguageTurkish: 'Türkçe',
      LanguageArabic: 'العربية',
      ServicesTitle: 'Unsere Services',
      ServicesSubtitle:
        'Verschaffen Sie sich einen kurzen Überblick. Details bei Bedarf anzeigen.',
      MoreDetails: 'Details ansehen',
      ServicesDetailsTitle: 'Service Details',
      FaqTitle: 'Häufige Fragen',
      FaqSubtitle: 'Kurze Antworten zu Buchung, Fahrzeugen und Service.',
      FleetTitle: 'Fahrzeugflotte',
      FleetPassengersLabel: 'Passagiere:',
      FleetLuggageLabel: 'Gepäck:',
      BookingTitle: 'Heute buchen und wir kümmern uns um Ihren Komfort.',
      BookingReachPhone: 'Anrufen',
      BookingAnd: 'oder',
      BookingReachEmail: 'E Mail senden',
      ContactCta: 'Kontakt',
      FeedbackTitle: 'Feedback geben',
      FeedbackSubtitle: 'Sehen Sie Ihre Live Google Bewertung auf der Karte.',
      FeedbackBoxTitle: 'Google Bewertung',
      FeedbackBoxText:
        'Öffnen Sie LIMOSEN VIP in Google Maps um Sterne und Kommentare zu sehen oder eine Bewertung zu schreiben.',
      FeedbackMapsCta: 'In Google Maps öffnen',
      AboutTitle: 'Über uns',
      AboutP1:
        'LIMOSEN KG bietet seit 2016 an 365 Tagen rund um die Uhr Service und verfolgt die Entwicklungen in Branche und Technik.',
      AboutP2:
        'Unsere Flotte wächst kontinuierlich mit modernen Mercedes Benz Fahrzeugen sowie freundlichen professionellen erfahrenen Fahrern. Wir arbeiten zuverlässig wirtschaftlich und komfortorientiert und steigern die Servicequalität.',
      AboutP3:
        'Kundenzufriedenheit hat höchste Priorität. Unsere Vision ist es die Ziele in unserem Portfolio bestmöglich zu bedienen und höchste Qualität zu liefern.',
      AboutImageAlt: 'Über uns',
      BookNowCta: 'Jetzt reservieren',
      FooterTagline: 'Premium Chauffeurservice in Wien und Umgebung.',
      FooterRights: 'Alle Rechte vorbehalten.'
    };

    const navLinks = [
      { label: 'Service', href: '#services' },
      { label: 'Fahrzeugflotte', href: '#fahrzeuge' },
      { label: 'Rezensionen', href: '#rezensionen' },
      { label: 'Registrieren', href: '/signup' },
      { label: 'Kontakt', href: '?contact' }
    ];

    const services = SERVICES_BASE.map(s => {
      switch (s.id) {
        case 'airport-transfer':
          return {
            id: s.id,
            title: 'Flughafentransfer',
            image: s.image,
            paragraphs: [
              'Am Flughafen Wien bringen wir Ihnen Luxus und Komfort mit dem professionellsten Transferservice der Stadt. Die von Ihnen vorab gebuchten und speziell ausgestatteten Fahrzeuge sowie unsere erfahrenen Fahrer warten am Flughafen um den gewünschten Transfer durchzuführen.',
              'Sie können eine Fahrt buchen um Ihr Ziel zu erreichen ohne selbst zu fahren. Wir helfen Ihnen die Reise erholt zu beginnen und nehmen Ihnen auch bei der Rückfahrt zum Flughafen Stress ab.'
            ]
          };
        case 'city-tour':
          return {
            id: s.id,
            title: 'Personalisierter Chauffeurservice',
            image: s.image,
            paragraphs: [
              'Sie haben einen Termin in Wien möchten einen Gast betreuen oder einfach komfortabel mobil sein. Dann ist ein Mercedes Benz S Klasse First Class V Klasse Business Van oder E Klasse Business Class die richtige Wahl. Wenn Sie Luxus und Komfort suchen sind Sie hier richtig. Wir sorgen dafür dass Ihre Zeit im Verkehr angenehm vergeht und Sie weniger von äußeren Faktoren abhängig sind.',
              'Zusätzlich sprechen unsere Fahrer Sprachen und tragen formelle Kleidung. Auf Wunsch kann ein Dolmetscher ergänzt werden. So reisen Sie noch entspannter.',
              'Wir denken an Ihre Sicherheit und die Ihrer Kinder. Auf Wunsch statten wir das Fahrzeug mit einem Kindersitz aus. So reisen Sie sicher ohne sich Sorgen machen zu müssen.',
              'Private Transfers werden nach den Ankunftszeiten der Flüge organisiert daher gibt es keine Wartezeiten am Flughafen. An den Zielorten werden Sie von unserem Personal empfangen und zügig zu den Fahrzeugen geleitet.',
              'In unseren Mercedes Benz VIP Fahrzeugen fühlen Sie sich ruhig und sicher. Kundenzufriedenheit steht im Mittelpunkt und wir helfen gern bei zusätzlichen Wünschen.'
            ]
          };
        case 'private-driver-service':
          return {
            id: s.id,
            title: 'Stadtrundfahrt',
            image: s.image,
            paragraphs: [
              'Bei unseren Touren zu allen Sehenswürdigkeiten in Österreich erleben Sie Luxus und Komfort in Mercedes Benz Fahrzeugen. Mit unseren versierten Fahrern reisen Sie auf vorab festgelegten Routen und entdecken Kultur Geschichte und Natur. Stephansdom Hofburg Schönbrunn Kahlenberg Salzburger Altstadt Seepromenade Hallstatt Eisriesenwelt Gollinger Wasserfall und viele weitere Ziele stehen zur Wahl.',
              'Während der Tour wählen wir sorgfältig praktische sichere und einfache Routen. Unser Unternehmen entwickelt sich stetig weiter um noch bessere Qualität zu liefern.',
              'Neben diesen sicheren und komfortablen Standards profitieren Sie von den gehobenen Ausstattungen unserer modernen Mercedes Benz Fahrzeuge. Auf Wunsch begleitet Sie ein Guide für mehr Details damit Ihre Tour noch informativer und persönlicher wird.'
            ]
          };
        case 'corporate-services':
          return {
            id: s.id,
            title: 'Firmenservice',
            image: s.image,
            paragraphs: [
              'Unsere langjährige Erfahrung garantiert dass alle Details unseres Services sorgfältig geplant sind und die Qualitätsstandards laufend aktualisiert werden.',
              'Für die Transferbedürfnisse Ihres Unternehmens erhalten Sie mit den Zielinformationen passende Angebote und können Paketlösungen nutzen.',
              '• Organisationstransfers',
              '• Touristischer Ausflugstransfer',
              '• Transfers für Sportteams',
              '• Eröffnungs und Eventtransfers',
              '• Unternehmens und Verbandsfahrten',
              '• Gruppentransfers',
              '• Roadshow Transfers',
              '• Messe Transfer',
              '• Fahrzeugoptionen verschiedener Segmente',
              'Jede bestätigte Reservierung ist ein gegebenes Versprechen.'
            ]
          };
        case 'city-to-city':
          return {
            id: s.id,
            title: 'Personalisierter Chauffeurservice',
            image: s.image,
            paragraphs: [
              'Sie haben einen Termin in Wien möchten einen Gast betreuen oder für Ihre Arbeit bequem ankommen. Dafür kann ein Mercedes Benz S Klasse First Class V Klasse Business Van oder E Klasse Business Class ideal sein. Wenn Sie einen so luxuriösen und komfortablen Service suchen sind Sie hier richtig. Wir garantieren dass Ihre Zeit im Verkehr angenehm vergeht und Sie nicht von äußeren Bedingungen abhängig sind.',
              'Außerdem sprechen unsere Fahrer Sprachen und tragen formelle Kleidung. Auf Wunsch kann ein Dolmetscher bereitgestellt werden. So sind Sie während der Fahrt noch entspannter.',
              'Wir denken an Ihre Sicherheit und die Ihrer Kinder. Daher können wir im Fahrzeug Kindersitze bereitstellen. So müssen Sie sich um Ihr Kind nicht sorgen.',
              'Private Transfers werden nach Flugankünften organisiert daher gibt es keine Wartezeit am Flughafen. Ankunftsorts werden Sie vom Personal empfangen und schnell zu den Fahrzeugen geleitet.',
              'In unseren Mercedes Benz VIP Fahrzeugen fühlen Sie sich sicher und geborgen. Unsere Firma stellt Kundenzufriedenheit in den Mittelpunkt und hilft gern bei zusätzlichen Anliegen.'
            ]
          };
        case 'international':
          return {
            id: s.id,
            title: 'Internationaler Transfer',
            image: s.image,
            paragraphs: [
              'Der Flughafen Wien ist dank seiner Lage einer der zentralen Knoten für internationale Verbindungen in Europa.',
              'Als Flughafentransfer holen wir Sie ab kümmern uns um Ihr Gepäck bis zum Fahrzeug und bringen Sie zu jeder gewünschten Destination wie Bratislava Budapest Prag Venedig und alle Ziele innerhalb des Schengen Raums.',
              'Die Sicherheit unserer Kunden hat höchste Priorität. Dank moderner Fahrzeugortungssysteme fühlen Sie sich bis zum Ziel sicher und können Ihre Reise genießen.'
            ]
          };
        default:
          return {
            id: s.id,
            title: 'Transfer zwischen Bundesländern',
            image: s.image,
            paragraphs: [
              'Österreich ist eine föderale Republik mit neun Bundesländern. Wien Niederösterreich Oberösterreich Steiermark Tirol Kärnten Salzburg Vorarlberg Burgenland. Wenn Sie nach der Landung Ihr Ziel ohne eigenes Fahren erreichen möchten oder die Zeiten des öffentlichen Verkehrs nicht passen organisieren wir Ihre sichere Fahrt zum gewünschten Ort.'
            ]
          };
      }
    });

    const faq = FAQ_BASE.map(f => {
      switch (f.id) {
        case 'general-classes':
          return {
            question: 'Welche Fahrzeugklassen gibt es',
            answer:
              'Wir bieten Business und First Class. E Klasse für viele Einsätze V Klasse für Gruppen und S Klasse für besondere Anlässe.'
          };
        case 'airport-flow':
          return {
            question: 'Wie läuft der Flughafentransfer ab',
            answer:
              'Ihr Fahrer empfängt Sie trägt Ihr Gepäck und bringt Sie direkt an Ihr Ziel. Rücktransfer ist möglich.'
          };
        case 'kids-multilingual':
          return {
            question: 'Gibt es Kindersitz oder mehrsprachige Fahrer',
            answer:
              'Auf Wunsch stellen wir einen Kindersitz bereit. Unsere Fahrer tragen formelle Kleidung und sprechen verschiedene Sprachen. Ein Dolmetscher kann ergänzt werden.'
          };
        default:
          return {
            question: 'Bieten Sie internationale Transfers an',
            answer:
              'Ja. Bratislava Budapest Prag und Venedig sind beliebte Strecken. Wir bieten Tracking und persönlichen Service.'
          };
      }
    });

    const fleet = FLEET_BASE.map(v => {
      switch (v.id) {
        case 'business-sedan':
          return {
            name: 'Mercedes Benz E Klasse oder BMW 5',
            category: 'Business Class',
            description:
              'Mercedes Benz EQE 300, Mercedes Benz E 220d, BMW i5 eDrive40',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        case 'electric-sedan':
          return {
            name: 'Mercedes EQE Klasse oder BMW i5',
            category: 'Electric Class',
            description: 'Mercedes Benz EQE 300, BMW i5 eDrive40',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        case 'first-class-sedan':
          return {
            name: 'Mercedes Benz S Klasse',
            category: 'First Class',
            description:
              'Mercedes Benz S 500 L 4MATIC, Mercedes Benz EQS 580 4MATIC, BMW i7 eDrive50',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        default:
          return {
            name: 'Mercedes Benz V Klasse',
            category: 'Business Van',
            description: 'Mercedes Benz V Class',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
      }
    });

    const footer = [
      {
        title: 'Navigation',
        links: [
          { label: 'Fahrzeugflotte', href: '#fahrzeuge' },
          { label: 'Rezensionen', href: '#rezensionen' },
          { label: 'Kontakt', href: '?contact' }
        ]
      },
      {
        title: 'Services',
        links: [
          { label: 'Registrieren', href: '/signup' },
          { label: 'Jetzt buchen', href: '?booking' },
          { label: 'Impressum', href: 'https://limosen.at/de/imprint' },
          { label: 'Datenschutz', href: 'https://limosen.at/de/privacy' }
        ]
      },
      {
        title: 'Kontakt',
        links: [
          {
            label: CONTACT_PHONE,
            href: `https://api.whatsapp.com/send?phone=${encodeURIComponent(
              CONTACT_PHONE
            )}`
          },
          { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
          { label: 'Schreiben Sie uns', href: '/?contact' }
        ]
      }
    ];

    return {
      code,
      strings,
      navLinks,
      services,
      faq,
      fleet,
      footer,
      media: {
        ABOUT_IMAGE,
        BOOKING_BACKGROUND,
        HERO_SLIDES,
        FLAG_DE,
        FLAG_EN,
        FLAG_TR,
        GOOGLE_MAPS_EMBED,
        GOOGLE_MAPS_OPEN,
        SOCIAL_LINKS
      }
    };
  }

  if (code === 'tr-TR') {
    const strings = {
      TopNavFleet: 'Araçlarımız',
      TopNavReviews: 'Geri Bildirim',
      TopNavBookNow: 'Online Rezervasyon',
      TopNavContact: 'İletişim',
      TopNavFollowUs: 'Bizi takip edin',
      TopNavAlwaysReachable: 'Her zaman ulaşılabilir',
      TopNavCityCountry: 'Viyana, Avusturya',
      TopNavAccount: 'Hesap',
      TopNavLanguage: 'Dil',
      LangTooltipDE: 'Deutsch',
      LangTooltipEN: 'English',
      LangTooltipTR: 'Türkçe',
      LangModalTitle: 'Dil seçin',
      LanguageGerman: 'Deutsch',
      LanguageEnglish: 'English',
      LanguageTurkish: 'Türkçe',
      ServicesTitle: 'Hizmetlerimiz',
      ServicesSubtitle: 'Kısa bir özet alın. İsterseniz ayrıntıları inceleyin.',
      MoreDetails: 'Detayları gör',
      ServicesDetailsTitle: 'Hizmet ayrıntıları',
      FaqTitle: 'Sık sorulan sorular',
      FaqSubtitle: 'Rezervasyon, araçlar ve hizmet hakkında kısa yanıtlar.',
      FleetTitle: 'Araçlarımız',
      FleetPassengersLabel: 'Yolcu:',
      FleetLuggageLabel: 'Bagaj:',
      BookingTitle:
        'Bugün rezervasyon yapın, seyahatinizin konforunu biz düşünelim.',
      BookingReachPhone: 'Arayabilir',
      BookingAnd: 'veya',
      BookingReachEmail: 'e-posta gönderebilirsiniz',
      ContactCta: 'İletişim',
      FeedbackTitle: 'Geri bildirim verin',
      FeedbackSubtitle: 'Canlı Google puanınızı haritada görün.',
      FeedbackBoxTitle: 'Google puanı',
      FeedbackBoxText:
        'Yıldızları ve yorumları görmek ya da yorum yapmak için Google Haritalar’da LIMOSEN VIP sayfasını açın.',
      FeedbackMapsCta: 'Google Haritalar’da aç',
      AboutTitle: 'Hakkımızda',
      AboutP1:
        'LIMOSEN KG, 2016 yılından bu yana sektörel ve teknolojik degişimleri takip ederek sizler için 365 gün boyunca 7/24 hizmet vermektedir.',
      AboutP2:
        'Filomuz, son model Mercedes-Benz araçlarımızla ve güleryüzlü, profesyonel, deneyimli şoförlerimizle güvenilir, ekonomik, konforlu bir hizmet anlayışıyla, servis kalitesini arttırarak istikrarlı bir şekilde büyümeye devam ederek çalışmaktadır.',
      AboutP3:
        'Müşteri memnuniyeti bizim için en önemli önceliktir ve şirket vizyonumuz portföyümüzdeki destinasyonlari en iyi şekilde yaparak müşterilerimize en yüksek kaliteyi sunmaktır.',
      AboutImageAlt: 'Hakkımızda',
      BookNowCta: 'Hemen rezervasyon',
      FooterTagline: 'Viyana ve çevresinde premium şoförlü hizmet.',
      FooterRights: 'Tüm hakları saklıdır.'
    };

    const navLinks = [
      { label: 'Hizmetler', href: '#services' },
      { label: 'Filo', href: '#fahrzeuge' },
      { label: 'Yorumlar', href: '#rezensionen' },
      { label: 'Kayıt ol', href: '/signup' },
      { label: 'İletişim', href: '?contact' }
    ];

    const services = SERVICES_BASE.map(s => {
      switch (s.id) {
        case 'airport-transfer':
          return {
            id: s.id,
            title: 'Havaalanı Transferi',
            image: s.image,
            paragraphs: [
              'Viyana Uluslararası Havaalanında, şehrin en profesyonel transfer hizmetiyle lüks ve konforu ayağınıza getiriyoruz. Önceden rezervasyonunu yapmış olduğunuz sizler icin özel olarak dizayn edilmiş lüks araçlarımız; işinde deneyimli şoförlerimizle birlikte talep etmiş olduğunuz transfer hizmetini yerine getirmek üzere, havaalanında sizleri hazır beklemektedir.',
              'Uçaktan inip gitmek istediğiniz destinasyona ulaşmak için araç kullanmadan, araç tahsisi yapabilirsiniz. Tatilinize daha dinç ve enerjik başlamınızı sağlıyor, aynı şekilde tatiliniz bittiğinde de sizlerin yorgunluğunu alıp havalimanına ulaşmanızı sağlıyoruz.'
            ]
          };
        case 'city-tour':
          return {
            id: s.id,
            title: 'Kişiselleştirilmiş Şoför Hizmeti',
            image: s.image,
            paragraphs: [
              'Viyana içerisinde toplantınız olabilir, bir misafirinizi gezdirecek olabilir, veya yaptığınız işe binaen rahat ulaşım sağlamak isteyebilirsiniz. İşte bu noktada tam da bir Mercedes-Benz S-Klasse (First Class), V-Klasse (Business Van), E- Klasse (Business Class) marka VIP araca ihtiyacınız olabilir. Eğer aradığınız bu denli lüks ve konforlu bir hizmet ise en doğru yerdesiniz. Sizlere, trafikte geçireceğiniz vaktin su gibi akıp gideceğinin ve çevresel etkenlere bağlı kalmayacağınızın garantisini veriyoruz.',
              'Bunlara ek olarak, dil bilen ve resmi giyimli şoförlerimiz ve isteğe özel olarak istihdam ettiğimiz tercüman gibi hizmetlerimiz de mevcuttur. Böylelikle yolculuğunuz boyunca çok daha rahat edebilirsiniz.',
              'Sizlerin her konuda ki güvenliğini düşündüğümüz gibi çocuklarınızın da güvenliğini düşünerek, aracımız içerisinde ki donanıma cocuk koltuğunu da ilave ettik. Bu sayede trafikte güvenli biçimde yolculuk ederken, her zaman güvenliğinden emin olmak istediğiniz çocuğunuzla ilgili endişe duymak zorunda değilsiniz.',
              'Özel transferler misafirlerin uçak varış saatlerine göre organize edildiğinden havaalanlarında bekleme süresi yoktur. Varış noktalarında misafirlerimiz personelimizce karşılanıp tahsis edilen araçlara en hızlı şekilde yönlendirilmektedir.',
              'Mercedes-Benz marka VIP araçlarımızın içerisinde kendinizi huzur ve güven içerisinde hissedebilirsiniz. Yine her konuda müsteri memnuniyetini esas alan şirketimiz, herhangi bir ek ihtiyaçlarınızla ilgili taleplerinizde de sizlere yardımcı olmaktan mutluluk duyar.'
            ]
          };
        case 'private-driver-service':
          return {
            id: s.id,
            title: 'Şehir Turu',
            image: s.image,
            paragraphs: [
              'Avusturya içerisindeki tüm turistik noktalara verdiğimiz tur hizmetinde lüks ve konforu aynı anda Mercedes-Benz marka araçlarımızla bulabilirsiniz. Donanımlı şoförlerimiz aracılığıyla, önceden belirlenmiş olan güzergahlarda seyahat eder ve Avusturya´nin kültürel, tarihi yapısını, doğa güzelliklerini seyre durursunuz. Stephansdom, Hofburg, Schönbrunn, Kahlenberg, Salzburger Altstadt, Seepromenade, Hallstadt, Eisriesenwelt, Gollinger Wasserfall ve bunun gibi görmek isteyeceğiniz tüm noktalara turlarımız mevcuttur.',
              'Turunuz esnasında tüm güvenliğinizden ve huzurunuzdan sorumlu olacağımız üzere güzergahınız özenle seçilerek en pratik, güvenli ve kolay rotalar  takip edilir. Bu noktada da firmamız sürekli çalışmalar yaparak kendini geliştirmekte ve misafirlerine daha kaliteli hizmet verme amacındadır.',
              'Tüm bu güvenli ve konforlu standartların keyfini çıkarırken, son model Mercedes-Benz marka araçlarımızın içerisinde sizler için sağladığımız tüm üst düzey olanaklardan da yararlanabileceğinizi tekrardan söylemekte fayda görüyoruz. Dilerseniz size tahsis edeceğimiz rehber eşliğinde turunuzu daha detaylı bilgiler edineceğiniz bir hale getirebilir, daha keyifli ve özel bir tecrübe yaşayabilir, unutamayacaginiz anılar biriktirebilirsiniz.'
            ]
          };
        case 'corporate-services':
          return {
            id: s.id,
            title: 'Kurumsal Hizmetler',
            image: s.image,
            paragraphs: [
              'Senelerdir biriktirmiş olduğumuz tecrübemiz, verdiğimiz hizmetin tüm detaylarının ince elenip, sık dokunmuş vaziyette plan, program dahilinde oluşturulduğuna ve kalite standartlarının sürekli olarak güncellenerek dünya konjonktürüne uyum sağlar hale getirildiğine sizi temin ederiz.',
              'Firmanızın transfer ihtiyaçları için destinasyon bilgileriyle birlikte uygun fiyatlar alabilir, paket çözümlerimizden yaralanabilirsiniz.',
              '• Organizasyon Transferleri',
              '• Turistik Gezi Transferi',
              '• Spor Takımı Transferleri',
              '• Açılış, Kutlama Transferleri',
              '• Şirket ve Birlik Transferleri',
              '• Grup Transferleri',
              '• Roadshow Transferleri',
              '• Fuar Transfer',
              '• Farklı Segment Araç Seçenekleri',
              'Kurumsal satış, araç tahsisi konusunda sizlere çözüm üretmek için buradayız. Onayladığımız her rezervasyon size verilen bir sözdür.'
            ]
          };
        case 'city-to-city':
          return {
            id: s.id,
            title: 'Kişiselleştirilmiş Şoför Hizmeti',
            image: s.image,
            paragraphs: [
              'Viyana içerisinde toplantınız olabilir, bir misafirinizi gezdirecek olabilir, veya yaptığınız işe binaen rahat ulaşım sağlamak isteyebilirsiniz. İşte bu noktada tam da bir Mercedes-Benz S-Klasse (First Class), V-Klasse (Business Van), E- Klasse (Business Class) marka VIP araca ihtiyacınız olabilir. Eğer aradığınız bu denli lüks ve konforlu bir hizmet ise en doğru yerdesiniz. Sizlere, trafikte geçireceğiniz vaktin su gibi akıp gideceğinin ve çevresel etkenlere bağlı kalmayacağınızın garantisini veriyoruz.',
              'Bunlara ek olarak, dil bilen ve resmi giyimli şoförlerimiz ve isteğe özel olarak istihdam ettiğimiz tercüman gibi hizmetlerimiz de mevcuttur. Böylelikle yolculuğunuz boyunca çok daha rahat edebilirsiniz.',
              'Sizlerin her konuda ki güvenliğini düşündüğümüz gibi çocuklarınızın da güvenliğini düşünerek, aracımız içerisinde ki donanıma cocuk koltuğunu da ilave ettik. Bu sayede trafikte güvenli biçimde yolculuk ederken, her zaman güvenliğinden emin olmak istediğiniz çocuğunuzla ilgili endişe duymak zorunda değilsiniz.',
              'Özel transferler misafirlerin uçak varış saatlerine göre organize edildiğinden havaalanlarında bekleme süresi yoktur. Varış noktalarında misafirlerimiz personelimizce karşılanıp tahsis edilen araçlara en hızlı şekilde yönlendirilmektedir.',
              'Mercedes-Benz marka VIP araçlarımızın içerisinde kendinizi huzur ve güven içerisinde hissedebilirsiniz. Yine her konuda müsteri memnuniyetini esas alan şirketimiz, herhangi bir ek ihtiyaçlarınızla ilgili taleplerinizde de sizlere yardımcı olmaktan mutluluk duyar.'
            ]
          };
        case 'international':
          return {
            id: s.id,
            title: 'Yurtdışı Transfer',
            image: s.image,
            paragraphs: [
              'Avrupanın en merkezi başkentlerinden olan Viyana Havaalanı konumu itibariyle uluslararası aktarmaların kilit noktası görevini üstleniyor.',
              'Havaalanı transfer hizmeti olarak sizi karşılıyoruz, valizleriniz ve çantalarınızın aracımıza kadar taşınmasını özenle yapıp, gitmek isteğiniz destinasyon neresi olursa olsun Bratislava, Budapeste, Prag, Venedik ve diger Schengen dahilindeki tüm uluslararası sınırlar için ulaşımınızı sağlıyoruz.',
              'Ayrıca şirket politikamız gereği müşterilerimizin güvenliği bizim için en önemli unsur olduğundan, araçlarımızda varış noktasına kadar bizimle olacak, en yeni teknoloji araç takip sistemlerimizle kendinizi güvende hissedebilir, seyahatinizin tadını çıkarabilirsiniz.'
            ]
          };
        default:
          return {
            id: s.id,
            title: 'Eyaletler Arası Transfer',
            image: s.image,
            paragraphs: [
              'Federal bir Cumhuriyet olan Avusturya, dokuz eyaletten oluşur. Wien, Niederösterreich, Oberösterreich, Steiermark, Tirol, Kärnten, Salzburg, Vorarberg, Burgenland. Eyaletler arası seyahatin yoğun oldugu Avusturya´da uçaktan inip gitmek istediğiniz destinasyona ulaşmak için araç kullanmadan ya da seyahatinizin saatlerinden dolayı toplu taşımaya yetişemediyseniz, ister önceden yapmış olduğunuz araç tahsisiyle, isterse anlık gelişen durumlar için bütün tecrübemizle sizin güvenle istediginiz noktaya ulaşımınızı sağlıyoruz.'
            ]
          };
      }
    });

    const faq = FAQ_BASE.map(f => {
      switch (f.id) {
        case 'general-classes':
          return {
            question: 'Hangi araç sınıfları mevcut',
            answer:
              'Business ve First Class seçenekleri sunuyoruz. E Class, gruplar için V Class ve özel günler için S Class uygundur.'
          };
        case 'airport-flow':
          return {
            question: 'Havalimanı transferi nasıl işliyor',
            answer:
              'Şoförünüz sizi karşılar, bagajı taşır ve sizi doğrudan varış noktanıza götürür. Dönüş transferi de mümkündür.'
          };
        case 'kids-multilingual':
          return {
            question: 'Çocuk koltuğu veya çok dilli şoför var mı',
            answer:
              'Talep halinde çocuk koltuğu sağlarız. Şoförlerimiz resmi giyinir ve farklı diller konuşabilir. Çevirmen de eklenebilir.'
          };
        default:
          return {
            question: 'Uluslararası transfer yapıyor musunuz',
            answer:
              'Evet. Bratislava, Budapeşte, Prag ve Venedik sık tercih edilen rotalardır. Takip ve kişisel hizmet sağlarız.'
          };
      }
    });

    const fleet = FLEET_BASE.map(v => {
      switch (v.id) {
        case 'business-sedan':
          return {
            name: 'Mercedes-Benz E Serisi veya BMW 5',
            category: 'Business Class',
            description:
              'Mercedes Benz EQE 300, Mercedes Benz E 220d, BMW i5 eDrive40',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        case 'electric-sedan':
          return {
            name: 'Mercedes EQE Serisi veya BMW i5',
            category: 'Electric Class',
            description: 'Mercedes Benz EQE 300, BMW i5 eDrive40',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        case 'first-class-sedan':
          return {
            name: 'Mercedes-Benz S Serisi',
            category: 'First Class',
            description:
              'Mercedes Benz S 500 L 4MATIC, Mercedes Benz EQS 580 4MATIC, BMW i7 eDrive50',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        default:
          return {
            name: 'Mercedes-Benz V Serisi',
            category: 'Business Van',
            description: 'Mercedes Benz V Class',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
      }
    });

    const footer = [
      {
        title: 'Gezinme',
        links: [
          { label: 'Filo', href: '#fahrzeuge' },
          { label: 'Yorumlar', href: '#rezensionen' },
          { label: 'İletişim', href: '?contact' }
        ]
      },
      {
        title: 'Hizmetler',
        links: [
          { label: 'Kayıt ol', href: '/signup' },
          { label: 'Hemen rezervasyon', href: '?booking' },
          { label: 'Künye', href: 'https://limosen.at/tr/imprint' },
          { label: 'Gizlilik', href: 'https://limosen.at/tr/privacy' }
        ]
      },
      {
        title: 'İletişim',
        links: [
          {
            label: CONTACT_PHONE,
            href: `https://api.whatsapp.com/send?phone=${encodeURIComponent(
              CONTACT_PHONE
            )}`
          },
          { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
          { label: 'Bize yazın', href: '/?contact' }
        ]
      }
    ];

    return {
      code,
      strings,
      navLinks,
      services,
      faq,
      fleet,
      footer,
      media: {
        ABOUT_IMAGE,
        BOOKING_BACKGROUND,
        HERO_SLIDES,
        FLAG_DE,
        FLAG_EN,
        FLAG_TR,
        GOOGLE_MAPS_EMBED,
        GOOGLE_MAPS_OPEN,
        SOCIAL_LINKS
      }
    };
  }

  if (code === 'ar-EG') {
    const strings = {
      TopNavFleet: 'أسطول المركبات',
      TopNavReviews: 'المراجعات',
      TopNavBookNow: 'احجز الآن عبر الإنترنت',
      TopNavContact: 'تواصل معنا',
      TopNavFollowUs: 'تابعنا',
      TopNavAlwaysReachable: 'متاحون دائمًا',
      TopNavCityCountry: 'فيينا النمسا',
      TopNavAccount: 'الحساب',
      TopNavLanguage: 'اللغة',
      LangTooltipDE: 'Deutsch',
      LangTooltipEN: 'English',
      LangTooltipTR: 'Türkçe',
      LangTooltipAR: 'العربية',
      LangModalTitle: 'اختر اللغة',
      LanguageGerman: 'Deutsch',
      LanguageEnglish: 'English',
      LanguageTurkish: 'Türkçe',
      LanguageArabic: 'العربية',
      ServicesTitle: 'خدماتنا',
      ServicesSubtitle: 'احصل على لمحة سريعة ويمكنك عرض التفاصيل عند الحاجة.',
      MoreDetails: 'عرض التفاصيل',
      ServicesDetailsTitle: 'تفاصيل الخدمة',
      FaqTitle: 'الأسئلة الشائعة',
      FaqSubtitle: 'إجابات سريعة عن الحجز والمركبات والخدمة.',
      FleetTitle: 'أسطول المركبات',
      FleetPassengersLabel: 'ركاب:',
      FleetLuggageLabel: 'أمتعة:',
      BookingTitle: 'احجز اليوم وسنهتم براحتك في الرحلة.',
      BookingReachPhone: 'اتصل',
      BookingAnd: 'أو',
      BookingReachEmail: 'أرسل بريدًا إلكترونيًا',
      ContactCta: 'تواصل',
      FeedbackTitle: 'أرسل ملاحظتك',
      FeedbackSubtitle: 'شاهد تقييم Google المباشر على الخريطة.',
      FeedbackBoxTitle: 'تقييم Google',
      FeedbackBoxText:
        'افتح صفحة LIMOSEN VIP في خرائط Google لعرض النجوم والتعليقات أو لكتابة مراجعة.',
      FeedbackMapsCta: 'فتح في خرائط Google',
      AboutTitle: 'من نحن',
      AboutP1:
        'تقدم LIMOSEN KG خدمة على مدار الساعة طوال أيام الأسبوع منذ عام 2016 مع متابعة التطورات في القطاع والتقنية.',
      AboutP2:
        'ينمو أسطولنا باستمرار بسيارات مرسيدس بنز الحديثة ومع سائقين ودودين محترفين ذوي خبرة. نقدم خدمة موثوقة واقتصادية ومريحة ونرفع جودة الخدمة.',
      AboutP3:
        'رضا العملاء هو أولويتنا القصوى. رؤيتنا تقديم أعلى جودة عبر تنفيذ الوجهات في محفظتنا بأفضل صورة.',
      AboutImageAlt: 'من نحن',
      BookNowCta: 'احجز الآن',
      FooterTagline: 'خدمة سائق مميزة في فيينا والمناطق المحيطة.',
      FooterRights: 'جميع الحقوق محفوظة.'
    };

    const navLinks = [
      { label: 'الخدمات', href: '#services' },
      { label: 'الأسطول', href: '#fahrzeuge' },
      { label: 'المراجعات', href: '#rezensionen' },
      { label: 'إنشاء حساب', href: '/signup' },
      { label: 'اتصل بنا', href: '?contact' }
    ];

    const services = SERVICES_BASE.map(s => {
      switch (s.id) {
        case 'airport-transfer':
          return {
            id: s.id,
            title: 'نقل المطار',
            image: s.image,
            paragraphs: [
              'في مطار فيينا الدولي نقدم لكم الفخامة والراحة مع خدمة نقل احترافية. المركبات التي حجزتموها مسبقًا مجهزة خصيصًا ومع سائقينا ذوي الخبرة نكون بانتظاركم في المطار لتقديم الخدمة المطلوبة.',
              'يمكنكم تخصيص سيارة للوصول إلى وجهتكم من دون قيادة. نساعدكم على بدء الرحلة بنشاط ونخفف عنكم العناء عند العودة إلى المطار.'
            ]
          };
        case 'city-tour':
          return {
            id: s.id,
            title: 'خدمة سائق شخصية',
            image: s.image,
            paragraphs: [
              'قد يكون لديكم اجتماع في فيينا أو ترغبون في استضافة ضيف أو تحتاجون إلى تنقل مريح للعمل. في هذه الحالة تكون Mercedes Benz S Klasse First Class أو V Klasse Business Van أو E Klasse Business Class خيارًا مناسبًا. إن كنتم تبحثون عن الفخامة والراحة فأنتم في المكان الصحيح. نضمن أن يمر وقتكم في الحركة بسلاسة وأن تقل الحساسية للعوامل الخارجية.',
              'سائقونا يتحدثون لغات ويرتدون ملابس رسمية ويمكن إضافة مترجم عند الطلب. هذا يجعل رحلتكم أكثر راحة.',
              'نهتم بسلامتكم وسلامة أطفالكم. يمكننا إضافة مقعد أطفال داخل السيارة لكي تسافروا بأمان واطمئنان.',
              'يتم تنظيم النقل الخاص حسب مواعيد وصول الرحلات لذلك لا توجد فترات انتظار في المطارات. في نقاط الوصول يستقبلكم فريقنا ويوجهكم بسرعة إلى المركبات المخصصة.',
              'داخل مركبات مرسيدس بنز الخاصة تشعرون بالهدوء والأمان. رضا العملاء أساس عملنا ونحن سعداء بتلبية أي احتياج إضافي.'
            ]
          };
        case 'private-driver-service':
          return {
            id: s.id,
            title: 'جولة في المدينة',
            image: s.image,
            paragraphs: [
              'مع جولاتنا إلى جميع المعالم في النمسا تجمعون بين الرفاهية والراحة في مركبات مرسيدس بنز. عبر سائقينا المتمرسين تسافرون على مسارات محددة مسبقًا وتستكشفون الثقافة والتاريخ والطبيعة. كاتدرائية شتيفان وهفبورغ وشونبرون وكالنبرغ والمدينة القديمة في زالتسبورغ والممشى البحري وهالشتات وكهوف الجليد وشلال غوللينغ وغيرها.',
              'أثناء الجولة نختار مسارات عملية وآمنة وسهلة. نعمل باستمرار على التطوير لتقديم جودة أعلى.',
              'إلى جانب هذه المعايير الآمنة والمريحة تستفيدون من تجهيزات سيارات مرسيدس بنز الحديثة. يمكن إضافة مرشد لتحويل جولتك إلى تجربة أكثر إفادة وتميزًا.'
            ]
          };
        case 'corporate-services':
          return {
            id: s.id,
            title: 'خدمات الشركات',
            image: s.image,
            paragraphs: [
              'خبرتنا الطويلة تضمن أن كل تفاصيل الخدمة مخطط لها بعناية وأن معايير الجودة يتم تحديثها باستمرار.',
              'للاحتياجات الخاصة بنقل شركتكم يمكنكم الحصول على أسعار مناسبة مع تفاصيل الوجهات واستخدام حلول الباقات.',
              '• نقل الفعاليات',
              '• نقل الرحلات السياحية',
              '• نقل فرق الرياضة',
              '• نقل الافتتاحات والاحتفالات',
              '• تنقلات الشركات والهيئات',
              '• نقل المجموعات',
              '• نقل عروض الطريق',
              '• نقل المعارض',
              '• خيارات مركبات من فئات مختلفة',
              'كل حجز مؤكد هو وعد نقدمه لكم.'
            ]
          };
        case 'city-to-city':
          return {
            id: s.id,
            title: 'خدمة سائق شخصية',
            image: s.image,
            paragraphs: [
              'قد يكون لديكم اجتماع في فيينا أو ترغبون في ضيافة ضيف أو تحتاجون إلى وصول مريح للعمل. عندها تكون Mercedes Benz S Klasse First Class أو V Klasse Business Van أو E Klasse Business Class خيارًا مناسبًا. إذا كنتم تبحثون عن خدمة فاخرة ومريحة فأنتم في المكان الصحيح. نضمن مرور الوقت في الحركة بسلاسة ومن دون تأثر كبير بالعوامل الخارجية.',
              'سائقونا يتحدثون لغات ويرتدون ملابس رسمية ويمكن إضافة مترجم عند الطلب.',
              'نهتم بسلامة أطفالكم أيضًا ويمكننا توفير مقعد أطفال داخل السيارة.',
              'يتم تنظيم النقل الخاص حسب مواعيد وصول الرحلات لذلك لا انتظار في المطارات. عند الوصول يستقبلكم فريقنا ويقودكم بسرعة إلى المركبات.',
              'داخل مركبات مرسيدس بنز تشعرون بالطمأنينة. رضا العملاء هو الأساس وسنساعدكم في أي احتياج إضافي.'
            ]
          };
        case 'international':
          return {
            id: s.id,
            title: 'نقل دولي',
            image: s.image,
            paragraphs: [
              'بفضل موقعه يعد مطار فيينا نقطة وصل مركزية للرحلات الدولية في أوروبا.',
              'نستقبلكم عند الوصول ونعتني بحقائبكم حتى السيارة ونوفر النقل إلى أي وجهة ترغبون بها مثل براتيسلافا وبودابست وبراغ والبندقية وجميع الوجهات ضمن منطقة شنغن.',
              'سلامة العملاء عنصر أساسي لدينا. عبر أنظمة تتبع المركبات الحديثة تشعرون بالأمان حتى الوصول وتستمتعون بالرحلة.'
            ]
          };
        default:
          return {
            id: s.id,
            title: 'نقل بين الولايات',
            image: s.image,
            paragraphs: [
              'النمسا جمهورية اتحادية تضم تسع ولايات. فيينا النمسا السفلى النمسا العليا شتايرمارك تيرول كيرنتن زالتسبورغ فورآرلبيرغ بورغنلاند. إذا أردتم الوصول إلى وجهتكم بعد الهبوط من دون قيادة أو لم تلائمكم مواعيد النقل العام فنحن ننظم Fahrt آمنة إلى المكان الذي تختارونه.'
            ]
          };
      }
    });

    const faq = FAQ_BASE.map(f => {
      switch (f.id) {
        case 'general-classes':
          return {
            question: 'ما الفئات المتاحة للمركبات',
            answer:
              'نقدم Business و First Class. تعد E Klasse مناسبة وللمجموعات V Klasse وللمناسبات الخاصة S Klasse.'
          };
        case 'airport-flow':
          return {
            question: 'كيف يعمل نقل المطار',
            answer:
              'يستقبلك السائق ويحمل الأمتعة وينقلك مباشرة إلى وجهتك. تتوفر أيضًا رحلة العودة.'
          };
        case 'kids-multilingual':
          return {
            question: 'هل يوجد مقعد أطفال أو سائقون متعددو اللغات',
            answer:
              'نوفر مقعد أطفال عند الطلب. سائقونا يرتدون ملابس رسمية ويمكنهم التحدث بلغات مختلفة. يمكن إضافة مترجم.'
          };
        default:
          return {
            question: 'هل تقدمون نقلًا دوليًا',
            answer:
              'نعم. براتيسلافا وبودابست وبراغ والبندقية مسارات شائعة. نوفر التتبع والخدمة الشخصية.'
          };
      }
    });

    const fleet = FLEET_BASE.map(v => {
      switch (v.id) {
        case 'business-sedan':
          return {
            name: 'Mercedes Benz E Klasse أو BMW 5',
            category: 'درجة الأعمال',
            description:
              'Mercedes Benz EQE 300, Mercedes Benz E 220d, BMW i5 eDrive40',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        case 'electric-sedan':
          return {
            name: 'Mercedes EQE Klasse أو BMW i5',
            category: 'الفئة الكهربائية',
            description: 'Mercedes Benz EQE 300, BMW i5 eDrive40',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        case 'first-class-sedan':
          return {
            name: 'Mercedes Benz S Klasse',
            category: 'الدرجة الأولى',
            description:
              'Mercedes Benz S 500 L 4MATIC, Mercedes Benz EQS 580 4MATIC, BMW i7 eDrive50',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
        default:
          return {
            name: 'Mercedes Benz V Klasse',
            category: 'فان الأعمال',
            description: 'Mercedes Benz V Class',
            image: v.image,
            passengers: v.passengers,
            luggage: v.luggage
          };
      }
    });

    const footer = [
      {
        title: 'التنقل',
        links: [
          { label: 'الأسطول', href: '#fahrzeuge' },
          { label: 'المراجعات', href: '#rezensionen' },
          { label: 'اتصل بنا', href: '?contact' }
        ]
      },
      {
        title: 'الخدمات',
        links: [
          { label: 'إنشاء حساب', href: '/signup' },
          { label: 'احجز الآن', href: '?booking' },
          {
            label: 'بيانات الناشر',
            href: 'https://limosen.at/ar/imprint'
          },
          { label: 'الخصوصية', href: 'https://limosen.at/ar/privacy' }
        ]
      },
      {
        title: 'التواصل',
        links: [
          {
            label: CONTACT_PHONE,
            href: `https://api.whatsapp.com/send?phone=${encodeURIComponent(
              CONTACT_PHONE
            )}`
          },
          { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
          { label: 'اكتب لنا', href: '/?contact' }
        ]
      }
    ];

    return {
      code,
      strings,
      navLinks,
      services,
      faq,
      fleet,
      footer,
      media: {
        ABOUT_IMAGE,
        BOOKING_BACKGROUND,
        HERO_SLIDES,
        FLAG_DE,
        FLAG_EN,
        FLAG_TR,
        GOOGLE_MAPS_EMBED,
        GOOGLE_MAPS_OPEN,
        SOCIAL_LINKS
      }
    };
  }

  const strings = {
    TopNavFleet: 'Fleet',
    TopNavReviews: 'Reviews',
    TopNavBookNow: 'Book online',
    TopNavContact: 'Contact',
    TopNavFollowUs: 'Follow us',
    TopNavAlwaysReachable: 'Always reachable',
    TopNavCityCountry: 'Vienna, Austria',
    TopNavAccount: 'Account',
    TopNavLanguage: 'Language',
    LangTooltipDE: 'Deutsch',
    LangTooltipEN: 'English',
    LangTooltipTR: 'Türkçe',
    LangTooltipAR: 'العربية',
    LangModalTitle: 'Choose language',
    LanguageGerman: 'Deutsch',
    LanguageEnglish: 'English',
    LanguageTurkish: 'Türkçe',
    LanguageArabic: 'العربية',
    ServicesTitle: 'Our services',
    ServicesSubtitle: 'Get a quick overview. See details if you like.',
    MoreDetails: 'View details',
    ServicesDetailsTitle: 'Service details',
    FaqTitle: 'Frequently asked questions',
    FaqSubtitle: 'Short answers about booking, vehicles and service.',
    FleetTitle: 'Our fleet',
    FleetPassengersLabel: 'Passengers:',
    FleetLuggageLabel: 'Luggage:',
    BookingTitle: 'Book today and let us take care of your comfort.',
    BookingReachPhone: 'Call',
    BookingAnd: 'or',
    BookingReachEmail: 'send an email',
    ContactCta: 'Contact',
    FeedbackTitle: 'Leave feedback',
    FeedbackSubtitle: 'See your live Google rating on the map.',
    FeedbackBoxTitle: 'Google rating',
    FeedbackBoxText:
      'Open LIMOSEN VIP on Google Maps to view stars and comments or to write a review.',
    FeedbackMapsCta: 'Open in Google Maps',
    AboutTitle: 'About us',
    AboutP1:
      'Since 2016 LIMOSEN KG has provided service 24 hours a day all year while following developments in the industry and technology.',
    AboutP2:
      'Our fleet grows steadily with modern Mercedes Benz vehicles and friendly professional experienced drivers. We work reliably economically and with comfort in mind and keep improving service quality.',
    AboutP3:
      'Customer satisfaction is our top priority. Our vision is to serve the destinations in our portfolio in the best way and deliver the highest quality.',
    AboutImageAlt: 'About us',
    BookNowCta: 'Reserve now',
    FooterTagline: 'Premium chauffeur service in Vienna and surroundings.',
    FooterRights: 'All rights reserved.'
  };

  const navLinks = [
    { label: 'Services', href: '#services' },
    { label: 'Fleet', href: '#fahrzeuge' },
    { label: 'Reviews', href: '#rezensionen' },
    { label: 'Sign up', href: '/signup' },
    { label: 'Contact', href: '?contact' }
  ];

  const services = SERVICES_BASE.map(s => {
    switch (s.id) {
      case 'airport-transfer':
        return {
          id: s.id,
          title: 'Airport transfer',
          image: s.image,
          paragraphs: [
            'At Vienna International Airport we bring luxury and comfort to you with the most professional transfer service in the city. The vehicles you pre booked are specially configured and our experienced drivers wait for you at the airport to deliver the service you requested.',
            'You can have a vehicle allocated to reach your destination without driving yourself. We help you start your trip rested and energized and we take the stress off when you head back to the airport.'
          ]
        };
      case 'city-tour':
        return {
          id: s.id,
          title: 'Personalized chauffeur service',
          image: s.image,
          paragraphs: [
            'You may have a meeting in Vienna want to host a guest or simply need comfortable mobility for your work. In that case a Mercedes Benz S Klasse First Class V Klasse Business Van or E Klasse Business Class can be the right choice. If you are looking for luxury and comfort you are in the right place. We make sure your time in traffic flows smoothly and you are less exposed to external factors.',
            'In addition our drivers speak languages and wear formal attire. An interpreter can be added on request. This makes your journey even more comfortable.',
            'We care about your safety and also the safety of your children. We can add a child seat in the car so you can travel safely without worries.',
            'Private transfers are organized according to flight arrival times so there is no waiting time at the airport. At the destination our staff greet you and guide you quickly to the allocated vehicles.',
            'Inside our Mercedes Benz VIP vehicles you will feel calm and safe. Customer satisfaction is central and we are happy to help with any extra needs.'
          ]
        };
      case 'private-driver-service':
        return {
          id: s.id,
          title: 'City tour',
          image: s.image,
          paragraphs: [
            'On our tours to all sights across Austria you enjoy luxury and comfort in Mercedes Benz vehicles. With our skilled drivers you travel on predefined routes and discover culture history and nature. Stephansdom Hofburg Schönbrunn Kahlenberg Salzburg old town lakeside promenade Hallstatt ice caves Gollinger waterfall and more.',
            'During your tour we select practical safe and easy routes. Our company keeps improving to deliver higher quality.',
            'While you enjoy safe and comfortable standards you also benefit from the high level features of our modern Mercedes Benz vehicles. If you like we can add a guide for deeper insights and a more personal experience.'
          ]
        };
      case 'corporate-services':
        return {
          id: s.id,
          title: 'Corporate services',
          image: s.image,
          paragraphs: [
            'Our long standing experience ensures that every detail of our service is carefully planned and that quality standards are updated continuously.',
            'For your company transfers you can get suitable rates with destination details and use our package solutions.',
            '• Organization transfers',
            '• Tourist excursion transfers',
            '• Sports team transfers',
            '• Opening and celebration transfers',
            '• Company and association rides',
            '• Group transfers',
            '• Roadshow transfers',
            '• Trade fair transfer',
            '• Vehicle options across segments',
            'Every confirmed reservation is a promise we keep.'
          ]
        };
      case 'city-to-city':
        return {
          id: s.id,
          title: 'Personalized chauffeur service',
          image: s.image,
          paragraphs: [
            'You may have a meeting in Vienna want to show a guest around or need comfortable access for your work. Then a Mercedes Benz S Klasse First Class V Klasse Business Van or E Klasse Business Class can be ideal. If you seek a luxurious and comfortable service you are in the right place. We guarantee that your time in traffic passes smoothly and you are not tied to external conditions.',
            'Our drivers speak languages and wear formal attire. On request we can add an interpreter.',
            'We also care about your children. We can provide a child seat in the car.',
            'Private transfers are organized based on flight arrivals so there is no waiting time at airports. On arrival our staff will greet you and guide you quickly to the vehicles.',
            'Inside our Mercedes Benz VIP cars you will feel secure. Customer satisfaction comes first and we gladly help with any extra needs.'
          ]
        };
      case 'international':
        return {
          id: s.id,
          title: 'International transfer',
          image: s.image,
          paragraphs: [
            'Thanks to its location Vienna Airport is a central hub for international connections in Europe.',
            'As an airport transfer service we welcome you handle your luggage to the car and provide transport to any destination such as Bratislava Budapest Prague Venice and all within the Schengen area.',
            'Customer safety is paramount. With our modern vehicle tracking systems you feel safe until arrival and can enjoy the journey.'
          ]
        };
      default:
        return {
          id: s.id,
          title: 'Interstate transfer',
          image: s.image,
          paragraphs: [
            'Austria is a federal republic of nine states. Vienna Lower Austria Upper Austria Styria Tyrol Carinthia Salzburg Vorarlberg Burgenland. If you want to reach your destination after landing without driving or public transport times do not fit we organize a safe ride to your chosen point.'
          ]
        };
    }
  });

  const faq = FAQ_BASE.map(f => {
    switch (f.id) {
      case 'general-classes':
        return {
          question: 'Which vehicle classes are available',
          answer:
            'We offer Business and First Class. E Klasse fits many trips V Klasse is great for groups and S Klasse suits special occasions.'
        };
      case 'airport-flow':
        return {
          question: 'How does the airport transfer work',
          answer:
            'Your driver greets you carries the luggage and takes you directly to your destination. A return transfer is possible.'
        };
      case 'kids-multilingual':
        return {
          question: 'Do you provide a child seat or multilingual drivers',
          answer:
            'On request we provide a child seat. Our drivers wear formal attire and can speak different languages. An interpreter can be added.'
        };
      default:
        return {
          question: 'Do you offer international transfers',
          answer:
            'Yes. Bratislava Budapest Prague and Venice are popular routes. We provide tracking and personal service.'
        };
    }
  });

  const fleet = FLEET_BASE.map(v => {
    switch (v.id) {
      case 'business-sedan':
        return {
          name: 'Mercedes Benz E Class or BMW 5',
          category: 'Business Class',
          description:
            'Mercedes Benz EQE 300, Mercedes Benz E 220d, BMW i5 eDrive40',
          image: v.image,
          passengers: v.passengers,
          luggage: v.luggage
        };
      case 'electric-sedan':
        return {
          name: 'Mercedes EQE Class or BMW i5',
          category: 'Electric Class',
          description: 'Mercedes Benz EQE 300, BMW i5 eDrive40',
          image: v.image,
          passengers: v.passengers,
          luggage: v.luggage
        };
      case 'first-class-sedan':
        return {
          name: 'Mercedes Benz S Class',
          category: 'First Class',
          description:
            'Mercedes Benz S 500 L 4MATIC, Mercedes Benz EQS 580 4MATIC, BMW i7 eDrive50',
          image: v.image,
          passengers: v.passengers,
          luggage: v.luggage
        };
      default:
        return {
          name: 'Mercedes Benz V Class',
          category: 'Business Van',
          description: 'Mercedes Benz V Class',
          image: v.image,
          passengers: v.passengers,
          luggage: v.luggage
        };
    }
  });

  const footer = [
    {
      title: 'Navigation',
      links: [
        { label: 'Fleet', href: '#fahrzeuge' },
        { label: 'Reviews', href: '#rezensionen' },
        { label: 'Contact', href: '?contact' }
      ]
    },
    {
      title: 'Services',
      links: [
        { label: 'Sign up', href: '/signup' },
        { label: 'Book now', href: '?booking' },
        { label: 'Imprint', href: 'https://limosen.at/imprint' },
        { label: 'Privacy', href: 'https://limosen.at/privacy' }
      ]
    },
    {
      title: 'Contact',
      links: [
        {
          label: CONTACT_PHONE,
          href: `https://api.whatsapp.com/send?phone=${encodeURIComponent(
            CONTACT_PHONE
          )}`
        },
        { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
        { label: 'Write to us', href: '/?contact' }
      ]
    }
  ];

  return {
    code,
    strings,
    navLinks,
    services,
    faq,
    fleet,
    footer,
    media: {
      ABOUT_IMAGE,
      BOOKING_BACKGROUND,
      HERO_SLIDES,
      FLAG_DE,
      FLAG_EN,
      FLAG_TR,
      GOOGLE_MAPS_EMBED,
      GOOGLE_MAPS_OPEN,
      SOCIAL_LINKS
    }
  };
}
