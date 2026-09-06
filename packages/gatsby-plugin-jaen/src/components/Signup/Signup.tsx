/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  Alert,
  Box,
  Button,
  CloseButton,
  Container,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  Field
} from '@chakra-ui/react'
import {useState} from 'react'
import {useIntl} from 'react-intl'
import {SubmitHandler, useForm} from 'react-hook-form'
import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'

import Logo from '../Logo'
import {JaenFullLogo} from '../shared/JaenLogo/JaenLogo'
import {Link} from '../shared/Link/Link'
import {PasswordField} from './components/PasswordField'

export interface SignupProps {
  onSignUp: (values: FormData) => Promise<void>
  goBackPath?: string
  onGoBack?: () => void
  signInPath?: string
  onSignIn?: () => void
}

interface FormData {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
}

export const Signup: React.FC<SignupProps> = props => {
  const intl = useIntl()
  const {
    handleSubmit,
    register,
    formState: {errors, isSubmitting}
  } = useForm<FormData>()

  const [alert, setAlert] = useState<{
    status: 'error' | 'success' | 'info'
    message: string | JSX.Element
    description?: string
  } | null>(null)

  const resetAlert = () => {
    setAlert(null)
  }

  const onSubmit: SubmitHandler<FormData> = async (data: FormData, e) => {
    e?.preventDefault()

    try {
      await props.onSignUp(data)

      setAlert({
        status: 'success',
        message: intl.formatMessage({
          id: 'SignupSuccessTitle',
          defaultMessage: 'Successfully signed up.'
        }),
        description: intl.formatMessage({
          id: 'SignupSuccessDescription',
          defaultMessage: 'Please check your email for a verification link.'
        })
      })
    } catch (e) {
      setAlert({
        status: 'error',
        message: intl.formatMessage({
          id: 'SignupErrorTitle',
          defaultMessage: 'Unable to sign up.'
        }),
        description: e.message
      })
    }
  }

  const content = (
    <Box id="momo" minH="100dvh">
      <Container maxW="lg" py={{base: '6', md: '12'}} px={{base: '0', sm: '8'}}>
        <Stack gap="8">
          <Stack gap="6">
            <HStack justify="center">
              <Link
                as={Button}
                variant="outline"
                to={props.goBackPath}
                onClick={props.onGoBack}>
                <FaArrowLeft />
                {intl.formatMessage({
                  id: 'SignupBackToWebsiteButton',
                  defaultMessage: 'Back to website'
                })}
              </Link>
            </HStack>

            <Stack gap={{base: '2', md: '3'}} textAlign="center">
              <Heading size={{base: 'xs', md: 'sm'}}>
                {intl.formatMessage({
                  id: 'SignupHeading',
                  defaultMessage: 'Create your account'
                })}
              </Heading>
              <Text color="fg.muted">
                {intl.formatMessage({
                  id: 'SignupAlreadyUserPrompt',
                  defaultMessage: 'Already a user?'
                })}{' '}
                <Link to={props.signInPath} onClick={props.onSignIn}>
                  {intl.formatMessage({
                    id: 'SignupLoginLink',
                    defaultMessage: 'Login'
                  })}
                </Link>
              </Text>
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

          <form onSubmit={handleSubmit(onSubmit) as any}>
            <Box
              py={{base: '0', sm: '8'}}
              px={{base: '4', sm: '10'}}
              bg="bg.surface"
              boxShadow={{base: 'none', sm: 'md'}}
              borderRadius={{base: 'none', sm: 'surface'}}>
              <Stack gap="6">
                <HStack justify="center" py="4">
                  <Box maxW="64" h="full">
                    <Logo />
                  </Box>
                </HStack>
                <Stack gap="5">
                  <Stack
                    gap="4"
                    direction={{
                      base: 'column',
                      md: 'row'
                    }}>
                    <Field.Root
                      id="login_form_first_name"
                      required
                      invalid={!!errors.firstName}>
                      <Field.Label htmlFor="firstName">
                        {intl.formatMessage({
                          id: 'SignupFirstNameLabel',
                          defaultMessage: 'First name'
                        })}
                      </Field.Label>
                      <Input
                        autoFocus
                        id="firstName"
                        {...register('firstName', {
                          required: true
                        })}
                      />
                      <Field.ErrorText>
                        {errors.firstName &&
                          intl.formatMessage({
                            id: 'SignupFirstNameRequiredError',
                            defaultMessage: 'First name is required'
                          })}
                      </Field.ErrorText>
                    </Field.Root>
                    <Field.Root
                      id="login_form_last_name"
                      required
                      invalid={!!errors.lastName}>
                      <Field.Label htmlFor="lastName">
                        {intl.formatMessage({
                          id: 'SignupLastNameLabel',
                          defaultMessage: 'Last name'
                        })}
                      </Field.Label>
                      <Input
                        id="lastName"
                        {...register('lastName', {
                          required: true
                        })}
                      />
                      <Field.ErrorText>
                        {errors.lastName &&
                          intl.formatMessage({
                            id: 'SignupLastNameRequiredError',
                            defaultMessage: 'Last name is required'
                          })}
                      </Field.ErrorText>
                    </Field.Root>
                  </Stack>

                  <Field.Root
                    id="login_form_email"
                    required
                    invalid={!!errors.email}>
                    <Field.Label htmlFor="email">
                      {intl.formatMessage({
                        id: 'SignupEmailLabel',
                        defaultMessage: 'Email'
                      })}
                    </Field.Label>
                    <Input
                      id="email"
                      {...register('email', {
                        required: true
                      })}
                    />
                    <Field.ErrorText>
                      {errors.email &&
                        intl.formatMessage({
                          id: 'SignupEmailRequiredError',
                          defaultMessage: 'Email is required'
                        })}
                    </Field.ErrorText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label htmlFor="username">
                      {intl.formatMessage({
                        id: 'SignupUsernameLabel',
                        defaultMessage: 'Username'
                      })}
                    </Field.Label>
                    <Input
                      id="username"
                      {...register('username', {
                        required: true
                      })}
                    />
                  </Field.Root>

                  <PasswordField
                    {...register('password', {required: true})}
                    required
                    invalid={!!errors.password?.message}
                  />
                </Stack>

                <Stack gap="6">
                  {/* `primary` is a real variant of theme/recipes/button.ts, but
                      v3 reads the variant union out of Chakra's shipped
                      recipes.gen.d.ts, which only learns about theme recipes
                      when `chakra typegen` regenerates it. No package here runs
                      typegen, so the literal has to be cast until one does. */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isSubmitting}>
                    {intl.formatMessage({
                      id: 'SignupSubmitButton',
                      defaultMessage: 'Sign up'
                    })}
                  </Button>
                  {/* <HStack>
            <Divider />
            <Text textStyle="sm" whiteSpace="nowrap" color="fg.muted">
              powered by
            </Text>
            <Divider />
            <OAuthButtonGroup />
          </HStack> */}
                </Stack>
              </Stack>
            </Box>
          </form>

          <JaenFullLogo height="12" width="auto" />
        </Stack>
      </Container>
    </Box>
  )

  return content
}

export default Signup
