/**
 * The column popover of the board: every column as a row with a grip and a
 * checkbox, dragged into order, ticked into view, and a reset to the
 * screen's default. Moved here from TransfersView unchanged in what it
 * draws, it now works on any DataTable's layout.
 */
import {useState} from 'react'
import {Box, Button, Checkbox, HStack, Popover, Portal, Stack, Text, chakra} from '@chakra-ui/react'
import {FaColumns} from '@react-icons/all-files/fa/FaColumns'
import {FaGripVertical} from '@react-icons/all-files/fa/FaGripVertical'
import {FaUndo} from '@react-icons/all-files/fa/FaUndo'
import {useI18nCode} from '../../i18n'
import {getI18nCommon} from '../../locales/i18nCommon'
import {defaultLayout, type ColumnLayout, type DataColumn} from './columns'

export interface ColumnsPopoverProps<Row> {
  columns: DataColumn<Row>[]
  layout: ColumnLayout[]
  onChange: (next: ColumnLayout[]) => void
}

export function ColumnsPopover<Row>({columns, layout, onChange}: ColumnsPopoverProps<Row>) {
  const code = useI18nCode()
  const {strings: tc} = getI18nCommon(code)
  const [dragged, setDragged] = useState<string | null>(null)
  const labelOf = (id: string) => columns.find(c => c.id === id)?.label ?? id

  const move = (from: string, to: string) => {
    if (from === to) return
    const next = [...layout]
    const fromIndex = next.findIndex(c => c.id === from)
    const toIndex = next.findIndex(c => c.id === to)
    if (fromIndex < 0 || toIndex < 0) return
    const [removed] = next.splice(fromIndex, 1)
    if (removed) next.splice(toIndex, 0, removed)
    onChange(next)
  }

  return (
    <Popover.Root positioning={{placement: 'bottom-end'}} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <Button size="sm" variant="outline" colorPalette="gray">
          <FaColumns />
          <chakra.span display={{base: 'none', sm: 'inline'}}>{tc.ColumnsLabel}</chakra.span>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="2xs">
            <Popover.Arrow />
            <Popover.Header>
              <HStack justify="space-between">
                <Box>
                  <Text textStyle="sm" fontWeight="medium">
                    {tc.ColumnsCustomize}
                  </Text>
                  <Text textStyle="xs" color="fg.muted">
                    {tc.ColumnsDragHint}
                  </Text>
                </Box>
                <Button size="2xs" variant="ghost" onClick={() => onChange(defaultLayout(columns))}>
                  <FaUndo />
                  {tc.ColumnsReset}
                </Button>
              </HStack>
            </Popover.Header>
            <Popover.Body maxH="60vh" overflowY="auto">
              <Stack gap="0.5">
                {layout.map(col => (
                  <HStack
                    key={col.id}
                    gap="2"
                    px="2"
                    py="1.5"
                    rounded="control"
                    cursor="grab"
                    draggable
                    opacity={dragged === col.id ? 0.5 : 1}
                    _hover={{bg: 'bg.subtle'}}
                    onDragStart={() => setDragged(col.id)}
                    onDragOver={e => {
                      e.preventDefault()
                      if (dragged) move(dragged, col.id)
                    }}
                    onDragEnd={() => setDragged(null)}>
                    <Box color="fg.muted" flexShrink={0}>
                      <FaGripVertical />
                    </Box>
                    <Checkbox.Root
                      size="sm"
                      colorPalette="brand"
                      checked={col.visible}
                      onCheckedChange={e =>
                        onChange(layout.map(c => (c.id === col.id ? {...c, visible: e.checked === true} : c)))
                      }>
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>{labelOf(col.id)}</Checkbox.Label>
                    </Checkbox.Root>
                  </HStack>
                ))}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
