import {
  DeleteIcon,
  CopyIcon,
  SmallAddIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@chakra-ui/icons'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
  PopoverAnchor,
  Button,
  Flex,
  IconButton,
  Spacer,
  VStack,
  Divider,
  Text,
  Box,
  HStack
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
  onDelete: (id: string) => void
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
    console.log('rerender SectionManagePopover: ' + id)
    if (disabled) {
      return <>{trigger}</>
    }

    return (
      <Popover trigger="hover">
        <PopoverTrigger>{trigger}</PopoverTrigger>
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
                    onClick={() => onDelete(id)}
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
