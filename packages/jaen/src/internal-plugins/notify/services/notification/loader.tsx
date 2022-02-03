import {IJaenPageProps} from '@jaen/internal-plugins/pages/types'
import {graphql, PageProps, useStaticQuery} from 'gatsby'
import * as React from 'react'
import {INotification} from '../../types'
import {INotificationConnection} from './context'

type QueryData = {
  jaenNotifications: {
    nodes: Array<{
      name: string
      relativePath: string
    }>
  }
  allJaenNotification: {
    nodes: Array<INotification>
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
        allJaenNotification {
          nodes {
            id
            jaenFields
          }
        }
      }
    `)
  } catch (e) {
    staticData = {
      jaenNotifications: {
        nodes: []
      },
      allJaenNotification: {
        nodes: []
      }
    }
  }

  return staticData
}

const loadNotifications = (
  jaenNotifications: QueryData['jaenNotifications'],
  allJaenNotification: QueryData['allJaenNotification'],
  pageProps: IJaenPageProps
) => {
  const blacklist = ['/jaen']

  if (blacklist.some(item => pageProps.path.startsWith(item))) {
    return []
  }

  const notificationLoader = (
    relativePath: string
  ): INotificationConnection => {
    return (
      //@ts-ignore
      require(`${___JAEN_NOTIFICATIONS___}/${relativePath}`).default
    )
  }

  const notifications: Array<JSX.Element> = []

  const addNotification = (id: string, Component: INotificationConnection) => {
    const notification = allJaenNotification.nodes.find(node => node.id === id)

    notifications.push(<Component id={id} notification={notification} />)
  }

  for (const {relativePath} of jaenNotifications.nodes) {
    const Notification = notificationLoader(relativePath)

    const {conditions, customCondition} = Notification.options

    //> Conditions
    if (customCondition) {
      const show = customCondition(pageProps)

      if (show) {
        addNotification(relativePath, Notification)
        break
      }
    }

    if (conditions) {
      const {entireSite, templates, urlPatterns} = conditions

      //> Entire site
      if (entireSite) {
        addNotification(relativePath, Notification)
        break
      }

      //> Templates
      if (templates) {
        const staticTemplate = pageProps.data?.jaenPage?.template

        if (staticTemplate && templates.includes(staticTemplate)) {
          addNotification(relativePath, Notification)
          break
        }
      }

      //> Url patterns
      if (urlPatterns) {
        const staticUrl = pageProps.location.pathname

        for (const urlPattern of urlPatterns) {
          if (staticUrl.match(urlPattern)) {
            addNotification(relativePath, Notification)
            break
          }
        }
      }
    }
  }

  return notifications
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
  const {jaenNotifications, allJaenNotification} = useStaticData()

  const notifications = React.useMemo(
    () =>
      loadNotifications(
        jaenNotifications,
        allJaenNotification,
        pageProps as any
      ),
    [jaenNotifications, pageProps]
  )

  return (
    <>
      <>{notifications}</>
      {children}
    </>
  )
}
