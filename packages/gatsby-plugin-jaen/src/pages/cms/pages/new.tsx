import {useLocation} from '@reach/router'
import {PageConfig, useNotificationsContext} from 'jaen'
import {navigate, PageProps} from 'gatsby'
import {useEffect, useMemo, useState} from 'react'

import {New} from '../../../components/cms/Pages/New'
import {
  CMSManagement,
  useCMSManagement
} from '../../../connectors/cms-management'
import {
  useJaenI18n,
  formatI18nMessage,
  resolveI18nCode
} from '../../../hooks/use-jaen-i18n'
import {getI18n} from '../../../locales'

const PagesNew: React.FC = () => {
  const {toast} = useNotificationsContext()
  const manager = useCMSManagement()
  const {strings} = useJaenI18n()
  const cmsPages = (strings?.cms?.pages as Record<string, any>) ?? {}
  const notifications = cmsPages.notifications ?? {}

  const parentPages = useMemo(() => {
    const pages = manager.pages()

    const _parentPages: {
      [pageId: string]: {
        label: string
        templates: {
          [templateId: string]: {
            label: string
          }
        }
      }
    } = {}

    for (const page of pages) {
      const pageTemplates = manager.templatesForPage(page.id)

      if (pageTemplates.length > 0) {
        _parentPages[page.id] = {
          label: page.jaenPageMetadata.title || page.slug,
          templates: pageTemplates.reduce((acc, template) => {
            acc[template.id] = {
              label: template.label
            }

            return acc
          }, {} as {[key: string]: {label: string}})
        }
      }
    }

    return _parentPages
  }, [])

  const location = useLocation()

  const [defaultParentPageId, setDefaultParentPageId] = useState<
    string | undefined
  >(undefined)

  const [addedPageId, setAddedPageId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (addedPageId) {
      navigate(manager.pagePath(addedPageId), {
        replace: true
      })

      setAddedPageId(undefined)
    }
  }, [addedPageId, manager.pagePath])

  useEffect(() => {
    try {
      const pageId = atob(location.hash.replace('#', ''))

      window.scrollTo(0, 0)

      if (parentPages[pageId]) {
        setDefaultParentPageId(pageId)
      }
    } catch (e) {
      console.error(e)
    }
  }, [location.hash, parentPages])

  return (
    <New
      form={{
        values: {
          parentPage: defaultParentPageId
        },
        parentPages,
        onSubmit: data => {
          const addedPageId = manager.addPage({
            slug: data.slug,
            template: data.template,
            parentPage: {
              id: data.parentPage
            },
            excludedFromIndex: data.isExcludedFromIndex,
            jaenPageMetadata: {
              title: data.title,
              image: data.image?.src,
              description: data.description,
              blogPost: data.blogPost
            }
          })

          toast({
            title: notifications.created ?? 'Page created',
            description: formatI18nMessage(
              notifications.createdDescription ??
                'Page {title} has been created',
              {title: data.title}
            ),
            status: 'success'
          })

          setAddedPageId(addedPageId)
        }
      }}
    />
  )
}

const Page: React.FC<PageProps> = () => {
  return (
    <CMSManagement>
      <PagesNew />
    </CMSManagement>
  )
}

export default Page

const getCmsMessages = (auth: {
  user?: {profile?: Record<string, string | undefined>}
}) => {
  const profile = auth.user?.profile ?? {}
  const localeCode = resolveI18nCode(
    profile.preferredLanguage ?? profile.locale ?? profile.language
  )

  const {strings} = getI18n(localeCode)
  return (strings.cms as Record<string, any>) ?? {}
}

export const pageConfig: PageConfig = {
  label: 'New page',
  breadcrumbs: [
    async ({auth}) => {
      const cms = getCmsMessages(auth)
      return {
        label: cms.labels?.root ?? 'CMS',
        path: '/cms/'
      }
    },
    async ({auth}) => {
      const cms = getCmsMessages(auth)
      return {
        label: cms.pages?.breadcrumbs?.pages ?? 'Pages',
        path: '/cms/pages/'
      }
    },
    async ({auth}) => {
      const cms = getCmsMessages(auth)
      return {
        label: cms.pages?.breadcrumbs?.new ?? 'New',
        path: '/cms/pages/new/'
      }
    }
  ],
  withoutJaenFrameStickyHeader: true,
  auth: {
    isAdminRequired: true
  },
  layout: {
    name: 'jaen',
    type: 'form'
  }
}

export {Head} from 'jaen'
