import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button
} from '@chakra-ui/react'
import * as React from 'react'

export interface AlertProps {
  title: string
  body: string
  buttons: {
    left: {
      text: string
      onClick: () => void
      colorScheme?: string
    }
    right: {
      text: string
      onClick: () => void
      colorScheme?: string
    }
  }
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

const Alert = ({title, body, buttons, isOpen, onOpen, onClose}: AlertProps) => {
  const cancelRef = React.useRef<any>()

  return (
    <>
      <Button onClick={onOpen}>Discard</Button>
      <AlertDialog
        motionPreset="slideInBottom"
        leastDestructiveRef={cancelRef}
        onClose={onClose}
        isOpen={isOpen}
        isCentered>
        <AlertDialogOverlay />

        <AlertDialogContent>
          <AlertDialogHeader>{title}</AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody>{body}</AlertDialogBody>
          <AlertDialogFooter>
            <Button
              ref={cancelRef}
              colorScheme={buttons.left.colorScheme}
              onClick={buttons.left.onClick || onClose}>
              {buttons.left.text}
            </Button>
            <Button
              colorScheme={buttons.right.colorScheme}
              onClick={buttons.right.onClick}
              ml={3}>
              {buttons.right.text}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default Alert
