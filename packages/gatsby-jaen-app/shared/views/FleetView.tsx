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
import React, {useEffect, useMemo, useState} from 'react'
import {
  Box,
  Button,
  Card,
  CloseButton,
  ColorPicker,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  SimpleGrid,
  Stack,
  Stat,
  Text,
  parseColor,
} from '@chakra-ui/react'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaSyncAlt} from '@react-icons/all-files/fa/FaSyncAlt'
import {FaExclamationTriangle} from '@react-icons/all-files/fa/FaExclamationTriangle'
import {useI18nCode} from '../i18n'
import {getI18nFleet, type FleetStrings} from '../locales/i18nFleet'
import {fill, getI18nCommon} from '../locales/i18nCommon'
import {useCaller} from '../auth'
import {useDrivers, type ResourceUser} from '../hooks'
import {
  DialogActions,
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  toaster,
  PageHeader
} from '../components'
import {DataTable, type CardApi, type DataColumn} from '../components/table'
import {
  CAR_CLASSES,
  asCarClass,
  assignCarToDriverMutation,
  createCarMutation,
  updateCarMutation,
  useFleet,
  type CarClass,
  type CarInput,
  type FleetCar
} from '../hooks/fleet'

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

export function FleetView() {
  const caller = useCaller()
  const code = useI18nCode()
  const {strings: t} = getI18nFleet(code)
  const {strings: tc} = getI18nCommon(code)
  const {cars, isLoading, error, refetch} = useFleet()
  const {drivers} = useDrivers()
  const [dialog, setDialog] = useState<{open: boolean; car?: FleetCar}>({
    open: false
  })
  const [assigning, setAssigning] = useState<string | null>(null)

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
        description: err instanceof Error ? err.message : undefined
      })
    } finally {
      setAssigning(null)
    }
  }

  const assigned = cars.filter(c => c.driverId).length

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
      {id: 'color', label: t.ColColor, width: 72, cell: car => <CarSwatch color={car.color} />},
      {
        id: 'plate',
        label: t.ColPlate,
        width: 150,
        cell: car => (
          <Text as="span" fontWeight="semibold" fontFamily="mono" whiteSpace="nowrap">
            {car.licensePlate}
          </Text>
        )
      },
      {id: 'name', label: t.ColName, width: 200, cell: car => <Text lineClamp={1}>{car.carName || '-'}</Text>},
      {id: 'class', label: t.ColClass, width: 150, cell: car => <Text color="fg.muted">{classLabel(car.carClass, t)}</Text>},
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
            <IconButton aria-label={tc.Refresh} variant="outline" onClick={refetch} loading={isLoading}>
              <FaSyncAlt />
            </IconButton>
            <Button colorPalette="brand" onClick={() => setDialog({open: true})}>
              <FaPlus /> {t.CreateCar}
            </Button>
          </>
        }
      />

      <SimpleGrid columns={3} gap="3">
        <StatCard label={t.StatTotal} value={cars.length} />
        <StatCard label={t.StatAssigned} value={assigned} palette="green" />
        <StatCard
          label={t.StatUnassigned}
          value={cars.length - assigned}
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
          <FleetCard car={car} driver={nameFor(car)} stripe={colourFor(car)} t={t} onOpen={c => setDialog({open: true, car: c})} />
        )}
        summary={fill(t.CountLabel, {count: cars.length})}
        isLoading={isLoading}
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
  value: number
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

/** One dialog for both: the title and the mutation are the only difference. */
function CarDialog({open, car, drivers, onClose, onSaved}: CarDialogProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nFleet(code)
  const {strings: tc} = getI18nCommon(code)
  const [form, setForm] = useState<CarInput>(() => emptyForm(car))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The dialog is mounted lazily, so the form follows whichever car opened it.
  useEffect(() => {
    if (open) {
      setForm(emptyForm(car))
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
        toaster.success({title: t.CarUpdated})
      } else {
        await createCarMutation(input)
        toaster.success({title: t.CarCreated})
      }
      onSaved()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : t.CarSaveFailed)
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
                  <Field.Root>
                    <Field.Label>{t.FieldColor}</Field.Label>
                    <ColorPicker.Root
                      value={parseColor(form.color || DEFAULT_COLOR)}
                      format="rgba"
                      onValueChange={e =>
                        setForm(f => ({...f, color: e.value.toString('hex')}))
                      }>
                      <ColorPicker.HiddenInput />
                      <ColorPicker.Control>
                        <ColorPicker.Input />
                        <ColorPicker.Trigger />
                      </ColorPicker.Control>
                      {/* No Portal on purpose: inside a Dialog, Chakra's own
                          "open from dialog" example keeps the positioner in
                          the dialog's tree so focus and dismissal stay with
                          the dialog. */}
                      <ColorPicker.Positioner>
                        <ColorPicker.Content>
                          <ColorPicker.Area />
                          <HStack>
                            <ColorPicker.EyeDropper
                              size="xs"
                              variant="outline"
                            />
                            <ColorPicker.Sliders />
                          </HStack>
                        </ColorPicker.Content>
                      </ColorPicker.Positioner>
                    </ColorPicker.Root>
                  </Field.Root>
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
              <DialogActions onCancel={onClose} confirmLabel={tc.Save} confirmType="submit" loading={saving} />
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
