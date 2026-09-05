import {useColorModeValue} from 'jaen'
import {Box, Text, useToken} from '@chakra-ui/react'

import {useEffect, useState} from 'react'
import {
  Tree,
  ControlledTreeEnvironment,
  TreeItemIndex,
  TreeItem
} from 'react-complex-tree'

import 'react-complex-tree/lib/style-modern.css'
import {convertTreeToPageTree, TreeNode} from './convert-tree-to-page-tree'

export interface PageTreeProps {
  tree: TreeNode[]
  defaultSelected?: string
  onSelected: (id: string, item: TreeItem) => void
}

export const PageTree: React.FC<PageTreeProps> = ({
  tree,
  defaultSelected,
  onSelected
}) => {
  const pageTree = convertTreeToPageTree(tree)

  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>()

  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>([
    'root',
    'JaenPage /'
  ])
  const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([])

  useEffect(() => {
    setSelectedItems(defaultSelected ? [defaultSelected] : [])
  }, [defaultSelected])

  const [brand50, brand100, brand200, brand500] = useToken('colors', [
    'brand.50',
    'brand.100',
    'brand.200',
    'brand.500'
  ])

  // These land in CSS custom properties that react-complex-tree reads, so they
  // have to be colour strings rather than style props. v2 got them from
  // @chakra-ui/theme-tools' transparentize, a package that no longer exists;
  // color-mix is what v3's own token/alpha syntax emits in its place.
  const darkHoverBg = `color-mix(in srgb, ${brand200} 12%, transparent)`
  const darkActiveBg = `color-mix(in srgb, ${brand200} 24%, transparent)`

  const hoverBg = useColorModeValue(brand50, darkHoverBg)
  const activeBg = useColorModeValue(brand100, darkActiveBg)

  const selectedBg = useColorModeValue('transparent', activeBg)

  // fg.emphasized is gray.700 in light and gray.200 in dark, the literals
  // this used to pick by mode, and a site's own text colour where it has one.
  const color = 'fg.emphasized'

  return (
    <ControlledTreeEnvironment
      items={pageTree.items}
      getItemTitle={item => item.data}
      viewState={{
        'tree-1': {
          expandedItems,
          selectedItems,
          focusedItem
        }
      }}
      renderTreeContainer={props => (
        <Box
          w="full"
          className="tree"
          css={{
            // Hand-written var() names cannot survive the prefix change: jaen's
            // system emits --jaen-*, and on a CMS route it is the only provider
            // mounted, so var(--chakra-colors-brand-500) resolves against
            // nothing. useToken reads the same token through the system that is
            // actually in scope, which is what the three above already do.
            '--rct-bar-color': brand500,

            '--rct-color-drag-between-line-bg': brand500,

            '--rct-item-height': '2rem',
            '--rct-color-focustree-item-hover-bg': hoverBg,
            '--rct-color-focustree-item-selected-bg': selectedBg,
            '--rct-color-focustree-item-active-bg': activeBg,
            '--rct-color-arrow': brand500
          }}>
          <ul className="tree-root tree-node-list" {...props.containerProps}>
            {props.children}
          </ul>
        </Box>
      )}
      renderItemTitle={props => {
        return (
          <Text fontSize="sm" color={color}>
            {props.title}
          </Text>
        )
      }}
      canDropAt={() => {
        return true
      }}
      onFocusItem={item => setFocusedItem(item.index)}
      onExpandItem={item => {
        setExpandedItems([...expandedItems, item.index])
      }}
      onCollapseItem={item => {
        if (item.index === 'root' || item.index === 'JaenPage /') return

        setExpandedItems(
          expandedItems.filter(
            expandedItemIndex => expandedItemIndex !== item.index
          )
        )
      }}
      onSelectItems={items => {
        setSelectedItems(items)

        const first = items[0]

        if (first) {
          const node = pageTree.items[first]

          if (!node) return

          onSelected(first.toString(), node)
        }
      }}
      canDragAndDrop
      canDropOnFolder
      canReorderItems={false}>
      <Tree treeId="tree-1" rootItem="root" treeLabel="Pages" />
    </ControlledTreeEnvironment>
  )
}
