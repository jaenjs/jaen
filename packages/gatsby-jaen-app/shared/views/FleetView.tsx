/**
 * The fleet, for the dispatcher.
 *
 * Every car with its plate, name, class, colour and the driver it is handed
 * to. Create and edit share one dialog. Handing a car to a driver is a select
 * on the row on a desk and the same select in the dialog on a phone, and it
 * is a one-column update on the backend, see hooks/fleet.ts.
 *
 * The list is the shared DataTable (okf/architecture/data-layer.md,
 * acceptance 4): the board's header row, the driver's colour on the left
 * edge of a row and a card, the column popover, and cards below `md`, with
 * the fleet's own columns and the select on the row.
 *
 * Admin only. `cars` answers a driver too, but the writes do not, and the
 * shell offers the entry to an admin alone.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  Box,
  Button,
  Card,
  CloseButton,
  ColorPicker,
  Dialog,
  Field,
  HStack,
  Input,
  NativeSelect,
  Portal,
  SimpleGrid,
  Stack,
  Stat,
  Text,
  parseColor,
  useBreakpointValue
} from '@chakra-ui/react'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaExclamationTriangle} from '@react-icons/all-files/fa/FaExclamationTriangle'
import {useI18nCode} from '../i18n'
import {getI18nFleet, type FleetStrings} from '../locales/i18nFleet'
import {fill, getI18nCommon} from '../locales/i18nCommon'
import {useCaller} from '../auth'
import {useDrivers, type ResourceUser} from '../hooks'
import {
  CarImage,
  CarImagesField,
  DialogActions,
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  toaster,
  PageHeader,
  type CarGalleryItem
} from '../components'
import {RefreshButton} from '../components/RefreshButton'
import {useViewRefresh} from '../hooks/view-refresh'
import {DataTable, type CardApi, type DataColumn} from '../components/table'
import {NumberSkeleton} from '../components/skeletons'
import {
  CAR_CLASSES,
  asCarClass,
  addCarImagesMutation,
  assignCarToDriverMutation,
  createCarMutation,
  removeCarImageMutation,
  reorderCarImagesMutation,
  updateCarMutation,
  useFleet,
  type CarClass,
  type CarInput,
  type FleetCar
} from '../hooks/fleet'
import {failureText} from '../errors'

const classLabel = (c: CarClass | undefined, t: FleetStrings): string =>
  c ? t[`Class_${c}`] : t.ClassNone

const driverName = (d: ResourceUser) =>
  [d.details?.firstName, d.details?.lastName].filter(Boolean).join(' ') ||
  d.username ||
  d.primaryEmailAddress

/** The car's paint as a swatch. A car colour is a literal by nature, there is no token for "silver". */
function CarSwatch({color, size = '5'}: {color: string; size?: string}) {
  return (
    <Box
      as="span"
      display="inline-block"
      flexShrink={0}
      boxSize={size}
      rounded="control"
      bg={color}
      borderWidth="1px"
      borderColor="blackAlpha.300"
      _dark={{borderColor: 'whiteAlpha.400'}}
      aria-hidden
    />
  )
}

interface FleetCardProps {
  car: FleetCar
  /** The driver's name from the picker's list, or what the car remembers. */
  driver: string | undefined
  /** WHO, on the left edge. */
  stripe: string | undefined
  t: FleetStrings
  onOpen: (car: FleetCar) => void
}

/**
 * A car below `md`, in the board's card frame: the paint and the plate on
 * the title line, the name under it, the driver with the colour dot last.
 * The dialog does the handing over on a phone, so the card carries no
 * select.
 */
function FleetCard({car, driver, stripe, t, onOpen}: FleetCardProps) {
  return (
    <Box
      rounded="surface"
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.surface"
      p="3"
      w="full"
      minW="0"
      borderInlineStartWidth="4px"
      borderInlineStartColor={stripe ?? 'border.emphasized'}
      onClick={() => onOpen(car)}
      cursor="pointer">
      <HStack gap="3" minW="0">
        {/* The car's picture, or the silhouette of its class (media.md). */}
        <CarImage car={car} size={56} alt={car.licensePlate} />
        <CarSwatch color={car.color} size="8" />
        <Box flex="1" minW="0">
          <HStack gap="2" minW="0">
            <Text fontWeight="semibold" fontFamily="mono" whiteSpace="nowrap">
              {car.licensePlate}
            </Text>
            <Text textStyle="xs" color="fg.muted" lineClamp={1}>
              {classLabel(car.carClass, t)}
            </Text>
          </HStack>
          {car.carName && (
            <Text textStyle="sm" lineClamp={1}>
              {car.carName}
            </Text>
          )}
        </Box>
      </HStack>
      <HStack mt="2" gap="2" textStyle="sm">
        <DriverColorDot color={stripe} />
        <Text color={driver ? 'fg.default' : 'fg.muted'} lineClamp={1}>
          {driver || t.NoDriver}
        </Text>
      </HStack>
    </Box>
  )
}

/**
 * The car the Media tab's Fahrzeuge source asked for. Its open lands on
 * `/app/fleet/?car=<id>` (media.md, "Sources", and src/components/
 * useMediaSources.ts), and the screen opens the vehicle form on that car.
 */
const readAskedCar = (): string | undefined => {
  try {
    return new URLSearchParams(window.location.search).get('car') ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Takes the argument out of the address once the form is open, so closing
 * the form leaves the plain list and a reload does not open it again.
 */
const forgetAskedCar = () => {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('car')) return
    url.searchParams.delete('car')
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    /* no address to write, the form still opens */
  }
}

export function FleetView() {
  const caller = useCaller()
  const code = useI18nCode()
  const {strings: t} = getI18nFleet(code)
  const {strings: tc} = getI18nCommon(code)
  const {cars, isLoading, error, isFetching, refetch} = useFleet()
  useViewRefresh(refetch, isFetching)
  const {drivers} = useDrivers()
  const [dialog, setDialog] = useState<{open: boolean; car?: FleetCar}>({
    open: false
  })
  const [assigning, setAssigning] = useState<string | null>(null)

  // The car the address asked for, read once on mount. The fleet lands a
  // moment later, so the form is opened by the effect below and not here.
  const [asked, setAsked] = useState<string | undefined>(() =>
    typeof window !== 'undefined' ? readAskedCar() : undefined
  )

  useEffect(() => {
    if (!asked || isLoading) return
    const car = cars.find(c => c.id === asked)
    setAsked(undefined)
    forgetAskedCar()
    // An id that names no car of this brand leaves the list as it is.
    if (car) setDialog({open: true, car})
  }, [asked, isLoading, cars])

  const driverById = new Map(drivers.map(d => [d.id, d]))
  const nameFor = (car: FleetCar) => {
    const d = car.driverId ? driverById.get(car.driverId) : undefined
    return d ? driverName(d) : car.driverName
  }
  const colourFor = (car: FleetCar) =>
    car.driverId ? driverById.get(car.driverId)?.driverColor : undefined

  const assign = async (car: FleetCar, driverId: string) => {
    setAssigning(car.id)
    try {
      await assignCarToDriverMutation(car.id, driverId || null)
      toaster.success({title: driverId ? t.DriverAssigned : t.DriverUnassigned})
      await refetch()
    } catch (err) {
      toaster.error({
        title: t.AssignFailed,
        description: failureText(err)
      })
    } finally {
      setAssigning(null)
    }
  }

  const assigned = cars.filter(c => c.driverId).length
  // The three numbers wait as numbers, never as 0 (design-consistency.md, rule 3).
  const pending = isLoading && cars.length === 0
  const count = (n: number) => (pending ? <NumberSkeleton chars={2} /> : n)

  const driverSelect = (car: FleetCar) => (
    <NativeSelect.Root
      size="sm"
      disabled={assigning === car.id}
      onClick={e => e.stopPropagation()}>
      <NativeSelect.Field
        value={car.driverId ?? ''}
        onChange={e => void assign(car, e.target.value)}
        aria-label={t.ColDriver}>
        <option value="">{t.NoDriver}</option>
        {drivers.map(d => (
          <option key={d.id} value={d.id}>
            {driverName(d)}
          </option>
        ))}
        {car.driverId && !driverById.has(car.driverId) && (
          <option value={car.driverId}>{car.driverName ?? car.driverId}</option>
        )}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  )

  // The fleet's columns as DataTable takes them. The driver cell is the
  // select of the old table, still stopping the click so the row does not
  // open the dialog under it.
  const columns = useMemo<DataColumn<FleetCar>[]>(
    () => [
      {
        id: 'image',
        label: t.FieldImage,
        width: 88,
        cell: car => <CarImage car={car} size={48} alt={car.licensePlate} />
      },
      {
        id: 'color',
        label: t.ColColor,
        width: 72,
        cell: car => <CarSwatch color={car.color} />
      },
      {
        id: 'plate',
        label: t.ColPlate,
        width: 150,
        cell: car => (
          <Text
            as="span"
            fontWeight="semibold"
            fontFamily="mono"
            whiteSpace="nowrap">
            {car.licensePlate}
          </Text>
        )
      },
      {
        id: 'name',
        label: t.ColName,
        width: 200,
        cell: car => <Text lineClamp={1}>{car.carName || '-'}</Text>
      },
      {
        id: 'class',
        label: t.ColClass,
        width: 150,
        cell: car => <Text color="fg.muted">{classLabel(car.carClass, t)}</Text>
      },
      {
        id: 'driver',
        label: t.ColDriver,
        width: 260,
        cell: car => (
          <HStack>
            <DriverColorDot color={colourFor(car)} />
            {driverSelect(car)}
          </HStack>
        )
      }
    ],
    // The cells read the drivers and the assigning state through the closures
    // above, which change with them, so the columns follow those two alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, drivers, assigning]
  )

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
              onClick={() => setDialog({open: true})}>
              <FaPlus /> {t.CreateCar}
            </Button>
            <RefreshButton />
          </>
        }
      />

      <SimpleGrid columns={3} gap="3">
        <StatCard label={t.StatTotal} value={count(cars.length)} />
        <StatCard
          label={t.StatAssigned}
          value={count(assigned)}
          palette="green"
        />
        <StatCard
          label={t.StatUnassigned}
          value={count(cars.length - assigned)}
          palette={cars.length - assigned > 0 ? 'orange' : undefined}
        />
      </SimpleGrid>

      <DataTable
        tableId="fleet"
        columns={columns}
        rows={cars}
        rowId={car => car.id}
        onOpen={car => setDialog({open: true, car})}
        stripe={colourFor}
        actionLabel={tc.Edit}
        card={(car, _api: CardApi) => (
          <FleetCard
            car={car}
            driver={nameFor(car)}
            stripe={colourFor(car)}
            t={t}
            onOpen={c => setDialog({open: true, car: c})}
          />
        )}
        summary={fill(t.CountLabel, {count: cars.length})}
        isLoading={isLoading}
        avatarSkeleton
        error={error}
        onRetry={refetch}
        empty={
          <EmptyState title={t.EmptyMessage} icon={<FaCar />}>
            <Button
              size="sm"
              colorPalette="brand"
              onClick={() => setDialog({open: true})}>
              <FaPlus /> {t.CreateCar}
            </Button>
          </EmptyState>
        }
      />

      <CarDialog
        open={dialog.open}
        car={dialog.car}
        drivers={drivers}
        onClose={() => setDialog({open: false})}
        onSaved={() => {
          setDialog({open: false})
          void refetch()
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

/**
 * The Farbe field: the swatch, the hex input, and the picker that opens on
 * the swatch's tap and on nothing else.
 *
 * The defect this shape fixes, photographed by the owner on an iPhone at app
 * 1.4.1: after a picture was set, the picker stood open at the very top of
 * the vehicle dialog, over the picture, far above the Farbe field it belongs
 * to. Two things caused it. The popover was uncontrolled, so a re-render of
 * the dialog's body could leave it mounted and visible without anybody
 * having tapped the swatch, and its positioner sat unportalled inside the
 * dialog's scrolling body, so the coordinates floating-ui computed against
 * the viewport were applied inside a scrolled container and landed at the
 * top of it.
 *
 * So: `open` is state here and only the trigger sets it. Below `md` the
 * picker is drawn inline directly under the field, in the flow, where it
 * cannot be positioned wrongly at all. From `md` up it is a portal anchored
 * to the trigger with a fixed strategy, which is measured against the
 * viewport the way the numbers are computed. It closes on an outside tap and
 * on any scroll, because a popover anchored to a control that has scrolled
 * away is the defect all over again.
 */
function ColorField({
  label,
  value,
  disabled,
  onChange
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  // `ssr: false` because the app is a client shell inside jaen: the first
  // paint happens in the browser and the value is read there.
  const inline =
    useBreakpointValue({base: true, md: false}, {ssr: false}) ?? true

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const node = root.current
      if (node && event.target instanceof Node && !node.contains(event.target))
        close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    // Scroll closes the portalled picker only. That one is anchored to the
    // trigger and would otherwise stand where the swatch used to be, which is
    // the defect itself. The inline picker below `md` sits in the flow under
    // the field and scrolls with it, and opening it lengthens the dialog's
    // body, so a scroll listener there would shut it the instant it opened.
    if (inline) {
      return () =>
        document.removeEventListener('pointerdown', onPointerDown, true)
    }
    const onScroll = () => close()
    // Capture, so the dialog body's own scroll is heard and not only the page's.
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open, close, inline])

  const picker = (
    <>
      <ColorPicker.Area />
      <HStack>
        <ColorPicker.EyeDropper size="xs" variant="outline" />
        <ColorPicker.Sliders />
      </HStack>
    </>
  )

  return (
    <Field.Root ref={root}>
      <Field.Label>{label}</Field.Label>
      <ColorPicker.Root
        open={open}
        onOpenChange={e => setOpen(e.open)}
        disabled={disabled}
        value={parseColor(value || DEFAULT_COLOR)}
        format="rgba"
        positioning={{placement: 'bottom-start', gutter: 4, strategy: 'fixed'}}
        onValueChange={e => onChange(e.value.toString('hex'))}>
        <ColorPicker.HiddenInput />
        <ColorPicker.Control>
          <ColorPicker.Input />
          <ColorPicker.Trigger data-testid="car-color-trigger" />
        </ColorPicker.Control>

        {inline
          ? open && (
              // The parts, not ColorPicker.Content: Content is the popover's
              // own surface and lives inside a Positioner, and the whole
              // point below `md` is that there is no positioner to get wrong.
              <Box
                mt="2"
                w="full"
                display="flex"
                flexDirection="column"
                gap="3"
                p="3"
                rounded="control"
                borderWidth="1px"
                borderColor="border.default"
                bg="bg.surface"
                data-testid="car-color-popover"
                data-color-picker="inline">
                {picker}
              </Box>
            )
          : open && (
              <Portal>
                <ColorPicker.Positioner
                  data-testid="car-color-popover"
                  data-color-picker="portal">
                  <ColorPicker.Content>{picker}</ColorPicker.Content>
                </ColorPicker.Positioner>
              </Portal>
            )}
      </ColorPicker.Root>
    </Field.Root>
  )
}

interface CarDialogProps {
  open: boolean
  /** Editing this car, or creating one when absent. */
  car?: FleetCar
  drivers: ResourceUser[]
  onClose: () => void
  onSaved: () => void
}

const DEFAULT_COLOR = '#000000'

const emptyForm = (car?: FleetCar): CarInput => ({
  licensePlate: car?.licensePlate ?? '',
  carName: car?.carName ?? '',
  carClass: car?.carClass,
  color: car?.color ?? DEFAULT_COLOR,
  driverId: car?.driverId
})

/**
 * The gallery the car has now, in the shape the field carries: every stored
 * picture with its row id, in its order, the first one the cover.
 */
const galleryOf = (car?: FleetCar): CarGalleryItem[] =>
  (car?.images ?? []).map(image => ({
    id: image.id,
    fileId: image.fileId,
    url: image.url,
    thumbUrl: image.thumbUrl,
    width: image.width,
    height: image.height
  }))

/**
 * What the dialog has to write to make the car's gallery look like the
 * draft: the rows to delete, the fresh uploads to add, and whether the
 * order that comes out of those two differs from the drafted one.
 *
 * The adds land at the end, which is where `addCarImages` appends them, so
 * a plain "upload three more" needs no reorder at all.
 */
const galleryPlan = (before: CarGalleryItem[], after: CarGalleryItem[]) => {
  const kept = new Set(after.map(image => image.id).filter(Boolean))
  const removed = before.filter(image => image.id && !kept.has(image.id))
  const added = after.filter(image => !image.id)
  const resulting = [
    ...before
      .filter(image => image.id && kept.has(image.id))
      .map(image => image.fileId),
    ...added.map(image => image.fileId)
  ]
  const wanted = after.map(image => image.fileId)
  const reordered = resulting.join('|') !== wanted.join('|')
  return {removed, added, reordered, wanted}
}

/**
 * Makes the car's gallery look like the draft: the removals first, so a
 * form that swapped one picture for another does not run into the backend's
 * ceiling, then the fresh uploads, then the order where the two did not
 * already produce it. `addCarImages` answers the whole gallery, which is how
 * the fresh rows get their ids for the reorder.
 */
async function writeGallery(
  carId: string,
  before: CarGalleryItem[],
  after: CarGalleryItem[]
): Promise<void> {
  const plan = galleryPlan(before, after)

  for (const image of plan.removed) {
    if (image.id) await removeCarImageMutation(image.id)
  }

  let stored = after.filter(image => image.id)
  if (plan.added.length) {
    const rows = await addCarImagesMutation(
      carId,
      plan.added.map(image => ({
        fileId: image.fileId,
        url: image.url,
        thumbUrl: image.thumbUrl,
        width: image.width,
        height: image.height
      }))
    )
    stored = rows
  }

  if (plan.reordered) {
    // The ids in the drafted order. A picture the answer does not name is a
    // gallery somebody else changed under this form, and the backend refuses
    // a partial list rather than half applying it.
    const byFile = new Map(stored.map(row => [row.fileId, row.id]))
    const ids = plan.wanted
      .map(fileId => byFile.get(fileId))
      .filter(Boolean) as string[]
    if (ids.length === stored.length && ids.length > 1) {
      await reorderCarImagesMutation(carId, ids)
    }
  }
}

/** One dialog for both: the title and the mutation are the only difference. */
function CarDialog({open, car, drivers, onClose, onSaved}: CarDialogProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nFleet(code)
  const {strings: tc} = getI18nCommon(code)
  const [form, setForm] = useState<CarInput>(() => emptyForm(car))
  // The gallery is its own piece of state: the files are uploaded to the
  // storage gateway while the dialog stands open and the car's own rows are
  // written with the rest on submit, so an abandoned form changes nothing.
  const [gallery, setGallery] = useState<CarGalleryItem[]>(() => galleryOf(car))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The dialog is mounted lazily, so the form follows whichever car opened it.
  useEffect(() => {
    if (open) {
      setForm(emptyForm(car))
      setGallery(galleryOf(car))
      setTouched(false)
      setFailure(null)
    }
  }, [open, car])

  const plateOk = form.licensePlate.trim().length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!plateOk || saving) return
    setSaving(true)
    setFailure(null)
    try {
      const input: CarInput = {
        licensePlate: form.licensePlate.trim().toUpperCase(),
        carName: form.carName?.trim() || undefined,
        carClass: form.carClass,
        color: form.color,
        // Explicit null takes the car away from its driver, undefined would leave it.
        driverId: form.driverId || null
      }
      if (car) {
        await updateCarMutation(car.id, input)
        await writeGallery(car.id, galleryOf(car), gallery)
        toaster.success({title: t.CarUpdated})
      } else {
        const id = await createCarMutation(input)
        // createCar writes no picture, so a new car with a gallery takes it
        // in a second call. A car that was created and then failed to take
        // its pictures still exists, which is why this is a second call and
        // not a retry of the first.
        if (id) await writeGallery(id, [], gallery)
        toaster.success({title: t.CarCreated})
      }
      onSaved()
    } catch (err) {
      setFailure(failureText(err, t.CarSaveFailed))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={e => {
        if (!e.open && !saving) onClose()
      }}
      size="md"
      placement="center"
      lazyMount
      unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content as="form" onSubmit={submit}>
            <Dialog.Header>
              <Dialog.Title>
                {car ? t.EditCarTitle : t.CreateCarTitle}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>{t.FieldImage}</Field.Label>
                  <CarImagesField
                    value={gallery}
                    onChange={setGallery}
                    disabled={saving}
                    strings={t}
                    onFailure={setFailure}
                  />
                </Field.Root>
                <Field.Root required invalid={touched && !plateOk}>
                  <Field.Label>
                    {t.FieldPlate} <Field.RequiredIndicator />
                  </Field.Label>
                  <Input
                    value={form.licensePlate}
                    onChange={e =>
                      setForm(f => ({...f, licensePlate: e.target.value}))
                    }
                    fontFamily="mono"
                    textTransform="uppercase"
                    autoComplete="off"
                  />
                  <Field.ErrorText>{t.ValidationPlate}</Field.ErrorText>
                </Field.Root>
                <Field.Root>
                  <Field.Label>{t.FieldName}</Field.Label>
                  <Input
                    value={form.carName ?? ''}
                    placeholder={t.FieldNamePlaceholder}
                    onChange={e =>
                      setForm(f => ({...f, carName: e.target.value}))
                    }
                  />
                </Field.Root>
                <SimpleGrid columns={{base: 1, sm: 2}} gap="4">
                  <Field.Root>
                    <Field.Label>{t.FieldClass}</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={form.carClass ?? ''}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            carClass: asCarClass(e.target.value)
                          }))
                        }>
                        <option value="">{t.ClassNone}</option>
                        {CAR_CLASSES.map(c => (
                          <option key={c} value={c}>
                            {classLabel(c, t)}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                  <ColorField
                    label={t.FieldColor}
                    value={form.color}
                    disabled={saving}
                    onChange={color => setForm(f => ({...f, color}))}
                  />
                </SimpleGrid>
                <Field.Root>
                  <Field.Label>{t.FieldDriver}</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.driverId ?? ''}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          driverId: e.target.value || undefined
                        }))
                      }>
                      <option value="">{t.NoDriver}</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {driverName(d)}
                        </option>
                      ))}
                      {car?.driverId &&
                        !drivers.some(d => d.id === car.driverId) && (
                          <option value={car.driverId}>
                            {car.driverName ?? car.driverId}
                          </option>
                        )}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                {failure && (
                  <ErrorBanner title={t.CarSaveFailed} message={failure} />
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <DialogActions
                onCancel={onClose}
                confirmLabel={tc.Save}
                confirmType="submit"
                loading={saving}
              />
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={saving} />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
