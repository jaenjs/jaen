/**
 * The customer's bookings, and the button that makes a new one.
 *
 * Whose bookings is the backend's decision: `transfers` is read without a
 * customerId and the resolver scopes it to the caller, so a customer sees
 * their own rides and a dispatcher opening the same route sees every
 * booking. The screen only changes its subtitle.
 *
 * The list is the dispatcher's board with the customer's columns: the same
 * list state and chips (today, tomorrow, all, a custom range), the status
 * filter, search and sort, the shared DataTable with the day header rows and
 * the two stripes (the driver's colour on the left, today green and tomorrow
 * yellow on the right), the board's cards on a phone, the pager. Until
 * 2026-09-05 this screen drew its own flat Table.Root beside it, one design
 * for the same rows on two routes, and since 2026-09-06 the board's pieces
 * are one component under shared/components/table. The rows come through useTransferList, the board's own read,
 * and the driver's name and colour through useBookingDrivers, because a
 * customer may not call getDriverColor and transferTracking is the read the
 * matrix gives them for the person picking them up.
 *
 * The modal is the sixteen strings in i18nBookings made into a form, plus
 * the counts and the flight the driver's screen wants to show. It calls
 * bookTransfer, never createTransfer, so the row belongs to whoever pressed
 * the button and never to an id typed into a field.
 */
import React, {useMemo, useState} from 'react'
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Field,
  Flex,
  HStack,
  Input,
  InputGroup,
  NativeSelect,
  Portal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  chakra
} from '@chakra-ui/react'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaSearch} from '@react-icons/all-files/fa/FaSearch'
import {FaCalendarCheck} from '@react-icons/all-files/fa/FaCalendarCheck'
import {useAppNavigate} from '../navigation'
import {useI18nCode} from '../i18n'
import {useCaller} from '../auth'
import {getI18nBookings} from '../locales/i18nBookings'
import {fill, getI18nCommon} from '../locales/i18nCommon'
import {
  bookRide,
  bookingPath,
  PAYMENT_METHODS,
  isPickupInPast,
  useBookingDrivers,
  type Booking,
  type BookRideInput,
  type PaymentMethod
} from '../hooks/bookings'
import {useTransferList} from '../hooks/transfers'
import {useRideDocuments} from '../hooks/finance'
import {RideDocumentButtons} from '../components/documents/RideDocumentButtons'
import {TRANSFER_STATES} from '../locales/i18nStates'
import {
  DialogActions,
  EmptyState,
  ErrorBanner,
  StatusBadge,
  toaster,
  PageHeader
} from '../components'
import {CustomerStatusBadge} from '../components/CustomerStatusBadge'
import {RefreshButton} from '../components/RefreshButton'
import {useViewRefresh} from '../hooks/view-refresh'
import {DataTable, type DataColumn} from '../components/table'
import {
  applyClientFilters,
  DateFilter,
  SortMenu,
  StatusFilter,
  TransferCard,
  useDayGroup,
  useListState,
  useServerArgs,
  useTodayTomorrow,
  useTransferColumns,
  type BoardRow,
  type ColumnId,
  type RowActions
} from './TransfersView'
import {failureText} from '../errors'

type Strings = ReturnType<typeof getI18nBookings>['strings']

const usePaymentLabel =
  (t: Strings) =>
  (method: string | null | undefined): string => {
    if (!method) return ''
    const key = `Payment${method.toUpperCase()}` as keyof Strings
    return (t[key] as string | undefined) ?? method
  }

// --------------- The modal ---------------

interface BookRideDialogProps {
  open: boolean
  onClose: () => void
  onBooked: (booking: Booking) => void
}

type FormState = {
  date: string
  time: string
  pickup: string
  dropoff: string
  subject: string
  paymentMethode: PaymentMethod | ''
  passengers: string
  luggage: string
  childSeats: string
  flightNumber: string
  wishes: string
}

const EMPTY_FORM: FormState = {
  date: '',
  time: '',
  pickup: '',
  dropoff: '',
  subject: '',
  paymentMethode: '',
  passengers: '1',
  luggage: '',
  childSeats: '',
  flightNumber: '',
  wishes: ''
}

const toInt = (raw: string): number | undefined => {
  if (!raw.trim()) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function BookRideDialog({open, onClose, onBooked}: BookRideDialogProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nBookings(code)
  const paymentLabel = usePaymentLabel(t)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({...prev, [key]: value}))

  // No ride in the past, dispatch.md section 12. The rule is the pylon's,
  // fifteen minutes of lead, and it is asked here so the visitor reads the
  // sentence under the date rather than a PICKUP_IN_PAST from the mutation.
  const pickupInPast = useMemo(
    () => isPickupInPast(form.date, form.time),
    [form.date, form.time]
  )

  const missing = {
    date: !form.date,
    time: !form.time,
    pickup: !form.pickup.trim(),
    dropoff: !form.dropoff.trim()
  }
  const valid = !Object.values(missing).some(Boolean) && !pickupInPast

  const reset = () => {
    setForm(EMPTY_FORM)
    setTouched(false)
    setFailure(null)
  }

  const close = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return

    const input: BookRideInput = {
      date: form.date,
      time: form.time,
      pickup: form.pickup,
      dropoff: form.dropoff,
      subject: form.subject,
      paymentMethode: form.paymentMethode,
      passengers: toInt(form.passengers),
      luggage: toInt(form.luggage),
      childSeats: toInt(form.childSeats),
      flightNumber: form.flightNumber,
      wishes: form.wishes,
      language: code
    }

    setSubmitting(true)
    setFailure(null)
    try {
      const booking = await bookRide(input)
      toaster.success({title: t.BookingCreatedSuccess})
      reset()
      onBooked(booking)
    } catch (err) {
      const message = failureText(err)
      setFailure(message)
      toaster.error({title: t.BookingCreatedError, description: message})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={e => {
        if (!e.open) close()
      }}
      size="lg"
      placement="center"
      scrollBehavior="inside"
      lazyMount
      unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            {/* display: contents keeps the header, body and footer as the
                content's own flex children, so the body still scrolls. */}
            <chakra.form display="contents" onSubmit={submit} noValidate>
              <Dialog.Header>
                <Dialog.Title>{t.BookTransferModalHeading}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="4">
                  <SimpleGrid columns={{base: 1, sm: 2}} gap="4">
                    <Field.Root
                      required
                      invalid={touched && (missing.date || pickupInPast)}>
                      <Field.Label>
                        {t.ModalLabelDate}
                        <Field.RequiredIndicator />
                      </Field.Label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={e => update('date', e.target.value)}
                        autoComplete="off"
                      />
                      {touched && missing.date && (
                        <Field.ErrorText>
                          {t.ModalErrorRequired}
                        </Field.ErrorText>
                      )}
                      {touched && !missing.date && pickupInPast && (
                        <Field.ErrorText>{t.ModalErrorPast}</Field.ErrorText>
                      )}
                    </Field.Root>
                    <Field.Root
                      required
                      invalid={touched && (missing.time || pickupInPast)}>
                      <Field.Label>
                        {t.ModalLabelTime}
                        <Field.RequiredIndicator />
                      </Field.Label>
                      <Input
                        type="time"
                        value={form.time}
                        onChange={e => update('time', e.target.value)}
                        autoComplete="off"
                      />
                      {touched && missing.time && (
                        <Field.ErrorText>
                          {t.ModalErrorRequired}
                        </Field.ErrorText>
                      )}
                    </Field.Root>
                  </SimpleGrid>

                  <Field.Root required invalid={touched && missing.pickup}>
                    <Field.Label>
                      {t.ModalLabelPickup}
                      <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      placeholder={t.ModalPlaceholderPickup}
                      value={form.pickup}
                      onChange={e => update('pickup', e.target.value)}
                      autoComplete="street-address"
                    />
                    {touched && missing.pickup && (
                      <Field.ErrorText>{t.ModalErrorRequired}</Field.ErrorText>
                    )}
                  </Field.Root>

                  <Field.Root required invalid={touched && missing.dropoff}>
                    <Field.Label>
                      {t.ModalLabelDropoff}
                      <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      placeholder={t.ModalPlaceholderDropoff}
                      value={form.dropoff}
                      onChange={e => update('dropoff', e.target.value)}
                      autoComplete="off"
                    />
                    {touched && missing.dropoff && (
                      <Field.ErrorText>{t.ModalErrorRequired}</Field.ErrorText>
                    )}
                  </Field.Root>

                  <SimpleGrid columns={{base: 1, sm: 2}} gap="4">
                    <Field.Root>
                      <Field.Label>{t.ModalLabelRoomOrName}</Field.Label>
                      <Input
                        placeholder={t.ModalPlaceholderRoomOrName}
                        value={form.subject}
                        onChange={e => update('subject', e.target.value)}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{t.ModalLabelPaymentMethod}</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          placeholder={t.ModalPlaceholderSelectPayment}
                          value={form.paymentMethode}
                          onChange={e =>
                            update(
                              'paymentMethode',
                              e.currentTarget.value as PaymentMethod | ''
                            )
                          }>
                          {PAYMENT_METHODS.map(m => (
                            <option key={m} value={m}>
                              {paymentLabel(m)}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Field.Root>
                  </SimpleGrid>

                  <SimpleGrid columns={3} gap="4">
                    <Field.Root>
                      <Field.Label>{t.ModalLabelPassengers}</Field.Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={50}
                        value={form.passengers}
                        onChange={e => update('passengers', e.target.value)}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{t.ModalLabelLuggage}</Field.Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={50}
                        value={form.luggage}
                        onChange={e => update('luggage', e.target.value)}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{t.ModalLabelChildSeats}</Field.Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={10}
                        value={form.childSeats}
                        onChange={e => update('childSeats', e.target.value)}
                      />
                    </Field.Root>
                  </SimpleGrid>

                  <Field.Root>
                    <Field.Label>{t.ModalLabelFlight}</Field.Label>
                    <Input
                      placeholder={t.ModalPlaceholderFlight}
                      value={form.flightNumber}
                      onChange={e => update('flightNumber', e.target.value)}
                      autoComplete="off"
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t.ModalLabelWishes}</Field.Label>
                    <Textarea
                      placeholder={t.ModalPlaceholderWishes}
                      value={form.wishes}
                      onChange={e => update('wishes', e.target.value)}
                      rows={3}
                      autoresize
                    />
                  </Field.Root>

                  <Text textStyle="sm" color="fg.muted">
                    {t.ModalHintPrice}
                  </Text>

                  {failure && (
                    <ErrorBanner
                      title={t.BookingCreatedError}
                      message={failure}
                    />
                  )}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <DialogActions
                  onCancel={close}
                  confirmLabel={t.BookingSubmit}
                  confirmType="submit"
                  loading={submitting}
                  loadingText={t.BookingSubmitting}
                  confirmDisabled={touched && !valid}
                />
              </Dialog.Footer>
            </chakra.form>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={submitting} />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

// --------------- The list ---------------

/**
 * The customer's column set on the board's table: the code, when, where,
 * how many, the state, who drives and what it costs. The driver's phone is
 * not on it (the customer sees the name and the colour, never the number),
 * nor the columns that are the dispatcher's alone.
 */
const CUSTOMER_COLUMNS: ColumnId[] = [
  'code',
  'pickup',
  'route',
  'capacity',
  'status',
  'driver',
  'price'
]

const PAGE_SIZE = 25

export function BookingView() {
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: t} = getI18nBookings(code)
  const {strings: tc} = getI18nCommon(code)
  const caller = useCaller()

  const {today, tomorrow} = useTodayTomorrow()

  // The same chips and filters as the board, with the board's defaults:
  // today, every state. The list is scoped in the resolver, so a customer
  // gets their own rows and a dispatcher every booking, from one read.
  const list = useListState('today', new Set(TRANSFER_STATES))
  const args = useServerArgs(list, today, tomorrow, PAGE_SIZE)
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
  } = useTransferList({...args, tableId: 'bookings'})
  useViewRefresh(refetch, isFetching)
  const drivers = useBookingDrivers(rows)

  const enriched = useMemo<BoardRow[]>(
    () =>
      rows.map(r => {
        const driver = r.driverId ? drivers[r.driverId] : undefined
        return {
          ...r,
          driverName:
            driver?.name ?? (r.driverId ? t.DriverAssigned : undefined),
          driverColor: driver?.color,
          carName: r.car?.carName ?? r.car?.licensePlate,
          carPlate: r.car?.licensePlate
        }
      }),
    [rows, drivers, t.DriverAssigned]
  )
  const filtered = useMemo(
    () => applyClientFilters(enriched, list),
    [enriched, list]
  )
  // The offer and the invoice of the rides on the page, one request, so a
  // button is drawn only where the document exists (customer-experience.md,
  // section 5). A driver is answered nothing and asks nothing.
  const {documents} = useRideDocuments(
    filtered.map(r => r.id),
    !caller.loading && (caller.isAdmin || caller.isCustomer)
  )

  const [dialogOpen, setDialogOpen] = useState(false)

  // Links carry the code, the pylon resolves it, see transfer-codes.md.
  const actions = useMemo<RowActions>(
    () => ({onOpen: row => navigate(bookingPath(row))}),
    [navigate]
  )
  // The board's cells, the customer's subset in the customer's order, every one shown.
  const boardColumns = useTransferColumns(actions)
  // The status cell carries the customer's own words beside the ride state
  // ("Angebot erhalten", "Bestätigt", "Rechnung erhalten", "Bezahlt"), the
  // board's cell carries the dispatcher's, see offers-and-documents.md.
  const columns = useMemo<DataColumn<BoardRow>[]>(
    () => [
      ...CUSTOMER_COLUMNS.map(id => boardColumns.find(c => c.id === id))
        .filter((c): c is DataColumn<BoardRow> => !!c)
        .map(c =>
          c.id === 'status'
            ? {
                ...c,
                defaultVisible: true,
                width: 200,
                cell: (row: BoardRow) => (
                  <HStack gap="1" flexWrap="wrap">
                    <StatusBadge state={row.state} />
                    <CustomerStatusBadge
                      status={row.customerStatus}
                      audience="customer"
                      size="sm"
                    />
                  </HStack>
                )
              }
            : {...c, defaultVisible: true}
        ),
      {
        id: 'documents',
        label: t.ColDocuments,
        width: 220,
        defaultVisible: true,
        cell: (row: BoardRow) => (
          <RideDocumentButtons docs={documents[row.id]} />
        )
      }
    ],
    [boardColumns, documents, t.ColDocuments]
  )
  const group = useDayGroup(today, tomorrow)

  const onBooked = (booking: Booking) => {
    setDialogOpen(false)
    // Land on the new booking. It also shows up on the list on the way back.
    navigate(bookingPath(booking))
  }

  // A driver has no booking form in the matrix: their rides are assigned to
  // them. Somebody holding both roles books as the customer they also are.
  if (
    !caller.loading &&
    caller.isDriver &&
    !caller.isCustomer &&
    !caller.isAdmin
  ) {
    return (
      <Box p={{base: '4', md: '6'}} maxW="full">
        <EmptyState
          title={t.NotACustomer}
          description={t.NotACustomerHint}
          icon={<FaCalendarCheck />}
        />
      </Box>
    )
  }

  // Nothing at all, or nothing in the window the chips and filters cut.
  const nothingBooked = pagination.totalCount === 0 && list.dateChip === 'all'

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="5">
        <PageHeader
          title={t.Heading}
          subtitle={
            caller.isAdmin && !caller.isCustomer ? t.SubtitleAll : t.SubtitleOwn
          }
          actions={
            <>
              <Button
                size="sm"
                colorPalette="brand"
                onClick={() => setDialogOpen(true)}>
                <FaPlus /> {t.BookTransferButton}
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
        </Flex>

        <DataTable
          tableId="bookings"
          columns={columns}
          rows={filtered}
          rowId={row => row.id}
          onOpen={actions.onOpen}
          group={group}
          stripe={row => row.driverColor}
          card={(row, api) => (
            <Stack gap="2">
              <TransferCard
                row={row}
                expanded={api.expanded}
                onToggle={api.toggle}
                actions={actions}
                dayTone={api.tone}
                customerAudience="customer"
              />
              <RideDocumentButtons docs={documents[row.id]} size="sm" px="1" />
            </Stack>
          )}
          summary={fill(t.CountLabel, {
            total: pagination.totalCount,
            count: filtered.length
          })}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          // A failed read shows its banner over the rows it still has, never the empty words.
          empty={
            error ? null : (
              <EmptyState
                title={nothingBooked ? t.EmptyMessage : t.EmptyFiltered}
                description={nothingBooked ? t.EmptyHint : t.EmptyFilteredHint}
                icon={<FaCalendarCheck />}>
                <Button
                  colorPalette="brand"
                  onClick={() => setDialogOpen(true)}>
                  <FaPlus /> {t.BookTransferButton}
                </Button>
              </EmptyState>
            )
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

      <BookRideDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onBooked={onBooked}
      />
    </Box>
  )
}
