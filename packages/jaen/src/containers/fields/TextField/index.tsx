import {connectField} from '../../../utils/hooks/field'
import Editor from './Editor'

const TextField = connectField<string, {rtf?: boolean}>(
  ({jaenField, rtf = false}) => (
    <Editor
      defaultValue={jaenField.staticValue || jaenField.defaultValue}
      value={jaenField.value}
      onBlurValue={data => jaenField.onUpdateValue(data)}
      editing={jaenField.isEditing}
      disableToolbar={!rtf}
    />
  ),
  {fieldType: 'IMA:TextField'} // IMA: Internal Managable Attributes
)

export default TextField
