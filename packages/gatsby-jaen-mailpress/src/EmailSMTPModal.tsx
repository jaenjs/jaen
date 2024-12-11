import React, {useState} from 'react'
import {useForm, Controller} from 'react-hook-form'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  useDisclosure,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from '@chakra-ui/react'

interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  password: string
}

interface EmailSMTPFormData {
  email: string
  config: SMTPConfig
}

interface EmailSMTPModalProps {
  onSubmit: (data: EmailSMTPFormData) => Promise<void>
}

export function EmailSMTPModal({onSubmit}: EmailSMTPModalProps) {
  const {isOpen, onOpen, onClose} = useDisclosure()
  const [error, setError] = useState<string | null>(null)
  const {control, handleSubmit, reset, formState} = useForm<EmailSMTPFormData>({
    defaultValues: {
      email: '',
      config: {
        host: '',
        port: 587,
        secure: false,
        password: ''
      }
    }
  })

  const onSubmitForm = async (data: EmailSMTPFormData) => {
    setError(null)
    try {
      console.log('data', data)
      data.config.port = Number(data.config.port)
      await onSubmit(data)
      onClose()
      reset()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || 'An error occurred while submitting the form.')
      } else {
        setError('An unknown error occurred.')
      }
    }
  }

  return (
    <>
      <Button
        onClick={onOpen}
        isLoading={formState.isSubmitting}
        variant="outline">
        Connect Email
      </Button>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Email and SMTP Configuration</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit(onSubmitForm)}>
            <ModalBody>
              <VStack spacing={4}>
                {error && (
                  <Alert status="error">
                    <AlertIcon />
                    <AlertTitle mr={2}>Error!</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Controller
                  name="email"
                  control={control}
                  rules={{required: 'Email is required'}}
                  render={({field, fieldState: {error}}) => (
                    <FormControl isInvalid={!!error}>
                      <FormLabel>Email</FormLabel>
                      <Input {...field} />
                      {error && <Text color="red.500">{error.message}</Text>}
                    </FormControl>
                  )}
                />
                <Controller
                  name="config.host"
                  control={control}
                  rules={{required: 'SMTP Host is required'}}
                  render={({field, fieldState: {error}}) => (
                    <FormControl isInvalid={!!error}>
                      <FormLabel>SMTP Host</FormLabel>
                      <Input {...field} />
                      {error && <Text color="red.500">{error.message}</Text>}
                    </FormControl>
                  )}
                />
                <Controller
                  name="config.port"
                  control={control}
                  rules={{required: 'SMTP Port is required'}}
                  render={({field, fieldState: {error}}) => (
                    <FormControl isInvalid={!!error}>
                      <FormLabel>SMTP Port</FormLabel>
                      <Input {...field} type="number" />
                      {error && <Text color="red.500">{error.message}</Text>}
                    </FormControl>
                  )}
                />
                <Controller
                  name="config.secure"
                  control={control}
                  render={({field: {onChange, value, ref}}) => (
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="secure" mb="0">
                        Secure
                      </FormLabel>
                      <Switch
                        id="secure"
                        onChange={onChange}
                        isChecked={value}
                        ref={ref}
                      />
                    </FormControl>
                  )}
                />
                <Controller
                  name="config.password"
                  control={control}
                  rules={{required: 'SMTP Password is required'}}
                  render={({field, fieldState: {error}}) => (
                    <FormControl isInvalid={!!error}>
                      <FormLabel>SMTP Password</FormLabel>
                      <Input {...field} type="password" />
                      {error && <Text color="red.500">{error.message}</Text>}
                    </FormControl>
                  )}
                />
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button
                colorScheme="blue"
                mr={3}
                type="submit"
                isLoading={formState.isSubmitting}>
                Save
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  )
}
