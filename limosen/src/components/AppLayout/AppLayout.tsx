import { Box, useDisclosure } from '@chakra-ui/react';
import React, { FC, ReactNode, useMemo } from 'react';
import { TopNavigation } from '../Content';
import { HeaderBar } from '../Content';

import { useAuth, useCMSManagementContext } from 'jaen';
import { useLocation } from '@reach/router';
import { MenuStructureContext } from '../../contexts/menu-structure';
import { createPageTree } from '../../utils/navigation';
import DocsLayout from './DocsLayout';
import Footer from './Footer';
import PostLayout from './PostLayout';

interface AppLayoutProps {
  children?: React.ReactNode;
  isDocs?: boolean;
  path: string;
  footer?: FC<{ pullUp?: boolean }>;
}

const AppLayout: FC<AppLayoutProps> = ({ children, isDocs, path, footer }) => {
  const cmsManager = useCMSManagementContext();
  const location = useLocation();
  useDisclosure(); // reserved for mobile drawer if needed later
  const { isAuthenticated } = useAuth();

  const menuStructure = useMemo(
    () => createPageTree(cmsManager, location.pathname),
    [cmsManager, path]
  );

  const FooterComp = footer ?? Footer;

  let childrenElmnt: ReactNode = null;
  const isCommunity = ['/experiments', '/experiments/'].includes(path);

  if (isDocs || isCommunity) {
    childrenElmnt = (
      <DocsLayout path={path} isCommunity={isCommunity}>
        {children}
      </DocsLayout>
    );
  } else if (
    (path.startsWith('/experiments') &&
      path !== '/experiments/' &&
      path !== '/experiments') ||
    path.startsWith('/new/experiment')
  ) {
    childrenElmnt = <PostLayout>{children}</PostLayout>;
  } else {
    childrenElmnt = children;
  }

  return (
    <>
      {!isAuthenticated && <HeaderBar />}
      <MenuStructureContext.Provider value={{ menuStructure }}>
        <Box as="main" minW="210px" h="max(100%, 100vh)" minH="100vh">
          {!isAuthenticated && path !== '/' && <TopNavigation path={path} />}
          {!isAuthenticated && path === '/' && <TopNavigation path={path} />}
          {childrenElmnt}
        </Box>
      </MenuStructureContext.Provider>
      <FooterComp pullUp={path === '/'} />
    </>
  );
};

export default AppLayout;
