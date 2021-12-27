import {connectField} from '../../../utils/hooks/field'
import Editor from './Editor'

const TextField = connectField<string>(({jaenField, ...rest}) => (
  <Editor
    defaultValue={jaenField.staticValue || jaenField.defaultValue}
    value={jaenField.value}
    onBlurValue={data => jaenField.onUpdateValue(data)}
    editing={jaenField.isEditing}
    disableToolbar
  />
))

export default TextField
