// BookingModal.tsx
import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Stack,
  Text,
  Textarea,
  Select,
  SimpleGrid,
  Divider
} from '@chakra-ui/react';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CheckboxStyled } from './CheckboxStyled';
import { useT } from '../../contexts/language';
import { useIntl } from 'react-intl';

export type RideCategory = 'DISTANCE' | 'HOURLY' | 'FLATRATE';
export type RideType = 'ONEWAY' | 'RETURN';
export type PaymentOption = 'CASH' | 'CARD' | 'TRANSFER';

export interface BookingFormValues {
  // Contact
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  flightNumber?: string;
  message: string;

  // Consent
  agreeToTerms: boolean;

  // Ride details
  rideCategory?: RideCategory;
  rideType?: RideType;
  date?: string;
  time?: string;
  pickupAddress?: string;
  destinationAddress?: string;

  passengers?: number;
  luggage?: number;
  childSeats?: number;
  extraTime?: number;

  // Vehicle & Payment (optional)
  carClass?: string;
  carTitle?: string;
  paymentOption?: PaymentOption;
}

export interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BookingFormValues) => Promise<void>;
  fixedValues?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  defaultValues?: {
    message?: string;
  };
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  fixedValues,
  defaultValues
}) => {
  const t = useT();
  const intl = useIntl();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<BookingFormValues>({
    defaultValues: {
      rideCategory: 'FLATRATE',
      rideType: 'ONEWAY',
      passengers: undefined,
      luggage: undefined,
      childSeats: undefined,
      extraTime: undefined,
      paymentOption: undefined
    }
  });

  // --- Debug: log all react-intl messages once ---
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[intl.messages]', intl.messages);
  }, [intl]);

  // --- Pull fleet and categories primarily from react-intl, fallback to useT() ---
  const rawFleetFromIntl = (intl.messages as any)?.fleet;
  const rawFleetCategoriesMsg = (intl.messages as any)?.fleetCategories;

  const fleetFromIntl: any[] = React.useMemo(() => {
    if (Array.isArray(rawFleetFromIntl)) return rawFleetFromIntl;
    if (typeof rawFleetFromIntl === 'string') {
      try {
        const parsed = JSON.parse(rawFleetFromIntl);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore invalid JSON
      }
    }
    return [];
  }, [rawFleetFromIntl]);

  const fleetCategoriesFromIntl: string[] = React.useMemo(() => {
    if (Array.isArray(rawFleetCategoriesMsg)) {
      return rawFleetCategoriesMsg.filter(Boolean);
    }
    if (typeof rawFleetCategoriesMsg === 'string') {
      try {
        const parsed = JSON.parse(rawFleetCategoriesMsg);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        return rawFleetCategoriesMsg
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    }
    if (fleetFromIntl.length) {
      return Array.from(
        new Set(fleetFromIntl.map((v: any) => v?.category).filter(Boolean))
      );
    }
    return [];
  }, [rawFleetCategoriesMsg, fleetFromIntl]);

  const fleetData: any[] = fleetFromIntl.length
    ? fleetFromIntl
    : (t as any).fleet ?? [];

  const fleetCategories: string[] = fleetCategoriesFromIntl.length
    ? fleetCategoriesFromIntl
    : Array.from(
        new Set(
          (Array.isArray(fleetData) ? fleetData : [])
            .map((v: any) => v?.category)
            .filter(Boolean)
        )
      );

  // Build vehicle names per category from comma-separated description
  const vehiclesByCategory: Record<string, string[]> = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    (fleetData as any[]).forEach((item: any) => {
      const cat = item?.category;
      if (!cat) return;
      const desc: string = item?.description || '';
      const models =
        desc
          .split(',')
          .map(s => s.trim())
          .filter(Boolean) || [];
      const list = models.length > 0 ? models : item?.name ? [item.name] : [];
      if (!map[cat]) map[cat] = [];
      list.forEach(m => {
        if (!map[cat].includes(m)) map[cat].push(m);
      });
    });
    return map;
  }, [fleetData]);

  const selectedCarClass = watch('carClass');
  const vehicleOptions = selectedCarClass
    ? vehiclesByCategory[selectedCarClass] ?? []
    : [];

  React.useEffect(() => {
    reset({
      ...fixedValues,
      message: defaultValues?.message
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedValues, defaultValues]);

  React.useEffect(() => {
    if (!isOpen) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    // Clear vehicle selection when class changes
    setValue('carTitle', undefined);
  }, [selectedCarClass, setValue]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      blockScrollOnMount={false}
    >
      <ModalOverlay />
      <ModalContent>
        <form
          onSubmit={event => {
            void handleSubmit(onSubmit)(event);
          }}
        >
          <ModalCloseButton />
          <ModalBody
            p={{
              base: 4,
              md: 8,
              lg: 10
            }}
          >
            <Stack spacing={8}>
              <Stack spacing={2}>
                <Heading as="h2" size={{ base: 'md', md: 'lg' }}>
                  {t('BookingHeading', 'Booking request')}
                </Heading>
                <Text color="black">
                  {t(
                    'BookingIntro',
                    'Please fill in your ride details and contact info. We’ll get back to you shortly.'
                  )}
                </Text>
              </Stack>

              {/* Ride details */}
              <Stack spacing={4}>
                <Heading as="h3" size="sm">
                  {t('SectionRide', 'Ride')}
                </Heading>

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm">
                      {t('LabelCategory', 'Category')}
                    </FormLabel>
                    <Select
                      {...register('rideCategory')}
                      focusBorderColor="brand.500"
                    >
                      <option value="DISTANCE">
                        {t('CategoryDistance', 'Distance')}
                      </option>
                      <option value="HOURLY">
                        {t('CategoryHourly', 'Hourly')}
                      </option>
                      <option value="FLATRATE">
                        {t('CategoryFlatrate', 'Flat rate')}
                      </option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">
                      {t('LabelType', 'Type')}
                    </FormLabel>
                    <Select
                      {...register('rideType')}
                      focusBorderColor="brand.500"
                    >
                      <option value="ONEWAY">
                        {t('TypeOneWay', 'One-way')}
                      </option>
                      <option value="RETURN">
                        {t('TypeReturn', 'Return')}
                      </option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="date" fontSize="sm">
                      {t('LabelDate', 'Date')}
                    </FormLabel>
                    <Input
                      id="date"
                      type="date"
                      {...register('date')}
                      focusBorderColor="brand.500"
                    />
                    <FormErrorMessage fontSize="sm">
                      {errors.date?.toString()}
                    </FormErrorMessage>
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="time" fontSize="sm">
                      {t('LabelTime', 'Pickup time')}
                    </FormLabel>
                    <Input
                      id="time"
                      type="time"
                      {...register('time')}
                      focusBorderColor="brand.500"
                    />
                    <FormErrorMessage fontSize="sm">
                      {errors.time?.toString()}
                    </FormErrorMessage>
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="pickupAddress" fontSize="sm">
                      {t('LabelPickup', 'Pickup address')}
                    </FormLabel>
                    <Input
                      id="pickupAddress"
                      placeholder={t('LabelPickup', 'Pickup address')}
                      {...register('pickupAddress')}
                      focusBorderColor="brand.500"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="destinationAddress" fontSize="sm">
                      {t('LabelDestination', 'Destination address')}
                    </FormLabel>
                    <Input
                      id="destinationAddress"
                      placeholder={t('LabelDestination', 'Destination address')}
                      {...register('destinationAddress')}
                      focusBorderColor="brand.500"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="passengers" fontSize="sm">
                      {t('LabelPassengers', 'Passengers')}
                    </FormLabel>
                    <Input
                      id="passengers"
                      type="number"
                      min={1}
                      {...register('passengers', { valueAsNumber: true })}
                      focusBorderColor="brand.500"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="luggage" fontSize="sm">
                      {t('LabelLuggage', 'Luggage')}
                    </FormLabel>
                    <Input
                      id="luggage"
                      type="number"
                      min={0}
                      {...register('luggage', { valueAsNumber: true })}
                      focusBorderColor="brand.500"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="childSeats" fontSize="sm">
                      {t('LabelChildSeats', 'Child seat')}
                    </FormLabel>
                    <Input
                      id="childSeats"
                      type="number"
                      min={0}
                      {...register('childSeats', { valueAsNumber: true })}
                      focusBorderColor="brand.500"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel htmlFor="extraTime" fontSize="sm">
                      {t('LabelExtraTime', 'Extra time (hrs)')}
                    </FormLabel>
                    <Input
                      id="extraTime"
                      type="number"
                      min={0}
                      max={12}
                      {...register('extraTime', { valueAsNumber: true })}
                      focusBorderColor="brand.500"
                    />
                  </FormControl>
                </SimpleGrid>

                <Divider />

                {/* Vehicle & Payment */}
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm">
                      {t('LabelCarClass', 'Vehicle class')}
                    </FormLabel>
                    <Select
                      placeholder={t('SelectCarClass', 'Select a class')}
                      {...register('carClass')}
                      focusBorderColor="brand.500"
                    >
                      {fleetCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl isDisabled={!selectedCarClass}>
                    <FormLabel fontSize="sm">
                      {t('LabelCarTitle', 'Vehicle')}
                    </FormLabel>
                    <Select
                      placeholder={
                        selectedCarClass
                          ? t('SelectVehicle', 'Select a vehicle')
                          : t('SelectClassFirst', 'Select a class first')
                      }
                      {...register('carTitle')}
                      focusBorderColor="brand.500"
                    >
                      {vehicleOptions.map(model => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">
                      {t('LabelPaymentOption', 'Payment option')}
                    </FormLabel>
                    <Select
                      {...register('paymentOption')}
                      focusBorderColor="brand.500"
                    >
                      <option value="CASH">{t('PaymentCash', 'Cash')}</option>
                      <option value="CARD">{t('PaymentCard', 'Card')}</option>
                      <option value="TRANSFER">
                        {t('PaymentTransfer', 'Überweisung')}
                      </option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
              </Stack>

              {/* Contact details */}
              <Stack spacing={4}>
                <Heading as="h3" size="sm">
                  {t('SectionContact', 'Contact details')}
                </Heading>

                <HStack>
                  <FormControl isRequired isInvalid={!!errors.firstName}>
                    <FormLabel htmlFor="firstName" fontSize="sm">
                      {t('LabelFirstName', 'First name')}
                    </FormLabel>
                    <Input
                      id="firstName"
                      placeholder={t('LabelFirstName', 'First name')}
                      {...register('firstName', { required: true })}
                      isDisabled={!!fixedValues?.firstName}
                      focusBorderColor="brand.500"
                    />
                    <FormErrorMessage fontSize="sm">
                      {errors.firstName?.message}
                    </FormErrorMessage>
                  </FormControl>
                  <FormControl isRequired isInvalid={!!errors.lastName}>
                    <FormLabel htmlFor="lastName" fontSize="sm">
                      {t('LabelLastName', 'Last name')}
                    </FormLabel>
                    <Input
                      id="lastName"
                      placeholder={t('LabelLastName', 'Last name')}
                      {...register('lastName', { required: true })}
                      isDisabled={!!fixedValues?.lastName}
                      focusBorderColor="brand.500"
                    />
                    <FormErrorMessage fontSize="sm">
                      {errors.lastName?.message}
                    </FormErrorMessage>
                  </FormControl>
                </HStack>

                <HStack>
                  <FormControl isRequired isInvalid={!!errors.email}>
                    <FormLabel htmlFor="email" fontSize="sm">
                      {t('LabelEmail', 'Email')}
                    </FormLabel>
                    <Input
                      id="email"
                      placeholder="john.doe@example.com"
                      type="email"
                      {...register('email', { required: true })}
                      isDisabled={!!fixedValues?.email}
                      focusBorderColor="brand.500"
                    />
                    <FormErrorMessage fontSize="sm">
                      {errors.email?.message}
                    </FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.phone}>
                    <FormLabel htmlFor="phone" fontSize="sm">
                      {t('LabelPhone', 'Phone')}
                    </FormLabel>
                    <Input
                      id="phone"
                      placeholder="+43 660 000 0000"
                      type="tel"
                      {...register('phone')}
                      isDisabled={!!fixedValues?.phone}
                      focusBorderColor="brand.500"
                    />
                    <FormErrorMessage fontSize="sm">
                      {errors.phone?.toString()}
                    </FormErrorMessage>
                  </FormControl>
                </HStack>

                <HStack>
                  <FormControl isInvalid={!!errors.flightNumber}>
                    <FormLabel htmlFor="flightNumber" fontSize="sm">
                      {t('LabelFlightNumber', 'Flight number')}
                    </FormLabel>
                    <Input
                      id="flightNumber"
                      placeholder="e.g. OS123"
                      {...register('flightNumber')}
                      focusBorderColor="brand.500"
                    />
                    <FormErrorMessage fontSize="sm">
                      {errors.flightNumber?.toString()}
                    </FormErrorMessage>
                  </FormControl>
                </HStack>

                <FormControl isRequired isInvalid={!!errors.message}>
                  <FormLabel htmlFor="message" fontSize="sm">
                    {t('LabelWishes', 'Wishes')}
                  </FormLabel>
                  <Textarea
                    id="message"
                    placeholder={t('WishesPlaceholder', 'Wishes or note')}
                    defaultValue={defaultValues?.message}
                    {...register('message', { required: true })}
                    focusBorderColor="brand.500"
                  />
                  <FormErrorMessage fontSize="sm">
                    {errors.message?.message}
                  </FormErrorMessage>
                </FormControl>

                <FormControl isRequired isInvalid={!!errors.agreeToTerms}>
                  <Controller
                    name="agreeToTerms"
                    control={control}
                    rules={{
                      required: t(
                        'ConsentError',
                        'Please confirm the contact permission'
                      )
                    }}
                    render={({ field }) => (
                      <CheckboxStyled
                        ref={field.ref}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                        checked={field.value}
                        roundedFull
                      >
                        <Text color="black" fontSize={{ base: 'xs', md: 'sm' }}>
                          {t(
                            'ConsentText',
                            'I agree that my details may be stored for contacting me and for follow-up questions.'
                          )}
                        </Text>
                      </CheckboxStyled>
                    )}
                  />
                  <FormErrorMessage fontSize="sm">
                    {errors.agreeToTerms?.message}
                  </FormErrorMessage>
                </FormControl>
              </Stack>
            </Stack>
          </ModalBody>

          <ModalFooter borderTop="1px solid" color="gray.2 00">
            <Button isLoading={isSubmitting} type="submit">
              {t('SubmitCta', 'Reserve')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
