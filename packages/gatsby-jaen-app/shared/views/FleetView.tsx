/**
 * The fleet, for the dispatcher.
 *
 * Every car with its plate, name, class, colour and the driver it is handed
 * to. Create and edit share one dialog. Handing a car to a driver is a select
 * on the row on a desk and the same select in the dialog on a phone, and it
 * is a one-column update on the backend, see hooks/fleet.ts.
 *
 * Admin only. `cars` answers a driver too, but the writes do not, and the
 * shell offers the entry to an admin alone.
 */
import React, {useEffect, useState} from 'react'
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
  Table,
  Text,
  parseColor,
} from '@chakra-ui/react'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaEdit} from '@react-icons/all-files/fa/FaEdit'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaSyncAlt} from '@react-icons/all-files/fa/FaSyncAlt'
import {FaExclamationTriangle} from '@react-icons/all-files/fa/FaExclamationTriangle'
import {useI18nCode} from '../i18n'
import {getI18nFleet, type FleetStrings} from '../locales/i18nFleet'
import {getI18nCommon} from '../locales/i18nCommon'
import {useCaller} from '../auth'
import {useDrivers, type ResourceUser} from '../hooks'
import {
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  LoadingOverlay,
  toaster,
  PageHeader
} from '../components'
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
      rounded="md"
      bg={color}
      borderWidth="1px"
      borderColor="blackAlpha.300"
      _dark={{borderColor: 'whiteAlpha.400'}}
      aria-hidden
    />
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

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      <Card.Root position="relative" overflow="hidden">
        {isLoading && <LoadingOverlay overlay />}
        {!isLoading && cars.length === 0 ? (
          <EmptyState title={t.EmptyMessage} icon={<FaCar />}>
            <Button
              size="sm"
              colorPalette="brand"
              onClick={() => setDialog({open: true})}>
              <FaPlus /> {t.CreateCar}
            </Button>
          </EmptyState>
        ) : (
          <>
            <Box display={{base: 'none', md: 'block'}} overflowX="auto">
              <Table.Root size="md" interactive>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader w="12">{t.ColColor}</Table.ColumnHeader>
                    <Table.ColumnHeader>{t.ColPlate}</Table.ColumnHeader>
                    <Table.ColumnHeader>{t.ColName}</Table.ColumnHeader>
                    <Table.ColumnHeader>{t.ColClass}</Table.ColumnHeader>
                    <Table.ColumnHeader minW="56">
                      {t.ColDriver}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {cars.map(car => (
                    <Table.Row
                      key={car.id}
                      cursor="pointer"
                      onClick={() => setDialog({open: true, car})}>
                      <Table.Cell>
                        <CarSwatch color={car.color} />
                      </Table.Cell>
                      <Table.Cell
                        fontWeight="semibold"
                        fontFamily="mono"
                        whiteSpace="nowrap">
                        {car.licensePlate}
                      </Table.Cell>
                      <Table.Cell>{car.carName || '-'}</Table.Cell>
                      <Table.Cell color="fg.muted">
                        {classLabel(car.carClass, t)}
                      </Table.Cell>
                      <Table.Cell>
                        <HStack>
                          <DriverColorDot color={colourFor(car)} />
                          {driverSelect(car)}
                        </HStack>
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        <IconButton
                          aria-label={tc.Edit}
                          size="xs"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation()
                            setDialog({open: true, car})
                          }}>
                          <FaEdit />
                        </IconButton>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>

            <Stack display={{base: 'flex', md: 'none'}} gap="0" divideY="1px">
              {cars.map(car => (
                <HStack key={car.id} gap="3" p="3" align="start">
                  <CarSwatch color={car.color} size="8" />
                  <Box flex="1" minW="0">
                    <HStack>
                      <Text fontWeight="semibold" fontFamily="mono">
                        {car.licensePlate}
                      </Text>
                      <Text textStyle="xs" color="fg.muted">
                        {classLabel(car.carClass, t)}
                      </Text>
                    </HStack>
                    {car.carName && (
                      <Text textStyle="sm" lineClamp={1}>
                        {car.carName}
                      </Text>
                    )}
                    <HStack mt="1" gap="2">
                      <DriverColorDot color={colourFor(car)} />
                      <Text
                        textStyle="sm"
                        color={nameFor(car) ? 'fg.default' : 'fg.muted'}
                        lineClamp={1}>
                        {nameFor(car) || t.NoDriver}
                      </Text>
                    </HStack>
                  </Box>
                  <IconButton
                    aria-label={tc.Edit}
                    size="sm"
                    variant="ghost"
                    onClick={() => setDialog({open: true, car})}>
                    <FaEdit />
                  </IconButton>
                </HStack>
              ))}
            </Stack>
          </>
        )}
      </Card.Root>

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
              <Button variant="outline" onClick={onClose} disabled={saving}>
                {tc.Cancel}
              </Button>
              <Button type="submit" colorPalette="brand" loading={saving}>
                {tc.Save}
              </Button>
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
