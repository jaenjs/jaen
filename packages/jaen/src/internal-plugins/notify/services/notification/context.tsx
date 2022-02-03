import {
  Modal,
  ModalContent,
  ModalContentProps,
  ModalOverlay,
  useDisclosure
} from '@chakra-ui/react'
import {IJaenConnection, RequireAtLeastOne} from '@jaen/types'
import {PageProps} from 'gatsby'
import * as React from 'react'

type PositionProps = ModalContentProps & {size?: string; isCentered?: boolean}

export type NotificationOptions = {
  displayName?: string
  description?: string
  position?: 'modal' | 'modal-center'
  positionProps?: PositionProps
  conditions: RequireAtLeastOne<{
    entireSite: boolean
    templates: string[]
    urlPatterns: string[]
  }>
  triggers: RequireAtLeastOne<{
    onPageLoad: number
    onPageScroll: {
      percentage: number
      direction: 'up' | 'down'
    }
  }>
  advanced?: Partial<{
    showAfterXPageViews: number
    showUntilXPageViews: number
  }>
  customCondition?: (props: PageProps) => boolean
  customTrigger?: () => Promise<boolean>
}

export const NotificationContext =
  React.createContext<{} | undefined>(undefined)

export const useNotificationContext = () => {
  const context = React.useContext(NotificationContext)
  if (context === undefined) {
    throw new Error(
      `useNotificationContext must be used within a NotificationProvider`
    )
  }
  return context
}

export interface NotificationProviderProps extends NotificationOptions {
  id: string
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  position,
  positionProps,
  triggers,
  customTrigger,
  advanced
}) => {
  const {isOpen, onClose, onOpen} = useDisclosure({defaultIsOpen: false})

  const defaultPositonProps: PositionProps = {
    m: 0
  }

  switch (position) {
    case 'modal':
      defaultPositonProps.size = 'lg'
      break
    case 'modal-center':
      defaultPositonProps.size = 'lg'
      defaultPositonProps.isCentered = true
      break

    default:
      break
  }

  const {size, isCentered, ...positionPropsWithDefaults} = {
    ...defaultPositonProps,
    ...positionProps
  }

  React.useEffect(() => {
    customTrigger &&
      customTrigger().then(shouldOpen => {
        if (shouldOpen) {
          onOpen()
        }
      })
  }, [isOpen])

  React.useEffect(() => {
    if (triggers) {
      if (triggers.onPageLoad) {
        // wait onPageLoad seconds before opening
        setTimeout(() => {
          onOpen()
        }, triggers.onPageLoad * 1000)
      }

      if (triggers.onPageScroll) {
        const {percentage, direction} = triggers.onPageScroll
        const handleScroll = () => {
          const scrollPercentage =
            window.pageYOffset /
            (document.body.offsetHeight - window.innerHeight)

          if (
            (direction === 'up' && scrollPercentage > percentage) ||
            (direction === 'down' && scrollPercentage < percentage)
          ) {
            onOpen()
            window.removeEventListener('scroll', handleScroll)
          }
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  return (
    <NotificationContext.Provider value={{}}>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={size}
        isCentered={isCentered}>
        <ModalOverlay />
        <ModalContent {...positionPropsWithDefaults}>{children}</ModalContent>
      </Modal>
    </NotificationContext.Provider>
  )
}

export const connectNotification = <P extends {id: string}>(
  Component: React.ComponentType<P>,
  options: NotificationOptions
) => {
  const MyComp: IJaenConnection<P, typeof options> = props => {
    return (
      <NotificationProvider {...options}>
        <Component {...props} />
      </NotificationProvider>
    )
  }

  MyComp.options = options

  return MyComp
}

export type INotificationConnection = ReturnType<typeof connectNotification>

// is notification a banner or a modal?
// enable duration => set duration in interface
// default enabled / disabled
// extended usage => get access to the page props
