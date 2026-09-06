/**
 * The words of the glass tab bar: the card with its switch on the Me page,
 * and the name the bar gives itself to a screen reader. See
 * okf/architecture/navigation.md, "A bottom bar again, only if it feels
 * native".
 *
 * German is the product language and the other three are typed against it,
 * the way i18nOffline does it. The entries themselves carry no strings here,
 * they are the drawers' entries and read their labels from the common
 * catalogue.
 */
import type {I18nCode} from '../i18n'

const de = {
  /** The card's title on the Me page, the decided name of the switch. */
  Heading: 'Untere Leiste',
  Body: 'Eine Leiste am unteren Rand mit deinen Seiten, wie in einer App. Die Menüs oben bleiben, wie sie sind. Gilt nur auf diesem Gerät.',
  Switch: 'Untere Leiste anzeigen',
  /** The accessible name of the bar. */
  NavLabel: 'Navigation'
}

export type TabBarStrings = typeof de

const en: TabBarStrings = {
  Heading: 'Bottom bar',
  Body: 'A bar along the bottom with your pages, the way an app has one. The menus at the top stay as they are. Applies to this device only.',
  Switch: 'Show the bottom bar',
  NavLabel: 'Navigation'
}

const tr: TabBarStrings = {
  Heading: 'Alt çubuk',
  Body: 'Sayfalarının bulunduğu, bir uygulamadaki gibi alt kenarda bir çubuk. Üstteki menüler olduğu gibi kalır. Yalnızca bu cihaz için geçerlidir.',
  Switch: 'Alt çubuğu göster',
  NavLabel: 'Gezinme'
}

const ar: TabBarStrings = {
  Heading: 'الشريط السفلي',
  Body: 'شريط في أسفل الشاشة يحتوي على صفحاتك، كما في التطبيقات. تبقى القوائم في الأعلى كما هي. ينطبق على هذا الجهاز فقط.',
  Switch: 'إظهار الشريط السفلي',
  NavLabel: 'التنقل'
}

export function getI18nTabBar(code: I18nCode): {code: I18nCode; strings: TabBarStrings} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}
