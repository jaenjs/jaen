import {IJaenPageProps} from '@jaen/internal-plugins/pages/types'
import {usePromiseEffect} from '@jaen/utils/hooks/usePromiseEffect'
import {graphql, PageProps, useStaticQuery} from 'gatsby'
import * as React from 'react'
import {INotificationConnection} from './context'

type QueryData = {
  jaenNotifications: {
    nodes: Array<{
      name: string
      relativePath: string
    }>
  }
}

const useStaticData = () => {
  let staticData: QueryData

  try {
    staticData = useStaticQuery<QueryData>(graphql`
      query {
        jaenNotifications: allFile(
          filter: {sourceInstanceName: {eq: "notifications"}}
        ) {
          nodes {
            name
            relativePath
          }
        }
      }
    `)
  } catch (e) {
    staticData = {
      jaenNotifications: {
        nodes: []
      }
    }
  }

  return staticData
}

/**
 * Loads the notifications for a given page.
 * Only notifications that match the page's conditions are returned.
 *
 * Known limitation:
 * -    The `templates` condition is only checked in buildtime. That means that
 *      if you add a new page, the notification will not be shown until the page
 *      is published.
 */
export const NotificationsLoader: React.FC<{pageProps: PageProps}> = ({
  children,
  pageProps
}) => {
  const {jaenNotifications} = useStaticData()

  const notificationsPaths = React.useMemo(
    () =>
      jaenNotifications.nodes.reduce<{[name: string]: string}>((dict, node) => {
        dict[node.name] = node.relativePath
        return dict
      }, {}),
    []
  )

  const notificationLoader = async (
    name: string
  ): Promise<INotificationConnection> => {
    return (
      //@ts-ignore
      (await import(`${___JAEN_NOTIFICATIONS___}/${notificationsPaths[name]}`))
        .default
    )
  }

  const {value: Notifications} = usePromiseEffect(async () => {
    const loadNotifications = async (pageProps: IJaenPageProps) => {
      const Notifications: Array<INotificationConnection> = []

      for (const {name} of jaenNotifications.nodes) {
        const Notification = await notificationLoader(name)

        const {conditions, customCondition} = Notification.options

        //> Conditions
        if (customCondition) {
          const show = customCondition(pageProps)

          if (show) {
            Notifications.push(Notification)
            break
          }
        }

        if (conditions) {
          const {entireSite, templates, urlPatterns} = conditions

          //> Entire site
          if (entireSite) {
            Notifications.push(Notification)
            break
          }

          //> Templates
          if (templates) {
            const staticTemplate = pageProps.data?.jaenPage?.template

            if (staticTemplate && templates.includes(staticTemplate)) {
              Notifications.push(Notification)
              break
            }
          }

          //> Url patterns
          if (urlPatterns) {
            const staticUrl = pageProps.location.pathname

            for (const urlPattern of urlPatterns) {
              if (staticUrl.match(urlPattern)) {
                Notifications.push(Notification)
                break
              }
            }
          }
        }
      }

      return Notifications
    }
    return await loadNotifications(pageProps as any)
  }, [pageProps])

  return (
    <>
      {Notifications && (
        <>
          {Notifications.map(Notification => (
            <Notification />
          ))}
        </>
      )}
      {children}
    </>
  )
}