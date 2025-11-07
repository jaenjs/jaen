import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Container as ChakraContainer,
  Checkbox,
  CloseButton,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Stack,
  Text,
  Badge,
  VisuallyHidden,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Control, Controller, SubmitHandler, useForm } from 'react-hook-form';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import { Container, Engine } from 'tsparticles-engine';
import { Link } from 'gatsby-plugin-jaen';
import { FaArrowLeft } from '@react-icons/all-files/fa/FaArrowLeft';
import { PageConfig, PageProps } from 'jaen';
import { FiUpload } from '@react-icons/all-files/fi/FiUpload';
import { FiTrash2 } from '@react-icons/all-files/fi/FiTrash2';
import Logo from '../components/Logo';

const Page: React.FC<PageProps> = () => {
  const [alert, setAlert] = useState<{
    status: 'error' | 'success' | 'info';
    message: string | JSX.Element;
    description?: string;
  } | null>(null);

  const resetAlert = () => setAlert(null);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    await console.log(container);
  }, []);

  return (
    <Box pos="relative" id="coco" layerStyle="limosen.page">
      <Particles
        id="tsparticles"
        init={particlesInit}
        loaded={particlesLoaded}
        options={{
          fullScreen: true,
          background: { color: { value: '#1b1b1b' } }, // LIMOSEN dark canvas
          fpsLimit: 120,
          interactivity: {
            events: {
              onClick: { enable: true, mode: 'push' },
              onHover: { enable: true, mode: 'repulse' },
              resize: true
            },
            modes: { push: { quantity: 4 }, repulse: { distance: 200, duration: 0.4 } }
          },
          particles: {
            color: { value: '#d4af37' },       // brand gold
            links: {
              color: '#d4af37',                // brand gold
              distance: 150,
              enable: true,
              opacity: 0.35,
              width: 1
            },
            move: {
              direction: 'none',
              enable: true,
              outModes: { default: 'bounce' },
              random: false,
              speed: 0.8,
              straight: false
            },
            number: { density: { enable: true, area: 800 }, value: 70 },
            opacity: { value: 0.4 },
            shape: { type: 'circle' },
            size: { value: { min: 1, max: 4 } }
          },
          detectRetina: true
        }}
      />
      <Box pos="relative">
        <ChakraContainer maxW="3xl" py={{ base: '6', md: '12' }} px={{ base: '4', sm: '8' }}>
          <Stack spacing="8">
            <Stack spacing="6" align="center">
              <Link as={Button} leftIcon={<FaArrowLeft />} to="/">
                Zurück zur Webseite
              </Link>
              {/* Logo wurde von hier entfernt */}
              <Stack spacing={{ base: '2', md: '3' }} textAlign="center">
                <Heading size={{ base: 'sm', md: 'md' }} color="white">
                  Als Partner-Fahrer registrieren
                </Heading>
                <Text color="white">
                  Schon registriert? <Link to="/login">Anmelden</Link>
                </Text>
              </Stack>
            </Stack>

            {alert && (
              <Alert status={alert.status}>
                <AlertIcon />
                <Box w="full">
                  <AlertTitle>{alert.message}</AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </Box>
                <CloseButton
                  alignSelf="flex-start"
                  position="relative"
                  right={-1}
                  top={-1}
                  onClick={resetAlert}
                />
              </Alert>
            )}

            {/* Weißer Formular-Container auf dunklem Hintergrund */}
            <Box
              py={{ base: '2', sm: '8' }}
              px={{ base: '4', sm: '10' }}
              bg="white"
              color="black"
              boxShadow="md"
              borderRadius="xl"
            >
              <DriverSignupForm
                welcomeText={
                  // normale Schrift im weißen Container
                  `Willkommen bei LIMOSEN!\n\n` +
                  `Registriere dich als Partner-Fahrer und lade deine Dokumente sicher hoch.`
                }
                onSuccess={() =>
                  setAlert({
                    status: 'success',
                    message: 'Registrierung übermittelt.',
                    description: 'Wir prüfen deine Angaben und melden uns zeitnah.'
                  })
                }
                onError={(msg) =>
                  setAlert({
                    status: 'error',
                    message: 'Übermittlung fehlgeschlagen.',
                    description: msg ?? 'Bitte versuche es erneut.'
                  })
                }
              />
            </Box>

            {/* Logo hier unten eingefügt (Position des früheren Jaen-Logos) */}
            <Logo />
          </Stack>
        </ChakraContainer>
      </Box>
    </Box>
  );
};

/** ------------ Driver Signup Form ------------ */

interface DriverSignupFormProps {
  welcomeText: string;
  onSuccess?: () => void;
  onError?: (message?: string) => void;
}

type FileLike = File | null | undefined;

interface DriverSignupData {
  details: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  docs: {
    // Pflicht
    ecard: FileLike;              // E-Card
    registrationForm: FileLike;   // Meldezettel
    drivingFront: FileLike;       // Führerschein Vorderseite
    drivingBack: FileLike;        // Führerschein Rückseite
    criminalRecord: FileLike;     // Leumundszeugnis / Strafregisterauszug
    // Optional
    idCard: FileLike;             // Personalausweis
    residencePermit: FileLike;    // Aufenthaltstitel
    passport: FileLike;           // Reisepass
    taxiFront: FileLike;          // Taxischein Vorderseite
    taxiBack: FileLike;           // Taxischein Rückseite
  };
  terms: boolean;
}

enum DriverStep {
  Details,
  RequiredDocs,
  OptionalDocs,
  Terms // hier wird direkt abgesendet
}

const ACCEPTED = '.pdf,.jpg,.jpeg,.png';

const DriverSignupForm: React.FC<DriverSignupFormProps> = ({ welcomeText, onSuccess, onError }) => {
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    formState: { errors, isSubmitting, isSubmitted, isSubmitSuccessful },
    getValues,
    reset,
    trigger
  } = useForm<DriverSignupData>({
    defaultValues: {
      details: { firstName: '', lastName: '', email: '', phone: '' },
      terms: false
    }
  });

  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [step, setStep] = useState<DriverStep>(DriverStep.Details);

  const timer = useRef<NodeJS.Timeout>();

  const completeTypewriterAnimation = () => {
    setDisplayText(welcomeText);
    clearTimeout(timer.current);
    setShowInput(true);
  };

  useEffect(() => {
    if (currentIndex < welcomeText.length) {
      timer.current = setTimeout(() => {
        setDisplayText(prev => prev + welcomeText[currentIndex]);
        setCurrentIndex(currentIndex + 1);
      }, 20);
      return () => clearTimeout(timer.current);
    } else {
      completeTypewriterAnimation();
    }
  }, [currentIndex, welcomeText]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') completeTypewriterAnimation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (step === DriverStep.Details) setFocus('details.firstName');
  }, [step, setFocus]);

  useEffect(() => {
    const submitted = getValues();
    if (isSubmitSuccessful) {
      reset({ ...submitted });
    }
  }, [isSubmitSuccessful, reset, getValues]);

  // --- Step-wise validation ---
  const detailFields = [
    'details.firstName',
    'details.lastName',
    'details.email',
    'details.phone',
  ] as const;

  const requiredDocFields = [
    'docs.ecard',
    'docs.registrationForm',
    'docs.drivingFront',
    'docs.drivingBack',
    'docs.criminalRecord',
  ] as const;

  const onNext = async () => {
    if (step === DriverStep.Details) {
      const ok = await trigger(detailFields as any, { shouldFocus: true });
      if (ok) setStep(DriverStep.RequiredDocs);
      return;
    }
    if (step === DriverStep.RequiredDocs) {
      const ok = await trigger(requiredDocFields as any, { shouldFocus: true });
      if (ok) setStep(DriverStep.OptionalDocs);
      return;
    }
    if (step === DriverStep.OptionalDocs) {
      // optionaler Schritt – keine Pflichtvalidierung
      setStep(DriverStep.Terms);
      return;
    }
  };

  const onBack = () => {
    if (step === DriverStep.RequiredDocs) setStep(DriverStep.Details);
    else if (step === DriverStep.OptionalDocs) setStep(DriverStep.RequiredDocs);
    else if (step === DriverStep.Terms) setStep(DriverStep.OptionalDocs);
  };

  const onSubmit: SubmitHandler<DriverSignupData> = async (data) => {
    try {
      // Multipart payload
      const formData = new FormData();
      formData.append('firstName', data.details.firstName);
      formData.append('lastName', data.details.lastName);
      formData.append('email', data.details.email);
      formData.append('phone', data.details.phone);

      // Pflicht
      if (data.docs.ecard) formData.append('ecard', data.docs.ecard);
      if (data.docs.registrationForm) formData.append('registrationForm', data.docs.registrationForm);
      if (data.docs.drivingFront) formData.append('drivingFront', data.docs.drivingFront);
      if (data.docs.drivingBack) formData.append('drivingBack', data.docs.drivingBack);
      if (data.docs.criminalRecord) formData.append('criminalRecord', data.docs.criminalRecord);

      // Optional
      if (data.docs.idCard) formData.append('idCard', data.docs.idCard);
      if (data.docs.residencePermit) formData.append('residencePermit', data.docs.residencePermit);
      if (data.docs.passport) formData.append('passport', data.docs.passport);
      if (data.docs.taxiFront) formData.append('taxiFront', data.docs.taxiFront);
      if (data.docs.taxiBack) formData.append('taxiBack', data.docs.taxiBack);

      formData.append('terms', data.terms ? 'true' : 'false');

      const res = await fetch('/api/driver-signup', { method: 'POST', body: formData });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Serverfehler');
      }
      onSuccess?.();
    } catch (e: any) {
      onError?.(e?.message);
    }
  };

  return (
    <Stack spacing="4">
      {/* Normale Schrift im weißen Container */}
      <Text whiteSpace="pre-wrap" fontSize="md" color="black">
        {displayText}
      </Text>

      {showInput && (
        <Stack as="form" noValidate onSubmit={handleSubmit(onSubmit)} spacing={6} color="black">
          {/* Step 1: Details */}
          <Stack display={step >= DriverStep.Details ? 'flex' : 'none'} spacing={4}>
            <Heading size="sm">Kontakt</Heading>
            <HStack>
              <FormControl isInvalid={!!errors.details?.firstName} isRequired>
                <FormLabel>Vorname</FormLabel>
                <Input
                  {...register('details.firstName', { required: 'Vorname ist erforderlich' })}
                />
                <FormErrorMessage>{errors.details?.firstName?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.details?.lastName} isRequired>
                <FormLabel>Nachname</FormLabel>
                <Input
                  {...register('details.lastName', { required: 'Nachname ist erforderlich' })}
                />
                <FormErrorMessage>{errors.details?.lastName?.message}</FormErrorMessage>
              </FormControl>
            </HStack>

            <HStack>
              <FormControl isInvalid={!!errors.details?.email} isRequired>
                <FormLabel>E-Mail</FormLabel>
                <Input
                  type="email"
                  {...register('details.email', {
                    required: 'E-Mail ist erforderlich',
                    pattern: { value: /^\S+@\S+$/, message: 'Bitte gültige E-Mail angeben' }
                  })}
                />
                <FormErrorMessage>{errors.details?.email?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.details?.phone} isRequired>
                <FormLabel>Handynummer</FormLabel>
                <Input
                  type="tel"
                  placeholder="+43 ..."
                  {...register('details.phone', {
                    required: 'Handynummer ist erforderlich',
                    minLength: { value: 6, message: 'Bitte gültige Nummer' }
                  })}
                />
                <FormErrorMessage>{errors.details?.phone?.message}</FormErrorMessage>
              </FormControl>
            </HStack>

            {step === DriverStep.Details && (
              <HStack justify="flex-end">
                <Button type="button" onClick={onNext}>
                  Weiter
                </Button>
              </HStack>
            )}
          </Stack>

          {/* Step 2: Pflicht-Dokumente */}
          <Stack display={step >= DriverStep.RequiredDocs ? 'flex' : 'none'} spacing={4}>
            <Heading size="sm">Pflicht-Dokumente</Heading>
            <FileField
              control={control}
              name="docs.ecard"
              label="E-Card"
              accept={ACCEPTED}
              isRequired
              error={errors.docs?.ecard as any}
            />
            <FileField
              control={control}
              name="docs.registrationForm"
              label="Meldezettel"
              accept={ACCEPTED}
              isRequired
              error={errors.docs?.registrationForm as any}
            />
            {/* ▼▼ Responsive: Vorder-/Rückseite untereinander auf Mobile */}
            <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
              <FileField
                control={control}
                name="docs.drivingFront"
                label="Führerschein Vorderseite"
                accept={ACCEPTED}
                isRequired
                error={errors.docs?.drivingFront as any}
              />
              <FileField
                control={control}
                name="docs.drivingBack"
                label="Führerschein Rückseite"
                accept={ACCEPTED}
                isRequired
                error={errors.docs?.drivingBack as any}
              />
            </Stack>
            {/* ▲▲ */}
            <FileField
              control={control}
              name="docs.criminalRecord"
              label="Leumundszeugnis / Strafregisterauszug"
              accept={ACCEPTED}
              isRequired
              error={errors.docs?.criminalRecord as any}
            />
            {step === DriverStep.RequiredDocs && (
              <HStack justify="space-between">
                <Button variant="ghost" onClick={onBack}>
                  Zurück
                </Button>
                <Button type="button" onClick={onNext}>
                  Weiter
                </Button>
              </HStack>
            )}
          </Stack>

          {/* Step 3: Optionale Dokumente */}
          <Stack display={step >= DriverStep.OptionalDocs ? 'flex' : 'none'} spacing={4}>
            <Heading size="sm">Optionale Dokumente</Heading>
            <FileField
              control={control}
              name="docs.idCard"
              label="Personalausweis"
              accept={ACCEPTED}
              error={errors.docs?.idCard as any}
            />
            <FileField
              control={control}
              name="docs.residencePermit"
              label="Aufenthaltstitel"
              accept={ACCEPTED}
              error={errors.docs?.residencePermit as any}
            />
            <FileField
              control={control}
              name="docs.passport"
              label="Reisepass"
              accept={ACCEPTED}
              error={errors.docs?.passport as any}
            />
            {/* ▼▼ Responsive: Vorder-/Rückseite untereinander auf Mobile */}
            <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
              <FileField
                control={control}
                name="docs.taxiFront"
                label="Taxischein Vorderseite"
                accept={ACCEPTED}
                error={errors.docs?.taxiFront as any}
              />
              <FileField
                control={control}
                name="docs.taxiBack"
                label="Taxischein Rückseite"
                accept={ACCEPTED}
                error={errors.docs?.taxiBack as any}
              />
            </Stack>
            {/* ▲▲ */}

            {step === DriverStep.OptionalDocs && (
              <HStack justify="space-between">
                <Button variant="ghost" onClick={onBack}>
                  Zurück
                </Button>
                <Button type="button" onClick={onNext}>
                  Weiter
                </Button>
              </HStack>
            )}
          </Stack>

          {/* Step 4: Bedingungen – hier wird direkt abgesendet */}
          <Stack display={step >= DriverStep.Terms ? 'flex' : 'none'} spacing={4}>
            <Heading size="sm">Bedingungen</Heading>
            <FormControl isInvalid={!!errors.terms} isRequired>
              <Controller
                control={control}
                name="terms"
                rules={{ required: 'Bitte akzeptiere die Bedingungen' }}
                render={({ field }) => (
                  <Checkbox
                    isChecked={!!field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  >
                    Ich akzeptiere die AGB und die Verarbeitung meiner Daten gemäß Datenschutz.
                  </Checkbox>
                )}
              />
              <FormErrorMessage>{(errors.terms as any)?.message}</FormErrorMessage>
            </FormControl>

            <HStack justify="space-between">
              <Button variant="ghost" onClick={onBack}>
                Zurück
              </Button>
              <Button type="submit" isLoading={isSubmitting} isDisabled={isSubmitted}>
                Registrierung absenden
              </Button>
            </HStack>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};

/** File input helper – Chakra-styled “Datei wählen” */
interface FileFieldProps {
  control: Control<any>;
  name:
    | 'docs.ecard'
    | 'docs.registrationForm'
    | 'docs.drivingFront'
    | 'docs.drivingBack'
    | 'docs.criminalRecord'
    | 'docs.idCard'
    | 'docs.residencePermit'
    | 'docs.passport'
    | 'docs.taxiFront'
    | 'docs.taxiBack';
  label: string;
  accept?: string;
  isRequired?: boolean;
  error?: { message?: string };
}

const FileField: React.FC<FileFieldProps> = ({ control, name, label, accept, isRequired, error }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <FormControl isInvalid={!!error} isRequired={isRequired}>
      <FormLabel>{label}</FormLabel>
      <Controller
        control={control}
        name={name}
        rules={isRequired ? { required: 'Bitte Datei hochladen' } : undefined}
        render={({ field: { onChange, value } }) => (
          <HStack align="center" spacing={3}>
            <VisuallyHidden>
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={(e) => onChange(e.target.files?.[0] ?? null)}
              />
            </VisuallyHidden>

            <Button
              leftIcon={<FiUpload />}
              onClick={() => inputRef.current?.click()}
              variant="outline"
            >
              Datei wählen
            </Button>

            <Text flex="1" noOfLines={1}>
              {value ? (
                <>
                  <Badge mr={2}>gewählt</Badge>
                  {(value as File).name}
                </>
              ) : (
                <Text as="span" opacity={0.6}>
                  Keine Datei ausgewählt
                </Text>
              )}
            </Text>

            {value && (
              <IconButton
                aria-label="Auswahl entfernen"
                icon={<FiTrash2 />}
                variant="ghost"
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = '';
                  onChange(null);
                }}
              />
            )}
          </HStack>
        )}
      />
      <FormErrorMessage>{error?.message}</FormErrorMessage>
    </FormControl>
  );
};

export default Page;

export const pageConfig: PageConfig = {
  label: 'Signup',
  withoutJaenFrame: true,
  layout: { name: 'jaen', type: 'full' }
};

export { Head } from 'jaen';
