// src/components/ContactModal/ContactModal.tsx
import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Stack,
  Text,
  Textarea
} from '@chakra-ui/react'
import React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { CheckboxStyled } from './CheckboxStyled'
import { useT } from '../../contexts/language'
import { useIntl } from 'react-intl'

export interface ContactFormValues {
  firstName: string
  lastName: string
  email: string
  phone?: string
  message: string
  agreeToTerms: boolean
}

export interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ContactFormValues) => Promise<void>
  fixedValues?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  defaultValues?: {
    message?: string
  }
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  fixedValues,
  defaultValues
}) => {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ContactFormValues>({})

  const t = useT()
  const intl = useIntl()

  React.useEffect(() => {
    reset(fixedValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedValues])

  React.useEffect(() => {
    if (!isOpen) {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Debug (optional)
  // console.log("Contact", "locale", intl.locale, "messages", intl.messages)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      blockScrollOnMount={false}
    >
      <ModalOverlay />

      <ModalContent>
        <form
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event)
          }}
        >
          <ModalCloseButton />
          <ModalBody
            p={{
              base: 4,
              md: 8,
              lg: 12,
              xl: 16
            }}
          >
            <Stack spacing="6">
              <Heading
                as="h2"
                size={{
                  base: 'md',
                  md: 'lg'
                }}
              >
                {t('ContactHeading', 'Contact us')}
              </Heading>

              <Text>
                {t(
                  'ContactIntro',
                  'We look forward to your message and will get back to you shortly.'
                )}
              </Text>

              <HStack>
                <FormControl isRequired isInvalid={!!errors.firstName}>
                  <FormLabel htmlFor="firstName" fontSize="sm">
                    {t('FirstName', 'First name')}
                  </FormLabel>
                  <Input
                    id="firstName"
                    placeholder={t('FirstName', 'John')}
                    {...register('firstName', { required: true })}
                    isDisabled={!!fixedValues?.firstName}
                    focusBorderColor="brand.500"
                  />
                  <FormErrorMessage fontSize="sm">
                    {errors.firstName?.message}
                  </FormErrorMessage>
                </FormControl>

                <FormControl isRequired isInvalid={!!errors.lastName}>
                  <FormLabel htmlFor="lastName" fontSize="sm">
                    {t('LastName', 'Last name')}
                  </FormLabel>
                  <Input
                    id="lastName"
                    placeholder={t('LastName', 'Doe')}
                    {...register('lastName', { required: true })}
                    isDisabled={!!fixedValues?.lastName}
                    focusBorderColor="brand.500"
                  />
                  <FormErrorMessage fontSize="sm">
                    {errors.lastName?.message}
                  </FormErrorMessage>
                </FormControl>
              </HStack>

              <HStack>
                <FormControl isRequired isInvalid={!!errors.email}>
                  <FormLabel htmlFor="email" fontSize="sm">
                    {t('Email', 'Email')}
                  </FormLabel>
                  <Input
                    id="email"
                    placeholder={t('Email', 'john.doe@example.com')}
                    type="email"
                    {...register('email', { required: true })}
                    isDisabled={!!fixedValues?.email}
                    focusBorderColor="brand.500"
                  />
                  <FormErrorMessage fontSize="sm">
                    {errors.email?.message}
                  </FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.phone}>
                  <FormLabel htmlFor="phone" fontSize="sm">
                    {t('Phone', 'Phone')}
                  </FormLabel>
                  <Input
                    id="phone"
                    placeholder={t('Phone', '+43 660 000 0000')}
                    type="tel"
                    {...register('phone')}
                    isDisabled={!!fixedValues?.phone}
                    focusBorderColor="brand.500"
                  />
                  <FormErrorMessage fontSize="sm">
                    {errors.phone?.toString()}
                  </FormErrorMessage>
                </FormControl>
              </HStack>

              <FormControl isRequired isInvalid={!!errors.message}>
                <FormLabel htmlFor="message" fontSize="sm">
                  {t('HowCanWeHelp', 'How can we help?')}
                </FormLabel>
                <Textarea
                  id="message"
                  placeholder={t('MessagePlaceholder', 'Message')}
                  defaultValue={defaultValues?.message}
                  {...register('message', { required: true })}
                  focusBorderColor="brand.500"
                />
                <FormErrorMessage fontSize="sm">
                  {errors.message?.message}
                </FormErrorMessage>
              </FormControl>

              <FormControl isRequired isInvalid={!!errors.agreeToTerms}>
                <Controller
                  render={({ field }) => (
                    <CheckboxStyled
                      ref={field.ref}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      checked={field.value}
                      roundedFull
                    >
                      <Text
                        fontSize={{
                          base: 'xs',
                          md: 'sm'
                        }}
                      >
                        {t(
                          'ConsentText',
                          'You agree that your details may be stored for contacting you and for follow-up questions.'
                        )}
                      </Text>
                    </CheckboxStyled>
                  )}
                  name="agreeToTerms"
                  control={control}
                  rules={{
                    required: t(
                      'ConsentError',
                      'Please confirm the contact permission'
                    )
                  }}
                />
                <FormErrorMessage fontSize="sm">
                  {errors.agreeToTerms?.message}
                </FormErrorMessage>
              </FormControl>
            </Stack>
          </ModalBody>

          <ModalFooter borderTop="1px solid" color="gray.200">
            <Button isLoading={isSubmitting} type="submit">
              {t('SendCta', 'Send')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
