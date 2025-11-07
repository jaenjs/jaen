import { Box, Container, Flex, Text, VStack } from '@chakra-ui/react';
import { FaLink } from '@react-icons/all-files/fa/FaLink';
import React, { FC, useMemo, useState } from 'react';
import { useMenuStructureContext } from '../../contexts/menu-structure';
import { TOCProvider } from '../../contexts/toc';
import useNavOffset from '../../hooks/use-nav-offset';
import { createBreadCrumbParts } from '../../utils/navigation';
import { MainBreadcrumbPart } from '../../utils/navigation/types';
import Links from '../Links';
import TbUsers from '../icons/tabler/TbUsers';
import TbBooks from '../icons/tabler/TbBooks';
import MainBottomNav from '../navigation/MainBottomNav';
import MainBreadcrumb from '../navigation/MainBreadcrumb';
import TableOfContent from '../navigation/TableOfContent';
import PageDirectory from '../navigation/page-directory/PageDirectory';

const links = [
  {
    name: 'Question? Give us feedback',
    href: '/contact'
  },
  {
    name: 'Edit this page on Jaen',
    href: '/cms/pages'
  }
];

interface DocsLayoutProps {
  children?: React.ReactNode;
  path?: string;
  isCommunity?: boolean;
}

const DocsLayout: FC<DocsLayoutProps> = ({ children, path, isCommunity }) => {
  const { menuStructure } = useMenuStructureContext();

  const [isExpanded, setIsExpanded] = useState(true);

  const breadcrumbParts: MainBreadcrumbPart[] = useMemo(() => {
    return [
      {
        name: 'Artikel',
        isDisabled: path === '/docs/',
        href: '/docs'
      },
      ...createBreadCrumbParts(menuStructure)
    ];
  }, [menuStructure]);

  const memoedChildren = useMemo(() => children, [children]);

  const MemoizedToc = React.memo(TableOfContent, () => false);

  const offset = useNavOffset();

  return (
    <Container maxW="8xl" w="full" minH="full" mt={offset}>
      <Flex minH="100dvh">
        <Box
          as="aside"
          flex="1"
          maxW={{ base: '150px', lg: '2xs' }}
          display={{
            base: 'none',
            md: 'block'
          }}
          pb="4"
        >
          <Box position="sticky" top="100px" mt="50px">
            <PageDirectory
              data={menuStructure}
              isExpanded={isExpanded}
              path={path}
              baseMenuItems={[
                // {
                //   name: 'Rezept Etnwicklung',
                //   icon: <TbBooks />,
                //   items: [
                //     {
                //       name: 'Rezepte',
                //       href: '/recipes',
                //       isActive: path?.startsWith('/experiments')
                //     }
                //   ]
                // },
                {
                  name: 'Mehr',
                  icon: <FaLink />,
                  items: [
                    {
                      name: 'Hauptseite',
                      href: '/'
                    },
                    {
                      name: 'Services',
                      href: '/#services'
                    },
                    {
                      name: 'Unsere Fahrzeuge',
                      href: '/#fahrzeuge'
                    },
                    {
                      name: 'Kundenfeedback',
                      href: '/#kundenfeedback'
                    },
                    {
                      name: 'Registrieren',
                      href: '/signup'
                    },
                    {
                      name: 'Kontakt',
                      href: '/?contact'
                    },
                  ]
                }
              ]}
            />
          </Box>
        </Box>

        {/* <Container maxW="3xl" mt="6">
       
        </Container> */}

        <TOCProvider>
          {isCommunity ? (
            <Box flex="1" mt="6" mx="8">
              {memoedChildren}
            </Box>
          ) : (
            <>
              <Container flex="1" mt="6" maxW="3xl">
                <MainBreadcrumb parts={breadcrumbParts} />

                {memoedChildren}

                <MainBottomNav />
              </Container>
              <Box
                as="aside"
                flex="1"
                maxW={{ base: '150px', lg: '2xs' }}
                display={{
                  base: 'none',
                  md: 'block'
                }}
                pb="4"
              >
                <Box position="sticky" top="100px" mt="50px">
                  <Flex as="nav" direction="column" mt={5}>
                    <MemoizedToc />
                  </Flex>
                  <Box
                    mt={7}
                    pt={7}
                    borderTop="1px solid"
                    borderTopColor="components.separator.borderColor"
                    fontSize="xs"
                  >
                    <VStack rowGap={1} textAlign="left">
                      <Links
                        links={links}
                        props={{
                          variant: 'right-bottom-nav',
                          w: '100%',
                          display: 'block'
                        }}
                      />
                    </VStack>
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </TOCProvider>
      </Flex>
    </Container>
  );
};

export default DocsLayout;
