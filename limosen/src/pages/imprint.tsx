import { Field, PageConfig, PageProps } from 'jaen';
import { Box, Container } from '@chakra-ui/react';
import { graphql } from 'gatsby';
import * as React from 'react';

import { useTOCContext } from '../contexts/toc';
import TableOfContent from '../components/navigation/TableOfContent';
import MdxEditor from '../components/mdx-editor/MdxEditor';

const ImprintPage: React.FC<PageProps> = () => {
  // This can be memoized since it doesn't change and switching pages re-renders most of the app anyway.
  const MemoizedToc = React.memo(TableOfContent, () => false);

  const toc = useTOCContext();

  return (
    <Box as="main">
      <Container
        maxW="6xl"
        py={{ base: '6', md: '8', lg: '12' }}
        px={{ base: '4', md: '8', lg: '12' }}
      >
        <MdxEditor onMdast={toc.setValue} />
      </Container>
    </Box>
  );
};

export default ImprintPage;

export const pageConfig: PageConfig = {
  label: 'Imprint page',
  icon: 'FaPassport'
};

export const query = graphql`
  query ($jaenPageId: String!) {
    ...JaenPageQuery
    allJaenPage {
      nodes {
        ...JaenPageData
        children {
          ...JaenPageData
        }
      }
    }
  }
`;

export { Head } from 'jaen';
