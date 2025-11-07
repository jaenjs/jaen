import { PageConfig } from 'jaen';
import {
  Center,
  Spinner,
} from '@chakra-ui/react';
import { PageProps, graphql } from 'gatsby';
import * as React from 'react';
import MdxEditor from '../components/mdx-editor/MdxEditor';
import { useTOCContext } from '../contexts/toc';
import { useProtectedDocs } from '../hooks/use-protected-docs';

// Example links - these would probably be fetched from a CMS or other data source
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

const DocPage: React.FC<PageProps> = props => {
  const toc = useTOCContext();
  const { isChecking } = useProtectedDocs();

  if (isChecking) {
    // Show loader instead of content until auth is verified
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return <MdxEditor onMdast={toc.setValue} />;
};

export default DocPage;

export { Head } from 'jaen';

export const pageConfig: PageConfig = {
  label: 'DocPage',
  childTemplates: ['DocPage'],
  withoutJaenFrameStickyHeader: true
};

export const query = graphql`
  query ($jaenPageId: String!) {
    jaenPage(id: { eq: $jaenPageId }) {
      ...JaenPageData
      childPages {
        ...JaenPageChildrenData
      }
    }
  }
`;
