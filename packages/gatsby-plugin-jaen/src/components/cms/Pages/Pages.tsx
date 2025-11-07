import React from 'react'
import {
  Button,
  ButtonGroup,
  Heading,
  HStack,
  Icon,
  Stack,
  StackDivider,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr
} from '@chakra-ui/react'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaGripVertical} from '@react-icons/all-files/fa/FaGripVertical'
import {Link} from '../../shared/Link'
import {DangerZone, DangerZoneProps} from './components/DangerZone'
import {TreeNode} from './components/PageVisualizer'
import {PageVisualizer} from './components/PageVisualizer/PageVisualizer'
import {PageBreadcrumb} from './shared/PageBreadcrumb'
import {
  PageContentForm,
  PageContentFormProps
} from './shared/PageContentForm/PageContentForm'
import {
  DragDropContext,
  Draggable,
  Droppable,
  OnDragEndResponder
} from 'react-beautiful-dnd'
import {useJaenI18n, formatI18nMessage} from '../../../hooks/use-jaen-i18n'

export interface PagesProps {
  pageId: string
  form: PageContentFormProps
  children: Array<{
    id: string
    title: string
    description: string
    createdAt: string
    modifiedAt: string
    author?: string
  }>
  onUpdateChildPagesOrder: (newOrder: Array<string>) => void
  tree: Array<TreeNode>
  onTreeSelect?: (id: string) => void
  disableNewButton?: boolean
  dangerZoneActions?: DangerZoneProps['actions']
}

export const Pages: React.FC<PagesProps> = props => {
  const {strings, code} = useJaenI18n()
  const cmsPages = (strings?.cms?.pages as Record<string, any>) ?? {}
  const table = cmsPages.table ?? {}
  const labels = cmsPages.labels ?? {}
  const actions = cmsPages.actions ?? {}
  const descriptions = cmsPages.descriptions ?? {}
  const prompts = cmsPages.prompts ?? {}
  const notifications = cmsPages.notifications ?? {}
  const formButtons = cmsPages.form?.buttons ?? {}

  const dateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(code, {
        dateStyle: 'medium'
      }),
    [code]
  )
  const timeFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(code, {
        hour: '2-digit',
        minute: '2-digit'
      }),
    [code]
  )

  const renderTimestamp = React.useCallback(
    (created?: string, modified?: string) => {
      const emptyLabel = table.date?.empty ?? '-'
      if (!created && !modified) {
        return emptyLabel
      }

      const hasDifferentModification =
        created && modified && modified !== created
      const target = hasDifferentModification ? modified : created

      if (!target) {
        return emptyLabel
      }

      const date = dateFormatter.format(new Date(target))
      const time = timeFormatter.format(new Date(target))
      const template = hasDifferentModification
        ? table.date?.updated
        : table.date?.created

      if (typeof template === 'string' && template.length > 0) {
        return formatI18nMessage(template, {date, time})
      }

      return `${date} ${time}`
    },
    [dateFormatter, timeFormatter, table.date]
  )

  const [canReorder, setCanReorder] = React.useState(false)

  const handleDragEnd: OnDragEndResponder = result => {
    if (!result.destination) {
      return
    }

    const reorderedChildren = props.children.map(p => p.id)
    const [movedItem] = reorderedChildren.splice(result.source.index, 1)

    if (!movedItem) {
      if (typeof window !== 'undefined') {
        window.alert(table.reorderError || 'Something went wrong while reordering the pages.')
      }
      return
    }

    reorderedChildren.splice(result.destination.index, 0, movedItem)

    // Update state or dispatch an action to update the order of child pages
    props.onUpdateChildPagesOrder(reorderedChildren)
  }

  return (
    <Stack id="coco" flexDir="column" spacing="14">
      <Stack spacing="4" divider={<StackDivider />}>
        <Stack spacing="4">
          <PageBreadcrumb tree={props.tree} activePageId={props.pageId} />

          <PageContentForm mode="edit" {...props.form} />
        </Stack>

        <PageVisualizer
          tree={props.tree}
          selection={props.pageId}
          onSelect={props.onTreeSelect}
        />
      </Stack>

      <Stack spacing="4" divider={<StackDivider />}>
        <HStack justifyContent="space-between">
          <Heading as="h2" size="sm">
            {table.subpagesHeading ?? 'Subpages'}
          </Heading>

          <ButtonGroup>
            <Button
              onClick={() => setCanReorder(!canReorder)}
              variant="outline"
              leftIcon={
                canReorder ? (
                  <Icon as={FaGripVertical} transform="rotate(45deg)" />
                ) : (
                  <Icon as={FaGripVertical} />
                )
              }>
              {canReorder
                ? table.reorderDisable ?? 'Done'
                : table.reorderEnable ?? 'Reorder'}
            </Button>

            <Link
              isDisabled={props.disableNewButton}
              as={Button}
              to={`./new/#${btoa(props.pageId)}`}
              leftIcon={<FaPlus />}
              variant="outline">
              {table.newPage ?? 'New page'}
            </Link>
          </ButtonGroup>
        </HStack>

        <Table>
          <Thead>
            <Tr>
              <Th>{table.columns?.title ?? 'Title'}</Th>
              <Th>{table.columns?.description ?? 'Description'}</Th>
              <Th>{table.columns?.date ?? 'Date'}</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="child-pages">
              {provided => (
                <Tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {props.children.map((page, index) => (
                    <Draggable
                      isDragDisabled={
                        !canReorder || props.children.length === 1
                      }
                      key={page.id}
                      draggableId={page.id}
                      index={index}>
                      {(provided, snapshot) => (
                        <Tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          bg={snapshot.isDragging ? 'bg.subtle' : 'transparent'}
                          display={snapshot.isDragging ? 'table' : 'table-row'}>
                          <Td>
                            <Link to={`#${btoa(page.id)}`}>{page.title}</Link>
                          </Td>
                          <Td>{page.description}</Td>
                          <Td whiteSpace="break-spaces">
                            {renderTimestamp(page.createdAt, page.modifiedAt)}
                          </Td>
                          <Td w="8">
                            {canReorder && (
                              <Icon as={FaGripVertical} color="fg.subtle" />
                            )}
                          </Td>
                        </Tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {props.children.length === 0 && (
                    <Tr>
                      <Td colSpan={4}>
                        <HStack>
                          <Text>
                            {table.emptyState?.description ??
                              "This page doesn't have any subpages yet."}{' '}
                          </Text>
                          <Link to={`./new/#${btoa(props.pageId)}`}>
                            {table.emptyState?.action ?? 'Create a new page'}
                          </Link>
                        </HStack>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              )}
            </Droppable>
          </DragDropContext>
        </Table>
      </Stack>

      <Stack spacing="4" divider={<StackDivider />}>
        <Heading as="h2" size="sm">
          {table.dangerZoneHeading ?? 'Danger zone'}
        </Heading>

        <DangerZone actions={props.dangerZoneActions || []} />
      </Stack>
    </Stack>
  )
}
