export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG'

export interface UnifiedI18n {
  code: I18nCode
  // Flat messages consumed by <IntlProvider messages={...}>
  // Includes merged string keys + every other top-level field from homepage/contact/booking.
  messages: Record<string, any>
  // Raw locale strings (unflattened) so downstream overrides can opt-in if desired.
  strings: Record<string, any>
}

const baseStrings = {
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
        createdDescription: 'Page {title} has been created',
        updated: 'Page updated',
        updatedDescription: 'Page {title} has been updated',
        deleted: 'Page deleted',
        deletedDescription: 'Page {slug} has been deleted',
        duplicated: 'Page duplicated',
        duplicatedDescription: 'Page {slug} has been duplicated',
        moved: 'Page moved',
        movedDescription: 'Page {slug} has been moved',
        slugUpdated: 'Slug updated',
        slugUpdatedDescription: 'Slug has been updated to {slug}',
        duplicateFailed: 'Could not duplicate page',
        moveFailed: 'Could not move page',
        slugUpdateFailed: 'Could not update slug'
      },
      actions: {
        duplicate: 'Duplicate page',
        move: 'Move page',
        updateSlug: 'Update slug',
        renameSlug: 'Rename slug',
        delete: 'Delete page',
        deleteThis: 'Delete this page'
      },
      descriptions: {
        duplicate: 'This will duplicate the page with its subpages.',
        move: 'This will move the page and all its subpages.',
        updateSlug:
          'This will rename the slug and thus affects the path of the page and all its subpages.',
        delete: 'This will delete the page and all its subpages.'
      },
      prompts: {
        duplicate: {
          title: 'Duplicate page',
          message:
            'Please enter a new slug for the duplicated page. This will affect the path.',
          confirm: 'Duplicate',
          cancel: 'Cancel',
          placeholder: '{slug}-copy'
        },
        move: {
          title: 'Move page',
          message: 'Please select a new parent page.',
          confirm: 'Move',
          cancel: 'Cancel'
        },
        renameSlug: {
          title: 'Rename slug',
          message: 'Please enter a new slug. This will affect the path.',
          confirm: 'Rename',
          cancel: 'Cancel'
        },
        delete: {
          title: 'Delete page',
          message:
            'Are you sure you want to delete this page and all its subpages?',
          confirm: 'Delete'
        }
      },
      table: {
        subpagesHeading: 'Subpages',
        reorderEnable: 'Reorder',
        reorderDisable: 'Done',
        newPage: 'New page',
        columns: {
          title: 'Title',
          description: 'Description',
          date: 'Date'
        },
        emptyState: {
          description: "This page doesn't have any subpages yet.",
          action: 'Create a new page'
        },
        date: {
          created: 'Created {date} at {time}',
          updated: 'Last modified {date} at {time}',
          empty: '-'
        },
        reorderError: 'Something went wrong while reordering the pages.',
        dangerZoneHeading: 'Danger zone'
      },
      labels: {
        noTitle: 'No title',
        noDescription: 'No description',
        fallbackTitle: 'Page',
        yes: 'Yes'
      },
      form: {
        heading: {
          create: 'Create a New Page',
          edit: 'Edit the Page'
        },
        lead: {
          create:
            'A page represents an arrangement of fields or blocks that are presented on a specific URL.',
          edit: 'Edit the page. Enhance SEO and social media presence.'
        },
        template: {
          create: 'Select a Template for the New Page',
          edit: 'The template used for the page'
        },
        templateHelperText: {
          create:
            'This template will be applied to the new page, based on the parent page.',
          edit: 'If you wish to modify the template, create a new page and transfer the content.'
        },
        title: {
          create: 'Enter a Title for the New Page',
          edit: 'The title of the page'
        },
        titleHelperText: {
          create:
            'The title of the new page. The URL slug will be automatically generated from the title.',
          edit: 'The title of the page.'
        },
        description: {
          create: 'Provide a Description for the New Page',
          edit: 'The description of the page'
        },
        descriptionHelperText: {
          create:
            'The description will be utilized by search engines and social media. Aim for 160-165 characters.',
          edit: 'The description will be utilized by search engines and social media. Aim for 160-165 characters.'
        },
        parentPage: {
          create: 'Select a Parent Page',
          edit: 'The parent page of the page'
        },
        parentHelperText: {
          create: 'This serves as the parent page of the new page.',
          edit: 'You have the option to relocate the page to a more suitable parent page.'
        },
        image: {
          create: 'Image',
          edit: 'Image'
        },
        imageHelperText: {
          create:
            'Include an image on the page. If left unset, the image of the parent page or site will be utilized.',
          edit: 'The image of the page. If left unset, the image of the parent page or site will be utilized.'
        },
        post: {
          create: 'Mark as a Post',
          edit: 'Post'
        },
        postHelperText: {
          create:
            'Designate this page as a post to incorporate a date and author field.',
          edit: 'Designate this page as a post to incorporate a date and author field.'
        },
        postDate: {
          create: 'Enter a Date for the New Page',
          edit: 'The publication date of the page'
        },
        postDateHelperText: {
          create: 'The date will be employed for post sorting.',
          edit: 'The date will be employed for post sorting.'
        },
        postAuthor: {
          create: 'Enter an Author for the New Page',
          edit: 'The author of the page'
        },
        postAuthorHelperText: {
          create: 'This will be displayed as the author of the post.',
          edit: 'This will be displayed as the author of the post.'
        },
        postCategory: {
          create: 'Enter a Category for the New Page',
          edit: 'The category of the page'
        },
        postCategoryHelperText: {
          create: 'The category will be used for post classification.',
          edit: 'The category will be used for post classification.'
        },
        excludeFromIndex: {
          create: 'Exclude from Index',
          edit: 'Exclude from Index'
        },
        excludeFromIndexHelperText: {
          create:
            'Exclude this page from all index fields (e.g., locations where pages are listed).',
          edit: 'Exclude this page from all index fields (e.g., locations where pages are listed).'
        },
        placeholders: {
          title: 'Title',
          slug: 'slug',
          description: 'Description',
          author: 'Author',
          category: 'Category'
        },
        helper: {
          mediaDescription: 'Upload a photo to represent the organization.'
        },
        errors: {
          slugInUse: 'Slug is already in use',
          parentRequired: 'Parent is required',
          templateRequired: 'Template is required',
          dateRequired: 'Date is required for blog posts',
          authorRequired: 'Author is required for blog posts'
        },
        buttons: {
          preview: 'Preview',
          edit: 'Edit page',
          cancel: 'Cancel',
          create: 'Create page',
          save: 'Save page'
        }
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

type JaenStrings = typeof baseStrings

type DeepString<T> = T extends string
  ? string
  : {[K in keyof T]: DeepString<T[K]>}

const jaenStringsByLocale: Record<I18nCode, DeepString<JaenStrings>> = {
  'en-US': baseStrings,
  'de-AT': {
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
          createdDescription: 'Seite {title} wurde erstellt',
          updated: 'Seite aktualisiert',
          updatedDescription: 'Seite {title} wurde aktualisiert',
          deleted: 'Seite gelöscht',
          deletedDescription: 'Seite {slug} wurde gelöscht',
          duplicated: 'Seite dupliziert',
          duplicatedDescription: 'Seite {slug} wurde dupliziert',
          moved: 'Seite verschoben',
          movedDescription: 'Seite {slug} wurde verschoben',
          slugUpdated: 'Slug aktualisiert',
          slugUpdatedDescription: 'Slug wurde auf {slug} geändert',
          duplicateFailed: 'Seite konnte nicht dupliziert werden',
          moveFailed: 'Seite konnte nicht verschoben werden',
          slugUpdateFailed: 'Slug konnte nicht aktualisiert werden'
        },
        actions: {
          duplicate: 'Seite duplizieren',
          move: 'Seite verschieben',
          updateSlug: 'Slug aktualisieren',
          renameSlug: 'Slug umbenennen',
          delete: 'Seite löschen',
          deleteThis: 'Diese Seite löschen'
        },
        descriptions: {
          duplicate: 'Dies dupliziert die Seite samt ihrer Unterseiten.',
          move: 'Dies verschiebt die Seite und alle ihre Unterseiten.',
          updateSlug:
            'Dies benennt den Slug um und beeinflusst damit den Pfad der Seite und aller Unterseiten.',
          delete: 'Dies löscht die Seite und alle ihre Unterseiten.'
        },
        prompts: {
          duplicate: {
            title: 'Seite duplizieren',
            message:
              'Bitte gib einen neuen Slug für die duplizierte Seite ein. Dies beeinflusst den Pfad.',
            confirm: 'Duplizieren',
            cancel: 'Abbrechen',
            placeholder: '{slug}-kopie'
          },
          move: {
            title: 'Seite verschieben',
            message: 'Bitte wähle eine neue Elternseite.',
            confirm: 'Verschieben',
            cancel: 'Abbrechen'
          },
          renameSlug: {
            title: 'Slug umbenennen',
            message: 'Bitte gib einen neuen Slug ein. Dies beeinflusst den Pfad.',
            confirm: 'Umbenennen',
            cancel: 'Abbrechen'
          },
          delete: {
            title: 'Seite löschen',
            message:
              'Bist du sicher, dass du diese Seite und alle ihre Unterseiten löschen möchtest?',
            confirm: 'Löschen'
          }
        },
        table: {
          subpagesHeading: 'Unterseiten',
          reorderEnable: 'Neu anordnen',
          reorderDisable: 'Fertig',
          newPage: 'Neue Seite',
          columns: {
            title: 'Titel',
            description: 'Beschreibung',
            date: 'Datum'
          },
          emptyState: {
            description: 'Diese Seite hat noch keine Unterseiten.',
            action: 'Neue Seite erstellen'
          },
          date: {
            created: 'Erstellt am {date} um {time}',
            updated: 'Zuletzt geändert am {date} um {time}',
            empty: '-'
          },
          reorderError: 'Beim Neuordnen der Seiten ist ein Fehler aufgetreten.',
          dangerZoneHeading: 'Gefahrenbereich'
        },
        labels: {
          noTitle: 'Kein Titel',
          noDescription: 'Keine Beschreibung',
          fallbackTitle: 'Seite',
          yes: 'Ja'
        },
        form: {
          heading: {
            create: 'Neue Seite erstellen',
            edit: 'Seite bearbeiten'
          },
          lead: {
            create:
              'Eine Seite ist eine Anordnung von Feldern oder Blöcken, die unter einer bestimmten URL angezeigt werden.',
            edit: 'Bearbeite die Seite. Verbessere SEO und Auftritt in sozialen Medien.'
          },
          template: {
            create: 'Wähle ein Template für die neue Seite',
            edit: 'Das Template der Seite'
          },
          templateHelperText: {
            create:
              'Dieses Template wird basierend auf der Elternseite auf die neue Seite angewendet.',
            edit: 'Wenn du das Template ändern möchtest, erstelle eine neue Seite und übertrage die Inhalte.'
          },
          title: {
            create: 'Gib einen Titel für die neue Seite ein',
            edit: 'Der Titel der Seite'
          },
          titleHelperText: {
            create:
              'Der Titel der neuen Seite. Der URL-Slug wird automatisch aus dem Titel generiert.',
            edit: 'Der Titel der Seite.'
          },
          description: {
            create: 'Beschreibe die neue Seite',
            edit: 'Die Beschreibung der Seite'
          },
          descriptionHelperText: {
            create:
              'Die Beschreibung wird von Suchmaschinen und sozialen Medien verwendet. Ziel: 160-165 Zeichen.',
            edit: 'Die Beschreibung wird von Suchmaschinen und sozialen Medien verwendet. Ziel: 160-165 Zeichen.'
          },
          parentPage: {
            create: 'Wähle eine Elternseite',
            edit: 'Die Elternseite der Seite'
          },
          parentHelperText: {
            create: 'Dies ist die Elternseite der neuen Seite.',
            edit: 'Du kannst die Seite einer passenderen Elternseite zuordnen.'
          },
          image: {
            create: 'Bild',
            edit: 'Bild'
          },
          imageHelperText: {
            create:
              'Füge ein Bild zur Seite hinzu. Wenn keines gesetzt ist, wird das Bild der Elternseite oder der Website verwendet.',
            edit: 'Das Bild der Seite. Wenn keines gesetzt ist, wird das Bild der Elternseite oder der Website verwendet.'
          },
          post: {
            create: 'Als Beitrag markieren',
            edit: 'Beitrag'
          },
          postHelperText: {
            create:
              'Markiere die Seite als Beitrag, um Datum und Autor zu nutzen.',
            edit: 'Markiere die Seite als Beitrag, um Datum und Autor zu nutzen.'
          },
          postDate: {
            create: 'Veröffentlichungsdatum eingeben',
            edit: 'Das Veröffentlichungsdatum der Seite'
          },
          postDateHelperText: {
            create: 'Das Datum wird zur Sortierung von Beiträgen verwendet.',
            edit: 'Das Datum wird zur Sortierung von Beiträgen verwendet.'
          },
          postAuthor: {
            create: 'Autor der neuen Seite eingeben',
            edit: 'Der Autor der Seite'
          },
          postAuthorHelperText: {
            create: 'Wird als Autor des Beitrags angezeigt.',
            edit: 'Wird als Autor des Beitrags angezeigt.'
          },
          postCategory: {
            create: 'Kategorie für die neue Seite eingeben',
            edit: 'Die Kategorie der Seite'
          },
          postCategoryHelperText: {
            create: 'Die Kategorie dient zur Einteilung der Beiträge.',
            edit: 'Die Kategorie dient zur Einteilung der Beiträge.'
          },
          excludeFromIndex: {
            create: 'Von Index ausschließen',
            edit: 'Von Index ausschließen'
          },
          excludeFromIndexHelperText: {
            create:
              'Schließe diese Seite von allen Index-Feldern aus (z.B. überall, wo Seiten gelistet werden).',
            edit: 'Schließe diese Seite von allen Index-Feldern aus (z.B. überall, wo Seiten gelistet werden).'
          },
          placeholders: {
            title: 'Titel',
            slug: 'slug',
            description: 'Beschreibung',
            author: 'Autor',
            category: 'Kategorie'
          },
          helper: {
            mediaDescription: 'Lade ein Bild hoch, das die Organisation repräsentiert.'
          },
          errors: {
            slugInUse: 'Slug wird bereits verwendet',
            parentRequired: 'Elternseite ist erforderlich',
            templateRequired: 'Template ist erforderlich',
            dateRequired: 'Datum ist für Beiträge erforderlich',
            authorRequired: 'Autor ist für Beiträge erforderlich'
          },
          buttons: {
            preview: 'Vorschau',
            edit: 'Seite bearbeiten',
            cancel: 'Abbrechen',
            create: 'Seite erstellen',
            save: 'Seite speichern'
          }
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
  },
  'tr-TR': {
    language: 'Türkçe',
    auth: {
      login: 'Giriş Yap',
      signup: 'Kaydol',
      logout: 'Çıkış Yap',
      settings: 'Ayarlar'
    },
    cms: {
      labels: {
        root: 'CMS'
      },
      dashboard: {
        title: 'Jaen CMS',
        menuLabel: 'Kontrol Paneli',
        menuGroupLabel: 'Jaen CMS'
      },
      pages: {
        title: 'Jaen CMS | Sayfalar',
        menuLabel: 'Sayfalar',
        breadcrumbs: {
          pages: 'Sayfalar',
          new: 'Yeni'
        },
        notifications: {
          created: 'Sayfa oluşturuldu',
          createdDescription: '“{title}” sayfası oluşturuldu',
          updated: 'Sayfa güncellendi',
          updatedDescription: '“{title}” sayfası güncellendi',
          deleted: 'Sayfa silindi',
          deletedDescription: '{slug} sayfası silindi',
          duplicated: 'Sayfa kopyalandı',
          duplicatedDescription: '{slug} sayfası kopyalandı',
          moved: 'Sayfa taşındı',
          movedDescription: '{slug} sayfası taşındı',
          slugUpdated: 'Slug güncellendi',
          slugUpdatedDescription: 'Slug {slug} olarak güncellendi',
          duplicateFailed: 'Sayfa kopyalanamadı',
          moveFailed: 'Sayfa taşınamadı',
          slugUpdateFailed: 'Slug güncellenemedi'
        },
        actions: {
          duplicate: 'Sayfayı kopyala',
          move: 'Sayfayı taşı',
          updateSlug: 'Slugu güncelle',
          renameSlug: 'Slugu yeniden adlandır',
          delete: 'Sayfayı sil',
          deleteThis: 'Bu sayfayı sil'
        },
        descriptions: {
          duplicate: 'Bu işlem sayfayı ve alt sayfalarını kopyalar.',
          move: 'Bu işlem sayfayı ve tüm alt sayfalarını taşır.',
          updateSlug:
            'Bu işlem slugu değiştirir ve sayfanın ve tüm alt sayfalarının yolunu etkiler.',
          delete: 'Bu işlem sayfayı ve tüm alt sayfalarını siler.'
        },
        prompts: {
          duplicate: {
            title: 'Sayfayı kopyala',
            message:
              'Kopyalanan sayfa için yeni bir slug girin. Bu işlem yolu etkileyecektir.',
            confirm: 'Kopyala',
            cancel: 'İptal',
            placeholder: '{slug}-kopya'
          },
          move: {
            title: 'Sayfayı taşı',
            message: 'Lütfen yeni bir üst sayfa seçin.',
            confirm: 'Taşı',
            cancel: 'İptal'
          },
          renameSlug: {
            title: 'Slugu yeniden adlandır',
            message: 'Lütfen yeni bir slug girin. Bu işlem yolu etkileyecektir.',
            confirm: 'Yeniden adlandır',
            cancel: 'İptal'
          },
          delete: {
            title: 'Sayfayı sil',
            message: 'Bu sayfayı ve tüm alt sayfalarını silmek istediğinizden emin misiniz?',
            confirm: 'Sil'
          }
        },
        table: {
          subpagesHeading: 'Alt sayfalar',
          reorderEnable: 'Yeniden sırala',
          reorderDisable: 'Bitti',
          newPage: 'Yeni sayfa',
          columns: {
            title: 'Başlık',
            description: 'Açıklama',
            date: 'Tarih'
          },
          emptyState: {
            description: 'Bu sayfanın henüz alt sayfası yok.',
            action: 'Yeni bir sayfa oluştur'
          },
          date: {
            created: '{date} tarihinde {time} saatinde oluşturuldu',
            updated: 'Son güncelleme {date} tarihinde {time} saatinde',
            empty: '-'
          },
          reorderError: 'Sayfalar yeniden sıralanırken bir sorun oluştu.',
          dangerZoneHeading: 'Tehlike bölgesi'
        },
        labels: {
          noTitle: 'Başlıksız',
          noDescription: 'Açıklama yok',
          fallbackTitle: 'Sayfa',
          yes: 'Evet'
        },
        form: {
          heading: {
            create: 'Yeni sayfa oluştur',
            edit: 'Sayfayı düzenle'
          },
          lead: {
            create:
              'Bir sayfa, belirli bir URL altında gösterilen alan veya blok düzenidir.',
            edit: 'Sayfayı düzenleyin. SEO ve sosyal medya görünürlüğünü artırın.'
          },
          template: {
            create: 'Yeni sayfa için bir şablon seçin',
            edit: 'Sayfanın şablonu'
          },
          templateHelperText: {
            create:
              'Bu şablon, üst sayfaya göre yeni sayfaya uygulanacaktır.',
            edit: 'Şablonu değiştirmek istiyorsanız yeni bir sayfa oluşturup içeriği aktarın.'
          },
          title: {
            create: 'Yeni sayfa için başlık girin',
            edit: 'Sayfanın başlığı'
          },
          titleHelperText: {
            create:
              'Yeni sayfanın başlığı. URL slug başlıktan otomatik olarak oluşturulur.',
            edit: 'Sayfanın başlığı.'
          },
          description: {
            create: 'Yeni sayfa için açıklama ekleyin',
            edit: 'Sayfanın açıklaması'
          },
          descriptionHelperText: {
            create:
              'Açıklama arama motorları ve sosyal medya tarafından kullanılır. 160-165 karakter hedefleyin.',
            edit: 'Açıklama arama motorları ve sosyal medya tarafından kullanılır. 160-165 karakter hedefleyin.'
          },
          parentPage: {
            create: 'Bir üst sayfa seçin',
            edit: 'Sayfanın üst sayfası'
          },
          parentHelperText: {
            create: 'Bu, yeni sayfanın üst sayfasıdır.',
            edit: 'Sayfayı daha uygun bir üst sayfaya taşıyabilirsiniz.'
          },
          image: {
            create: 'Görsel',
            edit: 'Görsel'
          },
          imageHelperText: {
            create:
              'Sayfaya bir görsel ekleyin. Boş bırakılırsa üst sayfanın veya sitenin görseli kullanılır.',
            edit: 'Sayfanın görseli. Boş bırakılırsa üst sayfanın veya sitenin görseli kullanılır.'
          },
          post: {
            create: 'Yazı olarak işaretle',
            edit: 'Yazı'
          },
          postHelperText: {
            create:
              'Bu sayfayı yazı olarak işaretleyerek tarih ve yazar alanlarını ekleyin.',
            edit: 'Bu sayfayı yazı olarak işaretleyerek tarih ve yazar alanlarını ekleyin.'
          },
          postDate: {
            create: 'Yeni sayfa için tarih girin',
            edit: 'Sayfanın yayın tarihi'
          },
          postDateHelperText: {
            create: 'Tarih, yazı sıralamasında kullanılacaktır.',
            edit: 'Tarih, yazı sıralamasında kullanılacaktır.'
          },
          postAuthor: {
            create: 'Yeni sayfa için yazar girin',
            edit: 'Sayfanın yazarı'
          },
          postAuthorHelperText: {
            create: 'Yazı için yazar olarak gösterilecektir.',
            edit: 'Yazı için yazar olarak gösterilecektir.'
          },
          postCategory: {
            create: 'Yeni sayfa için kategori girin',
            edit: 'Sayfanın kategorisi'
          },
          postCategoryHelperText: {
            create: 'Kategori, yazıları sınıflandırmak için kullanılır.',
            edit: 'Kategori, yazıları sınıflandırmak için kullanılır.'
          },
          excludeFromIndex: {
            create: 'Dizinden çıkar',
            edit: 'Dizinden çıkar'
          },
          excludeFromIndexHelperText: {
            create:
              'Bu sayfayı tüm dizin alanlarından hariç tut (ör. sayfaların listelendiği yerler).',
            edit: 'Bu sayfayı tüm dizin alanlarından hariç tut (ör. sayfaların listelendiği yerler).'
          },
          placeholders: {
            title: 'Başlık',
            slug: 'slug',
            description: 'Açıklama',
            author: 'Yazar',
            category: 'Kategori'
          },
          helper: {
            mediaDescription: 'Kuruluşu temsil edecek bir görsel yükleyin.'
          },
          errors: {
            slugInUse: 'Slug zaten kullanılıyor',
            parentRequired: 'Üst sayfa gerekli',
            templateRequired: 'Şablon gerekli',
            dateRequired: 'Yazılar için tarih gereklidir',
            authorRequired: 'Yazılar için yazar gereklidir'
          },
          buttons: {
            preview: 'Önizleme',
            edit: 'Sayfayı düzenle',
            cancel: 'İptal',
            create: 'Sayfa oluştur',
            save: 'Sayfayı kaydet'
          }
        }
      },
      media: {
        title: 'Jaen CMS | Medya',
        menuLabel: 'Medya',
        breadcrumbs: {
          media: 'Medya'
        }
      },
      settings: {
        title: 'Jaen CMS | Ayarlar',
        menuLabel: 'Ayarlar',
        breadcrumbs: {
          settings: 'Ayarlar'
        }
      },
      debug: {
        title: 'Jaen CMS | Hata Ayıklama',
        breadcrumbs: {
          debug: 'Hata Ayıklama'
        }
      },
      notification: {
        title: 'Jaen CMS | Bildirim',
        menuLabel: 'Bildirim',
        breadcrumbs: {
          popup: 'Bildirim'
        }
      }
    }
  },
  'ar-EG': {
    language: 'العربية',
    auth: {
      login: 'تسجيل الدخول',
      signup: 'إنشاء حساب',
      logout: 'تسجيل الخروج',
      settings: 'الإعدادات'
    },
    cms: {
      labels: {
        root: 'نظام إدارة المحتوى'
      },
      dashboard: {
        title: 'Jaen CMS',
        menuLabel: 'لوحة التحكم',
        menuGroupLabel: 'Jaen CMS'
      },
      pages: {
        title: 'Jaen CMS | الصفحات',
        menuLabel: 'الصفحات',
        breadcrumbs: {
          pages: 'الصفحات',
          new: 'جديد'
        },
        notifications: {
          created: 'تم إنشاء الصفحة',
          createdDescription: 'تم إنشاء الصفحة {title}',
          updated: 'تم تحديث الصفحة',
          updatedDescription: 'تم تحديث الصفحة {title}',
          deleted: 'تم حذف الصفحة',
          deletedDescription: 'تم حذف الصفحة {slug}',
          duplicated: 'تم استنساخ الصفحة',
          duplicatedDescription: 'تم استنساخ الصفحة {slug}',
          moved: 'تم نقل الصفحة',
          movedDescription: 'تم نقل الصفحة {slug}',
          slugUpdated: 'تم تحديث الرابط',
          slugUpdatedDescription: 'تم تحديث الرابط إلى {slug}',
          duplicateFailed: 'تعذّر استنساخ الصفحة',
          moveFailed: 'تعذّر نقل الصفحة',
          slugUpdateFailed: 'تعذّر تحديث الرابط'
        },
        actions: {
          duplicate: 'استنساخ الصفحة',
          move: 'نقل الصفحة',
          updateSlug: 'تحديث الرابط',
          renameSlug: 'إعادة تسمية الرابط',
          delete: 'حذف الصفحة',
          deleteThis: 'حذف هذه الصفحة'
        },
        descriptions: {
          duplicate: 'سيؤدي ذلك إلى استنساخ الصفحة وجميع صفحاتها الفرعية.',
          move: 'سيؤدي ذلك إلى نقل الصفحة وجميع صفحاتها الفرعية.',
          updateSlug:
            'سيؤدي ذلك إلى إعادة تسمية الرابط وبالتالي يؤثر على مسار الصفحة وجميع صفحاتها الفرعية.',
          delete: 'سيؤدي ذلك إلى حذف الصفحة وجميع صفحاتها الفرعية.'
        },
        prompts: {
          duplicate: {
            title: 'استنساخ الصفحة',
            message:
              'يرجى إدخال رابط جديد للصفحة المستنسخة. سيؤثر ذلك على المسار.',
            confirm: 'استنساخ',
            cancel: 'إلغاء',
            placeholder: '{slug}-نسخة'
          },
          move: {
            title: 'نقل الصفحة',
            message: 'يرجى اختيار صفحة رئيسية جديدة.',
            confirm: 'نقل',
            cancel: 'إلغاء'
          },
          renameSlug: {
            title: 'إعادة تسمية الرابط',
            message: 'يرجى إدخال رابط جديد. سيؤثر ذلك على المسار.',
            confirm: 'إعادة تسمية',
            cancel: 'إلغاء'
          },
          delete: {
            title: 'حذف الصفحة',
            message: 'هل أنت متأكد أنك تريد حذف هذه الصفحة وجميع صفحاتها الفرعية؟',
            confirm: 'حذف'
          }
        },
        table: {
          subpagesHeading: 'الصفحات الفرعية',
          reorderEnable: 'إعادة الترتيب',
          reorderDisable: 'تم',
          newPage: 'صفحة جديدة',
          columns: {
            title: 'العنوان',
            description: 'الوصف',
            date: 'التاريخ'
          },
          emptyState: {
            description: 'لا تحتوي هذه الصفحة على أي صفحات فرعية بعد.',
            action: 'أنشئ صفحة جديدة'
          },
          date: {
            created: 'تم الإنشاء في {date} الساعة {time}',
            updated: 'آخر تعديل في {date} الساعة {time}',
            empty: '-'
          },
          reorderError: 'حدث خطأ أثناء إعادة ترتيب الصفحات.',
          dangerZoneHeading: 'منطقة الخطر'
        },
        labels: {
          noTitle: 'بدون عنوان',
          noDescription: 'بدون وصف',
          fallbackTitle: 'صفحة',
          yes: 'نعم'
        },
        form: {
          heading: {
            create: 'إنشاء صفحة جديدة',
            edit: 'تحرير الصفحة'
          },
          lead: {
            create:
              'تمثل الصفحة ترتيباً من الحقول أو الكتل يتم عرضه على عنوان URL محدد.',
            edit: 'حرر الصفحة. عزّز تحسين محركات البحث والحضور على وسائل التواصل الاجتماعي.'
          },
          template: {
            create: 'اختر قالباً للصفحة الجديدة',
            edit: 'القالب المستخدم للصفحة'
          },
          templateHelperText: {
            create:
              'سيتم تطبيق هذا القالب على الصفحة الجديدة بناءً على الصفحة الرئيسية.',
            edit: 'إذا أردت تعديل القالب، أنشئ صفحة جديدة وانقل المحتوى.'
          },
          title: {
            create: 'أدخل عنواناً للصفحة الجديدة',
            edit: 'عنوان الصفحة'
          },
          titleHelperText: {
            create:
              'عنوان الصفحة الجديدة. سيتم إنشاء الرابط تلقائياً من العنوان.',
            edit: 'عنوان الصفحة.'
          },
          description: {
            create: 'قدّم وصفاً للصفحة الجديدة',
            edit: 'وصف الصفحة'
          },
          descriptionHelperText: {
            create:
              'يُستخدم الوصف لمحركات البحث ووسائل التواصل الاجتماعي. استهدف 160-165 حرفاً.',
            edit: 'يُستخدم الوصف لمحركات البحث ووسائل التواصل الاجتماعي. استهدف 160-165 حرفاً.'
          },
          parentPage: {
            create: 'اختر صفحة رئيسية',
            edit: 'الصفحة الرئيسية لهذه الصفحة'
          },
          parentHelperText: {
            create: 'تُعد هذه الصفحة الرئيسية للصفحة الجديدة.',
            edit: 'يمكنك نقل الصفحة إلى صفحة رئيسية أكثر ملاءمة.'
          },
          image: {
            create: 'صورة',
            edit: 'صورة'
          },
          imageHelperText: {
            create:
              'أضف صورة إلى الصفحة. إذا تُركت فارغة فسيتم استخدام صورة الصفحة الرئيسية أو الموقع.',
            edit: 'صورة الصفحة. إذا تُركت فارغة فسيتم استخدام صورة الصفحة الرئيسية أو الموقع.'
          },
          post: {
            create: 'اعتبارها مقالة',
            edit: 'مقالة'
          },
          postHelperText: {
            create: 'عيّن هذه الصفحة كمقالة لإضافة حقلي التاريخ والمؤلف.',
            edit: 'عيّن هذه الصفحة كمقالة لإضافة حقلي التاريخ والمؤلف.'
          },
          postDate: {
            create: 'أدخل تاريخاً للصفحة الجديدة',
            edit: 'تاريخ نشر الصفحة'
          },
          postDateHelperText: {
            create: 'سيُستخدم التاريخ لفرز المقالات.',
            edit: 'سيُستخدم التاريخ لفرز المقالات.'
          },
          postAuthor: {
            create: 'أدخل مؤلف الصفحة الجديدة',
            edit: 'مؤلف الصفحة'
          },
          postAuthorHelperText: {
            create: 'سيظهر كمؤلف للمقالة.',
            edit: 'سيظهر كمؤلف للمقالة.'
          },
          postCategory: {
            create: 'أدخل تصنيفاً للصفحة الجديدة',
            edit: 'تصنيف الصفحة'
          },
          postCategoryHelperText: {
            create: 'يُستخدم التصنيف لتنظيم المقالات.',
            edit: 'يُستخدم التصنيف لتنظيم المقالات.'
          },
          excludeFromIndex: {
            create: 'استبعاد من الفهرس',
            edit: 'استبعاد من الفهرس'
          },
          excludeFromIndexHelperText: {
            create:
              'استبعد هذه الصفحة من جميع قوائم الفهرس (مثل الأماكن التي تُعرض فيها الصفحات).',
            edit: 'استبعد هذه الصفحة من جميع قوائم الفهرس (مثل الأماكن التي تُعرض فيها الصفحات).'
          },
          placeholders: {
            title: 'العنوان',
            slug: 'slug',
            description: 'الوصف',
            author: 'المؤلف',
            category: 'التصنيف'
          },
          helper: {
            mediaDescription: 'حمّل صورة تُمثّل المؤسسة.'
          },
          errors: {
            slugInUse: 'الرابط مستخدم بالفعل',
            parentRequired: 'الصفحة الرئيسية مطلوبة',
            templateRequired: 'القالب مطلوب',
            dateRequired: 'التاريخ مطلوب للمقالات',
            authorRequired: 'المؤلف مطلوب للمقالات'
          },
          buttons: {
            preview: 'معاينة',
            edit: 'تحرير الصفحة',
            cancel: 'إلغاء',
            create: 'إنشاء الصفحة',
            save: 'حفظ الصفحة'
          }
        }
      },
      media: {
        title: 'Jaen CMS | الوسائط',
        menuLabel: 'الوسائط',
        breadcrumbs: {
          media: 'الوسائط'
        }
      },
      settings: {
        title: 'Jaen CMS | الإعدادات',
        menuLabel: 'الإعدادات',
        breadcrumbs: {
          settings: 'الإعدادات'
        }
      },
      debug: {
        title: 'Jaen CMS | تتبع الأخطاء',
        breadcrumbs: {
          debug: 'تتبع الأخطاء'
        }
      },
      notification: {
        title: 'Jaen CMS | الإشعارات',
        menuLabel: 'النوافذ المنبثقة',
        breadcrumbs: {
          popup: 'الإشعار'
        }
      }
    }
  }
}

type JaenLocaleDefinition = {
  code: I18nCode
  strings: Record<string, any>
  [section: string]: any
}

const locales: Record<I18nCode, JaenLocaleDefinition> = {
  'en-US': {code: 'en-US', strings: jaenStringsByLocale['en-US']},
  'de-AT': {code: 'de-AT', strings: jaenStringsByLocale['de-AT']},
  'tr-TR': {code: 'tr-TR', strings: jaenStringsByLocale['tr-TR']},
  'ar-EG': {code: 'ar-EG', strings: jaenStringsByLocale['ar-EG']}
}

const strip = <T extends Record<string, any>>(obj: T, keys: string[]) => {
  const out: Record<string, any> = {}
  for (const k in obj) if (!keys.includes(k)) out[k] = obj[k]
  return out
}

/**
 * Collect everything from homepage.*, contact.*, booking.* into one flat `messages` object.
 * - Merges all `*.strings` into top-level id:value pairs
 * - Adds all other top-level fields generically (no hardcoded sub-keys)
 */
export function getI18n(code: I18nCode): UnifiedI18n {
  const locale = locales[code] ?? locales['en-US']
  const strings = locale.strings ?? {}
  const messages: Record<string, any> = {
    ...strings,
    ...strip(locale, ['code', 'strings'])
  }

  return {
    code,
    messages,
    strings
  }
}
