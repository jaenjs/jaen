export type SupportedLocale = 'en-US' | 'de-AT'

const messagesEn = {
  language: 'English',
  auth: {
    login: 'Login',
    signup: 'Sign up',
    logout: 'Logout',
    settings: 'Settings'
  },
  cms: {
    labels: {
      root: 'CMS'
    },
    dashboard: {
      title: 'Jaen CMS',
      menuLabel: 'Dashboard',
      menuGroupLabel: 'Jaen CMS'
    },
    pages: {
      title: 'Jaen CMS | Pages',
      menuLabel: 'Pages',
      breadcrumbs: {
        pages: 'Pages',
        new: 'New'
      },
      notifications: {
        created: 'Page created',
        updated: 'Page updated',
        deleted: 'Page deleted'
      },
      actions: {
        duplicate: 'Duplicate page',
        move: 'Move page',
        updateSlug: 'Update slug',
        delete: 'Delete page'
      },
      form: {
        title: 'New page'
      }
    },
    media: {
      title: 'Jaen CMS | Media',
      menuLabel: 'Media',
      breadcrumbs: {
        media: 'Media'
      }
    },
    settings: {
      title: 'Jaen CMS | Settings',
      menuLabel: 'Settings',
      breadcrumbs: {
        settings: 'Settings'
      }
    },
    debug: {
      title: 'Jaen CMS | Debug',
      breadcrumbs: {
        debug: 'Debug'
      }
    },
    notification: {
      title: 'Jaen CMS | Notification',
      menuLabel: 'Popup',
      breadcrumbs: {
        popup: 'Popup'
      }
    }
  }
} as const

// Allow the same shape as messagesEn, but with arbitrary strings for values.
type DeepString<T> = T extends string ? string : { [K in keyof T]: DeepString<T[K]> }

export type LocaleMessages = DeepString<typeof messagesEn>

const messagesDe: LocaleMessages = {
  language: 'Deutsch (Österreich)',
  auth: {
    login: 'Anmelden',
    signup: 'Registrieren',
    logout: 'Abmelden',
    settings: 'Einstellungen'
  },
  cms: {
    labels: {
      root: 'CMS'
    },
    dashboard: {
      title: 'Jaen CMS',
      menuLabel: 'Dashboard',
      menuGroupLabel: 'Jaen CMS'
    },
    pages: {
      title: 'Jaen CMS | Seiten',
      menuLabel: 'Seiten',
      breadcrumbs: {
        pages: 'Seiten',
        new: 'Neu'
      },
      notifications: {
        created: 'Seite erstellt',
        updated: 'Seite aktualisiert',
        deleted: 'Seite gelöscht'
      },
      actions: {
        duplicate: 'Seite duplizieren',
        move: 'Seite verschieben',
        updateSlug: 'Slug aktualisieren',
        delete: 'Seite löschen'
      },
      form: {
        title: 'Neue Seite'
      }
    },
    media: {
      title: 'Jaen CMS | Medien',
      menuLabel: 'Medien',
      breadcrumbs: {
        media: 'Medien'
      }
    },
    settings: {
      title: 'Jaen CMS | Einstellungen',
      menuLabel: 'Einstellungen',
      breadcrumbs: {
        settings: 'Einstellungen'
      }
    },
    debug: {
      title: 'Jaen CMS | Debug',
      breadcrumbs: {
        debug: 'Debug'
      }
    },
    notification: {
      title: 'Jaen CMS | Benachrichtigung',
      menuLabel: 'Popup',
      breadcrumbs: {
        popup: 'Popup'
      }
    }
  }
}

interface I18nDescriptor {
  messages: LocaleMessages
}

/** Deep-partial helper for override objects */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]>
}

/**
 * Merge two message objects of the same language.
 * Values from `override` win; merge is deep for nested objects and leaves are strings.
 * Works with full LocaleMessages or deep partial overrides.
 */
export const mergeLocaleMessages = (
  base: LocaleMessages,
  override: DeepPartial<LocaleMessages>
): LocaleMessages => {
  const merge = (b: any, o: any): any => {
    if (typeof b === 'string') {
      return typeof o === 'string' ? o : b
    }
    const result: Record<string, any> = {...b}
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) {
        const bk = (b as any)[k]
        const ok = (o as any)[k]
        result[k] = bk === undefined ? ok : merge(bk, ok)
      }
    }
    return result
  }
  return merge(base, override) as LocaleMessages
}

const i18nByLocale: Record<SupportedLocale, I18nDescriptor> = {
  'en-US': {
    messages: messagesEn
  },
  'de-AT': {
    messages: messagesDe
  }
}

export const getI18n = (locale: SupportedLocale): I18nDescriptor => {
  return i18nByLocale[locale]
}

export const supportedLocales = Object.keys(i18nByLocale) as SupportedLocale[]
