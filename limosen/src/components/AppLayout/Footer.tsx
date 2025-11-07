import {
  Box,
  Center,
  Container,
  Divider,
  Flex,
  HStack,
  Icon,
  Image,
  LinkBox,
  LinkOverlay,
  Spacer,
  Text,
  VStack,
  useColorModeValue
} from '@chakra-ui/react';
import { FC, ReactNode } from 'react';
import { Link } from 'gatsby-plugin-jaen';
import { Field } from 'jaen';
import { FaTwitter } from '@react-icons/all-files/fa/FaTwitter';
import { FaGithub } from '@react-icons/all-files/fa/FaGithub';
import { FaInstagram } from '@react-icons/all-files/fa/FaInstagram';
import { FaFacebook } from '@react-icons/all-files/fa/FaFacebook';
import Logo from '../../gatsby-plugin-jaen/components/Logo';

const year = new Date().getFullYear();

/**
 * Footer component.
 */
const Footer: FC = () => {
  const links = [
    [
      {
        label: 'Links',
        isTitle: true
      },
      {
        label: 'GitHub',
        href: 'https://github.com/in/kleberbaum/'
      },
      {
        label: 'LinkedIn',
        href: 'https://www.linkedin.com/in/kleberbaum/'
      },
      {
        label: 'Telegram',
        href: 'https://t.me/kleberbaum'
      },
      {
        label: 'Instagram',
        href: 'https://www.instagram.com/limosenvip'
      },
      {
        label: 'Impressum',
        href: '/imprint'
      }
    ],
    [
      {
        label: 'Partner',
        isTitle: true
      },
      {
        label: 'Kanbon',
        href: 'https://kanbon.at'
      },
      {
        label: 'Neurons',
        href: 'https://neurons.at'
      }
    ],
    [
      {
        label: 'Gestaltet von',
        isTitle: true
      },
      {
        label: 'Florian H. Kleber',
        href: 'https://github.com/in/kleberbaum/'
      },
      {
        label: 'Nico Schett',
        href: 'https://schett.net'
      }
    ]
  ]

  const linkElmnts: ReactNode[] = []

  links.forEach((linkGroup, i) => {
    linkElmnts.push(
      // <VStack spacing={3} alignItems="start" wrap="wrap" key={i}>
      //   {linkGroup.map((link, i) => {
      //     if ('isTitle' in link) {
      //       return (
      //         <Field.Text
      //           key={i}
      //           name={'FooterLinkTitle' + link.label}
      //           defaultValue={link.label}
      //           fontWeight="500"
      //         />
      //       )
      //     }
      //     return (
      //       <Link
      //         key={i}
      //         href={link.href}
      //         variant="pq-footer"
      //         color="white"
      //         opacity={0.7}
      //       >
      //         <Field.Text
      //           name={'FooterLink' + link.label}
      //           defaultValue={link.label}
      //         />
      //       </Link>
      //     )
      //   })}
      // </VStack>
    )
  })

  return (
    <>
      <Box
        borderTopRadius="2xl"
        borderTop="1px solid"
        borderColor={useColorModeValue('brand.500', 'brand.200')}
        pb={20}
        position="relative"
        //mt="-25px"
        px={{base: 5, lg: 0}}
        overflowX="hidden"
        bgColor="#0A0A0A"
        zIndex={0}>
        <Container maxW="7xl" h="100%">
          <Flex mt={20} color="white" wrap={{base: 'wrap', sm: 'nowrap'}}>
            <Box>
              <Flex alignItems={'center'}>
                <Logo h="100px" />
              </Flex>
            </Box>
            <Spacer minW={{base: '5rem', lg: '25%'}} />
            {/* <HStack
              alignItems="start"
              spacing={{base: 5, sm: 20}}
              wrap={{base: 'wrap', md: 'nowrap'}}
              mt={{base: 10, md: 0}}>
              {linkElmnts}
            </HStack> */}
          </Flex>
          {/* <Stack
            mt={20}
            as={LinkBox}
            direction={'row'}
            spacing="0"
            mx="-12px"
            flexWrap={'wrap'}>
            <IconButton
              as={LinkOverlay}
              size="lg"
              variant={'ghost'}
              color="#ffffff"
              icon={<Netsnek w={'25px'} h={'25px'} />}
              aria-label="Netsnek"
              href="https://netsnek.com/schett"
              isExternal
            />
            <IconButton
              as={LinkOverlay}
              size="lg"
              variant={'ghost'}
              color="#ffffff"
              icon={<FaGithub />}
              aria-label="Github"
              href="https://github.com/schettn/"
              isExternal
            />
            <IconButton
              as={LinkOverlay}
              size="lg"
              variant={'ghost'}
              color="#ffffff"
              icon={<FaInstagram />}
              aria-label="Instagram"
              href="https://www.instagram.com/limosenvip"
              isExternal
            />
            <IconButton
              as={LinkOverlay}
              size="lg"
              variant={'ghost'}
              color="#ffffff"
              icon={<FaTelegram />}
              aria-label="Telegram"
              href="https://t.me/schettn"
              isExternal
            />
          </Stack> */}
          <HStack
            //justifyContent={"flex-end"}
            color={'white'}
            mt={20}
            mb={4}
            as={LinkBox}
            spacing="4"
            flexWrap={'wrap'}>
            <LinkBox
              mr="4"
              display="flex"
              transition="color 0.2s"
              _hover={{
                color: 'brand.500'
              }}>
              <LinkOverlay href="https://www.facebook.com/profile.php?id=61552973278627" isExternal>
                <Icon as={FaFacebook} boxSize="5" />
              </LinkOverlay>
            </LinkBox>
            <LinkBox
              mr="4"
              display="flex"
              transition="color 0.2s"
              _hover={{
                color: 'brand.500'
              }}>
              <LinkOverlay href="https://instagram.com/barbara.mauz" isExternal>
                <Icon as={FaInstagram} boxSize="5" />
              </LinkOverlay>
            </LinkBox>
            {/* <LinkBox
              mr="4"
              display="flex"
              transition="color 0.2s"
              _hover={{
                color: 'brand.500'
              }}>
              <LinkOverlay href="https://twitter.com" isExternal>
                <Icon as={FaTwitter} boxSize="5" />
              </LinkOverlay>
            </LinkBox>
            <LinkBox
              mr="4"
              display="flex"
              transition="color 0.2s"
              _hover={{
                color: 'brand.500'
              }}>
              <LinkOverlay href="https://github.com" isExternal>
                <Icon as={FaGithub} boxSize="5" />
              </LinkOverlay>
            </LinkBox> */}
          </HStack>
          <Divider mt={0} opacity={0.2} border="1px" />
          <Field.Text
            name="FooterBottomText"
            defaultValue="Copyright © 2023 Florian H. Kleber, Florian Herbert Kleber IT. All rights reserved."
            mt={5}
            color="white"
            opacity={0.2}
            _hover={{
              opacity: 1
            }}
            cursor="default"
            transition="opacity 0.2s ease-in-out"
          />
        </Container>
      </Box>
    </>
  )
}

export default Footer;
