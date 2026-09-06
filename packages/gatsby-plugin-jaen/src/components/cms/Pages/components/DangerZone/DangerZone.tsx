import {useColorModeValue} from 'jaen'
import {Button, HStack, List, Stack, Text} from '@chakra-ui/react'
import {FC} from 'react'
import {IconType} from '@react-icons/all-files'

import {Link} from '../../../../shared/Link'

interface Action {
  title: string
  description: string
  buttonText: string
  icon: IconType
  onClick: (index: number) => void
  isDisabled?: boolean
}

export interface DangerZoneProps {
  actions: Action[]
}

export const DangerZone: FC<DangerZoneProps> = ({actions}) => {
  const borderColor = useColorModeValue('red.500', 'red.200')

  return (
    <List.Root
      gap="4"
      p="4"
      border="2px"
      borderRadius="surface"
      borderColor={borderColor}>
      {actions.map((action, index) => (
        <List.Item key={index}>
          <HStack justifyContent="space-between">
            <Stack gap="1">
              <Text fontWeight="bold">{action.title}</Text>
              <Text fontSize="sm">{action.description}</Text>
            </Stack>
            <Link
              as={Button}
              variant="outline"
              colorPalette="red"
              onClick={() => action.onClick(index)}
              isDisabled={action.isDisabled}>
              <action.icon />
              {action.buttonText}
            </Link>
          </HStack>
        </List.Item>
      ))}
    </List.Root>
  )
}

export default DangerZone
