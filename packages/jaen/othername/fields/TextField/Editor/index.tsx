import {Box} from '@chakra-ui/react'
import styled from '@emotion/styled'
import loadable from '@loadable/component'
import * as React from 'react'

const EditorWrapper = styled(Box)`
  width: 100%;

  .ck-content > * {
    all: revert;
  }
`

const LoadableCKEditor = loadable(() => import('@ckeditor/ckeditor5-react'), {
  resolveComponent: (editor: {CKEditor: any}) => editor.CKEditor
})

type EditorProps = {
  defaultValue: string
  value?: string
  editing: boolean
  disableToolbar: boolean
  /**
   * Get the data from the editor on blur.
   *
   * Only called when the editor is in edit mode and the data is not the same as the default value.
   *
   * @param data - The data that was changed
   */
  onBlurValue: (data: string) => void
}

let BalloonEditor: any = undefined

/**
 * TODO: Renders twice all the time. :(
 */
const Editor: React.FC<EditorProps> = props => {
  const [value, _] = React.useState(() => {
    let v = props.value || props.defaultValue || ''

    // Check if the default value does not contain any HTML tags
    // If so, wrap it in a <p> tag, else return the default value
    if (v.indexOf('<') === -1) {
      return `<p>${v}</p>`
    }
    return v
  })

  const raw = (
    <Box
      className="ck ck-content ck-editor__editable ck-rounded-corners ck-editor__editable_inline"
      dangerouslySetInnerHTML={{__html: value}}
    />
  )

  const editorConfig: {[key: string]: any} = {
    mediaEmbed: {
      previewsInData: true
    }
  }

  if (props.disableToolbar) {
    editorConfig['toolbar'] = []
  }

  const [editor, setEditor] = React.useState(BalloonEditor)

  React.useEffect(() => {
    async function load() {
      if (!BalloonEditor && props.editing) {
        //@ts-ignore
        BalloonEditor = await import('@ckeditor/ckeditor5-build-balloon')

        setEditor(BalloonEditor)
      }
    }

    load()
  })

  return (
    <EditorWrapper>
      {props.editing && editor ? (
        <LoadableCKEditor
          fallback={raw}
          //@ts-ignore
          editor={editor?.default}
          config={editorConfig}
          data={value}
          //@ts-ignore
          onBlur={(_, editor) => {
            const data = editor.getData()

            if (data !== value) {
              props.onBlurValue(data)
            }
          }}
          onLoad={(editor: any) => {
            editor.writer.addClass('revert-css')
          }}
        />
      ) : (
        <>{raw}</>
      )}
    </EditorWrapper>
  )
}

export default Editor
