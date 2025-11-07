// src/vars/i18nContact.tsx
export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG'

/** Contact modal i18n only */
export function getI18nContact(code: I18nCode) {
  if (code === 'de-AT') {
    return {
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
  }

  if (code === 'tr-TR') {
    return {
      code,
      strings: {
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
      }
    }
  }

  // EN fallback
  return {
    code,
    strings: {
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
    }
  }
}

const messagesEn = {} as const
