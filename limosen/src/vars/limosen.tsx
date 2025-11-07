// src/vars/limosen.tsx
import { FaFacebookF, FaInstagram, FaTwitter } from 'react-icons/fa'

export const CONTACT_EMAIL = 'office@limosen.at'
export const CONTACT_PHONE = '+43 660 876 06 06'
export const CONTACT_PHONE_TEL = '+436608760606'

export const LOGO_SRC = '/images/everything/logo.png'
export const FLAG_DE = '/images/everything/flag-de.png'
export const FLAG_EN = '/images/everything/flag-en.png'
export const FLAG_TR = '/images/everything/flag-tr.png'
export const FLAG_AR = '/images/everything/flag-ar.png'
export const ABOUT_IMAGE = '/images/everything/about-cars.jpg'
export const BOOKING_BACKGROUND = '/images/everything/booking-background.jpg'

export const SERVICE_NAVIGATION_EVENT = 'service-accordion:navigate'

export const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/limosenvip', icon: FaInstagram },
]

export const HERO_SLIDES = [
  '/images/everything/hero-beauty-of-vienna.jpg',
  '/images/everything/hero-whatsapp-1.jpeg',
  '/images/everything/hero-whatsapp-2.jpeg',
  '/images/everything/hero-whatsapp-3.jpeg',
  '/images/everything/hero-vienna-cityscape.jpg',
  '/images/everything/hero-whatsapp-4.jpeg',
  '/images/everything/hero-hofburg-night.jpg'
]

export const GOOGLE_MAPS_EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2663.3171060027275!2d16.598009087180113!3d48.12340777800851!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x476dabef40d859e9%3A0xb5eea86a2f486dc5!2sLIMOSEN%20VIP!5e0!3m2!1sen!2sat!4v1758710306571!5m2!1sen!2sat'

export const GOOGLE_MAPS_OPEN =
  'https://www.google.com/maps/place/LIMOSEN+VIP/@48.1234078,16.5980091,17z/data=!4m6!3m5!1s0x476dabef40d859e9:0xb5eea86a2f486dc5!8m2!3d48.1234043!4d16.60288!16s%2Fg%2F11n0g64y7s?authuser=0&entry=tts&g_ep=EgoyMDI1MDkyMS4wIPu8ASoASAFQAw%3D%3D&skid=df28c45c-0b42-446f-90b0-1bd0e46ed3c5'

/** BASE (language-neutral) — IDs are English only */
export const FLEET_BASE = [
  {
    id: 'business-sedan',
    image:
      'https://media.oneweb.mercedes-benz.com/images/dynamic/europe/AT/214003/806/iris.png?q=COSY-EU-100-1713d0VXqaWeqtyO67PobzIr3eWsrrCsdRRzwQZQ9vZbMw3SGtxmFtsd2HdcUfpAfXGEjamJ0lVHxOB2sW2bApvAVI5uLe2QC3bsOkzN4tkm7jgcFhKVPbQ%25vqAtayLR53VYaxCkYrH1znOn8w7XxoiZeIQM6oY2ul6zkzNetDm7jCeShKVf2c%25vqLUayLRaGXYaxH5xrH18Idn8520R%256d9lo24YaIl1wOoZ1qgqyfyzda8CD7dB3AF6h0HJ&BKGND=9&IMGT=P27&cp=U7lLKRUtPa6KAFr8s_ubHw&uni=m&POV=BE030',
    passengers: 4,
    luggage: 3
  },
  {
    id: 'electric-sedan',
    image:
      'https://media.oneweb.mercedes-benz.com/images/dynamic/europe/AT/295111/806/iris.png?q=COSY-EU-100-1713d0VXqaSFqtyO67PobzIr3eWsrrCsdRRzwQZQ9vZbMw3SGtle9tsd2HVcUfpAfXGEu5YJ0lVYrOB2q8%25bApRTyI5uGfuQC3aCRkzNHoNm7jQGIhKVPbQ%25vqe6kyLR5cHYaxCNqrH1zntn8w7PcoiZKJ1M4FsmJTg9Ukm6tTnuNptKhKVHtc%25YhD3Lyr%254u6Yax5bSrH1ACmn8wuaRoiZ4iYM4FgCrTg735wrcldu63eSAeIl9Q6DF1s1n2nvligKfLlCVzWcY54I&BKGND=9&IMGT=P27&cp=U7lLKRUtPa6KAFr8s_ubHw&uni=m&POV=BE030',
    passengers: 4,
    luggage: 3
  },
  {
    id: 'first-class-sedan',
    image:
      'https://media.oneweb.mercedes-benz.com/images/dynamic/europe/AT/223121/806/iris.png?q=COSY-EU-100-1713d0VXq0WFqtyO67PobzIr3eWsrrCsdRRzwQZgk4ZbMw3SGtle9tsd2HtcUfpOyXGEuTRJ0l3OtOB2q8%25bApRiwI5ux6YQC30s7kzNHzxm7j8hfhKVPsL%25vqeUDyLRsQmYaxCX8rH1zjRn8w7hnoiZK%25ZM4FvTJTg9L6n6PDaSmSeWH0Itsd8BGcUfimWXGEWbSJ0ldoVOB2zBObAp7oMIkbX1ZxkgTg9vQn6PDK%25jSeWgyStsdRGKcUfGUyXGE0aRJ0lBHAOB2A8nbAp5PwI5uC6xQCPFi2J%25xVZkF7oZ7Ix3MkNulKlO1OsxACeqUx4Wgj%25Xi5o&BKGND=9&IMGT=P27&cp=U7lLKRUtPa6KAFr8s_ubHw&uni=m&POV=BE030',
    passengers: 3,
    luggage: 2
  },
  {
    id: 'business-van',
    image: '',
    passengers: 6,
    luggage: 6
  }
]

export const SERVICES_BASE = [
  { id: 'airport-transfer', image: '/images/everything/service-airport-transfer.jpg' },
  { id: 'city-tour', image: '/images/everything/service-driver.jpg' },
  { id: 'private-driver-service', image: '/images/everything/service-limousine.jpg' },
  { id: 'corporate-services', image: null },
  { id: 'city-to-city', image: null },
  { id: 'international', image: null },
  { id: 'across-federal-states', image: null }
]

export const FAQ_BASE = [
  { id: 'general-classes' },
  { id: 'airport-flow' },
  { id: 'kids-multilingual' },
  { id: 'international' }
]
