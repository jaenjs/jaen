import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  AspectRatio,
  Box,
  BoxProps,
  Button,
  Container,
  Divider,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  Image,
  LinkBox,
  LinkOverlay,
  List,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
  Wrap,
  WrapItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  chakra,
  useBreakpointValue
} from '@chakra-ui/react';
import { Field, useAuth } from 'jaen';
import { ChevronDownIcon } from '@chakra-ui/icons';
import {
  FaEnvelopeOpen,
  FaEnvelopeOpenText,
  FaFacebookF,
  FaInstagram,
  FaPhone,
  FaSuitcaseRolling,
  FaTwitter,
  FaUser,
  FaWhatsapp
} from 'react-icons/fa';
import { GatsbyImage, IGatsbyImageData } from 'gatsby-plugin-image';
import { graphql, useStaticQuery } from 'gatsby';
import Marquee from 'react-fast-marquee';
import { Link } from 'gatsby-plugin-jaen';
import Logo from '../gatsby-plugin-jaen/components/Logo';
import {
  ABOUT_IMAGE,
  BOOKING_BACKGROUND,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_TEL,
  FLAG_DE,
  FLAG_EN,
  FLAG_TR,
  FLAG_AR,
  HERO_SLIDES,
  SOCIAL_LINKS,
  SERVICE_NAVIGATION_EVENT,
  GOOGLE_MAPS_EMBED,
  GOOGLE_MAPS_OPEN
} from '../vars/limosen';
import { useContactModal } from '../services/contact';
import { useBookingModal } from '../services/booking';
import { useIntl } from 'react-intl';
import ChakraLanguageSwitcher from './ChakraLanguageSwitcher';

function emitServiceNavigation(target: string) {
  if (typeof window === 'undefined' || !target) return;
  const targetId = target.replace(/^#/, '');
  window.dispatchEvent(
    new CustomEvent(SERVICE_NAVIGATION_EVENT, { detail: targetId })
  );
}
function handleServiceLinkClick(event: React.MouseEvent, targetHref?: string) {
  if (!targetHref || !targetHref.startsWith('#')) return;
  event?.preventDefault();
  emitServiceNavigation(targetHref);
}

export type THamburgerMenuIconStylerProps = BoxProps;
interface IHamburgerMenuIconProps {
  handleClick?: (isOpen: boolean) => void;
  wrapperProps?: BoxProps;
  iconProps?: BoxProps;
}
const HamburgerMenuIcon: FC<IHamburgerMenuIconProps> = ({
  handleClick,
  wrapperProps,
  iconProps
}) => {
  const props = {
    __css: {
      '&.open': {
        '& > div:nth-of-type(1)': { top: '50%', transform: 'rotate(45deg)' },
        '& > div:nth-of-type(2)': { opacity: 0 },
        '& > div:nth-of-type(3)': { top: '50%', transform: 'rotate(-45deg)' }
      },
      '& > div': {
        transition:
          'transform 0.2s cubic-bezier(0.68, 0, 0.27, 1), opacity 0.2s cubic-bezier(0.68, 0, 0.27, 1), top 0.2s cubic-bezier(0.68, 0, 0.27, 1), background-color 0.2s cubic-bezier(0.68, 0, 0.27, 1)'
      },
      ...wrapperProps?.__css
    },
    ...wrapperProps
  };
  return (
    <Box
      position="relative"
      rounded="full"
      boxSize="100%"
      onClick={handleClick}
      {...props}
    >
      <Box
        position="absolute"
        top="34%"
        left="25%"
        w="50%"
        h="4%"
        backgroundColor="limosen.border.subtle"
        borderRadius="full"
        {...iconProps}
      />
      <Box
        position="absolute"
        top="49%"
        left="25%"
        w="50%"
        h="4%"
        backgroundColor="limosen.border.subtle"
        borderRadius="full"
        {...iconProps}
      />
      <Box
        position="absolute"
        top="64%"
        left="25%"
        w="50%"
        h="4%"
        backgroundColor="limosen.border.subtle"
        borderRadius="full"
        {...iconProps}
      />
    </Box>
  );
};

function useServiceAccordionNavigation(serviceIds: string[]) {
  const idToIndex = useMemo(() => {
    const mapping: Record<string, number> = {};
    serviceIds.forEach((id, index) => {
      mapping[id] = index;
    });
    return mapping;
  }, [serviceIds]);

  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);
  const pendingScrollIdRef = useRef<string | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const scrollToService = useCallback((id: string) => {
    if (typeof window === 'undefined') return;
    const el = btnRefs.current[id] ?? document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  const openServiceById = useCallback(
    (targetId: string) => {
      if (!targetId || !(targetId in idToIndex)) return;
      const index = idToIndex[targetId];
      pendingScrollIdRef.current = targetId;
      setExpandedIndices([index]);
    },
    [idToIndex]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      openServiceById(hash);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [openServiceById]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    const handleNavigation = (event: Event) => {
      const anyEvent = event as CustomEvent<string>;
      const targetId =
        typeof anyEvent.detail === 'string' ? anyEvent.detail : '';
      if (!targetId) return;
      openServiceById(targetId);
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash !== targetId)
        window.history?.pushState?.(null, '', `#${targetId}`);
    };
    window.addEventListener(
      SERVICE_NAVIGATION_EVENT,
      handleNavigation as EventListener
    );
    return () =>
      window.removeEventListener(
        SERVICE_NAVIGATION_EVENT,
        handleNavigation as EventListener
      );
  }, [openServiceById]);

  useEffect(() => {
    if (!pendingScrollIdRef.current) return;
    const targetId = pendingScrollIdRef.current;
    pendingScrollIdRef.current = null;
    scrollToService(targetId);
  }, [expandedIndices, scrollToService]);

  const handleAccordionChange = useCallback((value: number[] | number) => {
    if (Array.isArray(value)) setExpandedIndices(value);
    else if (typeof value === 'number') setExpandedIndices([value]);
    else setExpandedIndices([]);
  }, []);

  return { expandedIndices, handleAccordionChange, btnRefs };
}

/** *****************************************************************
 * Helper: resolve local /images/* URL paths to GatsbyImage data
 * (files are under ../../static/images/ per user; we query all files
 * beneath /static/images and map by path suffix to the URL format).
 ****************************************************************** */
function useImageLookup() {
  const data = useStaticQuery(graphql`
    query LocalImagesForThisFile {
      allFile(filter: { absolutePath: { regex: "/static/images/" } }) {
        nodes {
          absolutePath
          relativePath
          name
          extension
          childImageSharp {
            gatsbyImageData(
              placeholder: BLURRED
              formats: [AUTO, WEBP, AVIF]
              layout: FULL_WIDTH
            )
          }
        }
      }
    }
  `) as {
    allFile: {
      nodes: Array<{
        absolutePath: string;
        relativePath: string;
        name: string;
        extension: string;
        childImageSharp?: { gatsbyImageData: IGatsbyImageData };
      }>;
    };
  };

  // Build a lookup that tolerates "/images/..." or just ".../filename.ext"
  const map = useMemo(() => {
    const m = new Map<string, IGatsbyImageData>();
    data.allFile.nodes.forEach(n => {
      const rel = n.relativePath.replace(/\\/g, '/'); // normalize
      const lowerRel = rel.toLowerCase();
      const afterImages = lowerRel.includes('images/')
        ? lowerRel.substring(lowerRel.lastIndexOf('images/'))
        : lowerRel;
      const filename = lowerRel.substring(lowerRel.lastIndexOf('/') + 1);

      const img = n.childImageSharp?.gatsbyImageData;
      if (!img) return;

      // Keys
      m.set(lowerRel, img);
      m.set('/' + lowerRel, img);
      m.set(afterImages, img);
      m.set('/' + afterImages, img);
      m.set(filename, img);
    });
    return m;
  }, [data]);

  const get = useCallback(
    (urlPath: string | undefined | null): IGatsbyImageData | null => {
      if (!urlPath) return null;
      const lower = urlPath.replace(/\\/g, '/').toLowerCase().replace(/^\/+/, '');
      // try several keys/suffix matches
      const direct =
        map.get(lower) ||
        map.get('/' + lower) ||
        map.get(lower.startsWith('images/') ? lower : `images/${lower}`) ||
        map.get('/' + (lower.startsWith('images/') ? lower : `images/${lower}`)) ||
        map.get(lower.substring(lower.lastIndexOf('/') + 1));
      if (direct) return direct;

      // suffix scan (fallback)
      for (const [k, v] of map) {
        if (k.endsWith(lower)) return v;
      }
      return null;
    },
    [map]
  );

  return get;
}

/** ***********************
 * Clients Marquee Section
 **************************/
interface Client {
  href: string;
  name: string;
  logo: string; // root-relative path like /images/...
}
const clients: Client[] = [
  {
    href: 'https://www.heinhotel.at/',
    name: 'Heinhotel',
    logo: '/images/clients/Heinhotel_logo.png'
  },
  {
    href: 'https://www.dasreinisch.at/',
    name: 'das Reinisch',
    logo: '/images/clients/das_Reinisch _logo.png'
  },
  // {
  //   href: 'https://www.citypension.at/',
  //   name: 'City Pension',
  //   logo: '/images/clients/citypension.png'
  // }
];

interface ClientsMarqueeProps extends BoxProps {}
const ClientsMarquee: FC<ClientsMarqueeProps> = ({ ...props }) => {
  const intl = useIntl();
  const isRtl = (intl.locale || '').toLowerCase().startsWith('ar');
  const imageFromPath = useImageLookup();

  // wide ratio + fixed height 150px; width is calculated (ratio * height)
  const ratio = 3;
  const heightPx = 100;

  return (
    <Box
      as="section"
      bg="white"
      borderTop="1px solid"
      borderBottom="1px solid"
      borderColor="limosen.border.faint"
      h="120px"
      py={{ base: 4, md: 6 }}
      dir="ltr"
      sx={{
        '&, & *': { direction: 'ltr !important' }
      }}
      {...props}
    >
      <Marquee
        gradient={false}
        speed={60}
        direction={isRtl ? 'right' : 'left'}
        style={{ lineHeight: 0, direction: 'ltr' }}
      >
        <Box display="flex" gridGap="32px">
          {clients.map((client, index) => {
            const gimg = imageFromPath(client.logo);
            return (
              <LinkBox
                key={index}
                display="flex"
                alignItems="center"
                justifyContent="center"
                px="16px"
                sx={{
                  '& img, .gatsby-image-wrapper, .gatsby-image-wrapper img': {
                    width: '100% !important',
                    height: '100% !important',
                    maxWidth: 'none !important',
                    maxHeight: 'none !important',
                    objectFit: 'contain !important',
                    objectPosition: 'center !important',
                    display: 'block !important',
                    inset: '0 !important'
                  }
                }}
              >
                <LinkOverlay href={client.href} isExternal aria-label={client.name}>
                  <AspectRatio
                    ratio={ratio}
                    h={`${heightPx}px`}
                    w={`calc(${heightPx}px * ${ratio})`}
                    bg="white"
                    overflow="hidden"
                  >
                    {gimg ? (
                      <GatsbyImage
                        image={gimg}
                        alt={client.name}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%' }}
                        imgStyle={{
                          objectFit: 'contain',
                          objectPosition: 'center'
                        }}
                      />
                    ) : (
                      // Fallback if a file wasn't resolved (kept optimized attrs)
                      <Image
                        src={client.logo}
                        alt={client.name}
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        sizes="(min-width: 768px) 450px, 169px"
                        htmlWidth={ratio * heightPx}
                        htmlHeight={heightPx}
                        style={{
                          width: '100%',
                          height: '100%',
                          maxWidth: 'none',
                          maxHeight: 'none',
                          objectFit: 'contain',
                          objectPosition: 'center',
                          display: 'block'
                        }}
                      />
                    )}
                  </AspectRatio>
                </LinkOverlay>
              </LinkBox>
            );
          })}
        </Box>
      </Marquee>
    </Box>
  );
};

/** *********************/
export default function Content({ language }: { language: string }) {
  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex(index => (index + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);
  const intl = useIntl();

  // 'de' | 'en' | 'tr' | 'ar' for flag display and direction
  const normalized = useMemo<'de' | 'en' | 'tr' | 'ar'>(() => {
    const l = (intl.locale || '').toLowerCase();
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('tr')) return 'tr';
    if (l.startsWith('ar')) return 'ar'; // ar-EG will match here
    return 'en';
  }, [intl.locale]);
  const isRtl = normalized === 'ar';

  return (
    <Box
      minH="100vh"
      bg="limosen.bg.canvas"
      color="limosen.text.primary"
      display="flex"
      flexDirection="column"
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={intl.locale}
    >
      <Box
        as="main"
        flex="1"
        display="flex"
        flexDirection="column"
        gap={0}
        className="homepage"
      >
        <HeroSection background={HERO_SLIDES[slideIndex] as any} />
        {/* New marquee band between Hero and About */}
        <ClientsMarquee />
        <AboutSection />
        <FleetSection />
        <ServicesSection />
        <ReviewsSection />
        <FAQSection />
        <OnlineBookingSection />
      </Box>
    </Box>
  );
}

export function HeaderBar() {
  const { signinRedirect } = useAuth();
  return (
    <Box
      bg="limosen.bg.banner"
      py={2}
      className="header-bar"
      display={{ base: 'none', md: 'block' }}
    >
      <Container maxW="6xl">
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          gap={{ base: 2, md: 4 }}
        >
          <HStack spacing={3} className="header-bar__item">
            <Icon as={FaEnvelopeOpenText} color="limosen.accent" />
            <Link href={`mailto:${CONTACT_EMAIL}`} color="limosen.text.primary">
              {CONTACT_EMAIL}
            </Link>
          </HStack>

          <HStack spacing={3} className="header-bar__item">
            <Icon as={FaWhatsapp} color="limosen.accent" />
            <Link
              href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(
                CONTACT_PHONE
              )}`}
              color="limosen.text.primary"
            >
              {CONTACT_PHONE}
            </Link>
          </HStack>

          <HStack spacing={3} ml={{ base: 0, md: 'auto' }}>
            {SOCIAL_LINKS.map(({ label, href, icon: IconComponent }) => (
              <IconButton
                key={label}
                as={Link}
                href={href}
                aria-label={label}
                icon={<IconComponent />}
                isRound
                size="sm"
                variant="ghost"
                isExternal
                color="limosen.text.primary"
                _hover={{ bg: 'whiteAlpha.200', color: 'limosen.accent' }}
              />
            ))}
            <Button
              size={'xs'}
              variant="limosen"
              onClick={() => void signinRedirect()}
            >
              Login
            </Button>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}

export function TopNavigation({ path }: { path?: string }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const langModal = useDisclosure();
  const { signinRedirect } = useAuth();
  const intl = useIntl();

  // 'de' | 'en' | 'tr' | 'ar' for flag display and direction
  const normalized = useMemo<'de' | 'en' | 'tr' | 'ar'>(() => {
    const l = (intl.locale || '').toLowerCase();
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('tr')) return 'tr';
    if (l.startsWith('ar')) return 'ar'; // ar-EG will match here
    return 'en';
  }, [intl.locale]);
  const isRtl = normalized === 'ar';

  const currentFlag =
    normalized === 'de'
      ? FLAG_DE
      : normalized === 'en'
      ? FLAG_EN
      : normalized === 'tr'
      ? FLAG_TR
      : FLAG_AR;

  const normalizeHash = useCallback((href: string) => {
    if (!href?.startsWith('#')) return href;
    if (href === '#fahrzeuge') return '#fleet';
    if (href === '#rezensionen') return '#reviews';
    return href;
  }, []);

  const messageNavLinks = (intl.messages as any)?.navLinks as
    | Array<{ label: string; href: string }>
    | undefined;

  const navLinks = useMemo(
    () =>
      messageNavLinks?.map(l => ({ ...l, href: normalizeHash(l.href) })) ?? [
        { label: intl.formatMessage({ id: 'TopNavFleet' }), href: '#fleet' },
        {
          label: intl.formatMessage({ id: 'TopNavReviews' }),
          href: '#reviews'
        },
        { label: intl.formatMessage({ id: 'TopNavContact' }), href: '?contact' }
      ],
    [messageNavLinks, normalizeHash, intl]
  );

  const [menuActive, setMenuActive] = useState(false);
  const closeMenu = useCallback(() => {
    setMenuActive(false);
    onClose();
  }, [onClose]);
  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
    } else {
      setMenuActive(true);
      onOpen();
    }
  };
  const handleNavLinkClick = useCallback(() => {
    if (isOpen) closeMenu();
  }, [isOpen, closeMenu]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMenuActive(false);
        onClose();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onClose]);

  const normalizePath = (p: string) => {
    const trimmed = p.split('#')[0].trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '') || '/';
  };
  const currentPath = useMemo(() => normalizePath(path || ''), [path]);

  const linkPathname = (href: string) => {
    try {
      const u = new URL(href);
      return normalizePath(u.pathname || '/');
    } catch {
      return normalizePath(href);
    }
  };

  const contactModal = useContactModal();
  const handleOnContactClick = () => {
    contactModal.onOpen({ meta: {} });
  };
  const bookingModal = useBookingModal();
  const handleOnBookingClick = () => {
    bookingModal.onOpen({ meta: {} });
  };

  const labelVehicleFleet = intl.formatMessage({ id: 'TopNavFleet' });
  const labelReviews = intl.formatMessage({ id: 'TopNavReviews' });
  const labelBookNow = intl.formatMessage({ id: 'TopNavBookNow' });
  const labelContact = intl.formatMessage({ id: 'TopNavContact' });
  const labelFollowUs = intl.formatMessage({ id: 'TopNavFollowUs' });
  const labelAlwaysReachable = intl.formatMessage({
    id: 'TopNavAlwaysReachable'
  });
  const labelCityCountry = intl.formatMessage({ id: 'TopNavCityCountry' });
  const labelAccount = intl.formatMessage({ id: 'TopNavAccount' });
  const labelLanguage = intl.formatMessage({ id: 'TopNavLanguage' });
  const languageCodeDisplay = normalized.toUpperCase();

  return (
    <Box
      pos="relative"
      overflow="hidden"
      backgroundColor="limosen.bg.navTop"
      height={isOpen ? 'calc(100vh + 15px)' : { base: '12vh', md: '15vh' }}
      minH={isOpen ? '600px' : '100px'}
      transition="height 0.2s cubic-bezier(0.68, 0, 0.27, 1), min-height 0.2s cubic-bezier(0.68, 0, 0.27, 1)"
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={intl.locale}
    >
      <Box
        pos="relative"
        bg="limosen.bg.navTop"
        color="limosen.text.primary"
        transition="height 0.2s cubic-bezier(0.68, 0, 0.27, 1), min-height 0.2s cubic-bezier(0.68, 0, 0.27, 1)"
        height={isOpen ? 'max(600px, calc(100vh + 15px))' : '0'}
        minH={isOpen ? 'fit-content' : '0'}
        width="100%"
        overflow="hidden"
      >
        <Grid
          as={Container}
          maxW="6xl"
          minH="max(600px, calc(100vh + 15px))"
          templateRows={{
            base: 'auto repeat(7, 1fr)',
            md: 'auto repeat(3, 1fr)'
          }}
          templateColumns={{ base: '1fr', md: '1fr 1fr' }}
          templateAreas={{
            base: '"empty" "services" "team" "portfolio" "blog" "offices" "social"',
            md: '"empty empty" "services team" "portfolio blog" "offices social"'
          }}
          fontSize={{ base: 'xl', md: '2xl' }}
          h="full"
          w="full"
          gap={0}
        >
          <Box gridArea="empty" h={{ base: '12vh', md: '15vh' }} minH="100px" />
          <LinkBox
            gridArea="services"
            display="flex"
            alignItems="center"
            pl={{ base: 8, md: 16 }}
            borderWidth="1px"
            borderLeft="0"
            borderBottom="0"
            borderColor="limosen.border.faint"
            transition="color 0.2s"
            _hover={{ color: 'limosen.accent' }}
          >
            <LinkOverlay href="#fleet" onClick={handleNavLinkClick}>
              {labelVehicleFleet}
            </LinkOverlay>
          </LinkBox>
          <LinkBox
            gridArea="team"
            display="flex"
            alignItems="center"
            pl={{ base: 8, md: 16 }}
            borderWidth="1px"
            borderBottom="0"
            borderRight="0"
            borderLeft={{ base: '1px', md: '0' }}
            borderColor="limosen.border.faint"
            transition="color 0.2s"
            _hover={{ color: 'limosen.accent' }}
          >
            <LinkOverlay href="#reviews" onClick={handleNavLinkClick}>
              {labelReviews}
            </LinkOverlay>
          </LinkBox>
          <LinkBox
            gridArea="portfolio"
            display="flex"
            alignItems="center"
            pl={{ base: 8, md: 16 }}
            borderWidth="1px"
            borderLeft="0"
            borderBottom="0"
            borderColor="limosen.border.faint"
            transition="color 0.2s"
            _hover={{ color: 'limosen.accent' }}
          >
            {/* add href for crawlability, keep onClick for modal */}
            <LinkOverlay href="?booking" onClick={handleOnBookingClick}>
              {labelBookNow}
            </LinkOverlay>
          </LinkBox>
          <LinkBox
            gridArea="blog"
            display="flex"
            alignItems="center"
            pl={{ base: 8, md: 16 }}
            borderWidth="1px"
            borderBottom="1px"
            borderRight="0"
            borderLeft={{ base: '1px', md: '0' }}
            borderColor="limosen.border.faint"
            transition="color 0.2s"
            _hover={{ color: 'limosen.accent' }}
          >
            {/* add href for crawlability, keep onClick for modal */}
            <LinkOverlay href="?contact" onClick={handleOnContactClick}>
              {labelContact}
            </LinkOverlay>
          </LinkBox>

          {/* OFFICES */}
          <Box
            gridArea="offices"
            pt={{ base: 8 }}
            pl={{ base: 8, md: 16 }}
            borderWidth="1px"
            borderTop="1px"
            borderBottom="0"
            borderLeft="0"
            borderRight={{ base: '1px', md: '0' }}
            borderColor={{ base: 'transparent', md: 'limosen.border.faint' }}
            display={{ base: 'none', md: 'block' }}
          >
            <Flex justify="space-between" align="flex-start" gap={6}>
              <Box flex="1" minW={0}>
                <Text
                  color="limosen.text.primary"
                  fontWeight="bold"
                  fontSize="lg"
                  pb={2}
                >
                  {labelAlwaysReachable}
                </Text>
                <VStack
                  align="flex-start"
                  spacing={2}
                  color="limosen.text.secondary"
                  fontSize="md"
                >
                  <Link
                    href={`tel:${CONTACT_PHONE_TEL}`}
                    color="limosen.text.primary"
                    onClick={handleNavLinkClick}
                  >
                    {CONTACT_PHONE}
                  </Link>
                  <Link
                    href={`mailto:${CONTACT_EMAIL}`}
                    color="limosen.text.primary"
                    onClick={handleNavLinkClick}
                  >
                    {CONTACT_EMAIL}
                  </Link>
                  <Text color="limosen.text.muted">
                    {labelCityCountry}
                  </Text>
                </VStack>
              </Box>
            </Flex>
          </Box>

          {/* SOCIAL */}
          <Box
            gridArea="social"
            pt={{ base: 8 }}
            pl={{ base: 8, md: 16 }}
            borderWidth="1px"
            borderTop="0"
            borderBottom="0"
            borderRight="0"
            borderLeft="0"
            borderColor="limosen.border.faint"
          >
            {/* MOBILE */}
            <Grid
              display={{ base: 'grid', md: 'none' }}
              templateColumns="1fr auto"
              templateRows="auto auto"
              gap={6}
              alignItems="start"
            >
              <Box gridColumn="1" gridRow="1" minW={0}>
                <Text
                  color="limosen.text.primary"
                  fontWeight="bold"
                  fontSize="lg"
                  pb={2}
                >
                  {labelAlwaysReachable}
                </Text>
                <VStack
                  align="flex-start"
                  spacing={2}
                  color="limosen.text.secondary"
                  fontSize="md"
                >
                  <Link
                    href={`tel:${CONTACT_PHONE_TEL}`}
                    color="limosen.text.primary"
                    onClick={handleNavLinkClick}
                  >
                    {CONTACT_PHONE}
                  </Link>
                  <Link
                    href={`mailto:${CONTACT_EMAIL}`}
                    color="limosen.text.primary"
                    onClick={handleNavLinkClick}
                  >
                    {CONTACT_EMAIL}
                  </Link>
                  <Text color="limosen.text.muted">
                    {labelCityCountry}
                  </Text>
                </VStack>
              </Box>

              <Box gridColumn="2" gridRow="1" pr="32px">
                <VStack spacing={3} align="flex-start" minW="auto">
                  <Text
                    color="limosen.text.primary"
                    fontWeight="bold"
                    fontSize="lg"
                    mb={1}
                  >
                    {labelAccount}
                  </Text>
                  <Button
                    size="sm"
                    variant="limosen"
                    onClick={() => void signinRedirect()}
                  >
                    Login
                  </Button>
                </VStack>
              </Box>

              <Box gridColumn="1" gridRow="2" minW={0}>
                <Text
                  color="limosen.text.primary"
                  fontWeight="bold"
                  fontSize="lg"
                  mb={3}
                >
                  {intl.formatMessage({ id: 'TopNavFollowUs' })}
                </Text>
                <HStack spacing={6}>
                  {SOCIAL_LINKS.map(({ label, href, icon: IconComponent }) => (
                    <Link
                      key={label}
                      href={href}
                      isExternal
                      color="limosen.text.primary"
                      transition="color 0.2s"
                      _hover={{ color: 'limosen.accent' }}
                      onClick={handleNavLinkClick}
                      aria-label={label}
                    >
                      <Icon as={IconComponent} boxSize={6} />
                    </Link>
                  ))}
                </HStack>
              </Box>

              {/* LANGUAGE (mobile) */}
              <Box gridColumn="2" gridRow="2" pr="32px">
                <VStack spacing={3} align="flex-start" minW="auto">
                  <Text
                    color="limosen.text.primary"
                    fontWeight="bold"
                    fontSize="lg"
                    mb={0}
                  >
                    {labelLanguage}
                  </Text>
                  <Button
                    variant="ghost"
                    color="limosen.text.primary"
                    px={2}
                    rightIcon={<ChevronDownIcon color="limosen.text.primary" />}
                    _hover={{ bg: 'whiteAlpha.200' }}
                    onClick={langModal.onOpen}
                  >
                    <HStack spacing={2}>
                      <Image
                        src={currentFlag}
                        alt={labelLanguage}
                        width="24px"
                        height="24px"
                        objectFit="cover"
                      />
                      <Text fontWeight="semibold" color="limosen.text.primary">
                        {languageCodeDisplay}
                      </Text>
                    </HStack>
                  </Button>
                </VStack>
              </Box>
            </Grid>

            {/* DESKTOP/TABLET */}
            <Flex
              justify="space-between"
              align="flex-start"
              gap={6}
              display={{ base: 'none', md: 'flex' }}
            >
              <Box flex="1" minW={0}>
                <Text
                  color="limosen.text.primary"
                  fontWeight="bold"
                  fontSize="lg"
                  mb={3}
                >
                  {labelFollowUs}
                </Text>
                <HStack spacing={6}>
                  {SOCIAL_LINKS.map(({ label, href, icon: IconComponent }) => (
                    <Link
                      key={label}
                      href={href}
                      isExternal
                      color="limosen.text.primary"
                      transition="color 0.2s"
                      _hover={{ color: 'limosen.accent' }}
                      onClick={handleNavLinkClick}
                      aria-label={label}
                    >
                      <Icon as={IconComponent} boxSize={6} />
                    </Link>
                  ))}
                </HStack>
              </Box>
            </Flex>
          </Box>
        </Grid>
      </Box>

      {/* Force LTR order for right-edge controls even in Arabic */}
      <Container maxW="6xl" pos="absolute" inset={0} pointerEvents="none" dir="ltr">
        <Flex
          h={{ base: '12vh', md: '15vh' }}
          minH="100px"
          align="center"
          px={{ base: 4, md: 6 }}
          py={{ base: 2, md: 4 }}
          justify="space-between"
          pointerEvents="auto"
        >
          <Link
            href="/"
            display="flex"
            alignItems="center"
            height="100%"
            onClick={handleNavLinkClick}
            aria-label="Home"
          >
            <Box
              height={{ base: 16, md: 20 }}
              display="flex"
              alignItems="center"
            >
              <Logo />
            </Box>
          </Link>

          <Flex align="center" gap={{ base: 2, lg: 4 }}>
            <Flex display={{ base: 'none', lg: 'flex' }} align="center" gap={2}>
              {navLinks.map(link => {
                const isActive =
                  currentPath && currentPath === linkPathname(link.href);
                return (
                  <Button
                    key={link.href}
                    as={Link}
                    href={link.href}
                    variant="ghost"
                    fontSize="sm"
                    fontWeight="semibold"
                    color="limosen.text.primary"
                    sx={{
                      textDecoration: isActive ? 'underline' : 'none',
                      textUnderlineOffset: '4px',
                      textDecorationThickness: '2px'
                    }}
                    _hover={{ color: 'limosen.accent', bg: 'whiteAlpha.200' }}
                    onClick={handleNavLinkClick}
                  >
                    {link.label}
                  </Button>
                );
              })}
            </Flex>

            {/* Language button opens modal */}
            <Button
              variant="ghost"
              color="limosen.text.primary"
              px={2}
              rightIcon={<ChevronDownIcon color="limosen.text.primary" />}
              _hover={{ bg: 'whiteAlpha.200' }}
              onClick={langModal.onOpen}
              display={{ base: 'none', md: 'inline-flex' }}
            >
              <HStack spacing={2}>
                <Tooltip label={labelLanguage} hasArrow>
                  <Image
                    src={currentFlag}
                    alt={labelLanguage}
                    width="24px"
                    height="24px"
                    objectFit="cover"
                    display={{ base: 'none', sm: 'block' }}
                  />
                </Tooltip>
                <Text fontWeight="semibold" color="limosen.text.primary">
                  {languageCodeDisplay}
                </Text>
              </HStack>
            </Button>

            {/* Booking */}
            <Button size="sm" variant="limosen" onClick={handleOnBookingClick}>
              {intl.formatMessage({ id: 'BookNowCta' })}
            </Button>

            {/* Mobile menu */}
            <IconButton
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              icon={
                <HamburgerMenuIcon
                  handleClick={toggleMenu}
                  wrapperProps={{ className: menuActive ? 'open' : '' }}
                  iconProps={{ backgroundColor: 'limosen.text.primary' }}
                />
              }
              variant="ghost"
              onClick={toggleMenu}
              display={{ base: 'flex', lg: 'none' }}
              _hover={{ bg: 'limosen.border.subtle' }}
            />
          </Flex>
        </Flex>
      </Container>

      {/* Language Modal */}
      <Modal isOpen={langModal.isOpen} onClose={langModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent bg="limosen.bg.surface" color="limosen.text.primary">
          <ModalHeader>
            {intl.formatMessage({ id: 'LangModalTitle' })}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <ChakraLanguageSwitcher
              onSelect={langModal.onClose}
              buttonProps={{
                justifyContent: 'flex-start',
                variant: 'ghost',
                color: 'limosen.text.primary',
                _hover: { bg: 'whiteAlpha.200' }
              }}
              flags={{
                'de-AT': FLAG_DE,
                'en-US': FLAG_EN,
                'tr-TR': FLAG_TR,
                'ar-EG': FLAG_AR
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}

type HeroSectionProps = {
  background: IGatsbyImageData | string; // accept either gatsby image data or URL
  objectPosition?: string;       // e.g., 'center', '50% 40%', etc.
};
function HeroSection({
  background,
  objectPosition = 'center'
}: HeroSectionProps) {
  const imageFromPath = useImageLookup();

  // If a URL path string is passed (e.g., from HERO_SLIDES), resolve to Gatsby image if possible
  const resolved = typeof background === 'string' ? imageFromPath(background) : null;

  return (
    <Box
      as="section"
      className="slider-wrapper"
      position="relative"
      overflow="hidden"
      minH={{ base: '320px', md: '540px' }}
    >
      {resolved ? (
        <GatsbyImage
          image={resolved}
          alt=""                      // decorative
          role="presentation"
          loading="eager"             // LCP eager
          fetchpriority="high"        // LCP high priority
          decoding="async"
          sizes="100vw"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          imgStyle={{ objectFit: 'cover', objectPosition }}
        />
      ) : typeof background !== 'string' ? (
        <GatsbyImage
          image={background as IGatsbyImageData}
          alt=""                      // decorative
          role="presentation"
          loading="eager"
          fetchpriority="high"
          decoding="async"
          sizes="100vw"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          imgStyle={{ objectFit: 'cover', objectPosition }}
        />
      ) : (
        // Fallback: render as real <img> (still discoverable for LCP)
        <img
          src={background as string}
          alt=""
          decoding="async"
          loading="eager"
          fetchpriority="high"
          sizes="100vw"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition,
            display: 'block'
          }}
        />
      )}
      {/* place overlay content here if needed */}
    </Box>
  );
}

function AboutSection() {
  const intl = useIntl();
  return (
    <Box
      as="section"
      bg="limosen.bg.about"
      py={{ base: 12, md: 20 }}
      className="about-us"
    >
      <Container maxW="6xl">
        <Flex
          direction={{ base: 'column', md: 'row' }}
          gap={{ base: 8, md: 12 }}
          align="stretch"
        >
          <VStack
            align="flex-start"
            spacing={6}
            flex="1"
            className="about-text"
          >
            <Heading
              size="lg"
              className="about-text__title"
              color="limosen.text.primary"
            >
              <Field.Text
                as={chakra.span}
                name={`AboutTitle`}
                defaultValue={intl.formatMessage({ id: 'AboutTitle' })}
              />
            </Heading>

            <Stack
              spacing={4}
              fontSize="lg"
              className="about-description"
              color="limosen.text.secondary"
            >
              <Text>
                <Field.Text
                  as={chakra.span}
                  name={`AboutP1`}
                  defaultValue={intl.formatMessage({ id: 'AboutP1' })}
                />
              </Text>
              <Text>
                <Field.Text
                  as={chakra.span}
                  name={`AboutP2`}
                  defaultValue={intl.formatMessage({ id: 'AboutP2' })}
                />
              </Text>
              <Text>
                <Field.Text
                  as={chakra.span}
                  name={`AboutP3`}
                  defaultValue={intl.formatMessage({ id: 'AboutP3' })}
                />
              </Text>
            </Stack>
          </VStack>

          <Box
            flex={{ base: 'none', md: '0 0 40%' }}
            minH={{ base: '240px', md: '320px' }}
            borderRadius="lg"
            overflow="hidden"
            border="1px solid"
            borderColor="limosen.border.faint"
            bg="limosen.bg.card"
          >
            {/* keep Field.Image unchanged */}
            <Field.Image
              name="about-image"
              defaultValue={ABOUT_IMAGE}
              alt={intl.formatMessage({ id: 'AboutImageAlt' })}
              style={{ width: '100%', height: '100%' }}
              objectFit="cover"
            />
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}

function ServicesSection() {
  const intl = useIntl();
  const isRtl = (intl.locale || '').toLowerCase().startsWith('ar');

  const services: Array<{
    id: string;
    title: string;
    image?: string;
    paragraphs: string[];
  }> = ((intl.messages as any)?.services as any) ?? [];

  const serviceIds = useMemo(
    () => services.map(service => service.id as string),
    [services]
  );

  const { expandedIndices, handleAccordionChange, btnRefs } =
    useServiceAccordionNavigation(serviceIds);

  // merged defaults (overview & detail share the exact same fields)
  const mergedDefaultText = (paragraphs: string[]) =>
    (paragraphs ?? []).join('\n\n');

  return (
    <Box
      as="section"
      bg="limosen.bg.section"
      py={{ base: 12, md: 20 }}
      id="services"
    >
      <Container maxW="6xl">
        <VStack spacing={{ base: 12, md: 16 }} align="stretch">
          <VStack spacing={3} textAlign="center">
            <Heading size="lg" color="limosen.text.primary">
              <Field.Text
                as={chakra.span}
                name={`ServicesTitle`}
                defaultValue={intl.formatMessage({ id: 'ServicesTitle' })}
              />
            </Heading>
            <Text color="limosen.text.muted" maxW="3xl">
              <Field.Text
                as={chakra.span}
                name={`ServicesSubtitle`}
                defaultValue={intl.formatMessage({ id: 'ServicesSubtitle' })}
              />
            </Text>
            <Divider
              w={{ base: '80px', md: '120px' }}
              borderColor="limosen.border.subtle"
            />
          </VStack>

          {/* Services Overview Cards */}
          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 3 }}
            spacing={{ base: 6, md: 8 }}
          >
            {services.map(service => {
              const targetHref = `#${service.id}`;
              const imageFieldName = `service-${service.id}-image`;
              const textFieldName = `service-${service.id}-text`;
              const textDefault = mergedDefaultText(service.paragraphs);

              return (
                <LinkBox
                  key={service.id}
                  id={`${service.id}-overview`}
                  bg="limosen.bg.card"
                  borderRadius="xl"
                  overflow="hidden"
                  border="1px solid"
                  borderColor="limosen.border.faint"
                  boxShadow="lg"
                  role="group"
                  transition="transform 0.2s ease, box-shadow 0.2s ease"
                  _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
                >
                  {service.image && (
                    <AspectRatio ratio={5 / 3} w="100%">
                      {/* keep Field.Image unchanged */}
                      <Field.Image
                        name={imageFieldName}
                        defaultValue={service.image as string}
                        alt={service.title as string}
                        objectFit="cover"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </AspectRatio>
                  )}
                  <Box p={6}>
                    <LinkOverlay
                      href={targetHref}
                      display="block"
                      onClick={e => handleServiceLinkClick(e, targetHref)}
                    >
                      <Stack spacing={3}>
                        <Heading size="sm" color="limosen.text.primary">
                          {service.title}
                        </Heading>
                        <Text
                          color="limosen.text.secondary"
                          fontSize="sm"
                          noOfLines={3}
                        >
                          <Field.Text
                            as={chakra.span}
                            name={textFieldName}
                            defaultValue={textDefault}
                          />
                        </Text>
                        <Text fontWeight="semibold" color="limosen.accent">
                          {intl.formatMessage({ id: 'MoreDetails' })} →
                        </Text>
                      </Stack>
                    </LinkOverlay>
                  </Box>
                </LinkBox>
              );
            })}
          </SimpleGrid>

          {/* Services Details (Accordion) */}
          <Box>
            <Heading
              size="md"
              mb={4}
              textAlign="center"
              color="limosen.text.primary"
            >
              <Field.Text
                as={chakra.span}
                name={`ServicesDetailsTitle`}
                defaultValue={intl.formatMessage({
                  id: 'ServicesDetailsTitle'
                })}
              />
            </Heading>

            <Accordion
              allowMultiple
              reduceMotion
              index={expandedIndices}
              onChange={handleAccordionChange}
            >
              {services.map(service => {
                const hasImage = Boolean(service.image);
                const imageFieldName = `service-${service.id}-image`;
                const textFieldName = `service-${service.id}-text`;
                const textDefault = mergedDefaultText(service.paragraphs);

                return (
                  <AccordionItem
                    key={service.id}
                    id={service.id as string}
                    border="none"
                    mb={4}
                  >
                    <h3>
                      <AccordionButton
                        ref={el => {
                          btnRefs.current[service.id as string] = el;
                        }}
                        scrollMarginTop={{ base: '120px', md: '160px' }}
                        bg="whiteAlpha.50"
                        _expanded={{
                          bg: 'whiteAlpha.200',
                          borderColor: 'limosen.accent',
                          color: 'limosen.text.primary'
                        }}
                        borderRadius="lg"
                        px={{ base: 4, md: 6 }}
                        py={{ base: 4, md: 5 }}
                        border="1px solid"
                        borderColor="limosen.border.faint"
                      >
                        <Box
                          flex="1"
                          textAlign={isRtl ? 'right' : 'left'}
                          fontWeight="semibold"
                        >
                          {service.title}
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h3>

                    <AccordionPanel px={{ base: 4, md: 6 }} pt={6} pb={2}>
                      <Stack
                        spacing={6}
                        direction={{
                          base: 'column',
                          md: hasImage ? 'row' : 'column'
                        }}
                        align={{ base: 'stretch', md: 'flex-start' }}
                      >
                        {hasImage && (
                          <AspectRatio
                            ratio={5 / 3}
                            w={{ base: '100%', md: '320px' }}
                            flexShrink={0}
                            borderRadius="lg"
                            overflow="hidden"
                          >
                            {/* keep Field.Image unchanged */}
                            <Field.Image
                              name={imageFieldName}
                              defaultValue={service.image as string}
                              alt={service.title as string}
                              objectFit="cover"
                              style={{ width: '100%', height: '100%' }}
                            />
                          </AspectRatio>
                        )}

                        <Stack
                          spacing={4}
                          color="limosen.text.primary"
                          fontSize="md"
                          flex="1"
                        >
                          <Text whiteSpace="pre-wrap">
                            <Field.Text
                              as={chakra.span}
                              name={textFieldName}
                              defaultValue={textDefault}
                            />
                          </Text>
                        </Stack>
                      </Stack>
                    </AccordionPanel>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

function FAQSection() {
  const intl = useIntl();
  const isRtl = (intl.locale || '').toLowerCase().startsWith('ar');
  const items: Array<{ question: string; answer: string }> =
    ((intl.messages as any)?.faq as any) ?? [];

  return (
    <Box as="section" bg="limosen.bg.section" py={{ base: 12, md: 20 }}>
      <Container maxW="5xl">
        <VStack spacing={{ base: 8, md: 10 }} align="stretch">
          <VStack spacing={3} textAlign="center">
            <Heading size="lg" color="limosen.text.primary">
              <Field.Text
                as={chakra.span}
                name={`FaqTitle`}
                defaultValue={intl.formatMessage({ id: 'FaqTitle' })}
              />
            </Heading>
            <Text color="limosen.text.muted" maxW="3xl">
              <Field.Text
                as={chakra.span}
                name={`FaqSubtitle`}
                defaultValue={intl.formatMessage({ id: 'FaqSubtitle' })}
              />
            </Text>
            <Divider
              w={{ base: '80px', md: '120px' }}
              borderColor="limosen.border.subtle"
            />
          </VStack>

          <Accordion allowToggle reduceMotion>
            {items.map(item => (
              <AccordionItem key={item.question} border="none" mb={3}>
                <h3>
                  <AccordionButton
                    bg="whiteAlpha.50"
                    _expanded={{
                      bg: 'whiteAlpha.200',
                      borderColor: 'limosen.accent',
                      color: 'limosen.text.primary'
                    }}
                    borderRadius="lg"
                    px={{ base: 4, md: 6 }}
                    py={{ base: 4, md: 5 }}
                    border="1px solid"
                    borderColor="limosen.border.faint"
                  >
                    <Box
                      flex="1"
                      textAlign={isRtl ? 'right' : 'left'}
                      fontWeight="semibold"
                    >
                      {item.question}
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h3>
                <AccordionPanel
                  px={{ base: 4, md: 6 }}
                  pt={4}
                  pb={6}
                  color="limosen.text.secondary"
                >
                  {item.answer}
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </VStack>
      </Container>
    </Box>
  );
}

function FleetSection() {
  const intl = useIntl();
  const vehicles: Array<{
    image: string;
    category: string;
    name: string;
    description: string;
    passengers: number;
    luggage: number;
  }> = ((intl.messages as any)?.fleet as any) ?? [];

  return (
    <Box
      as="section"
      id="fleet"
      bg="limosen.bg.fleet"
      py={{ base: 12, md: 20 }}
    >
      <Container maxW="6xl">
        <VStack spacing={10} align="stretch">
          <Heading size="lg" textAlign="center" color="limosen.text.primary">
            <Field.Text
              as={chakra.span}
              name={`FleetTitle`}
              defaultValue={intl.formatMessage({ id: 'FleetTitle' })}
            />
          </Heading>

          <SimpleGrid
            columns={{ base: 1, md: 2 }}
            spacing={{ base: 8, md: 10 }}
          >
            {vehicles.map(vehicle => (
              <Box
                key={vehicle.name}
                bg="limosen.bg.card"
                borderRadius="lg"
                overflow="hidden"
                boxShadow="lg"
                border="1px solid"
                borderColor="limosen.border.faint"
              >
                <Box
                  w="100%"
                  h={{ base: '220px', md: '260px' }}
                  overflow="hidden"
                  bg="white"
                >
                  {/* keep Field.Image unchanged */}
                  <Field.Image
                    name={`fleet-${vehicle.name}`}
                    defaultValue={vehicle.image as string}
                    alt={vehicle.name as string}
                    style={{ width: '100%', height: '100%' }}
                    objectFit="cover"
                  />
                </Box>

                <Stack spacing={3} p={6}>
                  <Heading size="md" color="limosen.text.primary">
                    {vehicle.category}
                  </Heading>
                  <Text fontWeight="semibold" color="limosen.text.muted">
                    {vehicle.name}
                  </Text>
                  <Text color="limosen.text.secondary">
                    {vehicle.description}
                  </Text>

                  <Wrap spacing={6} pt={2}>
                    <WrapItem>
                      <HStack spacing={2}>
                        <Icon as={FaUser} color="limosen.accent" />
                        <Text
                          color="limosen.text.secondary"
                          fontWeight="medium"
                        >
                          <Field.Text
                            as={chakra.span}
                            name={`FleetPassengersLabel_${vehicle.name}`}
                            defaultValue={intl.formatMessage({
                              id: 'FleetPassengersLabel'
                            })}
                          />{' '}
                          {vehicle.passengers}
                        </Text>
                      </HStack>
                    </WrapItem>

                    <WrapItem>
                      <HStack spacing={2}>
                        <Icon as={FaSuitcaseRolling} color="limosen.accent" />
                        <Text
                          color="limosen.text.secondary"
                          fontWeight="medium"
                        >
                          <Field.Text
                            as={chakra.span}
                            name={`FleetLuggageLabel_${vehicle.name}`}
                            defaultValue={intl.formatMessage({
                              id: 'FleetLuggageLabel'
                            })}
                          />{' '}
                          {vehicle.luggage}
                        </Text>
                      </HStack>
                    </WrapItem>
                  </Wrap>
                </Stack>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}

function OnlineBookingSection() {
  const contactModal = useContactModal();
  const intl = useIntl();
  const handleOnContactClick = () => {
    contactModal.onOpen({ meta: {} });
  };

  return (
    <Box
      as="section"
      bg="limosen.bg.surfaceAlt"
      py={{ base: 12, md: 16 }}
      className="online-booking"
      bgImage={`url('${BOOKING_BACKGROUND}')`}
      bgSize="cover"
      bgPos="center"
      bgRepeat="no-repeat"
    >
      <Container maxW="4xl">
        <VStack spacing={5} textAlign="center">
          <Heading
            size="md"
            className="online-booking__title"
            color="limosen.text.primary"
          >
            <Field.Text
              as={chakra.span}
              name={`BookingTitle`}
              defaultValue={intl.formatMessage({ id: 'BookingTitle' })}
            />
          </Heading>

          <Stack
            spacing={3}
            fontSize="lg"
            className="online-booking__sub-title"
            color="limosen.text.secondary"
          >
            <Text>
              <Field.Text
                as={chakra.span}
                name={`BookingReachPhone`}
                defaultValue={intl.formatMessage({ id: 'BookingReachPhone' })}
              />
            </Text>
            <HStack justify="center" spacing={2}>
              <Icon as={FaPhone} color="limosen.accent" />
              <Link
                href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(
                  CONTACT_PHONE
                )}`}
                color="limosen.text.primary"
              >
                {CONTACT_PHONE}
              </Link>
            </HStack>
            <Text>
              <Field.Text
                as={chakra.span}
                name={`BookingAnd`}
                defaultValue={intl.formatMessage({ id: 'BookingAnd' })}
              />
            </Text>
            <Text>
              <Field.Text
                as={chakra.span}
                name={`BookingReachEmail`}
                defaultValue={intl.formatMessage({ id: 'BookingReachEmail' })}
              />
            </Text>
            <HStack justify="center" spacing={2}>
              <Icon as={FaEnvelopeOpen} color="limosen.accent" />
              <Link
                href={`mailto:${CONTACT_EMAIL}`}
                color="limosen.text.primary"
              >
                {CONTACT_EMAIL}
              </Link>
            </HStack>
          </Stack>

          <Button variant="limosen" onClick={handleOnContactClick}>
            {intl.formatMessage({ id: 'ContactCta' })}
          </Button>
        </VStack>
      </Container>
    </Box>
  );
}

function ReviewsSection() {
  const intl = useIntl();
  return (
    <Box
      as="section"
      id="reviews"
      bg="limosen.bg.section"
      py={{ base: 12, md: 20 }}
    >
      <Container maxW="6xl">
        <VStack spacing={{ base: 8, md: 12 }} align="stretch">
          <VStack spacing={3} textAlign="center">
            <Heading size="lg" color="limosen.text.primary">
              <Field.Text
                as={chakra.span}
                name={`FeedbackTitle`}
                defaultValue={intl.formatMessage({ id: 'FeedbackTitle' })}
              />
            </Heading>
            <Text color="limosen.text.muted" maxW="3xl">
              <Field.Text
                as={chakra.span}
                name={`FeedbackSubtitle`}
                defaultValue={intl.formatMessage({ id: 'FeedbackSubtitle' })}
              />
            </Text>
            <Divider
              w={{ base: '80px', md: '120px' }}
              borderColor="limosen.border.subtle"
            />
          </VStack>

          <Grid
            templateColumns={{ base: '1fr', lg: '1fr 1fr' }}
            gap={{ base: 6, md: 10 }}
          >
            <Box
              bg="limosen.bg.card"
              border="1px solid"
              borderColor="limosen.border.faint"
              borderRadius="xl"
              p={{ base: 6, md: 8 }}
              boxShadow="lg"
            >
              <VStack align="flex-start" spacing={4}>
                <Heading size="md" color="limosen.text.primary">
                  <Field.Text
                    as={chakra.span}
                    name={`FeedbackBoxTitle`}
                    defaultValue={intl.formatMessage({
                      id: 'FeedbackBoxTitle'
                    })}
                  />
                </Heading>
                <Text color="limosen.text.secondary">
                  <Field.Text
                    as={chakra.span}
                    name={`FeedbackBoxText`}
                    defaultValue={intl.formatMessage({ id: 'FeedbackBoxText' })}
                  />
                </Text>
                <HStack pt={2} spacing={3} wrap="wrap">
                  <Button
                    as={Link}
                    href={GOOGLE_MAPS_OPEN}
                    isExternal
                    variant="limosen"
                  >
                    <Field.Text
                      as={chakra.span}
                      name={`FeedbackMapsCta`}
                      defaultValue={intl.formatMessage({
                        id: 'FeedbackMapsCta'
                      })}
                    />
                  </Button>
                </HStack>
              </VStack>
            </Box>

            <Box
              bg="limosen.bg.card"
              border="1px solid"
              borderColor="limosen.border.faint"
              borderRadius="xl"
              overflow="hidden"
              boxShadow="lg"
              minH={{ base: '280px', md: '360px' }}
            >
              <Box
                position="relative"
                w="100%"
                h="100%"
                minH={{ base: '280px', md: '360px' }}
              >
                <iframe
                  title="LIMOSEN VIP Google Maps"
                  src={GOOGLE_MAPS_EMBED}
                  width="100%"
                  height="100%"
                  style={{ border: 0, background: 'white' }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </Box>
            </Box>
          </Grid>
        </VStack>
      </Container>
    </Box>
  );
}

export function Footer() {
  const intl = useIntl();
  const isRtl = (intl.locale || '').toLowerCase().startsWith('ar');

  const footerGroups: Array<{
    title: string;
    links: { label: string; href: string }[];
  }> = ((intl.messages as any)?.footer as any) ?? [];

  return (
    <Box as="footer" bg="limosen.bg.footer" py={{ base: 12, md: 16 }} dir={isRtl ? 'rtl' : 'ltr'}>
      <Container maxW="6xl">
        <VStack spacing={{ base: 10, md: 14 }} align="stretch">
          <Flex
            direction={{ base: 'column', md: isRtl ? 'row-reverse' : 'row' }}
            align="flex-start"
            gap={{ base: 8, md: 14 }}
          >
            <Box
              flexShrink={0}
              textAlign={isRtl ? 'right' : 'left'}
              w={{ base: 'full', md: 'auto' }}
              alignSelf={{ base: isRtl ? 'flex-end' : 'flex-start', md: 'auto' }}
            >
              <Box
                h={{ base: 14, md: 16 }}
                display="flex"
                alignItems="center"
                justifyContent={isRtl ? 'flex-end' : 'flex-start'}
                w="full"
              >
                <Logo width="auto" />
              </Box>
              <Text mt={4} color="limosen.text.muted">
                <Field.Text
                  as={chakra.span}
                  name={`FooterTagline`}
                  defaultValue={intl.formatMessage({ id: 'FooterTagline' })}
                />
              </Text>
            </Box>

            <SimpleGrid
              columns={{ base: 1, sm: 2, md: 3 }}
              spacing={{ base: 8, md: 10 }}
              flex="1"
              dir={isRtl ? 'rtl' : 'ltr'}
              justifyItems={isRtl ? 'end' : 'start'}
            >
              {footerGroups.map(group => (
                <VStack
                  key={group.title}
                  spacing={4}
                  align={isRtl ? 'flex-end' : 'flex-start'}
                  textAlign={isRtl ? 'right' : 'left'}
                  w="full"
                >
                  <Text
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="widest"
                    color="limosen.text.primary"
                    w="full"
                  >
                    {group.title}
                  </Text>
                  {/* fix links alignment in Arabic reliably */}
                  <VStack
                    spacing={2}
                    align={isRtl ? 'flex-end' : 'flex-start'}
                    w="full"
                    direction={isRtl ? 'rtl' : 'ltr'}
                  >
                    {group.links.map(link => (
                      <Link
                        key={`${group.title}-${link.label}`}
                        href={link.href}
                        color="limosen.text.muted"
                        _hover={{ color: 'limosen.text.primary' }}
                        display="block"
                        w="full"
                        textAlign={isRtl ? 'right' : 'left'}
                        alignSelf={isRtl ? 'flex-end' : 'flex-start'}
                        aria-label={link.label}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </VStack>
                </VStack>
              ))}
            </SimpleGrid>
          </Flex>

          <Divider borderColor="limosen.border.subtle" />

          <Flex
            direction={{ base: 'column', md: isRtl ? 'row-reverse' : 'row' }}
            align="center"
            justify="space-between"
            gap={4}
          >
            <Text
              fontSize="sm"
              color="limosen.text.muted"
              textAlign={isRtl ? 'right' : 'left'}
              w="full"
            >
              © {new Date().getFullYear()} LIMOSEN KG{' '}
              <Field.Text
                as={chakra.span}
                name={`FooterRights`}
                defaultValue={intl.formatMessage({ id: 'FooterRights' })}
              />
            </Text>
            <Wrap spacing={3} justify={isRtl ? 'flex-start' : 'flex-end'} w="full">
              {SOCIAL_LINKS.map(({ label, href, icon: IconComponent }) => (
                <WrapItem key={label}>
                  <IconButton
                    as={Link}
                    href={href}
                    aria-label={label}
                    icon={<IconComponent />}
                    isRound
                    size="sm"
                    variant="ghost"
                    color="limosen.text.primary"
                    _hover={{ bg: 'whiteAlpha.200', color: 'limosen.accent' }}
                  />
                </WrapItem>
              ))}
            </Wrap>
          </Flex>
        </VStack>
      </Container>
    </Box>
  );
}
