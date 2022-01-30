import {ChevronLeftIcon, ChevronRightIcon, DeleteIcon} from '@chakra-ui/icons'
import {
  Box,
  ButtonGroup,
  Divider,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Select
} from '@chakra-ui/react'
import {ISectionConnection} from '@jaen-pages/connectors'
import * as React from 'react'

export type Props = {
  trigger: React.ReactNode
  header: React.ReactNode
  sections: Array<ISectionConnection['options']>
  disabled?: boolean
  disablePrepandSection?: boolean
  disableAppendSection?: boolean
  id: string
  ptrNext: string | null
  ptrPrev: string | null
  onDelete: (id: string, ptrPrev: string | null, ptrNext: string | null) => void
  onAppend: (sectionName: string, id: string, ptrNext: string | null) => void
  onPrepend: (sectionName: string, id: string, ptrPrev: string | null) => void
}

const SectionManagePopover = React.memo<Props>(
  ({
    trigger,
    header,
    sections,
    disabled,
    disablePrepandSection,
    disableAppendSection,
    id,
    ptrNext,
    ptrPrev,
    onDelete,
    onAppend,
    onPrepend
  }) => {
    const [sectionName, setSectionName] = React.useState(sections[0].name)

    if (disabled) {
      return <>{trigger}</>
    }

    return (
      <Popover trigger="hover">
        <PopoverTrigger>
          <Box
            transition={'box-shadow 0.3s ease-in-out'}
            _hover={{boxShadow: '0 0 0 2.5px #4fd1c5'}}>
            {trigger}
          </Box>
        </PopoverTrigger>
        <PopoverContent>
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader>Manage Section</PopoverHeader>
          <PopoverBody>
            <Box>
              <HStack>
                <Select
                  defaultValue={sectionName}
                  onChange={e => setSectionName(e.target.value)}>
                  {sections.map(({name, displayName}) => (
                    <option key={name} value={name}>
                      {displayName}
                    </option>
                  ))}
                </Select>

                <ButtonGroup isAttached variant="outline">
                  <IconButton
                    aria-label="Add section before"
                    mr="-px"
                    disabled={disablePrepandSection}
                    icon={<ChevronLeftIcon />}
                    onClick={() => onPrepend(sectionName, id, ptrPrev)}
                  />
                  <IconButton
                    aria-label="Add section after"
                    disabled={disableAppendSection}
                    icon={<ChevronRightIcon />}
                    onClick={() => onAppend(sectionName, id, ptrNext)}
                  />
                </ButtonGroup>
                <Divider orientation="vertical" />
                <IconButton
                  variant="outline"
                  aria-label="Delete section"
                  icon={<DeleteIcon />}
                  onClick={() => onDelete(id, ptrPrev, ptrNext)}
                  size="sm"
                />
              </HStack>
            </Box>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    )
  }
)

export default SectionManagePopover
