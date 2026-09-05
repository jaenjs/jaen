import {
  PageConfig,
  useAuth,
  useJaenUpdateModalContext,
  useMediaModal,
  useNotificationsContext,
  checkUserRoles,
  useAuthUser
} from 'jaen'
import {graphql, SliceComponentProps} from 'gatsby'
import {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {globalHistory} from '@reach/router'

import {FaEdit} from '@react-icons/all-files/fa/FaEdit'
import {FaFileDownload} from '@react-icons/all-files/fa/FaFileDownload'
import {FaFileUpload} from '@react-icons/all-files/fa/FaFileUpload'
import {FaGlobe} from '@react-icons/all-files/fa/FaGlobe'
import {FaImage} from '@react-icons/all-files/fa/FaImage'
import {FaSitemap} from '@react-icons/all-files/fa/FaSitemap'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'

import {useJaenFrameMenuContext} from '../contexts/jaen-frame-menu'
import JaenFrame from '../components/JaenFrame/JaenFrame'
import Logo from '../components/Logo'
import {CMSManagement, useCMSManagement} from '../connectors/cms-management'
import {usePageConfig} from './page-config-parser'

type SliceProps = SliceComponentProps<
  {
    allSitePage: {
      nodes: Array<{
        id: string
        path: string
        pageContext: {
          pageConfig: PageConfig
          /** Set by gatsby-source-jaen on the per-locale clones of a page. */
          locale?: string
          localePagesId?: string
        }
      }>
    }
  },
  {},
  {
    jaenPageId: string
    pageConfig: any
  }
>

const Slice: React.FC<SliceProps> = props => {
  const intl = useIntl()
  const manager = useCMSManagement()

  const auth = useAuth()
  const authUser = useAuthUser()
  const mediaModal = useMediaModal({
    id: 'JaenFrameMediaModal'
  })

  const {toast} = useNotificationsContext()

  const jaenUpdate = useJaenUpdateModalContext()

  const isBadgeVisible = manager.isEditing || jaenUpdate.isUpdateAvailable

  const {menu, extendMenu, addMenu, extendAddMenu} = useJaenFrameMenuContext()

  const {parsePageConfig} = usePageConfig()

  const [pageConfig, setPageConfig] = useState<PageConfig>()

  useEffect(() => {
    if (props.pageConfig) {
      parsePageConfig(props.pageConfig).then(config => {
        setPageConfig(config)
      })
    }

    globalHistory.listen(({action}) => {
      if (action !== 'PUSH') return

      if (props.pageConfig) {
        parsePageConfig(props.pageConfig).then(config => {
          setPageConfig(config)
        })
      }
    })
  }, [props.pageConfig])

  // Runs again when the language changes. The frame's own entries, Settings
  // and Logout among them, are registered with strings formatted at the
  // moment this effect runs, and on the first pass that moment comes before
  // the account's preferredLanguage has been read and before the browser
  // languages have been looked at, so the locale is still the en-US default.
  // Without intl.locale in the list the drawer kept "Settings" and "Logout"
  // beside a page that had long switched to German. extendMenu merges by
  // group and item id, so a second pass overwrites the labels in place.
  useEffect(() => {
    const isJaenAdmin = checkUserRoles(auth.user, ['jaen:admin'])

    if (isJaenAdmin) {
      // extendMenu('user', {
      //   group: 'add',
      //   items: {
      //     addPage: {
      //       label: 'New page',
      //       icon: FaSitemap,
      //       path: `/cms/pages/new/#${btoa(props.jaenPageId)}`
      //     },
      //     addMedia: {
      //       label: 'New media',
      //       icon: FaImage,
      //       onClick: () => {
      //         mediaModal.toggleModal()
      //       }
      //     }
      //   }
      // })

      // Add jaenCMS user menu
      extendMenu('user', {
        group: 'jaenCMS',
        label: intl.formatMessage({
          id: 'CmsDashboardMenuGroupLabel',
          defaultMessage: 'Jaen CMS'
        }),
        items: {
          edit: {
            label: manager.isEditing
              ? intl.formatMessage({
                  id: 'CmsFrameStopEditing',
                  defaultMessage: 'Stop editing'
                })
              : intl.formatMessage({
                  id: 'CmsFrameStartEditing',
                  defaultMessage: 'Start editing'
                }),
            icon: FaEdit,
            onClick: () => {
              manager.setIsEditing(!manager.isEditing)

              toast({
                title: intl.formatMessage({
                  id: 'CmsFrameNotificationsEditModeTitle',
                  defaultMessage: 'Edit mode'
                }),
                description: !manager.isEditing
                  ? intl.formatMessage({
                      id: 'CmsFrameNotificationsEditModeOn',
                      defaultMessage: 'You can now edit the page'
                    })
                  : intl.formatMessage({
                      id: 'CmsFrameNotificationsEditModeOff',
                      defaultMessage: 'You can no longer edit the page'
                    }),
                status: !manager.isEditing ? 'success' : 'info'
              })
            },
            order: 1
          },
          save: {
            label: intl.formatMessage({
              id: 'CmsFrameSaveDraft',
              defaultMessage: 'Save draft'
            }),
            icon: FaFileDownload,
            onClick: () => {
              manager.draft.save()

              toast({
                title: intl.formatMessage({
                  id: 'CmsFrameNotificationsSaved',
                  defaultMessage: 'Saved'
                }),
                description: intl.formatMessage({
                  id: 'CmsFrameNotificationsSavedDescription',
                  defaultMessage: 'Your changes have been saved'
                }),
                status: 'success'
              })
            },
            order: 2
          },
          import: {
            label: intl.formatMessage({
              id: 'CmsFrameImportDraft',
              defaultMessage: 'Import draft'
            }),
            icon: FaFileUpload,
            onClick: async () => {
              try {
                await manager.draft.import()

                toast({
                  title: intl.formatMessage({
                    id: 'CmsFrameNotificationsImported',
                    defaultMessage: 'Imported'
                  }),
                  description: intl.formatMessage({
                    id: 'CmsFrameNotificationsImportedDescription',
                    defaultMessage: 'Your changes have been imported'
                  }),
                  status: 'success'
                })
              } catch (e) {
                toast({
                  title: intl.formatMessage({
                    id: 'CmsFrameNotificationsImportFailed',
                    defaultMessage: 'Failed to import'
                  }),
                  description: intl.formatMessage({
                    id: 'CmsFrameNotificationsImportFailedDescription',
                    defaultMessage: 'Your changes could not be imported'
                  }),
                  status: 'error'
                })
              }
            },
            order: 3
          },
          discard: {
            label: intl.formatMessage({
              id: 'CmsFrameDiscardChanges',
              defaultMessage: 'Discard changes'
            }),
            icon: FaTrash,
            onClick: () => {
              manager.draft.discard()

              toast({
                title: intl.formatMessage({
                  id: 'CmsFrameNotificationsDiscarded',
                  defaultMessage: 'Discarded'
                }),
                description: intl.formatMessage({
                  id: 'CmsFrameNotificationsDiscardedDescription',
                  defaultMessage: 'Your changes have been discarded'
                }),
                status: 'info'
              })
            }
          },
          publish: {
            label: intl.formatMessage(
              {
                id: 'CmsFramePublish',
                defaultMessage:
                  '{isPublishing, select, true {Publish in progress} other {Publish changes}}'
              },
              {isPublishing: String(manager.isPublishing)}
            ),
            isLoading: manager.isPublishing,
            icon: FaGlobe,
            onClick: async () => {
              manager.draft.publish()
            },
            order: 4
          }
        }
      })

      // Add jaenCMS add menu
      extendAddMenu({
        addPage: {
          label: intl.formatMessage({
            id: 'CmsPagesTableNewPage',
            defaultMessage: 'New page'
          }),
          icon: FaSitemap,
          path: props.jaenPageId
            ? `/cms/pages/new/#${btoa(props.jaenPageId)}`
            : '/cms/pages/new/'
        },
        addMedia: {
          label: intl.formatMessage({
            id: 'CmsFrameNewMedia',
            defaultMessage: 'New media'
          }),
          icon: FaImage,
          onClick: () => {
            mediaModal.toggleModal()
          }
        }
      })
    }

    // Stateful pages fan out into one SitePage per locale, and every clone
    // carries the same pageConfig, so a page with a menu entry turned up once
    // per locale: five "Blog" items on a five-locale site. One item per
    // localePagesId; among the clones the shortest path is the unprefixed
    // one, which is the default locale and the address the menu should use.
    const byLocalePages = new Map<
      string,
      (typeof props.data.allSitePage.nodes)[number]
    >()
    const singles: typeof props.data.allSitePage.nodes = []

    for (const node of props.data.allSitePage.nodes) {
      const key = node.pageContext?.localePagesId

      if (!key) {
        singles.push(node)
        continue
      }

      const kept = byLocalePages.get(key)

      if (!kept || node.path.length < kept.path.length) {
        byLocalePages.set(key, node)
      }
    }

    const uniqueNodes = [...singles, ...byLocalePages.values()]

    const sortedNodes = uniqueNodes.sort((a, b) => {
      const aOrder = a.pageContext.pageConfig?.menu?.order || 0
      const bOrder = b.pageContext.pageConfig?.menu?.order || 0
      return aOrder - bOrder
    })

    // Every pass of this effect resolves the labels asynchronously, the icon
    // table is a lazy chunk, and a pass that started under en-US could land
    // after the pass the language change started: measured 2026-09-05 on
    // limosen.at, /de/ read Einstellungen while /cms/ and /app/transfers/
    // kept Settings and Logout from the earlier, slower pass. A pass that
    // has been superseded registers nothing.
    let superseded = false

    sortedNodes.forEach(async node => {
      const config = await parsePageConfig(node.pageContext.pageConfig)

      if (superseded) return

      if (!config?.menu) return

      if (config.auth?.isAdminRequired && !isJaenAdmin) return

      // Make sure at least one role of config.auth?.roles is in authentication.user?.roles
      const configRoles = config.auth?.roles || []

      if (configRoles.length > 0) {
        if (!checkUserRoles(auth.user, configRoles)) return
      }

      const group = config.menu.group || 'default'

      const groupType = config.menu.type === 'app' ? 'app' : 'user'

      // The icon table lives in its own chunk; see resolve-jaen-icon.ts. It
      // is 70 KiB and only an admin ever reaches this line.
      const icon = config.icon
        ? await (
            await import('./resolve-jaen-icon')
          ).resolveJaenIcon(config.icon)
        : undefined

      if (superseded) return

      extendMenu(groupType, {
        group,
        label: config.menu.groupLabel,
        items: {
          [node.id]: {
            label: config.menu?.label?.toString() || config.label,
            path: config.menu?.path?.toString() || node.path,
            order: config.menu?.order,
            icon
          }
        }
      })
    })

    return () => {
      superseded = true
    }
  }, [auth.user, props.data.allSitePage.nodes, manager.isEditing, intl.locale])

  return (
    <JaenFrame
      navigation={{
        isStickyDisabled: pageConfig?.withoutJaenFrameStickyHeader,
        app: {
          navigationGroups: menu.app,
          // @ts-ignore
          version: __VERSION__,
          logo: <Logo />
        },
        user: {
          user: auth.user?.profile
            ? {
                username:
                  auth.user.profile.preferred_username?.replace(
                    `@${auth.user.profile['urn:zitadel:iam:user:resourceowner:primary_domain']}`,
                    ''
                  ) || auth.user.profile.sub,
                firstName:
                  authUser.user?.human?.profile?.firstName ||
                  auth.user?.profile?.given_name,
                lastName:
                  authUser.user?.human?.profile?.lastName ||
                  auth.user?.profile?.family_name,
                avatarURL:
                  authUser.user?.human?.profile?.avatarUrl ||
                  auth.user?.profile?.picture
              }
            : {
                username: intl.formatMessage({
                  id: 'CmsFrameGuest',
                  defaultMessage: 'Guest'
                })
              },
          navigationGroups: menu.user,
          isBadgeVisible
        },
        addMenu,
        breadcrumbs: {
          links: (pageConfig?.breadcrumbs as any) || []
        }
      }}
      logo={<Logo />}
    />
  )
}

const JaenFrameSlice: React.FC<SliceProps> = props => {
  const auth = useAuth()

  const isJaenAdmin = checkUserRoles(auth.user, ['jaen:admin'])

  if (isJaenAdmin) {
    return (
      <CMSManagement>
        <Slice {...props} />
      </CMSManagement>
    )
  }

  return <Slice {...props} />
}

export default JaenFrameSlice

export const query = graphql`
  query {
    allSitePage {
      nodes {
        id
        path
        pageContext
      }
    }
  }
`
