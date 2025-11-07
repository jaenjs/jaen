import {useLocation} from '@reach/router'
import {navigate, PageProps} from 'gatsby'

import {PageConfig, useNotificationsContext} from 'jaen'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {FaArrowRight} from '@react-icons/all-files/fa/FaArrowRight'
import {FaEdit} from '@react-icons/all-files/fa/FaEdit'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'
import {FaClone} from '@react-icons/all-files/fa/FaClone'

import {Pages} from '../../../components/cms/Pages/Pages'
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

const PagesPage: React.FC = () => {
  const {toast, prompt, confirm} = useNotificationsContext()
  const manager = useCMSManagement()
  const {strings} = useJaenI18n()
  const cmsPages = (strings?.cms?.pages as Record<string, any>) ?? {}
  const labels = cmsPages.labels ?? {}
  const notifications = cmsPages.notifications ?? {}
  const actions = cmsPages.actions ?? {}
  const descriptions = cmsPages.descriptions ?? {}
  const prompts = cmsPages.prompts ?? {}
  const formButtons = cmsPages.form?.buttons ?? {}

  const [currentPageId, setCurrentPageId] = useState<string | undefined>(
    undefined
  )

  useEffect(() => {
    // scroll to top
    window.scrollTo(0, 0)
  }, [currentPageId])

  const location = useLocation()

  useEffect(() => {
    try {
      const pageId = atob(location.hash.replace('#', ''))

      setCurrentPageId(pageId || undefined)
    } catch (e) {
      setCurrentPageId(undefined)
    }
  }, [location.hash])

  const currentPage = useMemo(() => {
    try {
      return manager.page(currentPageId)
    } catch {
      // Clear location hash if page is not found

      return manager.page()
    }
  }, [currentPageId, manager.page])

  // useEffect(() => {
  //  // check if location is
  // }, [currentPage, location.hash])

  const children = useMemo(() => {
    const pages = manager.pages(currentPage.id)

    return pages.map(p => {
      return {
        id: p.id,
        title:
          p.jaenPageMetadata.title || labels.noTitle || 'No title',
        description:
          p.jaenPageMetadata.description ||
          labels.noDescription ||
          'No description',
        createdAt: p.createdAt,
        modifiedAt: p.modifiedAt
        // author: p.jaenPageMetadata.blogPost?.author
      }
    })
  }, [currentPage.id, manager.pages])

  const handleTreeSelect = useCallback(
    (id: string) => {
      setCurrentPageId(id || undefined)

      if (id) {
        navigate(`#${btoa(id)}`)
      } else {
        navigate('#')
      }
    },
    [manager]
  )

  // const parentPages = useMemo(() => {
  //   if (!currentPage.parentPage?.id) return {}

  //   const parentPage = manager.page(currentPage.parentPage.id)

  //   return {
  //     [currentPage.parentPage.id]: {
  //       label: parentPage.jaenPageMetadata?.title || parentPage.slug,
  //       templates: manager
  //         .templatesForPage(currentPage.parentPage.id)
  //         .reduce((acc, template) => {
  //           acc[template.id] = {
  //             label: template.label
  //           }

  //           return acc
  //         }, {} as {[key: string]: {label: string}})
  //     }
  //   }
  // }, [currentPage.parentPage?.id, manager])

  const parentPages = useMemo(() => {
    const pages = manager.pages()

    // use the manager.tree to blacklist all children of current page
    const blacklist: string[] = []

    const recursiveBlacklist = (pageId?: string) => {
      if (!pageId) return

      const page = manager.page(pageId)

      if (!page) return

      for (const child of page.childPages) {
        blacklist.push(child.id)
        recursiveBlacklist(child.id)
      }
    }

    recursiveBlacklist(currentPage.id)

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
      // skip if page is current page
      if (page.id === currentPage.id) {
        continue
      }

      // skip if page is in blacklist
      if (blacklist.includes(page.id)) {
        continue
      }

      const pageTemplates = manager.templatesForPage(page.id)

      if (pageTemplates.length > 0) {
        // skip if pageTemplates do not contain current page template
        if (
          !pageTemplates.find(template => template.id === currentPage.template)
        ) {
          continue
        }

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
  }, [manager, currentPage])

  const updatePageChildsOrder = useCallback(
    (newOrder: string[]) => {
      manager.updatePage(currentPage.id, {
        childPagesOrder: newOrder
      })
    },
    [manager]
  )

  return (
    <Pages
      pageId={currentPage.id}
      form={{
        // Always disable slug because the slug can only be changed in the danger zone
        disableSlug: true,
        values: {
          title: currentPage.jaenPageMetadata?.title || 'No title',
          image: {
            src: currentPage.jaenPageMetadata?.image
          },
          slug: currentPage.slug,
          template: currentPage.template,
          description:
            currentPage.jaenPageMetadata.description || 'No description',
          parentPage: currentPage.parentPage?.id,
          isExcludedFromIndex: currentPage.excludedFromIndex,
          blogPost: currentPage.jaenPageMetadata.blogPost
        },
        parentPages,
        onSubmit: data => {
          manager.updatePage(currentPage.id, {
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
            title: notifications.updated ?? 'Page updated',
            description: formatI18nMessage(
              notifications.updatedDescription ??
                'Page {title} has been updated',
              {title: data.title}
            ),
            status: 'success'
          })
        },
        path: manager.pagePath(currentPage.id),
        jaenTemplates: manager.templates
      }}
      children={children}
      onUpdateChildPagesOrder={updatePageChildsOrder}
      tree={manager.tree}
      onTreeSelect={handleTreeSelect}
      disableNewButton={manager.templatesForPage(currentPage.id).length === 0}
      dangerZoneActions={[
        {
          title: actions.duplicate ?? 'Duplicate page',
          description:
            descriptions.duplicate ??
            'This will duplicate the page with its subpages.',
          buttonText: actions.duplicate ?? 'Duplicate page',
          icon: FaClone,
          onClick: async () => {
            const duplicatePrompt = prompts.duplicate ?? {}
            const slug = await prompt({
              title:
                duplicatePrompt.title ??
                actions.duplicate ??
                'Duplicate page',
              message:
                duplicatePrompt.message ??
                'Please enter a new slug for the duplicated page. This will affect the path.',
              confirmText:
                duplicatePrompt.confirm ??
                actions.duplicate ??
                'Duplicate',
              cancelText:
                duplicatePrompt.cancel ?? formButtons.cancel ?? 'Cancel',
              placeholder: formatI18nMessage(
                duplicatePrompt.placeholder ?? '{slug}-copy',
                {slug: currentPage.slug}
              )
            })

            if (slug) {
              try {
                manager.clonePage(currentPage.id, slug)

                toast({
                  title: notifications.duplicated ?? 'Page duplicated',
                  description: formatI18nMessage(
                    notifications.duplicatedDescription ??
                      'Page {slug} has been duplicated',
                    {slug: currentPage.slug}
                  ),
                  status: 'success'
                })
              } catch (e) {
                toast({
                  title:
                    notifications.duplicateFailed ??
                    'Could not duplicate page',
                  description: e.message,
                  status: 'error'
                })
              }
            }
          },
          isDisabled: !currentPage.template
        },
        {
          title: actions.move ?? 'Move page',
          description:
            descriptions.move ?? 'This will move the page and all its subpages.',
          buttonText: actions.move ?? 'Move page',
          icon: FaArrowRight,
          onClick: async () => {
            const options = Object.entries(parentPages).map(
              ([pageId, page]) => {
                return {
                  id: pageId,
                  label: page.label
                }
              }
            )

            const parentPageId = await prompt(
              {
                title: prompts.move?.title ?? actions.move ?? 'Move page',
                message:
                  prompts.move?.message ??
                  'Please select a new parent page.',
                confirmText:
                  prompts.move?.confirm ?? actions.move ?? 'Move',
                cancelText:
                  prompts.move?.cancel ?? formButtons.cancel ?? 'Cancel',
                options
              },
              currentPage.parentPage?.id
            )

            if (parentPageId) {
              try {
                manager.updatePage(currentPage.id, {
                  parentPage: {
                    id: parentPageId
                  }
                })

                toast({
                  title: notifications.moved ?? 'Page moved',
                  description: formatI18nMessage(
                    notifications.movedDescription ??
                      'Page {slug} has been moved',
                    {slug: currentPage.slug}
                  ),
                  status: 'success'
                })
              } catch (e) {
                toast({
                  title:
                    notifications.moveFailed ?? 'Could not move page',
                  description: e.message,
                  status: 'error'
                })
              }
            }
          },
          isDisabled: !currentPage.template
        },
        {
          title: actions.updateSlug ?? 'Update slug',
          description:
            descriptions.updateSlug ??
            'This will rename the slug and thus affects the path of the page and all its subpages.',
          buttonText: actions.renameSlug ?? 'Rename slug',
          icon: FaEdit,
          onClick: async () => {
            const renamePrompt = prompts.renameSlug ?? {}
            const slug = await prompt({
              title:
                renamePrompt.title ??
                actions.renameSlug ??
                'Rename slug',
              message:
                renamePrompt.message ??
                'Please enter a new slug. This will affect the path.',
              confirmText:
                renamePrompt.confirm ?? actions.renameSlug ?? 'Rename',
              cancelText:
                renamePrompt.cancel ?? formButtons.cancel ?? 'Cancel',
              placeholder: currentPage.slug
            })

            if (slug) {
              try {
                manager.updatePage(currentPage.id, {
                  slug
                })

                toast({
                  title: notifications.slugUpdated ?? 'Slug updated',
                  description: formatI18nMessage(
                    notifications.slugUpdatedDescription ??
                      'Slug has been updated to {slug}',
                    {slug}
                  ),
                  status: 'success'
                })
              } catch (e) {
                toast({
                  title:
                    notifications.slugUpdateFailed ??
                    'Could not update slug',
                  description: e.message,
                  status: 'error'
                })
              }
            }
          },
          isDisabled: !currentPage.template
        },
        {
          title: actions.deleteThis ?? 'Delete this page',
          description:
            descriptions.delete ??
            'This will delete the page and all its subpages.',
          buttonText: actions.delete ?? 'Delete page',
          icon: FaTrash,
          onClick: async () => {
            const ok = await confirm({
              title:
                prompts.delete?.title ?? actions.delete ?? 'Delete page',
              message:
                prompts.delete?.message ??
                'Are you sure you want to delete this page and all its subpages?'
            })

            if (ok) {
              manager.removePage(currentPage.id)

              toast({
                title: notifications.deleted ?? 'Page deleted',
                description: formatI18nMessage(
                  notifications.deletedDescription ??
                    'Page {slug} has been deleted',
                  {slug: currentPage.slug}
                ),
                status: 'success'
              })
            }

            setCurrentPageId(currentPage.parentPage?.id)
          },
          isDisabled: !currentPage.template
        }
      ]}
    />
  )
}

const Page: React.FC<PageProps> = () => {
  return (
    <CMSManagement>
      <PagesPage />
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
  label: 'Jaen CMS | Pages',
  icon: 'FaSitemap',

  menu: {
    label: 'Pages',
    type: 'app',
    group: 'cms',
    order: 200
  },
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
    }
  ],
  withoutJaenFrameStickyHeader: true,
  auth: {
    isAdminRequired: true
  },
  layout: {
    name: 'jaen'
  }
}

export {Head} from 'jaen'
