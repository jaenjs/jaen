import {Button, useDisclosure} from '@chakra-ui/react'
import {runPublish} from '@internal/services/publish'
import PublishAlert from '../components/PublishAlert'

export const PublishButton = () => {
  const {onOpen, onClose, isOpen} = useDisclosure()

  return (
    <>
      <PublishAlert isOpen={isOpen} onClose={onClose} onConfirm={runPublish} />
      <Button onClick={onOpen} size="xs" variant={'darkghost'}>
        Publish
      </Button>
    </>
  )
}
