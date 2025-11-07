import { FC } from 'react';
import { MdxFieldProps, UncontrolledMdxField } from 'jaen-fields-mdx';
import { mdxEditorComponents } from './MdxEditor';
import Heading from '../docs/heading/components/Heading';
import { Stack, chakra } from '@chakra-ui/react';
import { text } from 'stream/consumers';
import TabsTemplate from './TabsTemplate';

const svgEditorComponents: MdxFieldProps['components'] = {
  // include all svg components
  svg: props => <chakra.svg children={props.children} />,
  style: props => <style children={props.children} />,
  defs: props => <defs children={props.children} />,
  mask: props => <mask children={props.children} />,
  path: props => <path children={props.children} />,
  text: props => <text children={props.children} />,
  rect: props => <rect children={props.children} />,
  g: props => <g children={props.children} />,
  circle: props => <circle children={props.children} />,
  polygon: props => <polygon children={props.children} />,
  line: props => <line children={props.children} />,
};

delete svgEditorComponents.Filesystem;
delete svgEditorComponents.DocsIndex;
delete svgEditorComponents.ImageCard;
delete svgEditorComponents.Image;

interface ICodeMdxEditorProps
  extends Omit<Parameters<typeof UncontrolledMdxField>[0], 'components'> {}

/**
 * Standalone MDX editor without automatic loading/saving by Jaen.
 */
const CodeMdxEditor: FC<ICodeMdxEditorProps> = ({
  ...props
}) => {
  return (
    <Stack
      pt={14}
      sx={{
        '.cm-editor': {
          height: '90dvh'
        }
      }}
    >
      <UncontrolledMdxField
        {...props}
        tabsTemplate={TabsTemplate}
        components={{
          wrapper: ({ children }) => <Stack>{children}</Stack>,
          ...svgEditorComponents
        }}
      />
    </Stack>
  );
};

export default CodeMdxEditor;
