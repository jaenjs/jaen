import {
  Alert,
  Box,
  Button,
  CloseButton,
  Container,
  Heading,
  HStack,
  Stack,
  Text
} from '@chakra-ui/react'
import React, {useState} from 'react'
import {useIntl} from 'react-intl'
import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'

import {JaenFullLogo} from '../../components/shared/JaenLogo/JaenLogo'
import {Link} from '../../components/shared/Link'
import StepEmail from './components/StepEmail'
import StepOTP from './components/StepOTP'
import StepPassword from './components/StepPassword'

// Define form steps
enum FormStep {
  EMAIL,
  PASSWORD,
  OTP
}

interface PasswordResetProps {
  goBackPath?: string
  onGoBack?: () => void
  signUpPath?: string
  onSignUp?: () => void

  onSendEmail: (email: string) => Promise<void>
  onResetPassword: (
    email: string,
    otp: string,
    password: string
  ) => Promise<boolean>
}

interface FormData {
  emailAddress: string
  password: string
}

export const PasswordReset: React.FC<PasswordResetProps> = props => {
  const intl = useIntl()
  const [formStep, setFormStep] = useState(FormStep.EMAIL)
  const [formData, setFormData] = useState<FormData>({
    emailAddress: '',
    password: ''
  })

  const [alert, setAlert] = useState<{
    status: 'error' | 'success' | 'info'
    message: string | JSX.Element
    description?: string
  } | null>(null)

  const resetAlert = () => {
    setAlert(null)
  }

  return (
    <Box id="momo" minH="100dvh">
      <Container maxW="lg" py={{base: '6', md: '12'}} px={{base: '0', sm: '8'}}>
        <Stack gap="8">
          <Stack gap="6">
            <HStack justify="center">
              {(formStep === FormStep.PASSWORD ||
                formStep === FormStep.OTP) && (
                <Button
                  variant="outline"
                  onClick={() => setFormStep(FormStep.EMAIL)}>
                  <FaArrowLeft />
                  {intl.formatMessage({
                    id: 'PasswordResetTryAnotherEmailButton',
                    defaultMessage: 'Try another email'
                  })}
                </Button>
              )}

              {formStep === FormStep.EMAIL && (
                <Link
                  as={Button}
                  variant="outline"
                  to={props.goBackPath}
                  onClick={props.onGoBack}>
                  <FaArrowLeft />
                  {intl.formatMessage({
                    id: 'PasswordResetBackToWebsiteButton',
                    defaultMessage: 'Back to website'
                  })}
                </Link>
              )}
            </HStack>

            <Stack gap={{base: '2', md: '3'}} textAlign="center">
              <>
                <Heading size={{base: 'xs', md: 'sm'}}>
                  {formStep === FormStep.EMAIL &&
                    intl.formatMessage({
                      id: 'PasswordResetEmailHeading',
                      defaultMessage: 'Reset your password'
                    })}
                  {formStep === FormStep.PASSWORD &&
                    intl.formatMessage({
                      id: 'PasswordResetPasswordHeading',
                      defaultMessage: 'Enter your new password'
                    })}
                  {formStep === FormStep.OTP &&
                    intl.formatMessage({
                      id: 'PasswordResetOtpHeading',
                      defaultMessage: 'Enter your code'
                    })}
                </Heading>
                <Text color="fg.muted">
                  {formStep === FormStep.EMAIL && (
                    <>
                      {intl.formatMessage({
                        id: 'PasswordResetNoAccountPrompt',
                        defaultMessage: "Don't have an account?"
                      })}{' '}
                      <Link to={props.signUpPath}>
                        {intl.formatMessage({
                          id: 'PasswordResetSignUpLink',
                          defaultMessage: 'Sign up'
                        })}
                      </Link>
                    </>
                  )}
                  {formStep === FormStep.PASSWORD && (
                    <>
                      {intl.formatMessage(
                        {
                          id: 'PasswordResetPasswordDescription',
                          defaultMessage:
                            'Enter a new password for <b>{email}</b>.'
                        },
                        {
                          email: formData.emailAddress,
                          b: chunks => <b>{chunks}</b>
                        }
                      )}
                    </>
                  )}

                  {formStep === FormStep.OTP && (
                    <>
                      {intl.formatMessage(
                        {
                          id: 'PasswordResetOtpDescription',
                          defaultMessage:
                            'A one-time password (OTP) has been sent to <strong>{email}</strong>.'
                        },
                        {
                          email: formData.emailAddress,
                          strong: chunks => <strong>{chunks}</strong>
                        }
                      )}
                    </>
                  )}
                </Text>
              </>
            </Stack>
          </Stack>

          {alert && (
            <Alert.Root status={alert.status}>
              <Alert.Indicator />
              <Box w="full">
                <Alert.Title>{alert.message}</Alert.Title>
                <Alert.Description>{alert.description}</Alert.Description>
              </Box>
              <CloseButton
                alignSelf="flex-start"
                position="relative"
                right={-1}
                top={-1}
                onClick={resetAlert}
              />
            </Alert.Root>
          )}

          <Box
            py={{base: '0', sm: '8'}}
            px={{base: '4', sm: '10'}}
            bg="bg.surface"
            boxShadow={{base: 'none', sm: 'md'}}
            borderRadius={{base: 'none', sm: 'surface'}}>
            {formStep === FormStep.EMAIL && (
              <StepEmail
                onSubmit={async data => {
                  await new Promise(resolve => setTimeout(resolve, 500))

                  setFormData({
                    ...formData,
                    emailAddress: data.emailAddress
                  })

                  setFormStep(FormStep.PASSWORD)
                }}
              />
            )}

            {formStep === FormStep.PASSWORD && (
              <StepPassword
                onSubmit={async data => {
                  await new Promise(resolve => setTimeout(resolve, 500))

                  setFormData({
                    ...formData,
                    password: data.password
                  })

                  setFormStep(FormStep.OTP)

                  await props.onSendEmail(formData.emailAddress)
                }}
              />
            )}

            {formStep === FormStep.OTP && (
              <StepOTP
                onSubmit={async data => {
                  const success = await props.onResetPassword(
                    formData.emailAddress,
                    data.otp,
                    formData.password
                  )

                  if (!success) {
                    throw new Error('Wrong OTP. Please try again.')
                  }
                }}
              />
            )}
          </Box>

          <JaenFullLogo height="12" width="auto" />
        </Stack>
      </Container>
    </Box>
  )
}

export default PasswordReset
