/**
 * One account, for the dispatcher.
 *
 * The profile as Zitadel holds it, the three roles as switches, the account
 * state, and for a driver everything the settlement needs: the colour, the
 * share of the fare, the expenses, this month's numbers, and the statements.
 * Every write is admin only on the backend, this screen only offers it.
 *
 * The month is one control for the statistics and the expenses together, so
 * the two cards always speak about the same month.
 */
import React, {useEffect, useState} from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  ColorPicker,
  DataList,
  Field,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  NumberInput,
  Portal,
  SimpleGrid,
  Stack,
  Stat,
  Switch,
  Table,
  Text,
  parseColor
} from '@chakra-ui/react'
import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'
import {FaChevronLeft} from '@react-icons/all-files/fa/FaChevronLeft'
import {FaChevronRight} from '@react-icons/all-files/fa/FaChevronRight'
import {FaExclamationTriangle} from '@react-icons/all-files/fa/FaExclamationTriangle'
import {useAppNavigate, useAppParams} from '../navigation'
import {useI18nCode} from '../i18n'
import {getI18nUsers, type UsersStrings} from '../locales/i18nUsers'
import {getI18nCommon} from '../locales/i18nCommon'
import {
  ADMIN_ROLE,
  brandCustomerRole,
  brandDriverRole,
  CUSTOMER_ROLE,
  DRIVER_ROLE,
  resetCaller,
  useCaller
} from '../auth'
import {
  ConfirmDialog,
  DetailRow,
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  MoneyText,
  selectable,
  toaster,
  PageHeader
} from '../components'
import {useViewRefresh} from '../hooks/view-refresh'
import {
  DetailSkeleton,
  NumberSkeleton,
  TableSkeleton
} from '../components/skeletons'
import {
  addDriverExpenseMutation,
  deactivateUserMutation,
  monthKey,
  reactivateUserMutation,
  setDriverColorMutation,
  setDriverPayoutPercentMutation,
  setUserRolesMutation,
  useDriverExpenses,
  useDriverMonthStats,
  useUserDetail,
  type UserDetail
} from '../hooks/users'
import {
  ActiveBadge,
  RoleChips,
  UserAvatar,
  loginName,
  profileName
} from './UsersView'
import {StatementsView} from './StatementsView'
import {failureText} from '../errors'

const isDriverRole = (key: string) =>
  key === DRIVER_ROLE || key.endsWith(':driver')

const holdsDriver = (roles: string[]) => roles.some(isDriverRole)

// The same tolerance on the way in, so an account still carrying a key that is
// being retired reads as what it is. Writing is strict, see the entries below.
const isCustomerRole = (key: string) =>
  key === CUSTOMER_ROLE || key.endsWith(':customer')

const holdsCustomer = (roles: string[]) => roles.some(isCustomerRole)

/** "September 2026" in the account's language, from a YYYY-MM key. */
const monthLabel = (month: string, code: string): string => {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  try {
    return new Intl.DateTimeFormat(code, {
      month: 'long',
      year: 'numeric'
    }).format(new Date(y, m - 1, 1))
  } catch {
    return month
  }
}

const shiftMonth = (month: string, by: number): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y ?? 1970, (m ?? 1) - 1 + by, 1)
  return monthKey(d)
}

const formatDate = (
  iso: string | null | undefined,
  code: string,
  long = false
) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return long
    ? d.toLocaleDateString(code, {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : d.toLocaleDateString(code)
}

export function UserDetailView() {
  const {userId} = useAppParams() as {userId: string}
  const caller = useCaller()
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: t} = getI18nUsers(code)
  const {strings: tc} = getI18nCommon(code)
  const {user, isLoading, error, isFetching, refetch} = useUserDetail(userId)
  useViewRefresh(refetch, isFetching)
  const [month, setMonth] = useState(() => monthKey())

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

  const back = (
    <Button
      variant="ghost"
      size="sm"
      alignSelf="start"
      onClick={() => navigate('/users')}>
      <FaArrowLeft /> {t.DetailBackLink}
    </Button>
  )

  if (isLoading) return <DetailSkeleton cards={3} avatar back />
  if (error) {
    return (
      <Stack gap="4" p={{base: '4', md: '6'}}>
        {back}
        <ErrorBanner message={error} onRetry={refetch} />
      </Stack>
    )
  }
  if (!user) {
    return (
      <Stack gap="4" p={{base: '4', md: '6'}}>
        {back}
        <EmptyState title={t.DetailNotFound} />
      </Stack>
    )
  }

  const driver = holdsDriver(user.roles)

  return (
    <Stack gap="6" p={{base: '4', md: '6'}} maxW="full">
      {back}

      <PageHeader
        leading={<UserAvatar user={user} size="xl" />}
        title={profileName(user) || loginName(user)}
        subtitle={profileName(user) ? loginName(user) : undefined}
        meta={
          <>
            <ActiveBadge active={user.isActive} t={t} />
            <RoleChips roles={user.roles} t={t} />
          </>
        }
      />

      <Section title={t.SectionAccountDetails}>
        <DataList.Root orientation="horizontal" size="md">
          <Row label={t.LabelEmail} value={user.email} />
          <Row label={t.LabelUsername} value={user.username} />
          <Row label={t.LabelPhone} value={user.phone} />
          <Row label={t.LabelLanguage} value={user.preferredLanguage} />
          <Row
            label={t.LabelCreated}
            value={formatDate(user.createdAt, code, true)}
          />
          <Row label={t.LabelUserId} value={user.id} mono />
        </DataList.Root>
      </Section>

      <RolesCard
        user={user}
        t={t}
        isSelf={caller.userId === user.id}
        onSaved={refetch}
      />

      <StateCard user={user} t={t} tc={tc.Cancel} onSaved={refetch} />

      {driver && (
        <>
          <ColorCard
            user={user}
            t={t}
            tc={{save: tc.Save, cancel: tc.Cancel}}
            onSaved={refetch}
          />
          <PayoutCard user={user} t={t} save={tc.Save} onSaved={refetch} />

          <HStack justify="space-between">
            <Heading size="md">{monthLabel(month, code)}</Heading>
            <HStack>
              <IconButton
                aria-label={tc.Previous}
                size="sm"
                variant="outline"
                onClick={() => setMonth(m => shiftMonth(m, -1))}>
                <FaChevronLeft />
              </IconButton>
              <IconButton
                aria-label={tc.Next}
                size="sm"
                variant="outline"
                onClick={() => setMonth(m => shiftMonth(m, 1))}>
                <FaChevronRight />
              </IconButton>
            </HStack>
          </HStack>

          <StatsCard userId={user.id} month={month} t={t} />
          <ExpensesCard userId={user.id} month={month} t={t} />
        </>
      )}

      <Section title={t.SectionStatements}>
        <StatementsView userId={user.id} embedded />
      </Section>
    </Stack>
  )
}

function Section({
  title,
  hint,
  children,
  actions
}: {
  title: string
  hint?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <Card.Root>
      <Card.Header pb="2">
        <Flex align="start" gap="3">
          <Box flex="1">
            <Card.Title>{title}</Card.Title>
            {hint && <Card.Description mt="1">{hint}</Card.Description>}
          </Box>
          {actions}
        </Flex>
      </Card.Header>
      <Card.Body>{children}</Card.Body>
    </Card.Root>
  )
}

/**
 * A row of the account card. The shared DetailRow carries the label column,
 * the wrapping of a long mail address or id (rule 9) and the selectable mark
 * (rule 11); this screen only says which of its values is mono.
 */
function Row({
  label,
  value,
  mono
}: {
  label: string
  value?: string
  mono?: boolean
}) {
  return <DetailRow label={label} value={value} mono={mono} placeholder="-" />
}

interface CardProps {
  user: UserDetail
  t: UsersStrings
  onSaved: () => void | Promise<void>
}

/**
 * The three role keys as switches. Each toggle writes the whole set, which
 * is what setUserRoles takes, and keys this screen does not know are kept
 * so a grant made elsewhere is not lost by flipping an unrelated switch.
 * Turning the driver off also drops booklimo's retired `krc:driver`.
 */
function RolesCard({user, t, isSelf, onSaved}: CardProps & {isSelf: boolean}) {
  const [roles, setRoles] = useState<string[]>(user.roles)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    setRoles(user.roles)
  }, [user.roles])

  const toggle = async (key: string, on: boolean) => {
    const next = on
      ? [...roles.filter(r => r !== key), key]
      : roles.filter(
          r => r !== key && !(key === DRIVER_ROLE && isDriverRole(r))
        )
    setRoles(next)
    setSaving(key)
    try {
      await setUserRolesMutation(user.id, next)
      toaster.success({title: t.RolesSaved})
      // The dispatcher who edited their own roles must not keep the old ones cached.
      if (isSelf) resetCaller()
      await onSaved()
    } catch (err) {
      setRoles(roles)
      toaster.error({
        title: t.RolesFailed,
        description: failureText(err)
      })
    } finally {
      setSaving(null)
    }
  }

  // The keys this brand writes, so a KRC account is offered krc:driver and
  // krc:customer and can never be given the other company's key from here.
  const driverKey = brandDriverRole()
  const customerKey = brandCustomerRole()

  const entries: Array<[string, string, boolean]> = [
    [ADMIN_ROLE, t.RoleAdmin, roles.includes(ADMIN_ROLE)],
    [driverKey, t.RoleDriver, holdsDriver(roles)],
    [customerKey, t.RoleCustomer, holdsCustomer(roles)]
  ]

  return (
    <Section title={t.SectionRoles} hint={t.RolesHint}>
      <Stack gap="3">
        {entries.map(([key, label, checked]) => (
          <Switch.Root
            key={key}
            checked={checked}
            disabled={saving !== null}
            colorPalette="brand"
            onCheckedChange={e => void toggle(key, e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>{label}</Switch.Label>
          </Switch.Root>
        ))}
      </Stack>
    </Section>
  )
}

function StateCard({user, t, onSaved}: CardProps & {tc: string}) {
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const run = async () => {
    setSaving(true)
    try {
      if (user.isActive) await deactivateUserMutation(user.id)
      else await reactivateUserMutation(user.id)
      toaster.success({
        title: user.isActive ? t.DeactivateSuccess : t.ReactivateSuccess
      })
      setConfirm(false)
      await onSaved()
    } catch (err) {
      toaster.error({
        title: t.StateChangeFailed,
        description: failureText(err)
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title={t.SectionAccountState}
      actions={
        <Button
          size="sm"
          variant={user.isActive ? 'outline' : 'solid'}
          colorPalette={user.isActive ? 'red' : 'green'}
          onClick={() => setConfirm(true)}>
          {user.isActive ? t.Deactivate : t.Reactivate}
        </Button>
      }>
      <HStack>
        <ActiveBadge active={user.isActive} t={t} />
        <Text textStyle="sm" color="fg.muted">
          {user.isActive ? t.DeactivateConfirmBody : t.ReactivateConfirmBody}
        </Text>
      </HStack>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={run}
        loading={saving}
        destructive={user.isActive}
        title={
          user.isActive ? t.DeactivateConfirmTitle : t.ReactivateConfirmTitle
        }
        body={user.isActive ? t.DeactivateConfirmBody : t.ReactivateConfirmBody}
        confirmLabel={user.isActive ? t.Deactivate : t.Reactivate}
      />
    </Section>
  )
}

const DEFAULT_PICK = '#3b82f6'

/** The colour picker that was there before, in Chakra's ColorPicker now. */
function ColorCard({
  user,
  t,
  tc,
  onSaved
}: CardProps & {tc: {save: string; cancel: string}}) {
  const [editing, setEditing] = useState(false)
  const [hex, setHex] = useState(user.driverColor ?? DEFAULT_PICK)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setHex(user.driverColor ?? DEFAULT_PICK)
  }, [user.driverColor])

  const save = async () => {
    setSaving(true)
    try {
      await setDriverColorMutation(user.id, hex)
      toaster.success({title: t.DriverColorSaved})
      setEditing(false)
      await onSaved()
    } catch (err) {
      toaster.error({
        title: t.DriverColorFailed,
        description: failureText(err)
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title={t.SectionDriverColor}
      hint={t.DriverColorHint}
      actions={
        !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t.DriverColorChange}
          </Button>
        )
      }>
      {!editing ? (
        <HStack gap="3">
          <DriverColorDot color={user.driverColor} size="6" />
          <Text fontFamily="mono" textStyle="sm">
            {user.driverColor ?? t.DriverColorNotSet}
          </Text>
        </HStack>
      ) : (
        <Stack gap="4" align="start">
          <ColorPicker.Root
            value={parseColor(hex)}
            format="rgba"
            onValueChange={e => setHex(e.value.toString('hex'))}
            maxW="xs">
            <ColorPicker.HiddenInput />
            <ColorPicker.Control>
              <ColorPicker.Input />
              <ColorPicker.Trigger />
            </ColorPicker.Control>
            <Portal>
              <ColorPicker.Positioner>
                <ColorPicker.Content>
                  <ColorPicker.Area />
                  <HStack>
                    <ColorPicker.EyeDropper size="xs" variant="outline" />
                    <ColorPicker.Sliders />
                  </HStack>
                </ColorPicker.Content>
              </ColorPicker.Positioner>
            </Portal>
          </ColorPicker.Root>
          <HStack>
            <Button
              size="sm"
              colorPalette="brand"
              onClick={() => void save()}
              loading={saving}>
              {tc.save}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}>
              {tc.cancel}
            </Button>
          </HStack>
        </Stack>
      )}
    </Section>
  )
}

/** payoutPercent, a percentage 0 to 100, never a fraction. Enforced here and in the resolver. */
function PayoutCard({user, t, save, onSaved}: CardProps & {save: string}) {
  const [value, setValue] = useState(String(user.payoutPercent ?? 0))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(String(user.payoutPercent ?? 0))
  }, [user.payoutPercent])

  const n = Number(value)
  const valid = Number.isFinite(n) && n >= 0 && n <= 100
  const dirty = valid && n !== (user.payoutPercent ?? 0)

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await setDriverPayoutPercentMutation(user.id, n)
      toaster.success({title: t.PayoutSaved})
      await onSaved()
    } catch (err) {
      toaster.error({
        title: t.PayoutFailed,
        description: failureText(err)
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title={t.SectionPayout} hint={t.PayoutHint}>
      <Field.Root invalid={!valid} maxW="xs">
        <Field.Label>{t.PayoutLabel}</Field.Label>
        <HStack>
          <NumberInput.Root
            value={value}
            onValueChange={e => setValue(e.value)}
            min={0}
            max={100}
            step={1}
            clampValueOnBlur
            w="32">
            <NumberInput.Control />
            <NumberInput.Input />
          </NumberInput.Root>
          <Text color="fg.muted">%</Text>
          <Button
            size="sm"
            colorPalette="brand"
            onClick={() => void submit()}
            loading={saving}
            disabled={!dirty}>
            {save}
          </Button>
        </HStack>
      </Field.Root>
    </Section>
  )
}

function StatsCard({
  userId,
  month,
  t
}: {
  userId: string
  month: string
  t: UsersStrings
}) {
  const {stats, isLoading, error, refetch} = useDriverMonthStats(userId, month)

  return (
    <Section title={t.SectionStatistics}>
      {error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : isLoading ? (
        // The four numbers wait as numbers, never as 0 (design-consistency.md, rule 3).
        <SimpleGrid columns={{base: 2, md: 4}} gap="4">
          {[t.StatCompleted, t.StatRevenue, t.StatCash, t.StatPayoutDue].map(
            label => (
              <Stat.Root key={label}>
                <Stat.Label>{label}</Stat.Label>
                <Stat.ValueText>
                  <NumberSkeleton chars={5} />
                </Stat.ValueText>
              </Stat.Root>
            )
          )}
        </SimpleGrid>
      ) : !stats ? (
        <Text textStyle="sm" color="fg.muted">
          {t.StatsNoRow}
        </Text>
      ) : (
        <SimpleGrid columns={{base: 2, md: 4}} gap="4">
          <Stat.Root>
            <Stat.Label>{t.StatCompleted}</Stat.Label>
            <Stat.ValueText>{stats.completed}</Stat.ValueText>
          </Stat.Root>
          <Stat.Root>
            <Stat.Label>{t.StatRevenue}</Stat.Label>
            <Stat.ValueText>
              <MoneyText value={stats.revenue} />
            </Stat.ValueText>
          </Stat.Root>
          <Stat.Root>
            <Stat.Label>{t.StatCash}</Stat.Label>
            <Stat.ValueText>
              <MoneyText value={stats.cash} />
            </Stat.ValueText>
          </Stat.Root>
          <Stat.Root>
            <Stat.Label>{t.StatPayoutDue}</Stat.Label>
            <Stat.ValueText colorPalette="brand" color="colorPalette.fg">
              <MoneyText value={stats.payoutDue} />
            </Stat.ValueText>
          </Stat.Root>
        </SimpleGrid>
      )}
    </Section>
  )
}

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The month's expenses and a one-line form to add one. */
function ExpensesCard({
  userId,
  month,
  t
}: {
  userId: string
  month: string
  t: UsersStrings
}) {
  const code = useI18nCode()
  const {expenses, isLoading, error, unsupported, refetch, added} =
    useDriverExpenses(userId, month)
  const [date, setDate] = useState(todayISO)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const n = Number(amount)
  const amountOk = Number.isFinite(n) && n > 0
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!amountOk || !dateOk || saving) return
    setSaving(true)
    try {
      const created = await addDriverExpenseMutation({
        userId,
        date,
        amount: n,
        note: note.trim()
      })
      toaster.success({title: t.ExpenseAdded})
      setAmount('')
      setNote('')
      setTouched(false)
      await added(created)
    } catch (err) {
      toaster.error({
        title: t.ExpenseFailed,
        description: failureText(err)
      })
    } finally {
      setSaving(false)
    }
  }

  const total = expenses.reduce((sum, x) => sum + x.amount, 0)

  return (
    <Section title={t.SectionExpenses} hint={t.ExpensesHint}>
      <Stack gap="5">
        <Box as="form" onSubmit={submit}>
          {/* The two narrow fields say their width, they do not only refuse
              to grow: Chakra's field recipe is `width: 100%`, so a
              `flex: 0 0 auto` field in a row was 100 per cent of the row and
              could not shrink either, and the date, the amount and the note
              stood three screens wide with the button off the page. Measured
              on the user detail at 1024 and 1440 on 2026-09-07, rule 9. */}
          <Flex
            gap="3"
            direction={{base: 'column', md: 'row'}}
            align={{md: 'end'}}>
            <Field.Root
              required
              invalid={touched && !dateOk}
              flex="0 0 auto"
              w={{md: 'auto'}}>
              <Field.Label>{t.ExpenseDate}</Field.Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </Field.Root>
            <Field.Root
              required
              invalid={touched && !amountOk}
              flex="0 0 auto"
              w={{md: 'auto'}}>
              <Field.Label>{t.ExpenseAmount}</Field.Label>
              <NumberInput.Root
                value={amount}
                onValueChange={e => setAmount(e.value)}
                min={0}
                step={0.5}
                w={{md: '36'}}>
                <NumberInput.Control />
                <NumberInput.Input placeholder="0.00" />
              </NumberInput.Root>
              <Field.ErrorText>{t.ValidationAmount}</Field.ErrorText>
            </Field.Root>
            <Field.Root flex="1">
              <Field.Label>{t.ExpenseNote}</Field.Label>
              <Input value={note} onChange={e => setNote(e.target.value)} />
            </Field.Root>
            <Button
              type="submit"
              colorPalette="brand"
              loading={saving}
              flexShrink={0}>
              {t.ExpenseAdd}
            </Button>
          </Flex>
        </Box>

        {unsupported && (
          <Text textStyle="sm" color="fg.muted">
            {t.ExpensesListUnavailable}
          </Text>
        )}

        {error ? (
          <ErrorBanner message={error} onRetry={refetch} />
        ) : isLoading ? (
          <TableSkeleton
            columns={[
              {id: 'date', label: t.ExpenseDate, width: 120},
              {id: 'note', label: t.ExpenseNote, width: 240},
              {id: 'amount', label: t.ExpenseAmount, width: 120, align: 'end'}
            ]}
            rows={3}
            dayHeader={false}
            actionsWidth={0}
          />
        ) : expenses.length === 0 ? (
          <Text textStyle="sm" color="fg.muted">
            {t.ExpensesEmpty}
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>{t.ExpenseDate}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t.ExpenseNote}</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">
                    {t.ExpenseAmount}
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {expenses.map(x => (
                  <Table.Row key={x.id}>
                    <Table.Cell {...selectable} whiteSpace="nowrap">
                      {formatDate(x.date, code)}
                    </Table.Cell>
                    {/* A driver's own words about the expense: data, and a
                        long one breaks inside its column (rules 9 and 11). */}
                    <Table.Cell {...selectable} overflowWrap="anywhere">
                      {x.note || '-'}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <MoneyText value={x.amount} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
              <Table.Footer>
                <Table.Row>
                  <Table.Cell colSpan={2} fontWeight="medium">
                    <Badge variant="subtle" size="sm">
                      {expenses.length}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell textAlign="end" fontWeight="semibold">
                    <MoneyText value={total} />
                  </Table.Cell>
                </Table.Row>
              </Table.Footer>
            </Table.Root>
          </Box>
        )}
      </Stack>
    </Section>
  )
}
