import {createContext, useCallback, useContext, useState, useMemo} from 'react'

import type {MediaNode} from 'jaen'

import {NavigationGroupsProps} from '../components/JaenFrame/components/NavigationGroups'
import {NavigationItem} from '../components/JaenFrame/components/NavigationGroups/NavigationGroups'
import {MenuButtonProps} from '../components/shared/MenuButton'

/**
 * A media node of an app's folder. jaen's own MediaNode is an image and
 * says nothing about its type, so the one thing a folder adds is the
 * gateway's `mimeType`: a node that says `application/pdf` draws the
 * document icon and its file name in the grid and opens its url in a new
 * tab, everything else draws its picture. See okf/architecture/media.md in
 * the taxi-app repository, "One gallery, jaen's".
 */
export interface MediaFolderNode extends MediaNode {
  /** What the storage gateway answered, `image/png`, `application/pdf`. */
  mimeType?: string
}

/**
 * Folders an app adds to the Media tab's tree, with the nodes that live in
 * them. There is one gallery and it is jaen's: no tab, no chrome of its
 * own, the app's folders sit in the same tree as the pages and their nodes
 * are in the same grid as the page images.
 *
 * - `id` and `label` are the folder itself, "Fahrzeuge" or "Dokumente".
 * - `tree` are its children, one per car or one per month. A child's `id`
 *   is what the folder's nodes carry as their `jaenPageId`, which is how
 *   selecting a child filters the grid: the gallery filters by that field
 *   and knows nothing else about either.
 * - `nodes` come from the registering app's own read (a TanStack Query
 *   hook), not from the CMS field, so nothing needs a publish and every
 *   admin sees the same list on every device.
 * - `onDelete` removes the thing behind a node (a car's picture, a
 *   document row). A folder without one shows a read only grid.
 *
 * Upload inside such a folder is refused with `uploadHint`, because a car's
 * picture is uploaded on the car and a document on its ride.
 */
export interface MediaFolders {
  id: string
  label: string
  tree: MediaFolderTreeNode[]
  nodes: MediaFolderNode[]
  onDelete?: (nodeId: string) => void | Promise<void>
  /** The one line the gallery shows where upload is refused. */
  uploadHint?: string
  /** Folders are sorted by it, the page tree always first. */
  order?: number
}

/** A folder's child, the shape the page tree already draws. */
export interface MediaFolderTreeNode {
  id: string
  label: string
  children: MediaFolderTreeNode[]
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

  /** The registered folders of the Media tab, by their order. */
  mediaFolders: MediaFolders[]

  /**
   * Registers a set of folders of the Media tab, the way extendMenu
   * registers a menu entry: keyed by id, so registering the same id again
   * replaces the folders in place (a label in a new language, a fresh list
   * of nodes) and nothing is duplicated. It cannot remove, an entry stays
   * until the page reloads.
   */
  registerMediaFolders: (folders: MediaFolders) => void
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

  const [folders, setFolders] = useState<{[id: string]: MediaFolders}>({})

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
  const registerMediaFolders = useCallback((next: MediaFolders) => {
    setFolders(prev => ({...prev, [next.id]: next}))
  }, [])

  const mediaFolders = useMemo(
    () =>
      Object.values(folders).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)
      ),
    [folders]
  )

  const contextValue = useMemo(
    () => ({
      menu,
      extendMenu,
      addMenu,
      extendAddMenu,
      mediaFolders,
      registerMediaFolders
    }),
    [
      menu,
      extendMenu,
      addMenu,
      extendAddMenu,
      mediaFolders,
      registerMediaFolders
    ]
  )

  return (
    <JaenFrameMenuContext.Provider value={contextValue}>
      {children}
    </JaenFrameMenuContext.Provider>
  )
}
