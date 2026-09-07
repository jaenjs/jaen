import {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
  type ComponentType
} from 'react'

import {NavigationGroupsProps} from '../components/JaenFrame/components/NavigationGroups'
import {NavigationItem} from '../components/JaenFrame/components/NavigationGroups/NavigationGroups'
import {MenuButtonProps} from '../components/shared/MenuButton'

/**
 * What the Media tab hands a source's list when it renders it: the source's
 * own open and remove, so a card can call them without knowing the source
 * object. Both are optional, a source that has neither renders a read only
 * grid.
 */
export interface MediaSourceListProps {
  onOpen?: (itemId: string) => void | Promise<void>
  onRemove?: (itemId: string) => void | Promise<void>
}

/**
 * A source of the Media tab beside the page images: an id, the label of its
 * tab, an icon, and the component that renders its grid. The list renders
 * with the source's own data (a TanStack Query hook of the registering app,
 * the skeleton first and the data when it lands) and receives `open` and
 * `remove` as props, see MediaSourceListProps.
 */
export interface MediaSource {
  id: string
  label: string
  icon?: ComponentType
  list: ComponentType<MediaSourceListProps>
  open?: (itemId: string) => void | Promise<void>
  remove?: (itemId: string) => void | Promise<void>
  /** Tabs are sorted by it, the page images always first. */
  order?: number
}

// Define the context type
type JaenFrameMenuContextType = {
  menu: {
    app: NavigationGroupsProps['groups']
    user: NavigationGroupsProps['groups']
  }
  extendMenu: (
    type: 'app' | 'user',
    menu: {
      group: string
      label?: string
      items: {[itemId: string]: NavigationItem}
    }
  ) => void

  addMenu: {
    items: MenuButtonProps['items']
  }

  extendAddMenu: (items: MenuButtonProps['items']) => void

  /** The registered sources of the Media tab, by their order. */
  mediaSources: MediaSource[]

  /**
   * Registers a source of the Media tab, the way extendMenu registers a
   * menu entry: keyed by id, so registering the same id again replaces the
   * source in place (a label in a new language, a new list) and nothing is
   * duplicated. It cannot remove, an entry stays until the page reloads.
   */
  registerMediaSource: (source: MediaSource) => void
}

// Create the context
const JaenFrameMenuContext = createContext<
  JaenFrameMenuContextType | undefined
>(undefined)

export const useJaenFrameMenuContext = () => {
  const context = useContext(JaenFrameMenuContext)
  if (!context) {
    throw new Error(
      'useJaenFrameMenuContext must be used within JaenFrameMenuProvider'
    )
  }
  return context
}

export const JaenFrameMenuProvider: React.FC<{
  children: React.ReactNode
}> = ({children}) => {
  const [menu, setMenu] = useState<JaenFrameMenuContextType['menu']>({
    app: {},
    user: {}
  })

  const [addMenu, setAddMenu] = useState<JaenFrameMenuContextType['addMenu']>({
    items: {}
  })

  const [sources, setSources] = useState<{[id: string]: MediaSource}>({})

  const extendMenu = (
    type: 'app' | 'user',
    menu: {
      group: string
      label: string
      items: {[itemId: string]: NavigationItem}
    }
  ) => {
    setMenu(prev => {
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [menu.group]: {
            ...prev[type]?.[menu.group],
            ...(menu.label ? {label: menu.label} : {}),
            items: {
              ...prev[type]?.[menu.group]?.items,
              ...menu.items
            }
          }
        }
      }
    })
  }

  const extendAddMenu = (items: MenuButtonProps['items']) => {
    setAddMenu(prev => {
      return {
        ...prev,
        items: {
          ...prev.items,
          ...items
        }
      }
    })
  }

  // Stable, unlike extendMenu: a registrar may list it in an effect's
  // dependencies without registering in a loop.
  const registerMediaSource = useCallback((source: MediaSource) => {
    setSources(prev => ({...prev, [source.id]: source}))
  }, [])

  const mediaSources = useMemo(
    () =>
      Object.values(sources).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)
      ),
    [sources]
  )

  const contextValue = useMemo(
    () => ({
      menu,
      extendMenu,
      addMenu,
      extendAddMenu,
      mediaSources,
      registerMediaSource
    }),
    [
      menu,
      extendMenu,
      addMenu,
      extendAddMenu,
      mediaSources,
      registerMediaSource
    ]
  )

  return (
    <JaenFrameMenuContext.Provider value={contextValue}>
      {children}
    </JaenFrameMenuContext.Provider>
  )
}
