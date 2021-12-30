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
import {CreateValues, PageCreator, Templates} from '../PageCreator'
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
  defaultSelection: string
  height: number | string
  templates: Templates
  onItemSelect: (id: string | null) => void
  onItemCreate: (parentId: string | null, values: CreateValues) => void
  onItemDelete: (id: string) => void
  onItemMove: (
    id: string,
    oldParentId: string | null,
    newParentId: string | null
  ) => void
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
  defaultSelection,
  ...props
}) => {
  const greyOverlay = useColorModeValue('gray.50', 'gray.700')
  const orange = useColorModeValue('orange', 'orange.500')

  const textColor = useColorModeValue('gray.700', 'gray.300')

  // convert items to a set
  const [tree, setTree] = React.useState(TreeConverter(items))

  const [selectedItem, selectItem] = React.useState<string>(defaultSelection)

  const pageCreatorDisclosure = useDisclosure()

  const handleItemCreate = (values: CreateValues) => {
    // Check if the slug is already taken of a sibling
    const {title, slug, templateName} = values

    const relativeParentId = selectedItem || tree.rootId

    const siblings = tree.items[relativeParentId].children

    const slugTaken = siblings.some(
      siblingId => tree.items[siblingId]?.data?.slug === slug
    )

    if (!slugTaken) {
      props.onItemCreate(relativeParentId.toString(), values)

      // Close the modal
      pageCreatorDisclosure.onClose()

      // Add the new item to the tree
      const newItemId = `${relativeParentId}/${slug}`

      const newItem = {
        id: newItemId,
        data: {
          title,
          slug,
          locked: false,
          templateName
        },
        children: [],
        parent: relativeParentId
      }

      tree.items[newItemId] = newItem

      // Update parent children
      tree.items[relativeParentId].children.push(newItemId)
      console.log(
        '🚀 ~ file: index.tsx ~ line 128 ~ handleItemCreate ~ tree',
        tree
      )

      setTree(tree)

      return true
    }

    return false
  }

  const handleItemDelete = (id: string) => {
    props.onItemDelete(id)

    // Remove the item from the tree
    const item = tree.items[id]
    console.log(
      '🚀 ~ file: index.tsx ~ line 146 ~ handleItemDelete ~ item',
      item
    )

    if (item) {
      const parentId: string = (item as any).parent || tree.rootId

      // Remove the item from the parent children
      tree.items[parentId].children = tree.items[parentId].children.filter(
        childId => childId !== id
      )

      // Remove the item from the tree
      delete tree.items[id]

      selectItem(defaultSelection)

      setTree(tree)
    }
  }

  React.useEffect(() => {
    console.log('rerender', items)

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

    const MotionBox = motion(ItemBox)

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

    const movedItemId = tree.items[source.parentId].children[
      source.index
    ].toString()

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
        // @ts-ignore
        tree.items[movedItemId].parent,
        dstId === tree.rootId.toString() ? null : dstId
      )
    }
  }

  return (
    <>
      <ContextMenu<HTMLDivElement>
        renderMenu={() => (
          <MenuList zIndex="popover">
            <MenuGroup title="Page">
              <MenuItem
                icon={<AddIcon />}
                onClick={() => pageCreatorDisclosure.onOpen()}>
                Add
              </MenuItem>
              {!tree.items[selectedItem].data.locked && (
                <>
                  <MenuItem
                    icon={<DeleteIcon />}
                    onClick={() => handleItemDelete(selectedItem)}>
                    Delete
                  </MenuItem>
                </>
              )}
            </MenuGroup>
          </MenuList>
        )}>
        {ref => (
          <Box ref={ref} overflowX={'hidden'}>
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
      <PageCreator
        finalFocusRef={null as any}
        templates={props.templates}
        isOpen={pageCreatorDisclosure.isOpen}
        onClose={pageCreatorDisclosure.onClose}
        onCreate={handleItemCreate}
      />
    </>
  )
}

export default PageTree
