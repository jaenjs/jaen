import {AuthUser, useNotificationsContext, AuthPasswordPolicy} from 'jaen'
import {
  Avatar,
  Button,
  ButtonGroup,
  Card,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Input,
  List,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  Field,
  StackSeparator
} from '@chakra-ui/react'
import {FaEdit} from '@react-icons/all-files/fa/FaEdit'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'
import {FaCheck} from '@react-icons/all-files/fa6/FaCheck'
import {FaX} from '@react-icons/all-files/fa6/FaX'
import {MdRefresh} from '@react-icons/all-files/md/MdRefresh'
import {useEffect, useState} from 'react'
import {useUiLocale} from '../../locales/ui-locale'

export interface SettingsProps {
  user: AuthUser
  passwordPolicy: AuthPasswordPolicy

  onUsernameUpdate: (userName: string) => Promise<void>

  onProfileUpdate: (profile: AuthUser['human']['profile']) => Promise<void>

  onProfileAvatarUpdate: (avatarFile: File) => Promise<void>

  onContactInformationRefresh: () => Promise<void>

  onEmailUpdate: (email: string) => Promise<void>
  onEmailResendCode: () => Promise<void>
  onphoneUpdate: (phone: string) => Promise<void>
  onphoneDelete: () => Promise<void>
  onphoneVerify: (code: string) => Promise<void>
  onphoneResendCode: () => Promise<void>
  onPasswordUpdate: (oldPassword: string, newPassword: string) => Promise<void>
}

type TabType = {
  label: string
  value: 'GENERAL' | 'PASSWD'
}

const TABS: TabType[] = [
  {
    label: 'General',
    value: 'GENERAL'
  },
  {
    label: 'Password & Security',
    value: 'PASSWD'
  }
]

// GENDER_UNSPECIFIED, GENDER_FEMALE, GENDER_MALE, GENDER_DIVERSE
const genderOptions = {
  GENDER_UNSPECIFIED: 'Unspecified',
  GENDER_MALE: 'Male',
  GENDER_FEMALE: 'Female',
  GENDER_DIVERSE: 'Other'
}

/**
 * One entry per catalog the CMS ships, keyed by the language tag stored on the
 * account. Names are in their own language, which is how every language list
 * that respects its readers is written.
 */
const localOptions = {
  en: 'English',
  de: 'Deutsch',
  sl: 'Slovenščina',
  it: 'Italiano',
  ja: '日本語',
  tr: 'Türkçe',
  ar: 'العربية'
}

export const Settings: React.FC<SettingsProps> = props => {
  const query = new URLSearchParams(window.location.search)
  const initialTab = query.get('activeTab') || 'GENERAL' // replace 'GENERAL' with your default tab value

  const notify = useNotificationsContext()
  const {setPreviewLocale} = useUiLocale()

  const [user, setUser] = useState(props.user)

  useEffect(() => {
    setUser(props.user)
  }, [props.user])

  const [activeTab, setActiveTab] = useState<TabType['value']>(
    initialTab as TabType['value']
  )

  const handleTabChange = (tab: TabType['value']) => {
    setActiveTab(tab)
    // Toggle password if the tab is changed
    setIsChangingPassword(false)

    // Update the query parameters
    query.set('activeTab', tab)
    // navigate(window.location.pathname + '?' + query.toString())
  }

  const [isProfileUpdating, setIsProfileUpdating] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsProfileUpdating(true)
    // Update profile information on form submission
    await props.onProfileUpdate(user.human.profile)
    setIsProfileUpdating(false)
  }

  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('')

  const togglePasswordChange = () => {
    setIsChangingPassword(!isChangingPassword)
  }

  const [isProfileAvatarUpdating, setIsProfileAvatarUpdating] = useState(false)

  const handleProfileAvatarUpdate = async (avatarFile: File) => {
    setIsProfileAvatarUpdating(true)
    await props.onProfileAvatarUpdate(avatarFile)
    setIsProfileAvatarUpdating(false)
  }

  const [isUsernameChanging, setIsUsernameChanging] = useState(false)

  const handleUsernameChange = async () => {
    const userName = await notify.prompt({
      title: 'Change Username',
      message: 'Please enter your new username'
    })

    if (userName) {
      // update username
      setIsUsernameChanging(true)
      await props.onUsernameUpdate(userName)
      setIsUsernameChanging(false)
    }
  }

  const [isEmailChanging, setIsEmailChanging] = useState(false)

  const handleEmailChange = async () => {
    const email = await notify.prompt({
      title: 'Change Email',
      message: 'Please enter your new email'
    })

    if (email) {
      // update email
      setIsEmailChanging(true)
      await props.onEmailUpdate(email)
      setIsEmailChanging(false)
    }
  }

  const [isEmailResendingCode, setIsEmailResendingCode] = useState(false)

  const handleEmailResendCode = async () => {
    setIsEmailResendingCode(true)

    await props.onEmailResendCode()

    setIsEmailResendingCode(false)
  }

  const [isPhoneChanging, setIsPhoneChanging] = useState(false)

  const handlePhoneChange = async () => {
    const phone = await notify.prompt({
      title: 'Change Phone Number',
      message: 'Please enter your new phone number'
    })

    if (phone) {
      // update phone number
      setIsPhoneChanging(true)
      await props.onphoneUpdate(phone)
      setIsPhoneChanging(false)
    }
  }

  const [isPhoneDeleting, setIsPhoneDeleting] = useState(false)

  const handlephoneDelete = async () => {
    const confirm = await notify.confirm({
      title: 'Delete Phone Number',
      message: 'Are you sure you want to delete your phone number?'
    })

    if (confirm) {
      // delete phone number
      setIsPhoneDeleting(true)
      await props.onphoneDelete()
      setIsPhoneDeleting(false)
    }
  }

  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false)

  const handlephoneVerify = async () => {
    const code = await notify.prompt({
      title: 'Verify Phone Number',
      message: 'Please enter the verification code'
    })

    if (code) {
      // verify phone number
      setIsPhoneVerifying(true)
      await props.onphoneVerify(code)
      setIsPhoneVerifying(false)
    }
  }

  const [isPhoneResendingCode, setIsPhoneResendingCode] = useState(false)

  const handlephoneResendCode = async () => {
    setIsPhoneResendingCode(true)

    await props.onphoneResendCode()

    setIsPhoneResendingCode(false)
  }

  const [isPasswordChanging, setIsPasswordChanging] = useState(false)

  const handlePasswordChange = async () => {
    setIsPasswordChanging(true)
    await props.onPasswordUpdate(currentPassword, password)
    setIsPasswordChanging(false)
  }

  const [isContactInformationRefreshing, setIsContactInformationRefreshing] =
    useState(false)

  const handleContactInformationRefresh = async () => {
    setIsContactInformationRefreshing(true)
    await props.onContactInformationRefresh()
    setIsContactInformationRefreshing(false)
  }

  return (
    <Grid templateColumns={{base: '1fr', md: '15% 85%'}} gap={4}>
      <GridItem>
        <VStack>
          {TABS.map(tab => (
            <Button
              w="full"
              justifyContent="left"
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              variant="ghost"
              color={tab.value === activeTab ? 'brand.500' : undefined}>
              {tab.label}
            </Button>
          ))}
        </VStack>
      </GridItem>
      <GridItem>
        {activeTab === 'GENERAL' && (
          <Stack gap="8">
            <Card.Root>
              <Card.Header fontWeight="bold" fontSize="lg">
                Profile
              </Card.Header>
              <Card.Body>
                <Stack gap="6">
                  <HStack gap="6">
                    <HStack>
                      <Avatar.Root
                        size="xl"
                        cursor="pointer"
                        onClick={
                          isProfileAvatarUpdating
                            ? undefined
                            : () => {
                                const input = document.createElement('input')
                                input.type = 'file'
                                input.accept = 'image/*'
                                input.onchange = async e => {
                                  const file = (e.target as HTMLInputElement)
                                    .files![0]

                                  if (!file) {
                                    notify.toast({
                                      title: 'No file selected',
                                      status: 'error'
                                    })
                                    return
                                  }

                                  await handleProfileAvatarUpdate(file)
                                }
                                input.click()
                              }
                        }>
                        <Avatar.Fallback
                          name={user?.human?.profile?.displayName}
                        />
                        <Avatar.Image src={user?.human?.profile?.avatarUrl} />
                      </Avatar.Root>

                      {isProfileAvatarUpdating && (
                        <Spinner size="sm" color="brand.500" />
                      )}
                    </HStack>
                    <Stack gap="4">
                      <Field.Root id="userName">
                        <Field.Label>Username</Field.Label>
                        <HStack>
                          <Input
                            disabled
                            maxW="xs"
                            autoComplete="off"
                            bg="gray.100"
                            value={user?.userName}
                            onChange={e =>
                              setUser({...user, userName: e.target.value})
                            }
                          />
                          <IconButton
                            size="lg"
                            aria-label="Edit userName"
                            variant="ghost"
                            onClick={handleUsernameChange}
                            loading={isUsernameChanging}>
                            <FaEdit />
                          </IconButton>
                        </HStack>
                      </Field.Root>
                    </Stack>
                  </HStack>

                  <form onSubmit={handleSubmit}>
                    <Stack gap="6">
                      <SimpleGrid columns={{base: 1, md: 2}} gap="6">
                        <Field.Root id="firstName">
                          <Field.Label>First Name</Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.firstName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    firstName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>
                        <Field.Root id="lastName">
                          <Field.Label>Last Name</Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.lastName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    lastName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>

                        <Field.Root id="nickName">
                          <Field.Label>Nickname</Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.nickName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    nickName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>

                        <Field.Root id="displayName">
                          <Field.Label>Full Name</Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.displayName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    displayName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>

                        <Field.Root id="gender">
                          <Field.Label>Gender</Field.Label>
                          <NativeSelect.Root>
                            <NativeSelect.Field
                              defaultValue={user?.human?.profile?.gender}
                              onChange={e => {
                                setUser({
                                  ...user,
                                  human: {
                                    ...user.human,
                                    profile: {
                                      ...user.human.profile,
                                      gender: e.target.value
                                    }
                                  }
                                })
                              }}>
                              {Object.entries(genderOptions).map(
                                ([key, value]) => (
                                  <option key={key} value={key}>
                                    {value}
                                  </option>
                                )
                              )}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>

                        <Field.Root id="preferredLanguage">
                          <Field.Label>Language</Field.Label>
                          <NativeSelect.Root>
                            {/* An account without a language would otherwise
                                display the first option as if it were set,
                                and choosing it again fires no change. The
                                disabled placeholder keeps "not set" visible
                                until a real choice is made. */}
                            <NativeSelect.Field
                              defaultValue={
                                user?.human?.profile?.preferredLanguage || ''
                              }
                              onChange={e => {
                                // The UI follows the pick at once; Save is
                                // what writes it to the account.
                                setPreviewLocale(e.target.value)

                                setUser({
                                  ...user,
                                  human: {
                                    ...user.human,
                                    profile: {
                                      ...user.human.profile,
                                      preferredLanguage: e.target.value
                                    }
                                  }
                                })
                              }}>
                              <option value="" disabled>
                                Not set
                              </option>
                              {Object.entries(localOptions).map(
                                ([key, value]) => (
                                  <option key={key} value={key}>
                                    {value}
                                  </option>
                                )
                              )}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>
                      </SimpleGrid>

                      <ButtonGroup>
                        <Button loading={isProfileUpdating} type="submit">
                          Save
                        </Button>
                      </ButtonGroup>
                    </Stack>
                  </form>
                </Stack>
              </Card.Body>
            </Card.Root>

            <Card.Root>
              <Card.Header fontWeight="bold" fontSize="lg">
                <HStack justifyContent="space-between">
                  <Text>Contact Information</Text>
                  <IconButton
                    size="lg"
                    aria-label="Refresh"
                    variant="ghost"
                    onClick={handleContactInformationRefresh}
                    loading={isContactInformationRefreshing}>
                    <MdRefresh />
                  </IconButton>
                </HStack>
              </Card.Header>
              <Card.Body>
                <Text fontSize="sm" color="gray.600">
                  The provided information is used to send important
                  information, like password reset e-mails to you.
                </Text>
                <Stack separator={<StackSeparator />} gap="6" my="4">
                  <Field.Root id="email">
                    <HStack justifyContent="space-between">
                      <Field.Label>Email</Field.Label>
                      <IconButton
                        size="lg"
                        aria-label="Edit email"
                        variant="ghost"
                        onClick={handleEmailChange}
                        loading={isEmailChanging}>
                        <FaEdit />
                      </IconButton>
                    </HStack>
                    <Text mt="2">{user?.human?.email?.email}</Text>

                    <HStack>
                      <Text
                        fontSize="sm"
                        color={
                          user?.human?.email?.isEmailVerified
                            ? 'green.500'
                            : 'red.500'
                        }>
                        {user?.human?.email?.isEmailVerified
                          ? 'Verified'
                          : 'Not verified'}
                      </Text>

                      {!user?.human?.email?.isEmailVerified && (
                        <>
                          <Button
                            variant="plain"
                            color="fg.subtle"
                            fontWeight="normal"
                            onClick={handleEmailResendCode}
                            loading={isEmailResendingCode}>
                            Resend Code
                          </Button>
                        </>
                      )}
                    </HStack>
                  </Field.Root>

                  <Field.Root>
                    {user?.human?.phone?.phone ? (
                      <>
                        <HStack justifyContent="space-between">
                          <Field.Label>Phone number</Field.Label>
                          <HStack>
                            <IconButton
                              size="lg"
                              aria-label="Delete phone number"
                              variant="ghost"
                              colorPalette="red"
                              onClick={handlephoneDelete}
                              loading={isPhoneDeleting}>
                              <Icon color="red.500" asChild>
                                <FaTrash />
                              </Icon>
                            </IconButton>
                            <IconButton
                              size="lg"
                              aria-label="Edit phone number"
                              variant="ghost"
                              onClick={handlePhoneChange}
                              loading={isPhoneChanging}>
                              <FaEdit />
                            </IconButton>
                          </HStack>
                        </HStack>
                        <Text mt="2">{user.human.phone.phone}</Text>

                        <HStack>
                          <Text
                            fontSize="sm"
                            color={
                              user.human.phone.isPhoneVerified
                                ? 'green.500'
                                : 'red.500'
                            }>
                            {user.human.phone.isPhoneVerified
                              ? 'Verified'
                              : 'Not verified'}
                          </Text>

                          {!user.human.phone.isPhoneVerified && (
                            <>
                              <Button
                                variant="plain"
                                color="fg.subtle"
                                fontWeight="normal"
                                onClick={handlephoneVerify}
                                loading={isPhoneVerifying}>
                                Verify
                              </Button>

                              <Button
                                variant="plain"
                                color="fg.subtle"
                                fontWeight="normal"
                                onClick={handlephoneResendCode}
                                loading={isPhoneResendingCode}>
                                Resend Code
                              </Button>
                            </>
                          )}
                        </HStack>
                      </>
                    ) : (
                      <>
                        <HStack justifyContent="space-between">
                          <Field.Label>Phone number</Field.Label>
                          <IconButton
                            size="lg"
                            aria-label="Add phone number"
                            variant="ghost"
                            onClick={handlePhoneChange}
                            loading={isPhoneChanging}>
                            <FaPlus />
                          </IconButton>
                        </HStack>
                        <Text mt="2">No phone number provided</Text>
                      </>
                    )}
                  </Field.Root>
                </Stack>
              </Card.Body>
            </Card.Root>
          </Stack>
        )}

        {activeTab === 'PASSWD' && (
          <Card.Root>
            <Card.Header fontWeight="bold" fontSize="lg">
              Password
            </Card.Header>

            <Card.Body>
              {isChangingPassword ? (
                <Stack gap="6">
                  <Field.Label>
                    Enter the new password according to the policy below.
                  </Field.Label>
                  <Field.Root>
                    <Field.Label>Current Password</Field.Label>
                    <Input
                      maxW="md"
                      type="password"
                      placeholder="New password"
                      onChange={e => setCurrentPassword(e.target.value)}
                    />
                  </Field.Root>

                  <List.Root gap={3}>
                    {props.passwordPolicy.minLength && (
                      <List.Item>
                        {password.length >= props.passwordPolicy.minLength ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        Has to be at least {props.passwordPolicy.minLength}{' '}
                        characters long. ({password.length} /{' '}
                        {props.passwordPolicy.minLength})
                      </List.Item>
                    )}
                    {props.passwordPolicy.hasSymbol && (
                      <List.Item>
                        {/[\p{P}\p{S}]/u.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        Must include a symbol or punctuation mark.
                      </List.Item>
                    )}

                    {props.passwordPolicy.hasNumber && (
                      <List.Item>
                        {/\d/.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        Must include a number.
                      </List.Item>
                    )}

                    {props.passwordPolicy.hasUppercase && (
                      <List.Item>
                        {/[A-Z]/.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        Must include an uppercase letter.
                      </List.Item>
                    )}

                    {props.passwordPolicy.hasLowercase && (
                      <List.Item>
                        {/[a-z]/.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        Must include a lowercase letter.
                      </List.Item>
                    )}

                    <List.Item>
                      {password && password === passwordConfirmation ? (
                        <List.Indicator color="green.500" asChild>
                          <FaCheck />
                        </List.Indicator>
                      ) : (
                        <List.Indicator color="red.500" asChild>
                          <FaX />
                        </List.Indicator>
                      )}
                      Passwords match.
                    </List.Item>
                  </List.Root>

                  <HStack>
                    <Field.Root>
                      <Field.Label>New Password</Field.Label>
                      <Input
                        type="password"
                        placeholder="New password"
                        autoComplete="new-password"
                        onChange={e => setPassword(e.target.value)}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Confirm Password</Field.Label>
                      <Input
                        type="password"
                        placeholder="Confirm password"
                        autoComplete="new-password"
                        onChange={e => setPasswordConfirmation(e.target.value)}
                      />
                    </Field.Root>
                  </HStack>

                  <ButtonGroup>
                    <Button
                      loading={isPasswordChanging}
                      type="submit"
                      onClick={handlePasswordChange}>
                      Reset Current Password
                    </Button>
                    <Button variant="outline" onClick={togglePasswordChange}>
                      Cancel
                    </Button>
                  </ButtonGroup>
                </Stack>
              ) : (
                <Field.Root>
                  <HStack justifyContent="space-between">
                    <Field.Label>
                      A secure password helps to protect the account
                    </Field.Label>
                    <IconButton
                      size="lg"
                      aria-label="Edit email"
                      variant="ghost"
                      onClick={togglePasswordChange}
                      loading={isPasswordChanging}>
                      <FaEdit />
                    </IconButton>
                  </HStack>
                  <Text mt="2">*********</Text>
                </Field.Root>
              )}
            </Card.Body>
          </Card.Root>
        )}
      </GridItem>
    </Grid>
  )
}
