import { Field, PageConfig, PageProps } from 'jaen';

import { Box } from '@chakra-ui/react';
import { graphql, navigate } from 'gatsby';
import * as React from 'react';

const PrivacyPolicyPage: React.FC<PageProps> = () => {
    return (
      <Box as="main">
        <Field.Editor name="privacy-policy" />
      </Box>
    );
  };
  
export default PrivacyPolicyPage;

export const pageConfig: PageConfig = {
  label: 'Privacy Policy',
  icon: 'FaPassport'
};

export const query = graphql`
  query ($jaenPageId: String!) {
    ...JaenPageQuery
  }
`;

export { Head } from 'jaen';
