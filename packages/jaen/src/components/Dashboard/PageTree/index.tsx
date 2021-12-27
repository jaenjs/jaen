import Tree, {
  mutateTree,
  moveItemOnTree,
  RenderItemParams,
  TreeItem,
  TreeData,
  ItemId,
  TreeSourcePosition,
  TreeDestinationPosition
} from '@atlaskit/tree'
import {AddIcon, DeleteIcon, LockIcon, PhoneIcon} from '@chakra-ui/icons'
import {
  Box,
  Text,
  useColorModeValue,
  Badge,
  Flex,
  Spacer,
  HStack,
  useDisclosure,
  Portal,
  MenuList,
  MenuItem,
  MenuDivider,
  Menu,
  MenuButton,
  MenuGroup,
  Button,
  BoxProps
} from '@chakra-ui/react'
import styled from '@emotion/styled'
import {motion} from 'framer-motion'
import * as React from 'react'

import {ContextMenu} from '../../ContextMenu'
import {FileIcon, FolderCloseIcon, FolderOpenIcon} from '../../icons'
import {resolveChildSlugs, titleToSlug, TreeConverter} from './treeconverter'

export type Items = {
  [id: string]: {
    data: Partial<{
      title: string
      slug: string
      locked?: boolean
    }>
    isRootItem?: true
    children: string[]
    parent: string | null
    deleted?: true
  }
}

type PageTreeProps = {
  items: Items
  rootItemIds: string[]
  defaultSelection: string
  height: number | string
  templates: string[]
  onItemSelect: (id: string | null) => void
  onItemCreate: (
    parentId: string | null,
    title: string,
    slug: string,
    template: string
  ) => void
  onItemDelete: (id: string) => void
  onItemMove: (id: string, newParentId: string | null) => void
}

const PADDING_PER_LEVEL = 16
const PreTextIcon = styled.span`
  display: inline-block;
  width: 16px;
  justify-content: center;
  cursor: pointer;
  margin-right: 5px;
`

const PageTree: React.FC<PageTreeProps> = ({
  items,
  rootItemIds,
  defaultSelection,
  ...props
}) => {
  const greyOverlay = useColorModeValue('gray.50', 'gray.700')
  const orange = useColorModeValue('orange', 'orange.500')

  const textColor = useColorModeValue('gray.700', 'gray.300')

  // convert items to a set
  const [tree, setTree] = React.useState(TreeConverter(items))

  const [selectedItem, selectItem] = React.useState<string>(defaultSelection)

  const addPageDisclousure = useDisclosure()

  React.useEffect(() => {
    setTree(TreeConverter(items))
  }, [items])

  const handleSelectItem = (id?: string | null) => {
    const finalId = id || defaultSelection
    selectItem(finalId)
    props.onItemSelect(finalId)
  }

  const handleClick = (event: React.MouseEvent, id: string | null) => {
    event.stopPropagation()

    handleSelectItem(id)
  }

  const getIcon = (
    item: TreeItem,
    onExpand: (itemId: ItemId) => void,
    onCollapse: (itemId: ItemId) => void
  ) => {
    if (item.children && item.children.length > 0) {
      return item.isExpanded ? (
        <PreTextIcon onClick={() => onCollapse(item.id)}>
          <FolderOpenIcon />
        </PreTextIcon>
      ) : (
        <PreTextIcon onClick={() => onExpand(item.id)}>
          <FolderCloseIcon />
        </PreTextIcon>
      )
    }
    return (
      <PreTextIcon>
        <FileIcon />
      </PreTextIcon>
    )
  }

  const renderItem = ({
    item,
    onExpand,
    onCollapse,
    provided
  }: RenderItemParams) => {
    const id = item.id.toString()
    const isSelected = id === selectedItem

    // Emotion box wrapper with props for the item
    // If selectedItem === item.id change background color and backdrop shadow
    // Use custom type
    const ItemBox = styled(Box)`
      &:hover {
        box-shadow: 0px 0px 4px rgba(0, 0, 0, 0.25);
      }
      border-bottom: 1px solid
        ${item.isExpanded && item.children && item.children.length > 0
          ? '#eaeaea'
          : 'transparent'};
      // Change background color and backdrop shadow when selected
      ${isSelected &&
      `
        box-shadow: 0px 0px 4px rgba(0, 0, 0, 0.25);
        `}
    `

    const handleItemBoxClick = (event: React.MouseEvent) => {
      handleClick(event, id)
    }

    //> ItemInfo and call
    const GenerateItemBadges = () => {
      const isLocked = !!item.data.locked
      const hasChanges = item.data.hasChanges

      return (
        <HStack align="center" justify="space-between">
          {isLocked && <LockIcon />}
          {hasChanges && (
            <Badge
              bg={orange}
              color={textColor}
              fontSize="xs"
              fontWeight="semibold"
              ml={2}>
              Changes
            </Badge>
          )}
        </HStack>
      )
    }

    const MotionBox = motion<BoxProps>(ItemBox)

    const renderedItem = (
      <MotionBox
        bg={isSelected ? greyOverlay : 'transparent'}
        whileHover={{scale: 1.005}}
        p={2}
        onClick={handleItemBoxClick}>
        <Flex>
          <Box flex={1}>
            {getIcon(item, onExpand, onCollapse)}
            {item.data ? item.data.title : ''}
          </Box>

          {GenerateItemBadges()}
        </Flex>
      </MotionBox>
    )

    // Framer Motion wrapper for the item

    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={{
          ...provided.draggableProps.style,
          top: 'auto !important',
          left: 'auto !important'
        }}>
        {!(item as any).deleted && renderedItem}
      </div>
    )
  }

  const onExpand = (itemId: ItemId) => {
    setTree(mutateTree(tree, itemId, {isExpanded: true}))
  }

  const onCollapse = (itemId: ItemId) => {
    setTree(mutateTree(tree, itemId, {isExpanded: false}))
  }

  const onDragEnd = (
    source: TreeSourcePosition,
    destination?: TreeDestinationPosition
  ) => {
    if (!destination) {
      return
    }

    const movedItemId =
      tree.items[source.parentId].children[source.index].toString()

    const dstId = destination.parentId.toString()

    if (
      tree.items[dstId].children
        .map(child => tree.items[child.toString()].data.slug)
        .indexOf(tree.items[movedItemId].data.slug) === -1
    ) {
      const newTree = moveItemOnTree(tree, source, destination)

      setTree(mutateTree(newTree, destination.parentId, {isExpanded: true}))
      handleSelectItem(movedItemId)

      props.onItemMove(
        movedItemId,
        dstId === tree.rootId.toString() ? null : dstId
      )
    }
  }

  return (
    <ContextMenu<HTMLDivElement>
      renderMenu={() => (
        <MenuList>
          <MenuGroup title="Page">
            <MenuItem
              icon={<AddIcon />}
              onClick={() => addPageDisclousure.onOpen()}>
              Add
            </MenuItem>
            {!items[selectedItem].data.locked && (
              <>
                <MenuItem
                  icon={<DeleteIcon />}
                  onClick={() => props.onItemDelete(selectedItem)}>
                  Delete
                </MenuItem>
              </>
            )}
          </MenuGroup>
        </MenuList>
      )}>
      {ref => (
        <Box ref={ref} overflowX={"hidden"}>
          <Tree
            tree={tree}
            renderItem={renderItem}
            onExpand={onExpand}
            onCollapse={onCollapse}
            onDragEnd={onDragEnd}
            offsetPerLevel={PADDING_PER_LEVEL}
            isDragEnabled
            isNestingEnabled
          />
        </Box>
      )}
    </ContextMenu>
  )
}

export default PageTree
