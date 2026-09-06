/**
 * The directory, for the dispatcher.
 *
 * One page of accounts from Zitadel with the name, the roles, whether the
 * account may sign in, and the driver's colour. Search narrows the page in
 * the browser. "Create driver" is the one create path: a customer creates
 * themselves by booking, a dispatcher is made by hand in Zitadel.
 *
 * The list is the shared DataTable (okf/architecture/data-layer.md,
 * acceptance 4): the board's header row, the driver's colour on the left
 * edge of a row and a card, the column popover, cards below `md` and the
 * pager, with the directory's own columns and its cursor pages.
 *
 * Admin only. The shell offers the entry only to an admin and the backend
 * refuses `users` to anyone else, so the screen itself only has to say so
 * politely when a link brought somebody here who has no business here.
 */
import React, {useMemo, useState} from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Clipboard,
  CloseButton,
  Code,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Portal,
  SimpleGrid,
  Stack,
  Stat,
  Text,
  Wrap
} from '@chakra-ui/react'
import {FaSearch} from '@react-icons/all-files/fa/FaSearch'
import {FaUserPlus} from '@react-icons/all-files/fa/FaUserPlus'
import {FaExclamationTriangle} from '@react-icons/all-files/fa/FaExclamationTriangle'
import {useAppNavigate} from '../navigation'
import {useI18nCode} from '../i18n'
import {getI18nUsers, type UsersStrings} from '../locales/i18nUsers'
import {fill, getI18nCommon} from '../locales/i18nCommon'
import {ADMIN_ROLE, CUSTOMER_ROLE, DRIVER_ROLE, useCaller} from '../auth'
import {
  DialogActions,
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  toaster,
  PageHeader
} from '../components'
import {RefreshButton} from '../components/RefreshButton'
import {useViewRefresh} from '../hooks/view-refresh'
import {DataTable, type DataColumn} from '../components/table'
import {NumberSkeleton} from '../components/skeletons'
import {
  createDriverMutation,
  fullName,
  useUserDirectory,
  type CreateDriverArgs,
  type CreatedDriver,
  type DirectoryUser
} from '../hooks/users'

/**
 * The three role keys, as chips. booklimo's retired `krc:driver` is shown as
 * the driver too, so an account that still carries it does not read as
 * roleless while the key is phased out.
 */
export function roleLabel(key: string, t: UsersStrings): string | undefined {
  if (key === ADMIN_ROLE) return t.RoleAdmin
  if (key === DRIVER_ROLE || key.endsWith(':driver')) return t.RoleDriver
  if (key === CUSTOMER_ROLE || key.endsWith(':customer')) return t.RoleCustomer
  return undefined
}

const rolePalette = (key: string): string => {
  if (key === ADMIN_ROLE) return 'purple'
  if (key.endsWith(':driver')) return 'blue'
  if (key.endsWith(':customer')) return 'green'
  return 'gray'
}

export function RoleChips({roles, t}: {roles: string[]; t: UsersStrings}) {
  // One chip per meaning, not one per key. A KRC driver holds `krc:driver` and
  // `limosen:driver` at once while the first is being phased out, and both read
  // as "Driver", so without this the row said Driver twice.
  const seen = new Set<string>()
  const known = roles.filter(r => {
    const label = roleLabel(r, t)
    if (!label || seen.has(label)) return false
    seen.add(label)
    return true
  })
  if (known.length === 0) {
    return (
      <Badge variant="outline" colorPalette="gray" size="sm">
        {t.RoleNone}
      </Badge>
    )
  }
  return (
    <Wrap gap="1">
      {known.map(r => (
        <Badge key={r} variant="subtle" colorPalette={rolePalette(r)} size="sm">
          {roleLabel(r, t)}
        </Badge>
      ))}
    </Wrap>
  )
}

export function ActiveBadge({active, t}: {active: boolean; t: UsersStrings}) {
  return (
    <Badge
      variant={active ? 'subtle' : 'outline'}
      colorPalette={active ? 'green' : 'gray'}
      size="sm">
      {active ? t.StatusActive : t.StatusInactive}
    </Badge>
  )
}

/**
 * The initial in a circle, painted in the driver's colour when there is one.
 * Chakra picks a readable foreground for a named palette but not for a hex,
 * so the contrast is decided here from the luminance.
 */
/**
 * How a person is named everywhere on these screens: the big line is the
 * profile name, "Vorname Nachname", and the muted line under it is the login
 * name. An account without a profile name shows the login name as the big
 * line and nothing under it, so the same string is never printed twice.
 */
export const profileName = (u: DirectoryUser): string =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim()

export const loginName = (u: DirectoryUser): string =>
  u.username || u.email || ''

export function PersonName({
  user,
  size = 'md'
}: {
  user: DirectoryUser
  /** md for list rows, lg for a detail header. */
  size?: 'md' | 'lg'
}) {
  const name = profileName(user)
  const login = loginName(user)
  const primary = name || login
  const secondary = name ? login : ''
  return (
    <Box minW="0">
      <Text
        textStyle={size === 'lg' ? {base: 'xl', md: '2xl'} : 'md'}
        fontWeight={size === 'lg' ? 'semibold' : 'medium'}
        lineClamp={1}>
        {primary}
      </Text>
      {secondary ? (
        <Text
          textStyle={size === 'lg' ? 'sm' : 'xs'}
          color="fg.muted"
          lineClamp={1}>
          {secondary}
        </Text>
      ) : null}
    </Box>
  )
}

export function UserAvatar({
  user,
  size = 'sm'
}: {
  user: DirectoryUser
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}) {
  const initial = (
    user.firstName?.[0] ||
    user.username?.[0] ||
    user.email?.[0] ||
    '?'
  ).toUpperCase()
  const colour = user.driverColor
  return (
    <Avatar.Root
      size={size}
      variant="subtle"
      style={
        colour
          ? {backgroundColor: colour, color: contrastFor(colour)}
          : undefined
      }>
      <Avatar.Fallback name={fullName(user)}>{initial}</Avatar.Fallback>
    </Avatar.Root>
  )
}

export const contrastFor = (hex: string): string => {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#000'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff'
}

const formatDate = (iso: string | null, code: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(code)
}

export function UsersView() {
  const caller = useCaller()
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: t} = getI18nUsers(code)
  const {strings: tc} = getI18nCommon(code)
  const {
    users,
    isLoading,
    error,
    isFetching,
    pagination,
    nextPage,
    prevPage,
    refetch
  } = useUserDirectory()
  useViewRefresh(refetch, isFetching)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      [u.username, u.email, u.firstName, u.lastName, fullName(u)].some(v =>
        v?.toLowerCase().includes(q)
      )
    )
  }, [users, search])

  // The directory's columns as DataTable takes them. The name cell carries
  // the colour dot and the avatar as the old table did, the same colour sits
  // on the row's left edge through `stripe`.
  const columns = useMemo<DataColumn<DirectoryUser>[]>(
    () => [
      {
        id: 'user',
        label: t.ColUser,
        width: 280,
        cell: u => (
          <HStack gap="3" minW="0">
            <DriverColorDot color={u.driverColor} />
            <UserAvatar user={u} />
            <PersonName user={u} />
          </HStack>
        )
      },
      {
        id: 'email',
        label: t.ColEmail,
        width: 240,
        cell: u => (
          <Text color="fg.muted" lineClamp={1}>
            {u.email}
          </Text>
        )
      },
      {
        id: 'roles',
        label: t.ColRoles,
        width: 200,
        cell: u => <RoleChips roles={u.roles} t={t} />
      },
      {
        id: 'status',
        label: t.ColStatus,
        width: 110,
        cell: u => <ActiveBadge active={u.isActive} t={t} />
      },
      {
        id: 'created',
        label: t.ColCreated,
        width: 120,
        cell: u => (
          <Text color="fg.muted" whiteSpace="nowrap">
            {formatDate(u.createdAt, code)}
          </Text>
        )
      }
    ],
    [t, code]
  )

  // The pager walks back one cursor per call, so the first page is the
  // trail walked back to its start in one tick.
  const firstPage = () => {
    for (let page = pagination.currentPage; page > 1; page--) prevPage()
  }

  if (!caller.loading && !caller.isAdmin) {
    // A driver or a customer landed on a dispatch screen: they have a role,
    // just not this one. Only an account with no role at all is told so.
    return (
      <EmptyState
        title={tc.NoAccessTitle}
        description={caller.roles.length ? tc.AdminOnlyBody : tc.NoAccessBody}
        icon={<FaExclamationTriangle />}
      />
    )
  }

  const activeOnPage = users.filter(u => u.isActive).length
  // The three numbers wait as numbers while the first page is read, never
  // as 0 (design-consistency.md, rule 3). A page turned keeps its numbers.
  const pending = isLoading && users.length === 0
  const count = (n: number, chars = 3) =>
    pending ? <NumberSkeleton chars={chars} /> : n

  return (
    <Stack gap="6" p={{base: '4', md: '6'}} maxW="full">
      <PageHeader
        title={t.Heading}
        subtitle={t.Subtitle}
        actions={
          <>
            <Button
              size="sm"
              colorPalette="brand"
              onClick={() => setCreateOpen(true)}>
              <FaUserPlus /> {t.CreateDriver}
            </Button>
            <RefreshButton />
          </>
        }
      />

      <SimpleGrid columns={{base: 3}} gap="3">
        <StatCard
          label={t.StatTotalUsers}
          value={count(pagination.totalCount)}
        />
        <StatCard
          label={t.StatActivePage}
          value={count(activeOnPage, 2)}
          palette="green"
        />
        <StatCard
          label={t.StatInactivePage}
          value={count(users.length - activeOnPage, 2)}
        />
      </SimpleGrid>

      <InputGroup startElement={<FaSearch />} maxW={{md: 'sm'}}>
        <Input
          placeholder={t.SearchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </InputGroup>

      <DataTable
        tableId="users"
        columns={columns}
        rows={filtered}
        rowId={u => u.id}
        onOpen={u => navigate(`/users/${u.id}`)}
        stripe={u => u.driverColor}
        summary={fill(t.CountLabel, {
          total: pagination.totalCount,
          count: filtered.length
        })}
        isLoading={isLoading}
        avatarSkeleton
        error={error}
        onRetry={refetch}
        empty={<EmptyState title={t.EmptyMessage} />}
        pager={{
          page: pagination.currentPage,
          pages: pagination.totalPages,
          hasNext: pagination.hasNextPage,
          onFirst: firstPage,
          onPrev: prevPage,
          onNext: nextPage,
          always: true
        }}
      />

      <CreateDriverDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={created => {
          setCreateOpen(false)
          refetch()
          if (created.userId) navigate(`/users/${created.userId}`)
        }}
      />
    </Stack>
  )
}

function StatCard({
  label,
  value,
  palette
}: {
  label: string
  value: React.ReactNode
  palette?: string
}) {
  return (
    <Card.Root size="sm">
      <Card.Body>
        <Stat.Root>
          <Stat.Label>{label}</Stat.Label>
          <Stat.ValueText
            colorPalette={palette}
            color={palette ? 'colorPalette.fg' : undefined}>
            {value}
          </Stat.ValueText>
        </Stat.Root>
      </Card.Body>
    </Card.Root>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CreateDriverDialogProps {
  open: boolean
  onClose: () => void
  /** Called when the dialog is done with the new account, after the password was shown if there was one. */
  onCreated: (created: CreatedDriver) => void
}

const EMPTY: CreateDriverArgs = {
  email: '',
  givenName: '',
  familyName: '',
  phone: '',
  password: ''
}

/**
 * The form behind "Create driver". Four fields and an optional password.
 * Left empty, the backend generates one and answers with it exactly once,
 * so the dialog stays open on a second page showing it until the dispatcher
 * has handed it over. A supplied password is never echoed back.
 */
function CreateDriverDialog({
  open,
  onClose,
  onCreated
}: CreateDriverDialogProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nUsers(code)
  const [form, setForm] = useState<CreateDriverArgs>(EMPTY)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedDriver | null>(null)

  const set =
    (key: keyof CreateDriverArgs) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({...f, [key]: e.target.value}))

  const errors = {
    email: !form.email.trim()
      ? t.ValidationRequired
      : !EMAIL.test(form.email.trim())
        ? t.ValidationEmail
        : undefined,
    givenName: !form.givenName.trim() ? t.ValidationRequired : undefined,
    familyName: !form.familyName.trim() ? t.ValidationRequired : undefined
  }
  const valid = !errors.email && !errors.givenName && !errors.familyName

  const reset = () => {
    setForm(EMPTY)
    setTouched(false)
    setFailure(null)
    setCreated(null)
  }

  const finish = () => {
    const done = created
    reset()
    if (done) onCreated(done)
    else onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid || saving) return
    setSaving(true)
    setFailure(null)
    try {
      const result = await createDriverMutation({
        email: form.email.trim(),
        givenName: form.givenName.trim(),
        familyName: form.familyName.trim(),
        phone: form.phone?.trim() || undefined,
        password: form.password || undefined
      })
      toaster.success({title: t.CreateDriverSuccess})
      if (result.temporaryPassword || !result.roleGranted) {
        // Something to show first: the dialog turns into the hand-over page.
        setCreated(result)
      } else {
        reset()
        onCreated(result)
      }
    } catch (err) {
      setFailure(err instanceof Error ? err.message : t.CreateDriverFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={e => {
        if (!e.open && !saving) finish()
      }}
      size="md"
      placement="center"
      lazyMount
      unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          {created ? (
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t.CreateDriverSuccess}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="4">
                  <Text textStyle="sm" color="fg.muted">
                    {form.email.trim()}
                  </Text>
                  {created.temporaryPassword && (
                    <Field.Root>
                      <Field.Label>{t.TemporaryPasswordLabel}</Field.Label>
                      <Clipboard.Root value={created.temporaryPassword}>
                        <HStack>
                          <Code textStyle="lg" px="3" py="2" userSelect="all">
                            {created.temporaryPassword}
                          </Code>
                          <Clipboard.Trigger asChild>
                            <IconButton
                              variant="outline"
                              size="sm"
                              aria-label={t.TemporaryPasswordLabel}>
                              <Clipboard.Indicator />
                            </IconButton>
                          </Clipboard.Trigger>
                        </HStack>
                      </Clipboard.Root>
                      <Field.HelperText>
                        {t.TemporaryPasswordHint}
                      </Field.HelperText>
                    </Field.Root>
                  )}
                  {!created.roleGranted && (
                    <ErrorBanner
                      title={t.RoleNone}
                      message={t.RoleNotGranted}
                    />
                  )}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <DialogActions
                  confirmLabel={t.OpenAccount}
                  onConfirm={finish}
                />
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          ) : (
            <Dialog.Content as="form" onSubmit={submit}>
              <Dialog.Header>
                <Dialog.Title>{t.CreateDriverTitle}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="4">
                  <Text textStyle="sm" color="fg.muted">
                    {t.CreateDriverBody}
                  </Text>
                  <Field.Root required invalid={touched && !!errors.email}>
                    <Field.Label>
                      {t.FieldEmail} <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      type="email"
                      autoComplete="off"
                      value={form.email}
                      onChange={set('email')}
                    />
                    <Field.ErrorText>{errors.email}</Field.ErrorText>
                  </Field.Root>
                  <SimpleGrid columns={{base: 1, sm: 2}} gap="4">
                    <Field.Root
                      required
                      invalid={touched && !!errors.givenName}>
                      <Field.Label>
                        {t.FieldGivenName} <Field.RequiredIndicator />
                      </Field.Label>
                      <Input
                        value={form.givenName}
                        onChange={set('givenName')}
                      />
                      <Field.ErrorText>{errors.givenName}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root
                      required
                      invalid={touched && !!errors.familyName}>
                      <Field.Label>
                        {t.FieldFamilyName} <Field.RequiredIndicator />
                      </Field.Label>
                      <Input
                        value={form.familyName}
                        onChange={set('familyName')}
                      />
                      <Field.ErrorText>{errors.familyName}</Field.ErrorText>
                    </Field.Root>
                  </SimpleGrid>
                  <Field.Root>
                    <Field.Label>{t.FieldPhone}</Field.Label>
                    <Input
                      type="tel"
                      value={form.phone ?? ''}
                      onChange={set('phone')}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>{t.FieldPassword}</Field.Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={form.password ?? ''}
                      onChange={set('password')}
                    />
                    <Field.HelperText>{t.FieldPasswordHint}</Field.HelperText>
                  </Field.Root>
                  {failure && (
                    <ErrorBanner
                      title={t.CreateDriverFailed}
                      message={failure}
                    />
                  )}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <DialogActions
                  onCancel={finish}
                  confirmLabel={t.CreateDriver}
                  confirmType="submit"
                  loading={saving}
                />
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={saving} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          )}
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
