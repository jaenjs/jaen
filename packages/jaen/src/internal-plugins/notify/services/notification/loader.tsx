import {IJaenPageProps} from '@jaen/internal-plugins/pages/types'
import {graphql, PageProps, useStaticQuery} from 'gatsby'
import * as React from 'react'
import {store} from '../../redux'
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

const notificationLoader = (relativePath: string): INotificationConnection => {
  return (
    //@ts-ignore
    require(`${___JAEN_NOTIFICATIONS___}/${relativePath}`).default
  )
}

export const loadNotificationsComponent = (
  jaenNotifications: QueryData['jaenNotifications'],
  allJaenNotification: QueryData['allJaenNotification']
) => {
  const notifications: Array<{
    id: string
    notification: INotification
    Component: INotificationConnection
  }> = []

  for (const {relativePath} of jaenNotifications.nodes) {
    const Notification = notificationLoader(relativePath)
    if (Notification) {
      const notification = allJaenNotification.nodes.find(
        node => node.id === relativePath
      )

      if (notification) {
        notifications.push({
          id: relativePath,
          notification,
          Component: Notification
        })
      }
    }
  }

  return notifications
}

export const useNotifications = () => {
  const staticData = useStaticData()

  const notifications = React.useMemo(
    () =>
      loadNotificationsComponent(
        staticData.jaenNotifications,
        staticData.allJaenNotification
      ),
    []
  )

  return notifications
}

export const loadNotificationsForPage = (
  jaenNotifications: QueryData['jaenNotifications'],
  allJaenNotification: QueryData['allJaenNotification'],
  pageProps: IJaenPageProps
) => {
  const blacklist = ['/jaen']

  if (blacklist.some(item => pageProps.path.startsWith(item))) {
    return []
  }

  const notifications = loadNotificationsComponent(
    jaenNotifications,
    allJaenNotification
  )

  const allNotificationElement: Array<JSX.Element> = []

  for (const {Component, notification} of notifications) {
    const isActive = store.getState().internal.notifications.nodes?.[
      notification.id
    ]?.active

    if (isActive === false || notification.active === false) {
      break
    }

    const pushNotification = () => {
      allNotificationElement.push(
        <Component id={notification.id} notification={notification} />
      )
    }

    //> Conditions
    const {conditions, customCondition} = Component.options

    if (customCondition) {
      const condition = customCondition(pageProps)

      if (condition) {
        pushNotification()
        break
      }
    }

    if (conditions) {
      const {entireSite, templates, urlPatterns} = conditions
      //> Entire site
      if (entireSite) {
        pushNotification()
        break
      }

      //> Templates
      if (templates) {
        const staticTemplate = pageProps.data?.jaenPage?.template

        if (staticTemplate && templates.includes(staticTemplate)) {
          pushNotification()
          break
        }
      }

      //> Url patterns
      if (urlPatterns) {
        const staticUrl = pageProps.location.pathname

        for (const urlPattern of urlPatterns) {
          if (staticUrl.match(urlPattern)) {
            pushNotification()
            break
          }
        }
      }
    }
  }

  return allNotificationElement
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
      loadNotificationsForPage(
        jaenNotifications,
        allJaenNotification,
        pageProps as any
      ),
    [jaenNotifications, pageProps]
  )

  console.log('NOTIFICAITONS', notifications)
  return (
    <>
      <>{notifications}</>
      {children}
    </>
  )
}
