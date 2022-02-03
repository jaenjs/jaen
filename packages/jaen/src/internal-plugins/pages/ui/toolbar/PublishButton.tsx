import {Button, useDisclosure} from '@chakra-ui/react'
import {publishRunner} from '@jaen/services/publish'
import PublishAlert from '../components/PublishAlert'

export const PublishButton = () => {
  const {onOpen, onClose, isOpen} = useDisclosure()

  return (
    <>
      <PublishAlert
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={publishRunner}
      />
      <Button onClick={onOpen} size="xs" variant={'darkghost'}>
        Publish
      </Button>
    </>
  )
}
