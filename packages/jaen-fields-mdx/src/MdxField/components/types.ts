import {Root as MdastRoot} from 'mdast'
import {TabsProps} from './TabsTemplate'

export interface BaseEditorProps {
  components: Record<string, React.ComponentType<any>>
  onMdast?(value: MdastRoot | undefined): void
  onUpdateValue: (mdast: any, value: string) => void
  mdast?: any
  value?: string
  tabsTemplate?: React.FC<TabsProps> // Update this line
  mode?: 'preview' | 'build' | 'editAndPreview' | 'editAndBuild'
}

export {MdastRoot}
