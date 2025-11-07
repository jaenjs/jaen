import {
  Button,
  ButtonGroup,
  ListItem,
  OrderedList,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  UnorderedList
} from '@chakra-ui/react';
import { FC } from 'react';

// Insertable custom components (via Jaen)

import {
  checkUserRoles,
  useAuth,
  useAuthUser,
  useContentManagement,
  usePageContext
} from 'jaen';
import { MdxField, MdxFieldProps } from 'jaen-fields-mdx';
import { EditIcon, SettingsIcon } from '@chakra-ui/icons';
import { Link } from 'gatsby-plugin-jaen';

import Heading from '../docs/heading/components/Heading';
import Callout from '../docs/callout/components/Callouts';
import CodeSnippet from '../docs/code-snippet/components/CodeSnippet';
import DocsIndex from '../docs/docs-index/components/DocsIndex';
import Filesystem from '../docs/filesystem/components/Filesystem';
import IconCard from '../docs/icon-card/components/IconCard';
import ImageCard from '../docs/image-card/components/ImageCard';
import JaenImage from '../JaenImage';

interface IMdxEditorProps {
  hideHeadingHash?: boolean;
  onMdast: (mdast: any) => void;
}

export const mdxEditorComponents: MdxFieldProps['components'] = {
  // TEXT
  p: props => <Text id={props.id} children={props.children} />,
  // LIST
  ul: (props: any) => (
    <UnorderedList id={props.id} children={props.children}></UnorderedList>
  ),
  ol: (props: any) => (
    <OrderedList id={props.id} children={props.children}></OrderedList>
  ),
  li: (props: any) => (
    <ListItem id={props.id} children={props.children}></ListItem>
  ),
  // TABLE
  table: (props: any) => (
    <Table
      id={props.id}
      variant="striped"
      w="fit-content"
      children={props.children}
    />
  ),
  thead: (props: any) => <Thead id={props.id} children={props.children} />,
  tbody: (props: any) => <Tbody id={props.id} children={props.children} />,
  tr: (props: any) => <Tr id={props.id} children={props.children} />,
  th: (props: any) => <Th id={props.id} children={props.children} />,
  td: (props: any) => <Td id={props.id} children={props.children} />,
  // MISC
  img: JaenImage,
  Image: JaenImage,
  // CUSTOM COMPONENTS
  Filesystem,
  ImageCard,
  Callout,
  IconCard,
  DocsIndex
};

const MdxEditor: FC<IMdxEditorProps> = ({ hideHeadingHash, onMdast }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { isEditing, toggleIsEditing } = useContentManagement();
  const { jaenPage } = usePageContext();

  const canEdit = isAuthenticated && checkUserRoles(user, ['jaen:admin']);

  return (
    <Stack
      spacing={4}
      sx={{
        '.cm-editor': {
          height: '60dvh'
        }
      }}
    >
      {canEdit && isLoading === false && (
        <ButtonGroup>
          <Button
            leftIcon={<EditIcon />}
            variant="outline"
            colorScheme={isEditing ? 'red' : undefined}
            onClick={() => toggleIsEditing()}
          >
            {isEditing ? 'Stop Editing' : 'Edit'}
          </Button>

          <Link
            leftIcon={<SettingsIcon />}
            variant="outline"
            as={Button}
            to={`/cms/pages/#${btoa(jaenPage.id)}`}
          >
            Page Settings
          </Link>
        </ButtonGroup>
      )}

      <div>
        <MdxField
          key={jaenPage.id}
          name="documentation"
          components={{
            // TEXT
            h1: props => (
              <Heading variant="h1" {...props} noAnchor={hideHeadingHash} />
            ),
            h2: props => (
              <Heading variant="h2" {...props} noAnchor={hideHeadingHash} />
            ),
            h3: props => (
              <Heading variant="h3" {...props} noAnchor={hideHeadingHash} />
            ),
            h4: props => (
              <Heading variant="h4" {...props} noAnchor={hideHeadingHash} />
            ),
            h5: props => (
              <Heading variant="h5" {...props} noAnchor={hideHeadingHash} />
            ),
            h6: props => (
              <Heading variant="h6" {...props} noAnchor={hideHeadingHash} />
            ),
            wrapper: ({ children }) => <Stack>{children}</Stack>,
            ...mdxEditorComponents
          }}
          onMdast={onMdast}
        />
      </div>
    </Stack>
  );
};

export default MdxEditor;
