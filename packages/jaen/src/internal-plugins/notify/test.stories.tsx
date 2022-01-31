import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure
} from '@chakra-ui/react'
import {ComponentMeta, Story} from '@storybook/react'
import React from 'react'
export default {
  title: 'ModalTest',
  component: BasicUsage
} as ComponentMeta<typeof BasicUsage>

function BasicUsage() {
  const {isOpen, onOpen, onClose} = useDisclosure()
  return (
    <>
      <Button onClick={onOpen}>Open Modal</Button>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent top="auto" bottom="0" m="0">
          <ModalHeader>Modal Title</ModalHeader>
          <ModalCloseButton />
          <ModalBody>Blalsdalsdksald</ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button variant="ghost">Secondary Action</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

// Create a template for the component
export const Template: Story<any> = args => <BasicUsage {...args} />
