import {ChevronLeftIcon, ChevronRightIcon, DeleteIcon} from '@chakra-ui/icons'
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Spacer,
  Text
} from '@chakra-ui/react'
import * as React from 'react'

export type Props = {
  trigger: React.ReactNode
  header: React.ReactNode
  disabled?: boolean
  disablePrepandSection?: boolean
  disableAppendSection?: boolean
  id: string
  ptrNext: string | null
  ptrPrev: string | null
  onDelete: (id: string, ptrPrev: string | null, ptrNext: string | null) => void
  onAppend: (id: string, ptrNext: string | null) => void
  onPrepend: (id: string, ptrPrev: string | null) => void
}

const SectionManagePopover = React.memo<Props>(
  ({
    trigger,
    header,
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
          {header && <PopoverHeader>{header}</PopoverHeader>}
          <PopoverBody>
            <Flex>
              <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p="4">
                <HStack>
                  <Text size="xs">Add:</Text>
                  <IconButton
                    aria-label="Add section before"
                    disabled={disablePrepandSection}
                    icon={<ChevronLeftIcon />}
                    onClick={() => onPrepend(id, ptrPrev)}
                  />
                  <IconButton
                    aria-label="Add section after"
                    disabled={disableAppendSection}
                    icon={<ChevronRightIcon />}
                    onClick={() => onAppend(id, ptrNext)}
                  />
                </HStack>
              </Box>
              <Spacer />
              <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p="4">
                <HStack>
                  <Text size="xs">Delete:</Text>
                  <IconButton
                    aria-label="Delete section"
                    icon={<DeleteIcon />}
                    onClick={() => onDelete(id, ptrPrev, ptrNext)}
                  />
                </HStack>
              </Box>
            </Flex>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    )
  }
)

export default SectionManagePopover
