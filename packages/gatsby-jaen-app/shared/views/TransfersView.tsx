/**
 * The transfers screen, in Chakra v3.
 *
 * For an admin it is the dispatcher's board: a table on a desktop, cards on a
 * phone, the twelve states as a filter, a date window, search, sort, columns
 * that can be hidden and reordered, the driver's colour as the left edge of a
 * row, and the three dialogs of dispatch (create, assign, price) plus the
 * state dialog. For a driver the same route is "My rides": the rows the
 * backend scoped to them, without prices, each leading to the phone screen in
 * TransferDetailView. A customer landing here gets their own bookings the same
 * way.
 *
 * Nothing here decides what the caller may see. The list is scoped in the
 * resolver from the token and a driver's rows arrive with the money fields
 * null (okf/architecture/permissions.md). useCaller() only decides which
 * screen to draw and which buttons to offer.
 *
 * The screen layout is carried over from the Chakra port of the dispatch
 * prototype (limosen-dashboard-chakra, 2026-09-04): the date chips, the status
 * and column popovers, the date-grouped rows with the driver stripe, the card
 * with the expanding body. That port pins a shadcn theme of its own and
 * hand-rolls its controls to match the prototype pixel for pixel. Here the
 * system in scope is jaen's, so the same screens are drawn with the stock
 * Chakra parts (Table, Popover, Menu, Dialog, Drawer, Checkbox, Switch,
 * SegmentGroup) and jaen's semantic tokens.
 *
 * The table and the cards are DataTable's (shared/components/table), the
 * board hands it the columns, the day grouping, the stripes and its card.
 * The dialogs are exported: TransferDetailView opens the same ones.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Drawer,
  Field,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Menu,
  NativeSelect,
  NumberInput,
  Popover,
  Portal,
  SegmentGroup,
  Separator,
  Skeleton,
  Stack,
  Switch,
  Text,
  Textarea,
  chakra
} from '@chakra-ui/react'
import {FaSearch} from '@react-icons/all-files/fa/FaSearch'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaFilter} from '@react-icons/all-files/fa/FaFilter'
import {FaSortAmountDown} from '@react-icons/all-files/fa/FaSortAmountDown'
import {FaSortAmountUp} from '@react-icons/all-files/fa/FaSortAmountUp'
import {FaChevronDown} from '@react-icons/all-files/fa/FaChevronDown'
import {FaChevronUp} from '@react-icons/all-files/fa/FaChevronUp'
import {FaUsers} from '@react-icons/all-files/fa/FaUsers'
import {FaSuitcase} from '@react-icons/all-files/fa/FaSuitcase'
import {FaPlane} from '@react-icons/all-files/fa/FaPlane'
import {FaMapMarkerAlt} from '@react-icons/all-files/fa/FaMapMarkerAlt'
import {FaCalendarAlt} from '@react-icons/all-files/fa/FaCalendarAlt'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaTimes} from '@react-icons/all-files/fa/FaTimes'
import type {BadgeProps} from '@chakra-ui/react'
import {useCaller} from '../auth'
import {useI18nCode, type I18nCode} from '../i18n'
import {useAppNavigate} from '../navigation'
import {
  useCars,
  useDrivers,
  useUsers,
  type ResourceCar,
  type ResourceUser
} from '../hooks'
import {
  assignCar,
  assignDriver,
  createTransfer,
  fetchTransfer,
  isClosed,
  setPrice,
  updateTransferState,
  passengerName,
  transferPath,
  useTransferList,
  CAR_CLASSES,
  EXTRA_TYPES,
  PAYING_PARTIES,
  PAYMENT_METHODS,
  TRANSFER_CATEGORIES,
  type CarClass,
  type CreateTransferInput,
  type ExtraType,
  type PayingParty,
  type PaymentMethod,
  type TransferCategory,
  type TransferRow,
  type AssignmentAttempt
} from '../hooks/transfers'
import {
  AmountInput,
  CarImage,
  DriverColorDot,
  EmptyState,
  DialogActions,
  ErrorBanner,
  MoneyText,
  StatusBadge,
  toaster,
  useStateLabel,
  PageHeader,
  formatAmount,
  parseAmount
} from '../components'
import {RefreshButton} from '../components/RefreshButton'
import {useViewRefresh} from '../hooks/view-refresh'
import {OfflineBanner} from '../components/OfflineBanner'
import {CustomerStatusBadge} from '../components/CustomerStatusBadge'
import {
  DataTable,
  useIsMobile,
  type DataColumn,
  type DataGroup,
  type DayTone
} from '../components/table'
import {ListSkeleton, TableSkeleton} from '../components/skeletons'
import {useRefetchOnReconnect} from '../offline'
import {getI18nCommon} from '../locales/i18nCommon'
import {
  fill,
  getI18nTransfers,
  type TransfersStrings
} from '../locales/i18nTransfers'

// TransferDetailView reads the breakpoint from here since before the table module existed.
export {useIsMobile}
import {
  asTransferState,
  TRANSFER_STATES,
  type TransferState
} from '../locales/i18nStates'

// ============================================================
// Small shared helpers
// ============================================================

/**
 * The account's catalogues, for every component on this screen. Memoised on
 * the code, so the column definitions built from them keep their identity
 * between renders.
 */
export function useTransferStrings() {
  const code = useI18nCode()
  const t = useMemo(() => getI18nTransfers(code).strings, [code])
  const tc = useMemo(() => getI18nCommon(code).strings, [code])
  return {code, t, tc}
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Local YYYY-MM-DD of a Date. */
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** "Fr., 4. Sep. 2026" in the account's language. */
export const formatDay = (iso: string, code: I18nCode): string => {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(code, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(`${iso}T00:00:00`))
  } catch {
    return iso
  }
}

/** A full timestamp in the account's language, for requestedAt and the ride's actuals. */
export const formatDateTime = (
  iso: string | undefined,
  code: I18nCode
): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(code, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

type EnumPrefix = 'Pay_' | 'Party_' | 'Class_' | 'Cat_' | 'Type_' | 'Extra_'

/** The catalogue word for an enum member, the raw member when the catalogue has none. */
export const enumLabel = (
  t: TransfersStrings,
  prefix: EnumPrefix,
  value: string | null | undefined
): string => {
  if (!value) return ''
  const key = `${prefix}${value}` as keyof TransfersStrings
  return (t[key] as string | undefined) ?? value.replace(/_/g, ' ')
}

export const driverDisplayName = (u: ResourceUser): string => {
  const full =
    `${u.details?.firstName ?? ''} ${u.details?.lastName ?? ''}`.trim()
  return full || u.username || u.primaryEmailAddress
}

export const carDisplayName = (c: ResourceCar): string =>
  c.carName || c.licensePlate

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback

// ============================================================
// A dialog that is a bottom drawer on a phone
// ============================================================

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Blocks closing while a mutation is out. */
  busy?: boolean
}

/**
 * The same content as a centred Dialog on a desktop and a bottom Drawer on a
 * phone, which is what every popover of the dispatch prototype became below
 * `md`. One component so the two never drift.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  busy = false
}: SheetProps) {
  const mobile = useIsMobile()
  const onOpenChange = (e: {open: boolean}) => {
    if (!e.open && !busy) onClose()
  }

  if (mobile) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={onOpenChange}
        placement="bottom"
        lazyMount
        unmountOnExit>
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content roundedTop="surface" maxH="92dvh">
              <Drawer.Header>
                <Drawer.Title>{title}</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>{children}</Drawer.Body>
              {footer && (
                <Drawer.Footer pb="calc(1rem + env(safe-area-inset-bottom, 0px))">
                  {footer}
                </Drawer.Footer>
              )}
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" disabled={busy} />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    )
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      placement="center"
      scrollBehavior="inside"
      lazyMount
      unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            {footer && <Dialog.Footer>{footer}</Dialog.Footer>}
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={busy} />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

// ============================================================
// The pickers
// ============================================================

interface PickerListProps<T> {
  items: T[]
  selectedId?: string
  currentId?: string
  onSelect: (id: string) => void
  keyOf: (item: T) => string
  renderItem: (item: T) => React.ReactNode
  emptyLabel: string
}

/** A list of choices, one highlighted, one marked as the current one. */
function PickerList<T>({
  items,
  selectedId,
  currentId,
  onSelect,
  keyOf,
  renderItem,
  emptyLabel
}: PickerListProps<T>) {
  const {t} = useTransferStrings()
  if (items.length === 0) {
    return (
      <Text textStyle="sm" color="fg.muted" textAlign="center" py="4">
        {emptyLabel}
      </Text>
    )
  }
  return (
    <Stack gap="1" role="listbox">
      {items.map(item => {
        const id = keyOf(item)
        const selected = id === selectedId
        return (
          <chakra.button
            key={id}
            type="button"
            role="option"
            aria-selected={selected}
            textAlign="start"
            w="full"
            px="3"
            py="2"
            rounded="control"
            borderWidth="1px"
            borderColor={selected ? 'colorPalette.solid' : 'border.default'}
            bg={selected ? 'colorPalette.subtle' : 'bg.surface'}
            colorPalette="brand"
            cursor="pointer"
            _hover={{bg: selected ? 'colorPalette.subtle' : 'bg.subtle'}}
            onClick={() => onSelect(id)}>
            <HStack justify="space-between" gap="2">
              <Box minW="0" flex="1">
                {renderItem(item)}
              </Box>
              {currentId === id && (
                <Badge size="sm" variant="outline" colorPalette="gray">
                  {t.Current}
                </Badge>
              )}
            </HStack>
          </chakra.button>
        )
      })}
    </Stack>
  )
}

export interface AssignDialogProps {
  open: boolean
  onClose: () => void
  transfer: TransferRow | null
  drivers: ResourceUser[]
  cars: ResourceCar[]
  /** Called with the new row after both writes. */
  onAssigned: (row: TransferRow) => void
}

/**
 * Driver and car in one dialog. The driver is written first, because
 * assignDriver gives a carless transfer the driver's latest car, then the
 * car when one was chosen explicitly. "Push the driver" is on by default and
 * passed through to the hook, see AssignDriverOptions there. The SMS switch
 * is the checkbox of the old picker, kept visible and disabled: nothing sends
 * an SMS on either side (okf/architecture/notifications.md).
 */
export function AssignDialog({
  open,
  onClose,
  transfer,
  drivers,
  cars,
  onAssigned
}: AssignDialogProps) {
  const {t, code} = useTransferStrings()
  const [driverId, setDriverId] = useState<string | undefined>(undefined)
  const [carId, setCarId] = useState<string>('')
  const [driverSearch, setDriverSearch] = useState('')
  const [carSearch, setCarSearch] = useState('')
  const [push, setPush] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The ride's request history, for the marks on the rows. A row from the
  // board carries none, so the ride is read once when the dialog opens;
  // the detail page's row already has it.
  const [attempts, setAttempts] = useState<AssignmentAttempt[]>([])

  useEffect(() => {
    if (open) {
      // The open request is the preselected row, that is transfer.driverId
      // while REQUESTED; a declined ride carries no driver and starts empty.
      setDriverId(transfer?.driverId)
      setCarId(transfer?.carId ?? '')
      setDriverSearch('')
      setCarSearch('')
      setPush(true)
      setError(null)
      setAttempts(transfer?.attempts ?? [])
      if (transfer && !transfer.attempts) {
        let live = true
        fetchTransfer(transfer.id)
          .then(row => {
            if (live && row?.attempts) setAttempts(row.attempts)
          })
          .catch(() => {
            // The marks are a courtesy: without them every row is unmarked,
            // which is what a schema without attempts shows anyway.
          })
        return () => {
          live = false
        }
      }
    }
    return undefined
  }, [
    open,
    transfer?.id,
    transfer?.driverId,
    transfer?.carId,
    transfer?.attempts,
    transfer
  ])

  // The newest request per driver: the list arrives newest first.
  const history = useMemo(() => {
    const byDriver = new Map<string, AssignmentAttempt>()
    for (const a of attempts)
      if (!byDriver.has(a.driverId)) byDriver.set(a.driverId, a)
    return byDriver
  }, [attempts])

  // The car assigned to each driver from the fleet the dialog already has,
  // Car.driverId. The first one when a driver has several.
  const carByDriver = useMemo(() => {
    const byDriver = new Map<string, ResourceCar>()
    for (const c of cars)
      if (c.driverId && !byDriver.has(c.driverId)) byDriver.set(c.driverId, c)
    return byDriver
  }, [cars])

  /** What a driver's row says about their history with this ride, or nothing. */
  const markOf = (
    d: ResourceUser
  ): {text: string; tone: 'orange' | 'red' | 'gray'} | undefined => {
    const a = history.get(d.id)
    if (!a) return undefined
    const time = formatDateTime(a.answeredAt ?? a.requestedAt, code)
    if (!a.answer)
      return {
        text: fill(t.PickerRequestedNoAnswer, {
          time: formatDateTime(a.requestedAt, code)
        }),
        tone: 'orange'
      }
    if (a.answer === 'DECLINED') {
      const base = fill(t.PickerDeclined, {time})
      return {text: a.reason ? `${base} · ${a.reason}` : base, tone: 'red'}
    }
    if (a.answer === 'WITHDRAWN')
      return {text: fill(t.PickerAskedBefore, {time}), tone: 'gray'}
    return undefined
  }

  const chooseDriver = (id: string) => {
    setDriverId(id)
    // Choosing a driver preselects their car below; a driver without one
    // leaves the automatic choice.
    setCarId(carByDriver.get(id)?.id ?? '')
  }

  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase()
    if (!q) return drivers
    return drivers.filter(d => {
      const car = carByDriver.get(d.id)
      return (
        driverDisplayName(d).toLowerCase().includes(q) ||
        (car
          ? `${car.licensePlate} ${carDisplayName(car)}`
              .toLowerCase()
              .includes(q)
          : false)
      )
    })
  }, [drivers, driverSearch, carByDriver])

  const filteredCars = useMemo(() => {
    const q = carSearch.trim().toLowerCase()
    const list = q
      ? cars.filter(
          c =>
            carDisplayName(c).toLowerCase().includes(q) ||
            c.licensePlate.toLowerCase().includes(q)
        )
      : cars
    // The chosen driver's own cars first, that is the usual answer.
    return [...list].sort(
      (a, b) =>
        Number(b.driverId === driverId) - Number(a.driverId === driverId)
    )
  }, [cars, carSearch, driverId])

  const submit = async () => {
    if (!transfer || !driverId) return
    setBusy(true)
    setError(null)
    try {
      let row = transfer
      if (driverId !== transfer.driverId) {
        row = await assignDriver(transfer.id, driverId, {notifyDriver: push})
      }
      if (carId && carId !== row.carId) {
        row = await assignCar(transfer.id, carId)
      }
      toaster.success({title: t.ToastDriverAssigned})
      onAssigned(row)
      onClose()
    } catch (err) {
      setError(errorMessage(err, t.ToastFailed))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.AssignTitle}
      size="lg"
      busy={busy}
      footer={
        <DialogActions
          onCancel={onClose}
          confirmLabel={t.AssignSubmit}
          onConfirm={submit}
          loading={busy}
          confirmDisabled={!driverId}
        />
      }>
      <Stack gap="5">
        {error && <ErrorBanner message={error} />}
        <Stack gap="2">
          <Text fontWeight="medium" textStyle="sm">
            {t.AssignDriverLabel}
          </Text>
          <InputGroup startElement={<FaSearch />}>
            <Input
              size="sm"
              placeholder={t.SearchDrivers}
              value={driverSearch}
              onChange={e => setDriverSearch(e.target.value)}
            />
          </InputGroup>
          <Box maxH="40vh" overflowY="auto" pe="1">
            <PickerList
              items={filteredDrivers}
              selectedId={driverId}
              currentId={transfer?.driverId}
              onSelect={chooseDriver}
              keyOf={d => d.id}
              emptyLabel={t.NoDriversFound}
              renderItem={d => {
                // The second line is the driver's car, never the login name:
                // a plate tells a dispatcher something, an address does not.
                const car = carByDriver.get(d.id)
                const mark = markOf(d)
                return (
                  <HStack gap="2" minW="0">
                    <DriverColorDot color={d.driverColor} />
                    {/* The car's picture beside the plate, dispatch.md
                        section 9 with media.md: a dispatcher recognises the
                        car faster than the plate. A car without a picture
                        shows the silhouette of its class. */}
                    {car && (
                      <CarImage car={car} size={36} alt={car.licensePlate} />
                    )}
                    <Box minW="0" flex="1">
                      <Text textStyle="sm" fontWeight="medium" truncate>
                        {driverDisplayName(d)}
                      </Text>
                      <Text textStyle="xs" color="fg.muted" truncate>
                        {car
                          ? `${car.licensePlate} · ${carDisplayName(car)}`
                          : t.NoCar}
                      </Text>
                      {mark && (
                        <Badge
                          size="sm"
                          variant="subtle"
                          colorPalette={mark.tone}
                          mt="1"
                          maxW="full"
                          whiteSpace="normal"
                          textAlign="start">
                          {mark.text}
                        </Badge>
                      )}
                    </Box>
                  </HStack>
                )
              }}
            />
          </Box>
        </Stack>

        <Stack gap="2">
          <Text fontWeight="medium" textStyle="sm">
            {t.AssignCarLabel}
          </Text>
          <InputGroup startElement={<FaSearch />}>
            <Input
              size="sm"
              placeholder={t.SearchVehicles}
              value={carSearch}
              onChange={e => setCarSearch(e.target.value)}
            />
          </InputGroup>
          <Box maxH="30vh" overflowY="auto" pe="1">
            <Stack gap="1">
              <chakra.button
                type="button"
                textAlign="start"
                w="full"
                px="3"
                py="2"
                rounded="control"
                borderWidth="1px"
                colorPalette="brand"
                borderColor={
                  carId === '' ? 'colorPalette.solid' : 'border.default'
                }
                bg={carId === '' ? 'colorPalette.subtle' : 'bg.surface'}
                cursor="pointer"
                onClick={() => setCarId('')}>
                <Text textStyle="sm" color="fg.muted">
                  {t.AssignCarKeep}
                </Text>
              </chakra.button>
              <PickerList
                items={filteredCars}
                selectedId={carId}
                currentId={transfer?.carId}
                onSelect={setCarId}
                keyOf={c => c.id}
                emptyLabel={t.NoVehiclesFound}
                renderItem={c => (
                  <HStack gap="2" minW="0">
                    <DriverColorDot color={c.color} />
                    <CarImage car={c} size={36} alt={c.licensePlate} />
                    <Box minW="0">
                      <Text textStyle="sm" fontWeight="medium" truncate>
                        {carDisplayName(c)}
                      </Text>
                      <Text textStyle="xs" color="fg.muted" truncate>
                        {c.licensePlate}
                        {c.carClass
                          ? ` · ${enumLabel(t, 'Class_', c.carClass)}`
                          : ''}
                      </Text>
                    </Box>
                  </HStack>
                )}
              />
            </Stack>
          </Box>
        </Stack>

        <Separator />

        <Stack gap="3">
          <Switch.Root
            checked={push}
            onCheckedChange={e => setPush(e.checked)}
            colorPalette="brand">
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>
              <Text textStyle="sm">{t.PushDriver}</Text>
              <Text textStyle="xs" color="fg.muted">
                {t.PushDriverHint}
              </Text>
            </Switch.Label>
          </Switch.Root>
          <Switch.Root checked={false} disabled colorPalette="gray">
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label>
              <HStack gap="2">
                <Text textStyle="sm">{t.SmsDriver}</Text>
                <Badge size="sm" variant="outline" colorPalette="gray">
                  {t.SmsComing}
                </Badge>
              </HStack>
            </Switch.Label>
          </Switch.Root>
        </Stack>
      </Stack>
    </Sheet>
  )
}

export interface PriceDialogProps {
  open: boolean
  onClose: () => void
  transfer: TransferRow | null
  onSaved: (row: TransferRow) => void
}

export function PriceDialog({
  open,
  onClose,
  transfer,
  onSaved
}: PriceDialogProps) {
  const {t} = useTransferStrings()
  const code = useI18nCode()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      // The stored price is shown the way the field shows any amount at rest,
      // `12,50 €`, and a focus turns it back into the bare number.
      setValue(
        transfer?.price != null ? formatAmount(code, transfer.price) : ''
      )
      setError(null)
    }
  }, [open, transfer?.id, transfer?.price, code])

  const submit = async () => {
    if (!transfer) return
    // parseAmount reads `12,5`, `12.5` and `12,50 €` alike and rounds to two
    // decimals, so the backend gets 12.5 for all three.
    const n = parseAmount(value)
    if (n === null || n < 0) {
      setError(t.PriceInvalid)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const row = await setPrice(transfer.id, n)
      toaster.success({title: t.ToastPriceSet})
      onSaved(row)
      onClose()
    } catch (err) {
      setError(errorMessage(err, t.ToastFailed))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.PriceTitle}
      size="sm"
      busy={busy}
      footer={
        <DialogActions
          onCancel={onClose}
          confirmLabel={t.PriceSubmit}
          onConfirm={submit}
          loading={busy}
        />
      }>
      <Stack gap="3">
        {error && <ErrorBanner message={error} />}
        <Field.Root invalid={!!error}>
          <Field.Label>{t.PriceLabel}</Field.Label>
          <AmountInput
            autoFocus
            data-testid="price-input"
            placeholder={t.PricePlaceholder}
            value={value}
            onChange={setValue}
            onKeyDown={e => {
              if (e.key === 'Enter') void submit()
            }}
          />
        </Field.Root>
      </Stack>
    </Sheet>
  )
}

export interface StateDialogProps {
  open: boolean
  onClose: () => void
  transfer: TransferRow | null
  onSaved: (row: TransferRow) => void
}

/** The dispatcher's state modal: the real twelve, any of them. */
export function StateDialog({
  open,
  onClose,
  transfer,
  onSaved
}: StateDialogProps) {
  const {t} = useTransferStrings()
  const label = useStateLabel()
  const current = asTransferState(transfer?.state)
  const [value, setValue] = useState<TransferState | undefined>(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(asTransferState(transfer?.state))
      setError(null)
    }
  }, [open, transfer?.id, transfer?.state])

  const submit = async () => {
    if (!transfer || !value) return
    setBusy(true)
    setError(null)
    try {
      const row = await updateTransferState(transfer.id, value)
      toaster.success({title: t.ToastStateUpdated})
      onSaved(row)
      onClose()
    } catch (err) {
      setError(errorMessage(err, t.ToastFailed))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.StateTitle}
      size="sm"
      busy={busy}
      footer={
        <DialogActions
          onCancel={onClose}
          confirmLabel={t.StateSubmit}
          onConfirm={submit}
          loading={busy}
          confirmDisabled={!value || value === current}
        />
      }>
      <Stack gap="3">
        {error && <ErrorBanner message={error} />}
        <Text textStyle="xs" color="fg.muted">
          {t.StateHint}
        </Text>
        <Stack gap="1" role="radiogroup" aria-label={t.StateLabel}>
          {TRANSFER_STATES.map(s => {
            const selected = s === value
            return (
              <chakra.button
                key={s}
                type="button"
                role="radio"
                aria-checked={selected}
                textAlign="start"
                w="full"
                px="3"
                py="2"
                rounded="control"
                borderWidth="1px"
                colorPalette="brand"
                borderColor={selected ? 'colorPalette.solid' : 'border.default'}
                bg={selected ? 'colorPalette.subtle' : 'bg.surface'}
                cursor="pointer"
                _hover={{bg: selected ? 'colorPalette.subtle' : 'bg.subtle'}}
                onClick={() => setValue(s)}>
                <HStack justify="space-between">
                  <HStack gap="3">
                    <StatusBadge state={s} />
                    <Text textStyle="sm">{label(s)}</Text>
                  </HStack>
                  {s === current && (
                    <Badge size="sm" variant="outline" colorPalette="gray">
                      {t.StateCurrent}
                    </Badge>
                  )}
                </HStack>
              </chakra.button>
            )
          })}
        </Stack>
      </Stack>
    </Sheet>
  )
}

// ============================================================
// Create transfer
// ============================================================

export interface CreateTransferDialogProps {
  open: boolean
  onClose: () => void
  customers: ResourceUser[]
  cars: ResourceCar[]
  onCreated: (row: TransferRow) => void
  /**
   * What the form opens with. The detail page's "Rückfahrt anlegen" hands in
   * the origin's addresses swapped, its customer, passengers and extras, and
   * the origin's id as referenceId, see returnTripPrefill.
   */
  prefill?: Partial<CreateForm>
}

export interface CreateForm {
  /**
   * The origin's id when this ride is a return trip, otherwise empty. Not a
   * field on the form: the pylon mints the code from it, `-2` under the
   * origin's stem, and the dialog only says which ride it returns from.
   */
  referenceId: string
  /** The origin's code, for the title. */
  originCode: string
  customerId: string
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  pickupTime: string
  subject: string
  firstName: string
  lastName: string
  phone: string
  email: string
  language: string
  flightNumber: string
  luggage: string
  childSeats: string
  extraTime: string
  preferredCarClass: CarClass | ''
  preferredCarName: string
  transferCategory: TransferCategory
  price: string
  paymentMethode: PaymentMethod | ''
  payingParty: PayingParty | ''
  carId: string
  message: string
  extras: Record<string, number>
}

const emptyForm = (): CreateForm => ({
  referenceId: '',
  originCode: '',
  customerId: '',
  pickupLocation: '',
  dropoffLocation: '',
  pickupDate: localDay(new Date()),
  pickupTime: '',
  subject: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  language: '',
  flightNumber: '',
  luggage: '',
  childSeats: '',
  extraTime: '',
  preferredCarClass: '',
  preferredCarName: '',
  transferCategory: 'DISTANCE',
  price: '',
  paymentMethode: '',
  payingParty: 'CUSTOMER',
  carId: '',
  message: '',
  extras: {}
})

const clean = (s: string): string | undefined =>
  s.trim() ? s.trim() : undefined

/**
 * The return trip of a ride, as the brief has the dialog open it: addresses
 * swapped, the customer, the first passenger, the extras, the wishes and the
 * money settings copied, the origin as referenceId, and no date or time, so
 * the office has to say when. Flight and luggage are not copied, the way
 * back is a different flight and usually the same bags, which the office
 * types when it knows.
 */
export const returnTripPrefill = (origin: TransferRow): Partial<CreateForm> => {
  const p = origin.passengers[0]
  const extras: Record<string, number> = {}
  origin.extras.forEach(x => {
    extras[x.type] = x.amount
  })
  const category = TRANSFER_CATEGORIES.find(c => c === origin.transferCategory)
  const payment = PAYMENT_METHODS.find(m => m === origin.paymentMethode)
  const party = PAYING_PARTIES.find(m => m === origin.payingParty)
  return {
    referenceId: origin.id,
    originCode: origin.code,
    customerId: origin.customerId,
    pickupLocation: origin.dropoff,
    dropoffLocation: origin.pickup,
    pickupDate: '',
    pickupTime: '',
    subject: origin.subject ?? '',
    firstName: p?.firstName ?? '',
    lastName: p?.lastName ?? '',
    phone: p?.phone ?? '',
    email: p?.email ?? '',
    language: p?.language ?? '',
    childSeats: origin.details?.childSeats ?? '',
    preferredCarClass:
      CAR_CLASSES.find(c => c === origin.details?.preferredCarClass) ?? '',
    preferredCarName: origin.details?.preferredCarName ?? '',
    transferCategory: category ?? 'DISTANCE',
    paymentMethode: payment ?? '',
    payingParty: party ?? 'CUSTOMER',
    message: origin.details?.message ?? '',
    extras
  }
}

function FormSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Stack gap="3">
      <Text
        textStyle="xs"
        fontWeight="semibold"
        color="fg.muted"
        textTransform="uppercase"
        letterSpacing="wider">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

/**
 * The full createTransfer input, every field the resolver takes: the route
 * and time, one passenger, flight, luggage, child seats, extra time, the car
 * class and a preferred car, the category, price, payment method and paying
 * party as selects over the enum, extras from the catalogue with a quantity,
 * and the wishes. The type is not asked: a ride is a return trip because it
 * references its origin, and the pylon derives ONE_WAY or RETURN_TRIP from
 * that (okf/architecture/transfer-codes.md). Enums are native selects so the
 * dialog works inside a drawer on a phone without a portal fight.
 */
export function CreateTransferDialog({
  open,
  onClose,
  customers,
  cars,
  onCreated,
  prefill
}: CreateTransferDialogProps) {
  const {t} = useTransferStrings()
  const [form, setForm] = useState<CreateForm>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({...emptyForm(), ...prefill})
      setError(null)
      setTouched(false)
    }
    // The prefill is read when the dialog opens, a new one arrives with a new open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) =>
    setForm(f => ({...f, [key]: value}))

  const missing = {
    customerId: !form.customerId,
    pickupLocation: !form.pickupLocation.trim(),
    dropoffLocation: !form.dropoffLocation.trim(),
    pickupDateTime: !form.pickupDate || !form.pickupTime
  }
  const invalid = Object.values(missing).some(Boolean)

  const submit = async () => {
    setTouched(true)
    if (invalid) return
    const when = new Date(`${form.pickupDate}T${form.pickupTime}`)
    if (Number.isNaN(when.getTime())) {
      setError(t.DateInvalid)
      return
    }
    // The same reading as PriceDialog: `12,5`, `12.5` and `12,50 €` all become
    // 12.5, an empty field means no price yet.
    const priceNumber = form.price.trim()
      ? (parseAmount(form.price) ?? NaN)
      : undefined
    if (
      priceNumber !== undefined &&
      (!Number.isFinite(priceNumber) || priceNumber < 0)
    ) {
      setError(t.PriceInvalid)
      return
    }

    const passenger = {
      firstName: clean(form.firstName),
      lastName: clean(form.lastName),
      phone: clean(form.phone),
      email: clean(form.email),
      language: clean(form.language)
    }
    const hasPassenger = Object.values(passenger).some(Boolean)

    const extras = Object.entries(form.extras)
      .filter(([, amount]) => amount > 0)
      .map(([type, amount]) => ({type: type as ExtraType, amount}))

    const input: CreateTransferInput = {
      customerId: form.customerId,
      pickupLocation: form.pickupLocation.trim(),
      dropoffLocation: form.dropoffLocation.trim(),
      pickupDateTime: when.toISOString(),
      subject: clean(form.subject),
      price: priceNumber,
      paymentMethode: form.paymentMethode || undefined,
      payingParty: form.payingParty || undefined,
      carId: form.carId || undefined,
      referenceId: form.referenceId || undefined,
      passengers: hasPassenger ? [passenger] : undefined,
      extras: extras.length ? extras : undefined,
      details: {
        flightNumber: clean(form.flightNumber),
        message: clean(form.message),
        luggage: clean(form.luggage),
        childSeats: clean(form.childSeats),
        extraTime: clean(form.extraTime),
        preferredCarClass: form.preferredCarClass || undefined,
        preferredCarName: clean(form.preferredCarName),
        transferCategory: form.transferCategory,
        // Derived, never chosen: the pylon writes the same and a build from
        // before the derivation would otherwise store ONE_WAY for a return.
        transferType: form.referenceId ? 'RETURN_TRIP' : 'ONE_WAY'
      }
    }

    setBusy(true)
    setError(null)
    try {
      const row = await createTransfer(input)
      toaster.success({title: t.TransferCreated})
      onCreated(row)
      onClose()
    } catch (err) {
      setError(errorMessage(err, t.TransferCreateFailed))
    } finally {
      setBusy(false)
    }
  }

  const customerLabel = (u: ResourceUser) => {
    const name = driverDisplayName(u)
    return name === u.primaryEmailAddress
      ? name
      : `${name} (${u.primaryEmailAddress})`
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        form.referenceId
          ? fill(t.CreateReturnTitle, {code: form.originCode})
          : t.CreateTitle
      }
      size="xl"
      busy={busy}
      footer={
        <DialogActions
          onCancel={onClose}
          confirmLabel={t.CreateSubmit}
          onConfirm={submit}
          loading={busy}
          loadingText={t.CreateSubmitting}
        />
      }>
      <Stack gap="6">
        {error && <ErrorBanner message={error} />}

        {form.referenceId && (
          <Box
            rounded="control"
            borderWidth="1px"
            borderColor="border.default"
            bg="bg.subtle"
            px="3"
            py="2">
            <Text textStyle="sm" fontWeight="medium">
              {t.LabelReturnOf}{' '}
              <chakra.span fontFamily="mono">{form.originCode}</chakra.span>
            </Text>
            <Text textStyle="xs" color="fg.muted">
              {t.ReturnPrefillHint}
            </Text>
          </Box>
        )}

        <FormSection title={t.SecRoute}>
          <Field.Root required invalid={touched && missing.customerId}>
            <Field.Label>
              {t.LabelCustomer} <Field.RequiredIndicator />
            </Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={form.customerId}
                onChange={e => set('customerId', e.target.value)}
                placeholder={t.PlaceholderCustomer}>
                {customers.map(u => (
                  <option key={u.id} value={u.id}>
                    {customerLabel(u)}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.ErrorText>{t.RequiredHint}</Field.ErrorText>
          </Field.Root>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root required invalid={touched && missing.pickupLocation}>
              <Field.Label>
                {t.LabelPickup} <Field.RequiredIndicator />
              </Field.Label>
              <Input
                size="sm"
                placeholder={t.PlaceholderPickup}
                value={form.pickupLocation}
                onChange={e => set('pickupLocation', e.target.value)}
              />
              <Field.ErrorText>{t.RequiredHint}</Field.ErrorText>
            </Field.Root>
            <Field.Root required invalid={touched && missing.dropoffLocation}>
              <Field.Label>
                {t.LabelDropoff} <Field.RequiredIndicator />
              </Field.Label>
              <Input
                size="sm"
                placeholder={t.PlaceholderDropoff}
                value={form.dropoffLocation}
                onChange={e => set('dropoffLocation', e.target.value)}
              />
              <Field.ErrorText>{t.RequiredHint}</Field.ErrorText>
            </Field.Root>
          </Stack>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root required invalid={touched && missing.pickupDateTime}>
              <Field.Label>
                {t.LabelDateTime} <Field.RequiredIndicator />
              </Field.Label>
              <HStack gap="2">
                <Input
                  size="sm"
                  type="date"
                  value={form.pickupDate}
                  onChange={e => set('pickupDate', e.target.value)}
                />
                <Input
                  size="sm"
                  type="time"
                  value={form.pickupTime}
                  onChange={e => set('pickupTime', e.target.value)}
                />
              </HStack>
              <Field.ErrorText>{t.DateInvalid}</Field.ErrorText>
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelSubject}</Field.Label>
              <Input
                size="sm"
                placeholder={t.PlaceholderSubject}
                value={form.subject}
                onChange={e => set('subject', e.target.value)}
              />
            </Field.Root>
          </Stack>
        </FormSection>

        <FormSection title={t.SecPassenger}>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root>
              <Field.Label>{t.LabelFirstName}</Field.Label>
              <Input
                size="sm"
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelLastName}</Field.Label>
              <Input
                size="sm"
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
              />
            </Field.Root>
          </Stack>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root>
              <Field.Label>{t.LabelPhone}</Field.Label>
              <Input
                size="sm"
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelEmail}</Field.Label>
              <Input
                size="sm"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </Field.Root>
            <Field.Root maxW={{md: '32'}}>
              <Field.Label>{t.LabelLanguage}</Field.Label>
              <Input
                size="sm"
                placeholder="de"
                value={form.language}
                onChange={e => set('language', e.target.value)}
              />
            </Field.Root>
          </Stack>
        </FormSection>

        <FormSection title={t.SecRide}>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root>
              <Field.Label>{t.LabelFlight}</Field.Label>
              <Input
                size="sm"
                placeholder={t.PlaceholderFlight}
                value={form.flightNumber}
                onChange={e => set('flightNumber', e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelLuggage}</Field.Label>
              <Input
                size="sm"
                placeholder={t.PlaceholderLuggage}
                value={form.luggage}
                onChange={e => set('luggage', e.target.value)}
              />
            </Field.Root>
          </Stack>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root>
              <Field.Label>{t.LabelChildSeats}</Field.Label>
              <Input
                size="sm"
                placeholder={t.PlaceholderChildSeats}
                value={form.childSeats}
                onChange={e => set('childSeats', e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelExtraTime}</Field.Label>
              <Input
                size="sm"
                placeholder={t.PlaceholderExtraTime}
                value={form.extraTime}
                onChange={e => set('extraTime', e.target.value)}
              />
            </Field.Root>
          </Stack>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root>
              <Field.Label>{t.LabelCarClass}</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={form.preferredCarClass}
                  onChange={e =>
                    set('preferredCarClass', e.target.value as CarClass | '')
                  }>
                  <option value="">{t.NoneOption}</option>
                  {CAR_CLASSES.map(c => (
                    <option key={c} value={c}>
                      {enumLabel(t, 'Class_', c)}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelCarName}</Field.Label>
              <Input
                size="sm"
                value={form.preferredCarName}
                onChange={e => set('preferredCarName', e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelCar}</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={form.carId}
                  onChange={e => set('carId', e.target.value)}>
                  <option value="">{t.NoneOption}</option>
                  {cars.map(c => (
                    <option key={c.id} value={c.id}>
                      {carDisplayName(c)} · {c.licensePlate}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </Stack>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root>
              <Field.Label>{t.LabelCategory}</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={form.transferCategory}
                  onChange={e =>
                    set('transferCategory', e.target.value as TransferCategory)
                  }>
                  {TRANSFER_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {enumLabel(t, 'Cat_', c)}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </Stack>
        </FormSection>

        <FormSection title={t.SecMoney}>
          <Stack direction={{base: 'column', md: 'row'}} gap="3">
            <Field.Root>
              <Field.Label>{t.LabelPrice}</Field.Label>
              <AmountInput
                size="sm"
                data-testid="create-price-input"
                placeholder={t.PricePlaceholder}
                value={form.price}
                onChange={v => set('price', v)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelPaymentMethod}</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={form.paymentMethode}
                  onChange={e =>
                    set('paymentMethode', e.target.value as PaymentMethod | '')
                  }>
                  <option value="">{t.NoneOption}</option>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>
                      {enumLabel(t, 'Pay_', m)}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Field.Root>
              <Field.Label>{t.LabelPayingParty}</Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={form.payingParty}
                  onChange={e =>
                    set('payingParty', e.target.value as PayingParty | '')
                  }>
                  {PAYING_PARTIES.map(p => (
                    <option key={p} value={p}>
                      {enumLabel(t, 'Party_', p)}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </Stack>
        </FormSection>

        <FormSection title={t.SecExtras}>
          <Stack gap="2">
            {EXTRA_TYPES.map(type => {
              const amount = form.extras[type] ?? 0
              return (
                <HStack key={type} justify="space-between" gap="3">
                  <Checkbox.Root
                    checked={amount > 0}
                    colorPalette="brand"
                    onCheckedChange={e =>
                      set('extras', {...form.extras, [type]: e.checked ? 1 : 0})
                    }>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>
                      {enumLabel(t, 'Extra_', type)}
                    </Checkbox.Label>
                  </Checkbox.Root>
                  <NumberInput.Root
                    size="sm"
                    w="24"
                    min={0}
                    max={20}
                    value={String(amount)}
                    aria-label={t.ExtrasQuantity}
                    onValueChange={e =>
                      set('extras', {
                        ...form.extras,
                        [type]: Math.max(0, e.valueAsNumber || 0)
                      })
                    }>
                    <NumberInput.Control />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </HStack>
              )
            })}
          </Stack>
        </FormSection>

        <FormSection title={t.SectionNotes}>
          <Field.Root>
            <Field.Label>{t.LabelMessage}</Field.Label>
            <Textarea
              size="sm"
              rows={3}
              placeholder={t.PlaceholderMessage}
              value={form.message}
              onChange={e => set('message', e.target.value)}
            />
          </Field.Root>
        </FormSection>
      </Stack>
    </Sheet>
  )
}

// ============================================================
// Filters
// ============================================================

export type DateChip = 'today' | 'tomorrow' | 'all' | 'custom'
export type SortOrder = 'earliest' | 'latest'

interface DateFilterProps {
  value: DateChip
  onChange: (v: DateChip) => void
  range: {start: string; end: string}
  onRangeChange: (r: {start: string; end: string}) => void
}

export function DateFilter({
  value,
  onChange,
  range,
  onRangeChange
}: DateFilterProps) {
  const {t, tc} = useTransferStrings()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(range)

  useEffect(() => {
    if (open) setDraft(range)
  }, [open, range])

  const items: Array<{value: DateChip; label: string}> = [
    {value: 'today', label: tc.DateToday},
    {value: 'tomorrow', label: tc.DateTomorrow},
    {value: 'all', label: tc.DateAll}
  ]

  return (
    <HStack gap="2" flexWrap="wrap">
      <SegmentGroup.Root
        size="sm"
        value={value === 'custom' ? null : value}
        onValueChange={e => {
          if (e.value) onChange(e.value as DateChip)
        }}>
        <SegmentGroup.Indicator />
        {items.map(item => (
          <SegmentGroup.Item key={item.value} value={item.value}>
            <SegmentGroup.ItemText>{item.label}</SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
      <Popover.Root
        open={open}
        onOpenChange={e => setOpen(e.open)}
        positioning={{placement: 'bottom-start'}}
        lazyMount
        unmountOnExit>
        <Popover.Trigger asChild>
          <Button
            size="sm"
            variant={value === 'custom' ? 'solid' : 'outline'}
            colorPalette={value === 'custom' ? 'brand' : 'gray'}>
            <FaCalendarAlt />
            {value === 'custom' && range.start && range.end
              ? `${range.start} – ${range.end}`
              : tc.DateCustom}
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content w="xs">
              <Popover.Arrow />
              <Popover.Body>
                <Stack gap="3">
                  <Field.Root>
                    <Field.Label>{t.CustomRangeFrom}</Field.Label>
                    <Input
                      size="sm"
                      type="date"
                      value={draft.start}
                      onChange={e =>
                        setDraft(d => ({...d, start: e.target.value}))
                      }
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>{t.CustomRangeTo}</Field.Label>
                    <Input
                      size="sm"
                      type="date"
                      value={draft.end}
                      onChange={e =>
                        setDraft(d => ({...d, end: e.target.value}))
                      }
                    />
                  </Field.Root>
                  <Button
                    size="sm"
                    colorPalette="brand"
                    disabled={
                      !draft.start || !draft.end || draft.end < draft.start
                    }
                    onClick={() => {
                      onRangeChange(draft)
                      onChange('custom')
                      setOpen(false)
                    }}>
                    {t.CustomRangeApply}
                  </Button>
                </Stack>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </HStack>
  )
}

interface StatusFilterProps {
  selected: Set<TransferState>
  onChange: (next: Set<TransferState>) => void
}

export function StatusFilter({selected, onChange}: StatusFilterProps) {
  const {t} = useTransferStrings()
  const label = useStateLabel()
  const all = selected.size === TRANSFER_STATES.length
  const openOnly = () =>
    onChange(new Set(TRANSFER_STATES.filter(s => !isClosed(s))))
  return (
    <Popover.Root
      positioning={{placement: 'bottom-start'}}
      lazyMount
      unmountOnExit>
      <Popover.Trigger asChild>
        <Button size="sm" variant="outline" colorPalette="gray">
          <FaFilter />
          {t.FilterStatus}
          {!all && (
            <Badge size="sm" colorPalette="brand" variant="solid">
              {selected.size}
            </Badge>
          )}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="2xs">
            <Popover.Arrow />
            <Popover.Header>
              <HStack justify="space-between">
                <Text textStyle="sm" fontWeight="medium">
                  {fill(t.FilterStatusCount, {
                    count: selected.size,
                    total: TRANSFER_STATES.length
                  })}
                </Text>
                <HStack gap="2">
                  <Button
                    size="2xs"
                    variant="ghost"
                    onClick={() => onChange(new Set(TRANSFER_STATES))}>
                    {t.FilterStatusAll}
                  </Button>
                  <Button size="2xs" variant="ghost" onClick={openOnly}>
                    {t.FilterOpenOnly}
                  </Button>
                  <Button
                    size="2xs"
                    variant="ghost"
                    onClick={() => onChange(new Set())}>
                    {t.FilterStatusNone}
                  </Button>
                </HStack>
              </HStack>
            </Popover.Header>
            <Popover.Body maxH="60vh" overflowY="auto">
              <Stack gap="1">
                {TRANSFER_STATES.map(s => (
                  <Checkbox.Root
                    key={s}
                    size="sm"
                    colorPalette="brand"
                    checked={selected.has(s)}
                    onCheckedChange={e => {
                      const next = new Set(selected)
                      if (e.checked) next.add(s)
                      else next.delete(s)
                      onChange(next)
                    }}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>
                      <HStack gap="2">
                        <StatusBadge state={s} size="sm" />
                        <Text textStyle="sm">{label(s)}</Text>
                      </HStack>
                    </Checkbox.Label>
                  </Checkbox.Root>
                ))}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

export function SortMenu({
  value,
  onChange
}: {
  value: SortOrder
  onChange: (v: SortOrder) => void
}) {
  const {tc} = useTransferStrings()
  return (
    <Menu.Root lazyMount unmountOnExit>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline" colorPalette="gray">
          {value === 'earliest' ? <FaSortAmountUp /> : <FaSortAmountDown />}
          <chakra.span display={{base: 'none', sm: 'inline'}}>
            {value === 'earliest' ? tc.SortEarliest : tc.SortLatest}
          </chakra.span>
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup
              value={value}
              onValueChange={e => onChange(e.value as SortOrder)}>
              <Menu.RadioItem value="earliest">
                <Menu.ItemIndicator />
                <Menu.ItemText>{tc.SortEarliest}</Menu.ItemText>
              </Menu.RadioItem>
              <Menu.RadioItem value="latest">
                <Menu.ItemIndicator />
                <Menu.ItemText>{tc.SortLatest}</Menu.ItemText>
              </Menu.RadioItem>
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

// ============================================================
// Columns
// ============================================================

export type ColumnId =
  | 'code'
  | 'status'
  | 'route'
  | 'pickup'
  | 'passenger'
  | 'capacity'
  | 'flight'
  | 'driver'
  | 'vehicle'
  | 'price'
  | 'customer'
  | 'category'
  | 'payment'
  | 'extras'
  | 'notes'

const COLUMN_WIDTHS: Record<ColumnId, number> = {
  code: 96,
  status: 160,
  route: 240,
  // "Mo., 07. Sep. 2026" is 123px at the table's 14px and the cell adds
  // 16px of padding, the 130px of the first build cut it (design-consistency.md, rule 8).
  pickup: 150,
  passenger: 160,
  capacity: 110,
  flight: 90,
  driver: 160,
  // The "Zuerst Fahrer zuweisen" badge is 166px wide.
  vehicle: 190,
  // The "Preis festlegen" badge is 123px wide at the table's 14px, and the
  // 110px of the first build left 21px of it past the cell (measured on
  // booklimo.at, 2026-09-07).
  price: 150,
  customer: 160,
  category: 110,
  payment: 110,
  extras: 160,
  notes: 180
}

/**
 * The board's order, and which columns a fresh browser shows. The layout a
 * dispatcher makes of it is DataTable's business, remembered under the
 * table id `transfers`, the key the board always used.
 */
const BOARD_COLUMNS: Array<{id: ColumnId; visible: boolean}> = [
  {id: 'code', visible: true},
  {id: 'status', visible: true},
  {id: 'route', visible: true},
  {id: 'pickup', visible: true},
  {id: 'passenger', visible: true},
  {id: 'capacity', visible: true},
  {id: 'flight', visible: false},
  {id: 'driver', visible: true},
  {id: 'vehicle', visible: true},
  {id: 'price', visible: true},
  {id: 'customer', visible: false},
  {id: 'category', visible: false},
  {id: 'payment', visible: false},
  {id: 'extras', visible: false},
  {id: 'notes', visible: false}
]

const columnLabel = (t: TransfersStrings, id: ColumnId): string => {
  const map: Record<ColumnId, string> = {
    code: t.ColCode,
    status: t.ColStatus,
    route: t.ColRoute,
    pickup: t.ColPickup,
    passenger: t.ColPassenger,
    capacity: t.ColCapacity,
    flight: t.ColFlight,
    driver: t.ColDriver,
    vehicle: t.ColVehicle,
    price: t.ColPrice,
    customer: t.ColCustomer,
    category: t.ColCategory,
    payment: t.ColPayment,
    extras: t.ColExtras,
    notes: t.ColNotes
  }
  return map[id]
}

// ============================================================
// Rows, enriched with the driver's name and colour
// ============================================================

export interface BoardRow extends TransferRow {
  driverName?: string
  driverColor?: string
  driverPhone?: string
  /** The driver who declined, from the newest attempt, while DECLINED. Their name, not on the row any more. */
  declinedDriverName?: string
  declinedDriverColor?: string
  customerName?: string
  carName?: string
  carPlate?: string
}

const enrich = (
  rows: TransferRow[],
  drivers: ResourceUser[],
  users: ResourceUser[],
  cars: ResourceCar[]
): BoardRow[] => {
  const driverMap = new Map(drivers.map(d => [d.id, d]))
  const userMap = new Map(users.map(u => [u.id, u]))
  const carMap = new Map(cars.map(c => [c.id, c]))
  return rows.map(r => {
    const driver = r.driverId
      ? (driverMap.get(r.driverId) ?? userMap.get(r.driverId))
      : undefined
    const customer = userMap.get(r.customerId)
    const car = r.carId ? carMap.get(r.carId) : undefined
    const declinedId =
      r.driverStatus === 'DECLINED' ? r.lastAttempt?.driverId : undefined
    const declined = declinedId
      ? (driverMap.get(declinedId) ?? userMap.get(declinedId))
      : undefined
    return {
      ...r,
      driverName: driver
        ? driverDisplayName(driver)
        : r.driverId
          ? r.driverId
          : undefined,
      driverColor: driver?.driverColor,
      declinedDriverName: declined ? driverDisplayName(declined) : declinedId,
      declinedDriverColor: declined?.driverColor,
      customerName: customer ? driverDisplayName(customer) : undefined,
      carName:
        r.car?.carName ??
        car?.carName ??
        (r.car?.licensePlate || car?.licensePlate),
      carPlate: r.car?.licensePlate ?? car?.licensePlate
    }
  })
}

/** The date header's stripe: green for today, yellow for tomorrow, nothing otherwise. */
/**
 * The two stripes on a transfer, and why there are two.
 *
 * Every row and card carries two independent 4px edges. The LEFT edge is WHO:
 * the driver's colour, the same colour as on the map and in the picker, and
 * nothing when nobody is assigned. The RIGHT edge is WHEN: green when the
 * ride is today, yellow when it is tomorrow, nothing otherwise. They answer
 * two different questions and a dispatcher reads both at a glance without
 * opening the row, so neither may be dropped in favour of the other.
 *
 * This is the rule of the original resource pages (gatsby-jaen-resource,
 * February 2026: borderLeftColor = driver, borderRightColor = green.400 today
 * and yellow.400 tomorrow). The Tailwind prototype of 2026-02-26 moved the
 * date colour onto the day header's left edge and dropped the right stripe,
 * and the Chakra port copied that. Restored 2026-09-05 at the owner's request.
 */
export const dayPalette = (
  day: string,
  today: string,
  tomorrow: string
): DayTone =>
  day === today ? 'green' : day === tomorrow ? 'yellow' : undefined

/** Today and tomorrow as local days, read once per screen. */
export const useTodayTomorrow = () => {
  const today = useMemo(() => localDay(new Date()), [])
  const tomorrow = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return localDay(d)
  }, [])
  return {today, tomorrow}
}

/** The board's grouping for DataTable: one section per ride day, named and toned by dayPalette. */
export const useDayGroup = (
  today: string,
  tomorrow: string
): DataGroup<BoardRow> => {
  const {code} = useTransferStrings()
  return useMemo(
    () => ({
      key: (row: BoardRow) => row.rideDateISO || '',
      label: (day: string) => formatDay(day, code),
      tone: (day: string) => dayPalette(day, today, tomorrow)
    }),
    [code, today, tomorrow]
  )
}

export interface RowActions {
  onOpen: (row: BoardRow) => void
  onAssign?: (row: BoardRow) => void
  onPrice?: (row: BoardRow) => void
  onState?: (row: BoardRow) => void
}

function CapacityText({row}: {row: BoardRow}) {
  const {t} = useTransferStrings()
  const pax = row.passengers.length
  return (
    <Stack gap="0.5" textStyle="sm" whiteSpace="nowrap">
      <HStack gap="1">
        <Box color="fg.muted">
          <FaUsers size={12} />
        </Box>
        <span>
          {pax || '–'} {t.Pax}
        </span>
      </HStack>
      {row.details?.luggage && (
        <HStack gap="1" color="fg.muted">
          <FaSuitcase size={12} />
          <Text truncate maxW="24">
            {row.details.luggage}
          </Text>
        </HStack>
      )}
    </Stack>
  )
}

/**
 * The one place the driver's answer is read (dispatch.md section 9): the
 * driver's name with an amber "Angefragt" while the request is open, the
 * declined driver's name with a red "Abgelehnt" and the reason on hover
 * until the next request, the name with a green "Zugewiesen" from the yes
 * on. A row from before the status (NONE with a driver) reads the name
 * alone, as it always did. The same words on the cards and the detail.
 */
export function DriverAnswerBadge({
  status,
  reason,
  ...rest
}: {status: string | undefined; reason?: string} & Omit<
  BadgeProps,
  'children'
>) {
  const {t} = useTransferStrings()
  if (status === 'REQUESTED') {
    return (
      <Badge
        size="sm"
        variant="subtle"
        colorPalette="orange"
        whiteSpace="nowrap"
        {...rest}>
        {t.DriverRequested}
      </Badge>
    )
  }
  if (status === 'DECLINED') {
    return (
      <Badge
        size="sm"
        variant="subtle"
        colorPalette="red"
        whiteSpace="nowrap"
        title={reason ? fill(t.DeclineReason, {reason}) : undefined}
        cursor={reason ? 'help' : undefined}
        {...rest}>
        {t.DriverDeclined}
      </Badge>
    )
  }
  if (status === 'ACCEPTED') {
    return (
      <Badge
        size="sm"
        variant="subtle"
        colorPalette="green"
        whiteSpace="nowrap"
        {...rest}>
        {t.DriverAccepted}
      </Badge>
    )
  }
  return null
}

function DriverCell({row, actions}: {row: BoardRow; actions: RowActions}) {
  const {t} = useTransferStrings()
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  if (row.driverId) {
    return (
      <HStack gap="2" minW="0">
        <DriverColorDot color={row.driverColor} />
        <Text textStyle="sm" fontWeight="medium" truncate>
          {row.driverName}
        </Text>
        <DriverAnswerBadge status={row.driverStatus} />
      </HStack>
    )
  }
  if (row.driverStatus === 'DECLINED' && row.declinedDriverName) {
    // The declined driver stays on the row until the next request, and the
    // badge is the way to ask again.
    return (
      <HStack gap="2" minW="0">
        <DriverColorDot color={row.declinedDriverColor} />
        <Text
          textStyle="sm"
          fontWeight="medium"
          truncate
          color="fg.muted"
          textDecoration="line-through">
          {row.declinedDriverName}
        </Text>
        <DriverAnswerBadge
          status="DECLINED"
          reason={row.lastAttempt?.reason}
          as={!isClosed(row.state) && actions.onAssign ? 'button' : undefined}
          onClick={e => {
            if (!actions.onAssign || isClosed(row.state)) return
            stop(e)
            actions.onAssign(row)
          }}
        />
      </HStack>
    )
  }
  if (isClosed(row.state) || !actions.onAssign) {
    return (
      <Text textStyle="sm" color="fg.muted">
        –
      </Text>
    )
  }
  return (
    <Badge
      as="button"
      colorPalette="red"
      variant="subtle"
      cursor="pointer"
      onClick={e => {
        stop(e)
        actions.onAssign?.(row)
      }}>
      {t.NotAssigned}
    </Badge>
  )
}

function VehicleCell({row, actions}: {row: BoardRow; actions: RowActions}) {
  const {t} = useTransferStrings()
  if (row.carId) {
    return (
      <Box textStyle="sm" minW="0">
        <Text fontWeight="medium" truncate>
          {row.carName}
        </Text>
        {row.carPlate && (
          <Text textStyle="xs" color="fg.muted" truncate>
            {row.carPlate}
          </Text>
        )}
      </Box>
    )
  }
  if (isClosed(row.state) || !actions.onAssign) {
    return (
      <Text textStyle="sm" color="fg.muted">
        –
      </Text>
    )
  }
  if (!row.driverId) {
    return (
      <Badge colorPalette="gray" variant="outline">
        {t.AssignDriverFirst}
      </Badge>
    )
  }
  return (
    <Badge
      as="button"
      colorPalette="orange"
      variant="subtle"
      cursor="pointer"
      onClick={e => {
        e.stopPropagation()
        actions.onAssign?.(row)
      }}>
      {t.AssignVehicle}
    </Badge>
  )
}

function PriceCell({row, actions}: {row: BoardRow; actions: RowActions}) {
  const {t} = useTransferStrings()
  if (row.price != null) {
    return (
      <MoneyText
        value={row.price}
        fontWeight="semibold"
        cursor={actions.onPrice ? 'pointer' : undefined}
        onClick={e => {
          if (!actions.onPrice) return
          e.stopPropagation()
          actions.onPrice(row)
        }}
      />
    )
  }
  if (isClosed(row.state) || !actions.onPrice) {
    return (
      <Text textStyle="sm" color="fg.muted">
        –
      </Text>
    )
  }
  return (
    <Badge
      as="button"
      colorPalette="orange"
      variant="subtle"
      cursor="pointer"
      onClick={e => {
        e.stopPropagation()
        actions.onPrice?.(row)
      }}>
      {t.SetPrice}
    </Badge>
  )
}

function StatusCell({row, actions}: {row: BoardRow; actions: RowActions}) {
  if (!actions.onState) return <StatusBadge state={row.state} />
  return (
    <StatusBadge
      state={row.state}
      as="button"
      cursor="pointer"
      onClick={e => {
        e.stopPropagation()
        actions.onState?.(row)
      }}
    />
  )
}

function ExtrasText({row}: {row: BoardRow}) {
  const {t} = useTransferStrings()
  if (!row.extras.length) {
    return (
      <Text textStyle="sm" color="fg.muted">
        –
      </Text>
    )
  }
  return (
    <Stack gap="0.5">
      {row.extras.map((x, i) => (
        <HStack
          key={i}
          justify="space-between"
          textStyle="xs"
          color="fg.muted"
          gap="2">
          <Text truncate>{enumLabel(t, 'Extra_', x.type)}</Text>
          <span>× {x.amount}</span>
        </HStack>
      ))}
    </Stack>
  )
}

// ============================================================
// The columns, as DataTable takes them
// ============================================================

/** One cell of the board, the same words and parts in the table and on a card. */
function transferCell(
  row: BoardRow,
  id: ColumnId,
  actions: RowActions,
  t: TransfersStrings,
  code: I18nCode
): React.ReactNode {
  switch (id) {
    case 'code':
      return (
        <Text
          fontWeight="medium"
          whiteSpace="nowrap"
          fontFamily="mono"
          textStyle="sm">
          {row.code}
        </Text>
      )
    case 'status':
      // The ride state and, beside it, the customer's status (offers-and-documents.md).
      return (
        <HStack gap="1" flexWrap="wrap">
          <StatusCell row={row} actions={actions} />
          <CustomerStatusBadge status={row.customerStatus} size="sm" />
        </HStack>
      )
    case 'route':
      return (
        <Box minW="0">
          <Text textStyle="sm" fontWeight="medium" truncate>
            {row.pickup}
          </Text>
          <Text textStyle="sm" color="fg.muted" truncate>
            {row.dropoff}
          </Text>
        </Box>
      )
    case 'pickup':
      return (
        <Box whiteSpace="nowrap">
          <Text textStyle="sm" fontWeight="medium">
            {formatDay(row.rideDateISO, code)}
          </Text>
          <Text textStyle="sm" color="fg.muted">
            {row.rideTime}
          </Text>
        </Box>
      )
    case 'passenger': {
      const name = passengerName(row)
      const phone = row.passengers[0]?.phone
      return (
        <Box minW="0">
          <Text textStyle="sm" fontWeight="medium" truncate>
            {name || '–'}
          </Text>
          {phone && (
            <Text textStyle="xs" color="fg.muted" truncate>
              {phone}
            </Text>
          )}
        </Box>
      )
    }
    case 'capacity':
      return <CapacityText row={row} />
    case 'flight':
      return (
        <Text
          textStyle="sm"
          color={row.details?.flightNumber ? undefined : 'fg.muted'}>
          {row.details?.flightNumber || '–'}
        </Text>
      )
    case 'driver':
      return <DriverCell row={row} actions={actions} />
    case 'vehicle':
      return <VehicleCell row={row} actions={actions} />
    case 'price':
      return <PriceCell row={row} actions={actions} />
    case 'customer':
      return (
        <Box minW="0">
          <Text textStyle="sm" fontWeight="medium" truncate>
            {row.customerName || '–'}
          </Text>
          <Text textStyle="xs" color="fg.muted" truncate>
            {row.customerId}
          </Text>
        </Box>
      )
    case 'category':
      return (
        <Text textStyle="sm">
          {enumLabel(t, 'Cat_', row.transferCategory)}
          {row.transferType
            ? ` · ${enumLabel(t, 'Type_', row.transferType)}`
            : ''}
        </Text>
      )
    case 'payment':
      return (
        <Text
          textStyle="sm"
          color={row.paymentMethode ? undefined : 'fg.muted'}>
          {row.paymentMethode ? enumLabel(t, 'Pay_', row.paymentMethode) : '–'}
          {row.payingParty
            ? ` · ${enumLabel(t, 'Party_', row.payingParty)}`
            : ''}
        </Text>
      )
    case 'extras':
      return <ExtrasText row={row} />
    case 'notes':
      return (
        <Text
          textStyle="sm"
          color="fg.muted"
          truncate
          title={row.details?.message}>
          {row.details?.message || '–'}
        </Text>
      )
    default:
      return null
  }
}

/**
 * The board's columns as DataTable takes them: the id, the header word in
 * the account's language, the width the board always had, whether a fresh
 * browser shows it, and the cell. The dispatcher's cells carry the row
 * actions (assign, price, state), a list without them draws the plain
 * value. Bookings picks the customer's subset by id from the same list, so
 * every cell is written once.
 */
export function useTransferColumns(
  actions: RowActions
): DataColumn<BoardRow>[] {
  const {t, code} = useTransferStrings()
  return useMemo(
    () =>
      BOARD_COLUMNS.map(({id, visible}) => ({
        id,
        label: columnLabel(t, id),
        width: COLUMN_WIDTHS[id],
        defaultVisible: visible,
        cell: (row: BoardRow) => transferCell(row, id, actions, t, code)
      })),
    [t, code, actions]
  )
}

// ============================================================
// The cards
// ============================================================

interface TransferCardProps {
  row: BoardRow
  expanded: boolean
  onToggle: () => void
  actions: RowActions
  /** The driver's own list hides the dispatcher's cells. */
  compact?: boolean
  /** WHEN, on the right edge: green today, yellow tomorrow. See dayPalette. */
  dayTone?: DayTone
  /** Whose words on the customer status chip: the dispatcher's, or the customer's on their own list. */
  customerAudience?: 'dispatcher' | 'customer'
}

export function TransferCard({
  row,
  expanded,
  onToggle,
  actions,
  compact = false,
  dayTone,
  customerAudience = 'dispatcher'
}: TransferCardProps) {
  const {t, tc, code} = useTransferStrings()
  const name = passengerName(row)
  return (
    <Box
      rounded="surface"
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.surface"
      p="3"
      w="full"
      minW="0"
      colorPalette={dayTone}
      borderInlineStartWidth="4px"
      borderInlineStartColor={row.driverColor ?? 'border.emphasized'}
      borderInlineEndWidth={dayTone ? '4px' : '1px'}
      borderInlineEndColor={dayTone ? 'colorPalette.solid' : 'border.default'}
      onClick={() => actions.onOpen(row)}
      cursor="pointer">
      <HStack justify="space-between" gap="2" minW="0">
        <HStack gap="2" minW="0">
          <Text fontWeight="semibold" textStyle="sm" fontFamily="mono" truncate>
            {row.code}
          </Text>
          <StatusCell row={row} actions={actions} />
          {!compact && (
            <CustomerStatusBadge
              status={row.customerStatus}
              audience={customerAudience}
              size="sm"
            />
          )}
        </HStack>
        <HStack gap="1" flexShrink={0}>
          <Text textStyle="sm" color="fg.muted" whiteSpace="nowrap">
            {row.rideTime}
          </Text>
          <IconButton
            size="xs"
            variant="ghost"
            aria-label={expanded ? t.ShowLess : t.ShowMore}
            onClick={e => {
              e.stopPropagation()
              onToggle()
            }}>
            {expanded ? <FaChevronUp /> : <FaChevronDown />}
          </IconButton>
        </HStack>
      </HStack>

      <HStack align="flex-start" gap="2" mt="2" textStyle="sm" minW="0">
        <Box color="fg.muted" mt="0.5">
          <FaMapMarkerAlt />
        </Box>
        <Box flex="1" minW="0">
          <Text fontWeight="medium">{row.pickup}</Text>
          <Text color="fg.muted">→ {row.dropoff}</Text>
        </Box>
      </HStack>

      {/* The dispatcher's eye needs the driver on the closed card, that is the whole board on a phone. */}
      {!compact && !expanded && (
        <HStack
          justify="space-between"
          mt="2"
          gap="2"
          onClick={e => e.stopPropagation()}>
          <DriverCell row={row} actions={actions} />
          <PriceCell row={row} actions={actions} />
        </HStack>
      )}

      {expanded && (
        <Stack gap="2" mt="3" onClick={e => e.stopPropagation()}>
          <HStack gap="2" textStyle="sm" color="fg.muted">
            <FaCalendarAlt />
            <span>
              {formatDay(row.rideDateISO, code)} · {row.rideTime}
            </span>
          </HStack>
          <HStack gap="4" textStyle="sm" flexWrap="wrap">
            <HStack gap="1.5">
              <Box color="fg.muted">
                <FaUsers />
              </Box>
              <span>{row.passengers.length || '–'}</span>
            </HStack>
            {row.details?.luggage && (
              <HStack gap="1.5">
                <Box color="fg.muted">
                  <FaSuitcase />
                </Box>
                <span>{row.details.luggage}</span>
              </HStack>
            )}
            {row.details?.flightNumber && (
              <HStack gap="1.5">
                <Box color="fg.muted">
                  <FaPlane />
                </Box>
                <span>{row.details.flightNumber}</span>
              </HStack>
            )}
          </HStack>
          <Separator />
          <Stack gap="1.5" textStyle="sm">
            <HStack gap="2">
              <Text color="fg.muted" w="24" flexShrink={0}>
                {t.Passenger}
              </Text>
              <Text truncate>{name || '–'}</Text>
            </HStack>
            {!compact && (
              <HStack gap="2">
                <Text color="fg.muted" w="24" flexShrink={0}>
                  {t.ColDriver}
                </Text>
                <DriverCell row={row} actions={actions} />
              </HStack>
            )}
            <HStack gap="2">
              <Text color="fg.muted" w="24" flexShrink={0}>
                {t.ColVehicle}
              </Text>
              <VehicleCell
                row={row}
                actions={compact ? {onOpen: actions.onOpen} : actions}
              />
            </HStack>
            {(!compact || row.price != null) && (
              <HStack gap="2">
                <Text color="fg.muted" w="24" flexShrink={0}>
                  {t.ColPrice}
                </Text>
                <PriceCell
                  row={row}
                  actions={compact ? {onOpen: actions.onOpen} : actions}
                />
              </HStack>
            )}
            {row.details?.message && (
              <HStack gap="2" align="flex-start">
                <Text color="fg.muted" w="24" flexShrink={0}>
                  {t.Wishes}
                </Text>
                <Text>{row.details.message}</Text>
              </HStack>
            )}
          </Stack>
          {row.extras.length > 0 && (
            <>
              <Separator />
              <ExtrasText row={row} />
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            colorPalette="brand"
            onClick={() => actions.onOpen(row)}>
            {tc.Details}
          </Button>
        </Stack>
      )}
    </Box>
  )
}

// ============================================================
// The list, shared by the board and "my rides"
// ============================================================

export interface ListState {
  dateChip: DateChip
  setDateChip: (v: DateChip) => void
  range: {start: string; end: string}
  setRange: (r: {start: string; end: string}) => void
  statuses: Set<TransferState>
  setStatuses: (s: Set<TransferState>) => void
  search: string
  setSearch: (s: string) => void
  sort: SortOrder
  setSort: (s: SortOrder) => void
  unassignedOnly: boolean
  setUnassignedOnly: (v: boolean) => void
}

const OPEN_STATES = new Set<TransferState>(
  TRANSFER_STATES.filter(s => !isClosed(s))
)

export function useListState(
  initialChip: DateChip,
  initialStatuses: ReadonlySet<TransferState>
): ListState {
  const [dateChip, setDateChip] = useState<DateChip>(initialChip)
  const [range, setRange] = useState({start: '', end: ''})
  const [statuses, setStatuses] = useState<Set<TransferState>>(
    () => new Set(initialStatuses)
  )
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('earliest')
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  return {
    dateChip,
    setDateChip,
    range,
    setRange,
    statuses,
    setStatuses,
    search,
    setSearch,
    sort,
    setSort,
    unassignedOnly,
    setUnassignedOnly
  }
}

/**
 * The server window from the chips: a day is sent as a bare date, which the
 * resolver reads as the whole day. One selected state is pushed down as well.
 * Everything else, search, several states, "without driver", is filtered
 * over the page that came back.
 */
export const useServerArgs = (
  state: ListState,
  today: string,
  tomorrow: string,
  pageSize: number
) => {
  const oneState =
    state.statuses.size === 1 ? [...state.statuses][0] : undefined
  return useMemo(() => {
    const base = {pageSize, state: oneState}
    if (state.dateChip === 'today')
      return {...base, fromISO: today, toISO: today}
    if (state.dateChip === 'tomorrow')
      return {...base, fromISO: tomorrow, toISO: tomorrow}
    if (state.dateChip === 'custom' && state.range.start && state.range.end) {
      return {...base, fromISO: state.range.start, toISO: state.range.end}
    }
    return base
  }, [
    state.dateChip,
    state.range.start,
    state.range.end,
    oneState,
    today,
    tomorrow,
    pageSize
  ])
}

export const applyClientFilters = (
  rows: BoardRow[],
  state: ListState
): BoardRow[] => {
  let result = rows.filter(r => {
    const s = asTransferState(r.state)
    return s ? state.statuses.has(s) : true
  })
  if (state.unassignedOnly)
    result = result.filter(r => !isClosed(r.state) && (!r.driverId || !r.carId))
  const q = state.search.trim().toLowerCase()
  if (q) {
    result = result.filter(r =>
      [
        r.code,
        r.id,
        r.pickup,
        r.dropoff,
        r.driverName,
        r.customerName,
        r.carPlate,
        r.carName,
        passengerName(r),
        r.passengers[0]?.phone,
        r.details?.flightNumber,
        r.subject
      ].some(v => v?.toLowerCase().includes(q))
    )
  }
  return [...result].sort((a, b) => {
    const ka = `${a.rideDateISO} ${a.rideTime}`
    const kb = `${b.rideDateISO} ${b.rideTime}`
    return state.sort === 'earliest'
      ? ka.localeCompare(kb)
      : kb.localeCompare(ka)
  })
}

// ============================================================
// The dispatcher's board
// ============================================================

const BOARD_PAGE_SIZE = 25

function DispatchBoard() {
  const {t, tc} = useTransferStrings()
  const navigate = useAppNavigate()
  const {drivers} = useDrivers()
  const {cars, refetch: refetchCars} = useCars()
  const {users} = useUsers(100)

  const {today, tomorrow} = useTodayTomorrow()

  const list = useListState('today', new Set(TRANSFER_STATES))
  const args = useServerArgs(list, today, tomorrow, BOARD_PAGE_SIZE)
  const {
    rows,
    isLoading,
    error,
    isFetching,
    pagination,
    pageSize,
    setPageSize,
    nextPage,
    prevPage,
    firstPage,
    refetch,
    replaceRow
  } = useTransferList(args)
  useViewRefresh(refetch, isFetching)

  const [assignFor, setAssignFor] = useState<TransferRow | null>(null)
  const [priceFor, setPriceFor] = useState<TransferRow | null>(null)
  const [stateFor, setStateFor] = useState<TransferRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const enriched = useMemo(
    () => enrich(rows, drivers, users, cars),
    [rows, drivers, users, cars]
  )
  const filtered = useMemo(
    () => applyClientFilters(enriched, list),
    [enriched, list]
  )

  const actions = useMemo<RowActions>(
    () => ({
      onOpen: row => navigate(transferPath(row)),
      onAssign: setAssignFor,
      onPrice: setPriceFor,
      onState: setStateFor
    }),
    [navigate]
  )
  const columns = useTransferColumns(actions)
  const group = useDayGroup(today, tomorrow)

  const onSaved = useCallback(
    (row: TransferRow) => {
      replaceRow(row)
    },
    [replaceRow]
  )

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="5">
        <PageHeader
          title={t.Heading}
          subtitle={t.Subtitle}
          actions={
            <>
              <Button
                size="sm"
                colorPalette="brand"
                onClick={() => setCreateOpen(true)}>
                <FaPlus />
                {t.AddTransfer}
              </Button>
              <RefreshButton />
            </>
          }
        />

        <Flex gap="2" flexWrap="wrap" align="center">
          <DateFilter
            value={list.dateChip}
            onChange={list.setDateChip}
            range={list.range}
            onRangeChange={list.setRange}
          />
          <Box w={{base: 'full', md: '52'}}>
            <InputGroup startElement={<FaSearch />}>
              <Input
                size="sm"
                placeholder={tc.Search}
                value={list.search}
                onChange={e => list.setSearch(e.target.value)}
              />
            </InputGroup>
          </Box>
          <StatusFilter selected={list.statuses} onChange={list.setStatuses} />
          <SortMenu value={list.sort} onChange={list.setSort} />
          <Switch.Root
            size="sm"
            colorPalette="brand"
            checked={list.unassignedOnly}
            onCheckedChange={e => list.setUnassignedOnly(e.checked)}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label textStyle="sm">{t.UnassignedOnly}</Switch.Label>
          </Switch.Root>
        </Flex>

        {list.unassignedOnly && (
          <HStack>
            <Badge colorPalette="red" variant="subtle" gap="1">
              {t.UnassignedOnly}
              <chakra.button
                type="button"
                display="inline-flex"
                onClick={() => list.setUnassignedOnly(false)}>
                <FaTimes size={10} />
              </chakra.button>
            </Badge>
          </HStack>
        )}

        <DataTable
          tableId="transfers"
          columns={columns}
          rows={filtered}
          rowId={row => row.id}
          onOpen={actions.onOpen}
          group={group}
          stripe={row => row.driverColor}
          muted={row => asTransferState(row.state) === 'COMPLETED'}
          card={(row, api) => (
            <TransferCard
              row={row}
              expanded={api.expanded}
              onToggle={api.toggle}
              actions={actions}
              dayTone={api.tone}
            />
          )}
          summary={fill(t.CountLabel, {
            total: pagination.totalCount,
            count: filtered.length
          })}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          empty={
            <EmptyState title={t.EmptyMessage} description={t.EmptyHint} />
          }
          pager={{
            page: pagination.currentPage,
            pages: pagination.totalPages,
            hasNext: pagination.hasNextPage,
            onFirst: firstPage,
            onPrev: prevPage,
            onNext: nextPage,
            pageSize,
            onPageSize: setPageSize,
            always: true
          }}
        />
      </Stack>

      <AssignDialog
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        transfer={assignFor}
        drivers={drivers}
        cars={cars}
        onAssigned={row => {
          onSaved(row)
          // A driver's latest car may have been created on the way, keep the plates fresh.
          refetchCars()
        }}
      />
      <PriceDialog
        open={!!priceFor}
        onClose={() => setPriceFor(null)}
        transfer={priceFor}
        onSaved={onSaved}
      />
      <StateDialog
        open={!!stateFor}
        onClose={() => setStateFor(null)}
        transfer={stateFor}
        onSaved={onSaved}
      />
      <CreateTransferDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customers={users}
        cars={cars}
        onCreated={() => {
          list.setDateChip('all')
          firstPage()
        }}
      />
    </Box>
  )
}

// ============================================================
// My rides: the driver's list, and a customer's bookings
// ============================================================

function MyRides({heading, subtitle}: {heading: string; subtitle?: string}) {
  const {t} = useTransferStrings()
  const navigate = useAppNavigate()

  const {today, tomorrow} = useTodayTomorrow()

  // A driver wants what is still to do. The chips and the status filter can widen it.
  const list = useListState('today', OPEN_STATES)

  const args = useServerArgs(list, today, tomorrow, 50)
  // No driverId is sent: the backend confines the list to the caller.
  const {
    rows,
    isLoading,
    error,
    isFetching,
    pagination,
    pageSize,
    setPageSize,
    nextPage,
    prevPage,
    firstPage,
    refetch
  } = useTransferList({...args, tableId: 'my-rides'})
  useViewRefresh(refetch, isFetching)
  // Offline the list is the stored answer, see shared/offline.ts. When the
  // connection returns it is read again and the banner above it goes.
  useRefetchOnReconnect(refetch)

  const enriched = useMemo(() => enrich(rows, [], [], []), [rows])
  const filtered = useMemo(
    () => applyClientFilters(enriched, list),
    [enriched, list]
  )

  const actions = useMemo<RowActions>(
    () => ({onOpen: row => navigate(transferPath(row))}),
    [navigate]
  )
  const columns = useTransferColumns(actions)
  const group = useDayGroup(today, tomorrow)

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="5">
        <PageHeader
          title={heading}
          subtitle={subtitle}
          actions={<RefreshButton />}
        />

        <Flex gap="2" flexWrap="wrap" align="center">
          <DateFilter
            value={list.dateChip}
            onChange={list.setDateChip}
            range={list.range}
            onRangeChange={list.setRange}
          />
          <StatusFilter selected={list.statuses} onChange={list.setStatuses} />
          <SortMenu value={list.sort} onChange={list.setSort} />
        </Flex>

        <OfflineBanner />

        {/* The driver's list is cards at every width, without the dispatcher's cells. */}
        <DataTable
          tableId="my-rides"
          columns={columns}
          rows={filtered}
          rowId={row => row.id}
          onOpen={actions.onOpen}
          group={group}
          stripe={row => row.driverColor}
          cardsOnly
          columnsControl={false}
          card={(row, api) => (
            <TransferCard
              row={row}
              expanded={api.expanded}
              onToggle={api.toggle}
              actions={actions}
              dayTone={api.tone}
              compact
            />
          )}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          empty={
            <EmptyState
              title={t.EmptyMessage}
              description={t.EmptyHint}
              icon={<FaCar />}
            />
          }
          pager={{
            page: pagination.currentPage,
            pages: pagination.totalPages,
            hasNext: pagination.hasNextPage,
            onFirst: firstPage,
            onPrev: prevPage,
            onNext: nextPage,
            pageSize,
            onPageSize: setPageSize
          }}
        />
      </Stack>
    </Box>
  )
}

// ============================================================
// The screen
// ============================================================

/** The columns' words while nobody opens a row yet. */
const NO_ACTIONS: RowActions = {onOpen: () => undefined}

/**
 * The list before the roles are known: the heading as a grey line and the
 * board's table, or its cards on a phone, in grey (design-consistency.md,
 * rule 3). The dispatcher's board and the driver's list are both lists of
 * rides, so whichever lands, the skeleton had its shape.
 */
function TransfersSkeleton() {
  const columns = useTransferColumns(NO_ACTIONS)
  const mobile = useIsMobile()
  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="5">
        <Skeleton h="8" w="48" rounded="sm" />
        {mobile ? (
          <ListSkeleton rows={8} />
        ) : (
          <TableSkeleton
            columns={columns.filter(c => c.defaultVisible !== false)}
          />
        )}
      </Stack>
    </Box>
  )
}

export function TransfersView() {
  const caller = useCaller()
  const {t} = useTransferStrings()

  if (caller.loading) return <TransfersSkeleton />
  if (caller.isAdmin) return <DispatchBoard />
  if (caller.isDriver)
    return <MyRides heading={t.MyRidesHeading} subtitle={t.MyRidesSubtitle} />
  return <MyRides heading={t.BookingsHeading} />
}
