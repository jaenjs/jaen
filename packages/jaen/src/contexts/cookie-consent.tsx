import {useColorMode} from '../hooks/use-color-mode'
import {
  CONSENT_CATEGORIES,
  diffCategories,
  eraseCookies,
  hasValidConsent,
  isConsentValid,
  NECESSARY_CATEGORY,
  readAllowedCategories,
  readConsentCookie,
  resolveAcceptedCategories,
  writeConsent
} from '../utils/consent-cookie'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

// vanilla-cookieconsent is no longer imported at the top of the module: the
// first layer of the banner is the React component below, and pulling the
// plugin into the main bundle would put its 18 kB and its DOM work back on the
// critical path that this whole arrangement exists to clear. It is imported
// dynamically in loadCookieConsentPlugin, which is also what keeps its ambient
// `declare global` types (CookieConsent, UserConfig, SavedCookieContent) in
// this program.

/**
 * Event dispatched on `window` whenever the visitor accepts the banner for
 * the first time or changes their categories later on.
 *
 * The context value is the plugin instance and its identity never changes,
 * so a consumer that only reads `allowedCategory` inside an effect keyed on
 * the context never learns about a consent change. The event is the missing
 * signal; it also crosses component trees, which matters because the plugin
 * renders its own modals outside of React.
 *
 * Consumers should not need this constant: `useCookieConsentCategory` wraps
 * both the event and the read.
 */
export const COOKIE_CONSENT_CHANGE_EVENT = 'jaen:cookie-consent-change'

export interface CookieConsentChangeDetail {
  /** Categories the visitor allows after the change. */
  categories: string[]
  /** Categories whose value flipped, empty on the first acceptance. */
  changedCategories: string[]
}

/**
 * Language the plugin falls back to when the page locale has no
 * translation of its own.
 */
const FALLBACK_LANGUAGE = 'en'

const analyticsCookieTable = (
  settings: {useGoogleAnalytics?: boolean} | undefined,
  labels: {twoYears: string; oneDay: string; description: string}
): Array<Record<string, string | boolean>> => {
  if (!settings?.useGoogleAnalytics) return []

  return [
    {
      col1: '^_ga', // Google Analytics cookies
      col2: 'google.com',
      col3: labels.twoYears,
      col4: labels.description,
      is_regex: true
    },
    {
      col1: '_gid',
      col2: 'google.com',
      col3: labels.oneDay,
      col4: labels.description
    }
  ]
}

/**
 * The banner copy per language. Every language carries the same blocks in
 * the same order, including the `data-cc="c-settings"` button that opens
 * the settings modal and the links of the closing block.
 */
const buildLanguages = (settings?: {
  useGoogleAnalytics?: boolean
}): Record<string, LanguageSetting> => ({
  en: {
    consent_modal: {
      title: 'We use cookies!',
      description:
        'Hi, this website uses essential cookies to ensure its proper operation and tracking cookies to understand how you interact with it. The latter will be set only after consent. <button type="button" data-cc="c-settings" class="cc-link">Let me choose</button>',
      primary_btn: {
        text: 'Accept all',
        role: 'accept_all'
      },
      secondary_btn: {
        text: 'Reject all',
        role: 'accept_necessary'
      }
    },
    settings_modal: {
      title: 'Cookie Settings',
      save_settings_btn: 'Save settings',
      accept_all_btn: 'Accept all',
      reject_all_btn: 'Reject all',
      close_btn_label: 'Close',
      cookie_table_headers: [
        {col1: 'Name'},
        {col2: 'Domain'},
        {col3: 'Expiration'},
        {col4: 'Description'}
      ],
      blocks: [
        {
          title: 'Cookie usage 📢',
          description:
            'I use cookies to ensure the basic functionalities of the website and to enhance your online experience. You can choose for each category to opt-in/out whenever you want. For more details relative to cookies and other sensitive data, please read the full <a href="#" class="cc-link">privacy policy</a>.'
        },
        {
          title: 'Strictly necessary cookies',
          description:
            'These cookies are essential for the proper functioning of my website. Without these cookies, the website would not work properly',
          toggle: {
            value: 'necessary',
            enabled: true,
            readonly: true // cookie categories with readonly=true are all treated as "necessary cookies"
          }
        },
        {
          title: 'Performance and Analytics cookies',
          description:
            'These cookies allow the website to remember the choices you have made in the past',
          toggle: {
            value: 'analytics', // your cookie category
            enabled: false,
            readonly: false
          },
          cookie_table: analyticsCookieTable(settings, {
            twoYears: '2 years',
            oneDay: '1 day',
            description:
              'Used to distinguish users in Google Analytics. This cookie helps us understand how visitors interact with our website.'
          })
        },
        {
          title: 'Advertisement and Targeting cookies',
          description:
            'These cookies collect information about how you use the website, which pages you visited and which links you clicked on. All of the data is anonymized and cannot be used to identify you',
          toggle: {
            value: 'targeting',
            enabled: false,
            readonly: false
          }
        },
        {
          title: 'More information',
          description:
            'For any queries in relation to our policy on cookies and your choices, please <a class="cc-link" href="/contakt">contact us</a>.'
        }
      ]
    }
  },
  de: {
    consent_modal: {
      title: 'Wir verwenden Cookies!',
      description:
        'Hallo, diese Website verwendet notwendige Cookies für ihren ordnungsgemäßen Betrieb und Tracking-Cookies, um zu verstehen, wie Sie mit ihr umgehen. Letztere werden erst nach Ihrer Zustimmung gesetzt. <button type="button" data-cc="c-settings" class="cc-link">Selbst auswählen</button>',
      primary_btn: {
        text: 'Alle akzeptieren',
        role: 'accept_all'
      },
      secondary_btn: {
        text: 'Alle ablehnen',
        role: 'accept_necessary'
      }
    },
    settings_modal: {
      title: 'Cookie-Einstellungen',
      save_settings_btn: 'Einstellungen speichern',
      accept_all_btn: 'Alle akzeptieren',
      reject_all_btn: 'Alle ablehnen',
      close_btn_label: 'Schließen',
      cookie_table_headers: [
        {col1: 'Name'},
        {col2: 'Domain'},
        {col3: 'Ablauf'},
        {col4: 'Beschreibung'}
      ],
      blocks: [
        {
          title: 'Verwendung von Cookies 📢',
          description:
            'Wir verwenden Cookies, um die grundlegenden Funktionen der Website sicherzustellen und Ihr Online-Erlebnis zu verbessern. Für jede Kategorie können Sie sich jederzeit dafür oder dagegen entscheiden. Weitere Einzelheiten zu Cookies und anderen sensiblen Daten finden Sie in der vollständigen <a href="#" class="cc-link">Datenschutzerklärung</a>.'
        },
        {
          title: 'Unbedingt erforderliche Cookies',
          description:
            'Diese Cookies sind für den ordnungsgemäßen Betrieb unserer Website unerlässlich. Ohne diese Cookies würde die Website nicht richtig funktionieren',
          toggle: {
            value: 'necessary',
            enabled: true,
            readonly: true
          }
        },
        {
          title: 'Cookies für Leistung und Analyse',
          description:
            'Diese Cookies ermöglichen es der Website, sich an Ihre früheren Entscheidungen zu erinnern',
          toggle: {
            value: 'analytics',
            enabled: false,
            readonly: false
          },
          cookie_table: analyticsCookieTable(settings, {
            twoYears: '2 Jahre',
            oneDay: '1 Tag',
            description:
              'Dient dazu, Nutzer in Google Analytics zu unterscheiden. Dieses Cookie hilft uns zu verstehen, wie Besucher mit unserer Website umgehen.'
          })
        },
        {
          title: 'Cookies für Werbung und Targeting',
          description:
            'Diese Cookies erfassen Informationen darüber, wie Sie die Website nutzen, welche Seiten Sie besucht und welche Links Sie angeklickt haben. Alle Daten werden anonymisiert und können nicht zu Ihrer Identifizierung verwendet werden',
          toggle: {
            value: 'targeting',
            enabled: false,
            readonly: false
          }
        },
        {
          title: 'Weitere Informationen',
          description:
            'Bei Fragen zu unserer Cookie-Richtlinie und zu Ihren Auswahlmöglichkeiten <a class="cc-link" href="/contakt">kontaktieren Sie uns bitte</a>.'
        }
      ]
    }
  },
  sl: {
    consent_modal: {
      title: 'Uporabljamo piškotke!',
      description:
        'Pozdravljeni, to spletno mesto uporablja nujne piškotke za pravilno delovanje in piškotke za sledenje, da razumemo, kako ga uporabljate. Slednji se nastavijo šele po vaši privolitvi. <button type="button" data-cc="c-settings" class="cc-link">Želim izbrati sam</button>',
      primary_btn: {
        text: 'Sprejmi vse',
        role: 'accept_all'
      },
      secondary_btn: {
        text: 'Zavrni vse',
        role: 'accept_necessary'
      }
    },
    settings_modal: {
      title: 'Nastavitve piškotkov',
      save_settings_btn: 'Shrani nastavitve',
      accept_all_btn: 'Sprejmi vse',
      reject_all_btn: 'Zavrni vse',
      close_btn_label: 'Zapri',
      cookie_table_headers: [
        {col1: 'Ime'},
        {col2: 'Domena'},
        {col3: 'Veljavnost'},
        {col4: 'Opis'}
      ],
      blocks: [
        {
          title: 'Uporaba piškotkov 📢',
          description:
            'Piškotke uporabljamo za zagotavljanje osnovnih funkcij spletnega mesta in za izboljšanje vaše spletne izkušnje. Za vsako kategorijo se lahko kadar koli odločite za privolitev ali zavrnitev. Več podrobnosti o piškotkih in drugih občutljivih podatkih najdete v celotni <a href="#" class="cc-link">izjavi o varstvu podatkov</a>.'
        },
        {
          title: 'Nujno potrebni piškotki',
          description:
            'Ti piškotki so nujni za pravilno delovanje našega spletnega mesta. Brez teh piškotkov spletno mesto ne bi delovalo pravilno',
          toggle: {
            value: 'necessary',
            enabled: true,
            readonly: true
          }
        },
        {
          title: 'Piškotki za zmogljivost in analitiko',
          description:
            'Ti piškotki spletnemu mestu omogočajo, da si zapomni vaše pretekle izbire',
          toggle: {
            value: 'analytics',
            enabled: false,
            readonly: false
          },
          cookie_table: analyticsCookieTable(settings, {
            twoYears: '2 leti',
            oneDay: '1 dan',
            description:
              'Uporablja se za razlikovanje uporabnikov v storitvi Google Analytics. Ta piškotek nam pomaga razumeti, kako obiskovalci uporabljajo naše spletno mesto.'
          })
        },
        {
          title: 'Piškotki za oglaševanje in ciljanje',
          description:
            'Ti piškotki zbirajo informacije o tem, kako uporabljate spletno mesto, katere strani ste obiskali in na katere povezave ste kliknili. Vsi podatki so anonimizirani in vas z njimi ni mogoče identificirati',
          toggle: {
            value: 'targeting',
            enabled: false,
            readonly: false
          }
        },
        {
          title: 'Več informacij',
          description:
            'Za vsa vprašanja o naši politiki piškotkov in o vaših izbirah nas <a class="cc-link" href="/contakt">kontaktirajte</a>.'
        }
      ]
    }
  },
  it: {
    consent_modal: {
      title: 'Utilizziamo i cookie!',
      description:
        'Ciao, questo sito web utilizza cookie essenziali per il suo corretto funzionamento e cookie di tracciamento per capire come interagite con esso. Questi ultimi vengono impostati solo dopo il vostro consenso. <button type="button" data-cc="c-settings" class="cc-link">Scelgo io</button>',
      primary_btn: {
        text: 'Accetta tutti',
        role: 'accept_all'
      },
      secondary_btn: {
        text: 'Rifiuta tutti',
        role: 'accept_necessary'
      }
    },
    settings_modal: {
      title: 'Impostazioni dei cookie',
      save_settings_btn: 'Salva le impostazioni',
      accept_all_btn: 'Accetta tutti',
      reject_all_btn: 'Rifiuta tutti',
      close_btn_label: 'Chiudi',
      cookie_table_headers: [
        {col1: 'Nome'},
        {col2: 'Dominio'},
        {col3: 'Scadenza'},
        {col4: 'Descrizione'}
      ],
      blocks: [
        {
          title: 'Utilizzo dei cookie 📢',
          description:
            'Utilizziamo i cookie per garantire le funzionalità di base del sito web e per migliorare la vostra esperienza online. Per ogni categoria potete scegliere in qualsiasi momento se attivarla o disattivarla. Per maggiori dettagli sui cookie e sugli altri dati sensibili consultate l\'<a href="#" class="cc-link">informativa sulla privacy</a> completa.'
        },
        {
          title: 'Cookie strettamente necessari',
          description:
            'Questi cookie sono essenziali per il corretto funzionamento del nostro sito web. Senza questi cookie il sito non funzionerebbe correttamente',
          toggle: {
            value: 'necessary',
            enabled: true,
            readonly: true
          }
        },
        {
          title: 'Cookie di prestazione e analisi',
          description:
            'Questi cookie consentono al sito web di ricordare le scelte che avete fatto in passato',
          toggle: {
            value: 'analytics',
            enabled: false,
            readonly: false
          },
          cookie_table: analyticsCookieTable(settings, {
            twoYears: '2 anni',
            oneDay: '1 giorno',
            description:
              'Utilizzato per distinguere gli utenti in Google Analytics. Questo cookie ci aiuta a capire come i visitatori interagiscono con il nostro sito web.'
          })
        },
        {
          title: 'Cookie di pubblicità e targeting',
          description:
            'Questi cookie raccolgono informazioni su come utilizzate il sito web, quali pagine avete visitato e su quali link avete fatto clic. Tutti i dati sono anonimizzati e non possono essere utilizzati per identificarvi',
          toggle: {
            value: 'targeting',
            enabled: false,
            readonly: false
          }
        },
        {
          title: 'Maggiori informazioni',
          description:
            'Per qualsiasi domanda sulla nostra politica dei cookie e sulle vostre scelte <a class="cc-link" href="/contakt">contattateci</a>.'
        }
      ]
    }
  },
  ja: {
    consent_modal: {
      title: 'Cookie を使用しています',
      description:
        '当ウェブサイトでは、正常な動作に必要な Cookie と、ご利用状況を把握するためのトラッキング Cookie を使用しています。後者はお客様の同意をいただいた後にのみ設定されます。<button type="button" data-cc="c-settings" class="cc-link">個別に選択する</button>',
      primary_btn: {
        text: 'すべて許可',
        role: 'accept_all'
      },
      secondary_btn: {
        text: 'すべて拒否',
        role: 'accept_necessary'
      }
    },
    settings_modal: {
      title: 'Cookie 設定',
      save_settings_btn: '設定を保存',
      accept_all_btn: 'すべて許可',
      reject_all_btn: 'すべて拒否',
      close_btn_label: '閉じる',
      cookie_table_headers: [
        {col1: '名称'},
        {col2: 'ドメイン'},
        {col3: '有効期限'},
        {col4: '説明'}
      ],
      blocks: [
        {
          title: 'Cookie の使用について 📢',
          description:
            'ウェブサイトの基本的な機能を確保し、オンライン体験を向上させるために Cookie を使用しています。カテゴリごとに、いつでも有効または無効をお選びいただけます。Cookie およびその他の機微な情報の詳細については、<a href="#" class="cc-link">プライバシーポリシー</a>の全文をご覧ください。'
        },
        {
          title: '必須 Cookie',
          description:
            'これらの Cookie は当ウェブサイトが正しく動作するために不可欠です。これらの Cookie がない場合、ウェブサイトは正常に機能しません',
          toggle: {
            value: 'necessary',
            enabled: true,
            readonly: true
          }
        },
        {
          title: 'パフォーマンスおよび分析 Cookie',
          description:
            'これらの Cookie により、ウェブサイトはお客様がこれまでに行った選択を記憶できます',
          toggle: {
            value: 'analytics',
            enabled: false,
            readonly: false
          },
          cookie_table: analyticsCookieTable(settings, {
            twoYears: '2 年',
            oneDay: '1 日',
            description:
              'Google アナリティクスでユーザーを識別するために使用されます。この Cookie は、訪問者が当ウェブサイトをどのように利用しているかを把握するために役立ちます。'
          })
        },
        {
          title: '広告およびターゲティング Cookie',
          description:
            'これらの Cookie は、ウェブサイトの利用方法、閲覧したページ、クリックしたリンクに関する情報を収集します。すべてのデータは匿名化されており、お客様個人を特定することはできません',
          toggle: {
            value: 'targeting',
            enabled: false,
            readonly: false
          }
        },
        {
          title: '詳細情報',
          description:
            'Cookie に関する当社の方針やお客様の選択についてご不明な点がございましたら、<a class="cc-link" href="/contakt">お問い合わせください</a>。'
        }
      ]
    }
  }
})

const buildPluginConfig = (settings?: {
  useGoogleAnalytics?: boolean
}): UserConfig => {
  const pluginConfig: UserConfig = {
    current_lang: FALLBACK_LANGUAGE,
    autoclear_cookies: true,
    page_scripts: true,

    gui_options: {
      settings_modal: {
        layout: 'box'
      },
      consent_modal: {
        layout: 'cloud'
      }
    },

    languages: buildLanguages(settings)
  }

  return pluginConfig
}

/**
 * Pick the banner language for a locale.
 *
 * The locale that reaches the provider is whatever the site labels its
 * pages with, which is usually a full tag such as `de-AT` or `ja-JP`, while
 * the copy above is keyed by base language. Region and script subtags are
 * therefore dropped, and a language without copy of its own falls back to
 * english instead of being handed to the plugin, which would otherwise
 * resolve it against the first key of the map.
 */
const resolveLanguage = (
  locale: string | null | undefined,
  languages: Record<string, LanguageSetting>
): string => {
  const [base = ''] = (locale ?? '').replace(/_/g, '-').toLowerCase().split('-')

  return Object.prototype.hasOwnProperty.call(languages, base)
    ? base
    : FALLBACK_LANGUAGE
}

const dispatchConsentChange = (detail: CookieConsentChangeDetail): void => {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<CookieConsentChangeDetail>(COOKIE_CONSENT_CHANGE_EVENT, {
      detail
    })
  )
}

/**
 * Marks the first layer this module renders, as opposed to the one the plugin
 * builds for itself.
 *
 * It is a contract with gatsby-plugin-jaen's onRenderBody, which puts two
 * rules keyed on this attribute into every generated page: one that makes the
 * banner visible with no JavaScript at all — the plugin's stylesheet starts
 * `#cm` at `visibility: hidden` because the plugin used to reveal it from
 * script — and one that hides it again before the first paint for a visitor
 * who has already answered. The name is repeated there rather than imported,
 * the way the no-flash script in that file already repeats next-themes'
 * storage contract; both sides carry a comment pointing at the other.
 */
const STATIC_BANNER_ATTRIBUTE = 'data-jaen-cc-banner'

/**
 * Lets `hide()` and `show()` reach a banner that is a React component now.
 * Consent changes travel on COOKIE_CONSENT_CHANGE_EVENT instead, because they
 * concern more than the banner.
 */
const BANNER_VISIBILITY_EVENT = 'jaen:cookie-consent-banner-visibility'

const setBannerVisible = (visible: boolean): void => {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<boolean>(BANNER_VISIBILITY_EVENT, {detail: visible})
  )
}

/** The plugin, once someone has needed it. Null for the whole of a visit that never opens the settings. */
let pluginInstance: CookieConsent | null = null
let pluginPromise: Promise<CookieConsent | null> | null = null

/** What the plugin will be run with, recorded by bootstrapCookieConsent. */
const pluginSettings: {useGoogleAnalytics?: boolean; locale?: string} = {}

/**
 * Load and start vanilla-cookieconsent, once per page.
 *
 * Only the settings modal needs it. That modal is behind a click, so it is on
 * no metric's critical path, and it is the part with the legal weight — the
 * category toggles and the cookie tables — which is reason enough to keep it
 * exactly as the plugin renders it rather than to reimplement it.
 */
const loadCookieConsentPlugin = async (): Promise<CookieConsent | null> => {
  if (typeof window === 'undefined') return null
  if (pluginInstance) return pluginInstance
  if (pluginPromise) return await pluginPromise

  pluginPromise = (async () => {
    await import('vanilla-cookieconsent')

    if (typeof window.initCookieConsent !== 'function') return null

    const cc = window.initCookieConsent()
    const pluginConfig = buildPluginConfig({
      useGoogleAnalytics: pluginSettings.useGoogleAnalytics
    })

    cc.run({
      ...pluginConfig,
      current_lang: resolveLanguage(
        pluginSettings.locale,
        pluginConfig.languages ?? {}
      ),
      // run() shows the consent modal by itself unless told not to. React owns
      // that layer, and a second copy of it would either stack on top of the
      // one already on screen or replace it after a frame of nothing.
      autorun: false,
      onAccept: cookie => {
        dispatchConsentChange({
          categories: cookie?.categories ?? [],
          changedCategories: []
        })
      },
      onChange: (cookie, changedCookieCategories) => {
        dispatchConsentChange({
          categories: cookie?.categories ?? [],
          changedCategories: changedCookieCategories ?? []
        })
      }
    })

    // run() builds the consent modal whether or not it is allowed to show it,
    // under the same ids this module renders. Two elements per id is not a
    // cosmetic problem here: `aria-labelledby="c-ttl"` resolves in document
    // order, so the copy nobody can see would end up naming the visible
    // dialog. The plugin holds its own references and never queries these
    // back, so removing them costs it nothing.
    const orphans = document.querySelectorAll(
      `#cc--main:not([${STATIC_BANNER_ATTRIBUTE}]) #cm,` +
        `#cc--main:not([${STATIC_BANNER_ATTRIBUTE}]) #cm-ov`
    )

    orphans.forEach(node => {
      node.remove()
    })

    pluginInstance = cc

    return cc
  })().catch(() => {
    // A failed chunk load must not poison every later click.
    pluginPromise = null

    return null
  })

  return await pluginPromise
}

/** Run something against the plugin, loading it first if that is what it takes. */
const withPlugin = (use: (plugin: CookieConsent) => void): void => {
  if (pluginInstance) {
    use(pluginInstance)
    return
  }

  void loadCookieConsentPlugin().then(plugin => {
    if (plugin) use(plugin)
  })
}

/**
 * The object `useCookieConsentContext()` and `window.cookieConsent` hand out.
 *
 * It has the plugin's shape and its identity never changes, but it is not the
 * plugin: the plugin may never be loaded at all, and the two calls the sites
 * actually make — `accept('analytics')` from the Maps embed and
 * `allowedCategory('analytics')` from onClientEntry — have to work on a page
 * where only the React banner exists. Everything that is really about the
 * stored consent is answered from the cookie, which is the same source the
 * plugin reads; everything that is about the plugin's own DOM is delegated,
 * loading it on demand.
 */
const consentApi: CookieConsent = {
  run: config => {
    withPlugin(plugin => {
      plugin.run(config)
    })
  },

  showSettings: delay => {
    withPlugin(plugin => {
      plugin.showSettings(delay)
    })
  },

  hideSettings: () => {
    pluginInstance?.hideSettings()
  },

  hide: () => {
    setBannerVisible(false)
    pluginInstance?.hide()
  },

  show: (delay, createModal) => {
    setBannerVisible(true)
    pluginInstance?.show(delay, createModal)
  },

  /**
   * Store a consent without the plugin, exactly as the plugin would store it.
   *
   * With the plugin loaded the call goes to it instead, so that the settings
   * modal's toggles and its autoclear stay in step with what is written.
   */
  accept: (categories, exclusions) => {
    if (pluginInstance) {
      pluginInstance.accept(categories, exclusions)
      return
    }

    const previous = readAllowedCategories()
    const hadConsent = isConsentValid(readConsentCookie())
    const accepted = resolveAcceptedCategories(categories, exclusions)
    const cookie = writeConsent(accepted)

    dispatchConsentChange({
      categories: cookie.categories,
      // The plugin reports no change on a first acceptance and only the
      // categories that flipped afterwards; onAccept and onChange above pass
      // the same two shapes.
      changedCategories: hadConsent ? diffCategories(previous, accepted) : []
    })
  },

  allowedCategory: category => readAllowedCategories().includes(category),

  validConsent: () => hasValidConsent(),

  validCookie: cookieName => {
    if (typeof document === 'undefined') return false

    const match = document.cookie.match(
      `(^|;)\\s*${cookieName}\\s*=\\s*([^;]+)`
    )

    return Boolean(match?.[2])
  },

  get: (field, cookieName) => {
    // Only the consent cookie is read here; any other name is the plugin's
    // own business and it can answer for itself once it exists.
    if (cookieName) return pluginInstance?.get(field, cookieName) ?? {}

    const cookie = readConsentCookie() as unknown as Record<string, any> | null

    return cookie?.[field]
  },

  getUserPreferences: () => {
    const accepted = readAllowedCategories()

    return {
      accept_type:
        accepted.length === CONSENT_CATEGORIES.length
          ? 'all'
          : accepted.length === 1 && accepted.includes(NECESSARY_CATEGORY)
            ? 'necessary'
            : 'custom',
      accepted_categories: accepted,
      rejected_categories: CONSENT_CATEGORIES.filter(
        category => !accepted.includes(category)
      )
    }
  },

  eraseCookies: (cookies, path, domain) => {
    eraseCookies(
      typeof cookies === 'string' ? [cookies] : cookies,
      path,
      domain ? [domain, `.${domain}`] : undefined
    )
  },

  getConfig: field => {
    const pluginConfig = buildPluginConfig({
      useGoogleAnalytics: pluginSettings.useGoogleAnalytics
    })

    return pluginConfig[field]
  },

  loadScript: (src, callback, attrs) => {
    withPlugin(plugin => {
      plugin.loadScript(src, callback, attrs)
    })
  },

  updateScripts: () => {
    withPlugin(plugin => {
      plugin.updateScripts()
    })
  },

  // Both of these describe the plugin's own DOM: `set` writes into the
  // settings modal's stored payload and `updateLanguage` re-renders its
  // markup. The React layer takes its language from the provider's locale
  // prop and there is nothing of the plugin's to update before it exists.
  set: (field, data) => pluginInstance?.set(field, data) ?? false,

  updateLanguage: (lang, force) =>
    pluginInstance?.updateLanguage(lang, force) ?? false
}

const CookieContext = createContext<CookieConsent | null>(null)

/**
 * Record the settings the plugin will need and hand back the consent API.
 *
 * It no longer builds a banner. It used to call the plugin here, which is what
 * made the banner appear at onClientEntry rather than after hydration; the
 * banner is now in the static HTML and paints at first contentful paint, with
 * no JavaScript involved at all. What is left is the settings this module
 * needs later and an object callers can use straight away — onClientEntry asks
 * `allowedCategory('analytics')` before anything has hydrated, and that answer
 * comes from the cookie.
 *
 * It stays synchronous and keeps returning null on the server, so no caller
 * has to change.
 */
export const bootstrapCookieConsent = (settings?: {
  useGoogleAnalytics?: boolean
  locale?: string
}): CookieConsent | null => {
  if (typeof window === 'undefined') return null

  if (settings?.useGoogleAnalytics !== undefined) {
    pluginSettings.useGoogleAnalytics = settings.useGoogleAnalytics
  }

  if (settings?.locale !== undefined) {
    pluginSettings.locale = settings.locale
  }

  window.cookieConsent = consentApi

  return consentApi
}

/**
 * The first layer's copy, built once.
 *
 * Only the settings modal's cookie tables depend on the plugin settings, and
 * the settings modal is the plugin's business, so the banner's own strings are
 * the same object for every visitor.
 */
const CONSENT_MODAL_LANGUAGES = buildLanguages()

/**
 * The consent banner, first layer, as static markup.
 *
 * Gatsby writes this into all 253 pages of netsnek.com at build time, so it
 * paints with the first contentful paint at about 1.4 s instead of when the
 * bundle has run. It was the LCP element at 13.2 s, and the render delay was
 * all of it: the plugin is a DOM library and could not draw anything before
 * its own script had been fetched, parsed and run.
 *
 * The markup is the plugin's, element for element, id for id, for
 * `gui_options.consent_modal.layout: 'cloud'` — read out of
 * dist/cookieconsent.js — so that the stylesheet the site already inlines
 * styles it without a single new rule. The two exceptions are noted where they
 * are made.
 */
const CookieConsentBanner: React.FC<{locale?: string}> = ({locale}) => {
  const [isVisible, setIsVisible] = useState(true)

  const consentModal =
    CONSENT_MODAL_LANGUAGES[resolveLanguage(locale, CONSENT_MODAL_LANGUAGES)]
      ?.consent_modal

  const primaryButton = consentModal?.primary_btn
  const secondaryButton = consentModal?.secondary_btn

  const acceptAll = useCallback(() => {
    consentApi.accept(primaryButton?.role === 'accept_all' ? 'all' : [])
  }, [primaryButton?.role])

  const acceptSecondary = useCallback(() => {
    if (secondaryButton?.role === 'accept_necessary') {
      consentApi.accept([])
      return
    }

    consentApi.showSettings(0)
  }, [secondaryButton?.role])

  const showSettings = useCallback(() => {
    consentApi.showSettings(0)
  }, [])

  /**
   * The banner is gone as soon as there is a consent to read, whoever wrote
   * it: these buttons, the settings modal, or `accept()` from an embed
   * somewhere else on the page.
   */
  useEffect(() => {
    const sync = (): void => {
      if (hasValidConsent()) setIsVisible(false)
    }

    sync()

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync)
    }
  }, [])

  useEffect(() => {
    const onVisibility = (event: Event): void => {
      setIsVisible(Boolean((event as CustomEvent<boolean>).detail))
    }

    window.addEventListener(BANNER_VISIBILITY_EVENT, onVisibility)

    return () => {
      window.removeEventListener(BANNER_VISIBILITY_EVENT, onVisibility)
    }
  }, [])

  /**
   * Replay a click that landed before this component existed.
   *
   * The banner is painted by the HTML and answers only once React has
   * hydrated, and on netsnek.com those two moments are seconds apart. The
   * pre-paint script gatsby-plugin-jaen injects records the last button a
   * visitor pressed in that window; setting the property to undefined tells it
   * to stop listening, because from here on the buttons have their own
   * handlers.
   */
  useEffect(() => {
    const early = window.__JAEN_COOKIE_CONSENT_EARLY_CLICK__

    window.__JAEN_COOKIE_CONSENT_EARLY_CLICK__ = undefined

    if (early === 'c-p-bn') acceptAll()
    else if (early === 'c-s-bn') acceptSecondary()
    else if (early === 'c-settings') showSettings()
  }, [acceptAll, acceptSecondary, showSettings])

  /**
   * The "let me choose" button is inside the translated description, as raw
   * HTML with the plugin's own `data-cc="c-settings"` hook on it, so the copy
   * did not have to be rewritten to become React. The click is caught on the
   * container instead.
   */
  const onDescriptionClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement | null

      if (!target?.closest?.('[data-cc="c-settings"]')) return

      event.preventDefault()
      showSettings()
    },
    [showSettings]
  )

  if (!isVisible || !consentModal) return null

  return (
    <div
      id="cc--main"
      {...{[STATIC_BANNER_ATTRIBUTE]: ''}}
      // The plugin sets the same declaration inline; the id carries the
      // z-index.
      style={{position: 'fixed'}}>
      <div className="cc_div">
        <div
          id="cm"
          className="cloud"
          role="dialog"
          aria-modal="true"
          aria-labelledby="c-ttl"
          aria-describedby="c-txt"
          tabIndex={-1}>
          <div id="c-inr">
            <div id="c-inr-i">
              <h2 id="c-ttl">{consentModal.title}</h2>

              <div
                id="c-txt"
                onClick={onDescriptionClick}
                dangerouslySetInnerHTML={{
                  __html: consentModal.description ?? ''
                }}
              />
            </div>

            <div id="c-bns">
              {primaryButton && (
                // `type` is the one attribute the plugin does not set: it
                // creates the element from script, where the default is
                // already `submit` in name only. React wants it spelled out.
                <button
                  id="c-p-bn"
                  className="c-bn"
                  type="button"
                  onClick={acceptAll}>
                  <span tabIndex={-1}>{primaryButton.text}</span>
                </button>
              )}

              {secondaryButton && (
                <button
                  id="c-s-bn"
                  className="c-bn c_link"
                  type="button"
                  onClick={acceptSecondary}>
                  <span tabIndex={-1}>{secondaryButton.text}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Only ever shown with force_consent, which is not configured, but it
            is part of the structure the stylesheet expects. */}
        <div id="cm-ov" />
      </div>
    </div>
  )
}

export interface CookieConsentProviderProps {
  locale?: string
  useGoogleAnalytics?: boolean
  /**
   * Whether the first layer of the banner is rendered at all. Default true.
   *
   * gatsby-plugin-jaen passes false on the routes that carry the CMS and the
   * app: a signed-in tool with no analytics and no marketing cookies has
   * nothing to ask, and on a phone the banner covered the lower third of
   * every app screen until answered. The context, the settings modal and the
   * consent cookie stay as they are, so a visitor who answered on a public
   * page is remembered, and one who never saw the banner is asked the next
   * time they open a public page. Decided per route, so it has to be right
   * at build time too: the banner is baked into the generated HTML.
   */
  banner?: boolean
  children: React.ReactNode
}

export const CookieConsentProvider: React.FC<CookieConsentProviderProps> = ({
  children,
  useGoogleAnalytics,
  locale,
  banner = true
}) => {
  const {colorMode} = useColorMode()

  useEffect(() => {
    bootstrapCookieConsent({useGoogleAnalytics, locale})
  }, [locale, useGoogleAnalytics])

  useEffect(() => {
    // The class only declares custom properties, so it works from any
    // ancestor, and <html> is the only one that exists before the first paint:
    // the banner is in the HTML now, and the no-flash script sets the same
    // class there so a dark-mode visitor never sees it paint light first.
    //
    // The class is read off <html> rather than taken from `colorMode` because
    // useColorMode deliberately reports the fallback during the hydration
    // render (see the comment in use-color-mode); using its value here would
    // strip the class off a dark page for the frame between the two passes.
    // next-themes has written the real answer there before React re-renders.
    //
    // And the class is watched, not read once: next-themes rewrites it on a
    // client-side route change between a page with a colour mode and the
    // forced-light public site (color-mode-scope in gatsby-plugin-jaen)
    // without `colorMode` changing, so an effect keyed on the hook alone ran
    // once with 'dark' and never again. Measured 2026-09-05: after the dark
    // /loading page handed over to the light home page the banner stayed in
    // its dark theme on a light page. The observer follows every writer of
    // the class, and toggling to the state it already has records nothing,
    // so it does not feed itself.
    const root = document.documentElement

    const sync = (): void => {
      root.classList.toggle('c_darkmode', root.classList.contains('dark'))
    }

    sync()

    const observer = new MutationObserver(sync)

    observer.observe(root, {attributes: true, attributeFilter: ['class']})

    return () => {
      observer.disconnect()
    }
  }, [colorMode])

  return (
    <CookieContext.Provider value={consentApi}>
      {children}

      {banner && <CookieConsentBanner locale={locale} />}
    </CookieContext.Provider>
  )
}

export default CookieConsentProvider

export function useCookieConsentContext(): CookieConsent | null {
  const context = useContext(CookieContext)

  return context
}

/**
 * Whether the visitor currently allows a cookie category, re-read whenever
 * consent changes.
 *
 * The answer comes from the cookie, not from the plugin, so an embed is
 * ungated the moment the banner is answered rather than whenever the plugin
 * happens to be loaded — on most visits that is never.
 *
 * It stays false through server rendering and the hydration render, so a gated
 * embed is closed in the static HTML and does not flicker; the effect below
 * corrects it for a visitor who has already consented.
 */
export function useCookieConsentCategory(category: string): boolean {
  const [isAllowed, setIsAllowed] = useState(false)

  useEffect(() => {
    const read = (): void => {
      setIsAllowed(readAllowedCategories().includes(category))
    }

    read()

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, read)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, read)
    }
  }, [category])

  return isAllowed
}
