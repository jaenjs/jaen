import {Button, Portal, Text, TextProps, Tooltip} from '@chakra-ui/react'
import DOMPurify from 'isomorphic-dompurify'
import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {FaAlignCenter} from '@react-icons/all-files/fa/FaAlignCenter'
import {FaAlignJustify} from '@react-icons/all-files/fa/FaAlignJustify'
import {FaAlignLeft} from '@react-icons/all-files/fa/FaAlignLeft'
import {FaAlignRight} from '@react-icons/all-files/fa/FaAlignRight'
import {FaBold} from '@react-icons/all-files/fa/FaBold'
import {FaItalic} from '@react-icons/all-files/fa/FaItalic'
import {FaUnderline} from '@react-icons/all-files/fa/FaUnderline'
import {FaLink} from '@react-icons/all-files/fa/FaLink'
import {FaUnlink} from '@react-icons/all-files/fa/FaUnlink'
import {FaFileUpload} from '@react-icons/all-files/fa/FaFileUpload'

import {useDebouncedCallback} from 'use-debounce'

import {TuneOption} from '../../components/TuneSelectorButton/components/TuneSelector/TuneSelector'
import {useTunes} from '../../components/TuneSelectorButton/components/TuneSelector/useTunes'
import {TuneSelectorButton} from '../../components/TuneSelectorButton/TuneSelectorButton'

import {connectField} from '../../connectors'
import {useNotificationsContext} from '../../contexts/notifications'
import {HighlightTooltip} from '../components/HighlightTooltip/HighlightTooltip'
import {uploadFile} from '../../utils/open-storage-gateway'

const cleanRichText = (
  text: string,
  options: {
    isRTF?: boolean
  }
) => {
  const {isRTF} = options

  if (isRTF) {
    // allow target="_blank" for links
    return DOMPurify.sanitize(text, {
      ADD_TAGS: ['a'],
      ADD_ATTR: ['href', 'target']
    })
  }

  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}

/**
 * Cheap pre test for "is there an anchor in here at all".
 *
 * The bracket class is what keeps `<abbr>` out of the match, so a value whose
 * only markup is an abbreviation never pays for a second parse.
 */
const CONTAINS_ANCHOR = /<a[\s/>]/i

/**
 * Attributes that can name a link on their own, without any visible text.
 */
const ANCHOR_NAME_ATTRIBUTES = ['aria-label', 'aria-labelledby', 'title']

/**
 * Removes anchors that are invisible and nameless from rendered rich text.
 *
 * Editing leaves them behind. netsnek.com's footer field "FooterTextNew"
 * starts with `<a href="tel:+436508248811" target="_blank"></a><b>E-Mail</b>`,
 * an anchor holding a phone number in its href and nothing between its tags.
 * It paints nothing, it has no accessible name, and axe reports it as a
 * link-name violation ("Links must have discernible text"). The same phone
 * number appears again further down the very same field, that time with a
 * visible label, so dropping the empty one loses nothing.
 *
 * An anchor is only dropped when it is worthless in every respect: it has an
 * href (an anchor without one may be a jump target), its text is empty after
 * trimming, it has no element child (an img names its link through alt) and it
 * carries none of aria-label, aria-labelledby or title.
 *
 * DOMPurify is the only parser available on both the server and the browser
 * here, so RETURN_DOM is used to get a walkable tree. The value has already
 * been sanitized with the same options, which makes this pass idempotent apart
 * from the anchors it is here to remove.
 */
const stripEmptyAnchors = (html: string) => {
  if (!CONTAINS_ANCHOR.test(html)) {
    return html
  }

  const root = DOMPurify.sanitize(html, {
    ADD_TAGS: ['a'],
    ADD_ATTR: ['href', 'target'],
    RETURN_DOM: true
  })

  root.querySelectorAll('a').forEach(anchor => {
    const hasName = ANCHOR_NAME_ATTRIBUTES.some(
      attribute => (anchor.getAttribute(attribute) || '').trim() !== ''
    )

    if (
      anchor.hasAttribute('href') &&
      (anchor.textContent || '').trim() === '' &&
      anchor.children.length === 0 &&
      !hasName
    ) {
      anchor.remove()
    }
  })

  return root.innerHTML
}

/**
 * Elements that may legally sit inside a heading or a paragraph.
 *
 * The list is HTML's phrasing content, trimmed to what a rich text value
 * actually produces. Anything outside it is flow content, which a heading
 * cannot contain, and a value carrying it has to be rendered in a div.
 */
const PHRASING_CONTENT =
  /^(a|abbr|b|bdi|bdo|br|cite|code|data|dfn|em|i|kbd|mark|q|rp|rt|ruby|s|samp|small|span|strong|sub|sup|time|u|var|wbr)$/i

/**
 * Whether the value contains anything a heading may not hold.
 *
 * Asking "does this contain any tag at all" was the old test, and it cost the
 * site its document outline: a heading whose only markup is the brand span
 * around its final dot, which is how every section heading here is written,
 * came out as a div. Screen readers and search engines then saw a page with no
 * headings on it. A span is phrasing content and belongs inside the heading;
 * only a div, a list or a table forces the fallback.
 */
const containsFlowContent = (input: string) => {
  const tags = input.match(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g)

  if (!tags) return false

  return tags.some(
    tag => !PHRASING_CONTENT.test(tag.replace(/^<\s*\/?\s*/, ''))
  )
}

export interface TextFieldProps extends Omit<TextProps, 'children'> {
  /**
   * The component the field renders as, destructured below as `as: Wrapper`.
   * The codemod turned it into v3's `asChild` boolean, which is a different
   * feature and would have left every caller's Heading rendering as a Text.
   */
  as?: React.ElementType
  asAs?: React.ElementType
  defaultValue?: string
  styleTunes?: TuneOption[]
  isRTF?: boolean
}

export const TextField = connectField<string, TextFieldProps>(
  ({
    jaenField,
    defaultValue,
    as: Wrapper = Text,
    asAs: definedAsAs,
    styleTunes: fieldStyleTunes = [],
    isRTF = true,
    ...rest
  }) => {
    const [value, setValue] = useState(() => {
      return cleanRichText(jaenField.staticValue || defaultValue || '', {
        isRTF
      })
    })

    useEffect(() => {
      const newValue = cleanRichText(
        jaenField.value || jaenField.staticValue || defaultValue || '',
        {
          isRTF
        }
      )

      setValue(newValue)
    }, [jaenField.value, isRTF])

    /**
     * What is actually painted, which is not always what is stored.
     *
     * The empty anchor cleanup may only ever touch the rendered output. `value`
     * is what a blur writes back into the field, and while a writer is placing
     * a link the anchor is legitimately empty for a moment, so neither the
     * saved text nor the text under the caret is allowed to change under them.
     * Plain text fields have had every tag removed already and are handed
     * through untouched.
     */
    const displayValue = useMemo(() => {
      if (jaenField.isEditing || !isRTF) {
        return value
      }

      return stripEmptyAnchors(value)
    }, [value, jaenField.isEditing, isRTF])

    const {toast} = useNotificationsContext()

    const asAs = useMemo(() => {
      if (containsFlowContent(value)) {
        return 'div'
      }

      // asAs is the caller's explicit choice and outranks the guess. It used
      // to be dropped for headings, so asAs="h3" silently rendered an h2 and
      // there was no way to place a heading at any level but the second.
      if (definedAsAs) {
        return definedAsAs
      }

      return (Wrapper as any).displayName === 'Heading' ? 'h2' : undefined
    }, [value, (Wrapper as any).displayName, definedAsAs])

    const handleTextSave = useDebouncedCallback(
      useCallback(
        (data: string | null) => {
          // skip if data has not changed

          if (data === value) {
            return
          }

          jaenField.onUpdateValue(data || undefined)

          toast({
            title: 'Text saved',
            description: 'The text has been saved',
            status: 'info'
          })
        },
        [value]
      ),
      500
    )

    useEffect(() => {
      if (jaenField.isEditing) {
        const as =
          typeof Wrapper === 'string'
            ? Wrapper
            : typeof asAs === 'string'
              ? asAs
              : undefined

        jaenField.register({
          as
        })
      }
    }, [jaenField.isEditing])

    const handleContentBlur: React.FocusEventHandler<HTMLSpanElement> =
      useCallback(evt => {
        handleTextSave(evt.currentTarget.innerHTML)
      }, [])

    const handleFileChange = async (
      event: Event & {target: {files: FileList | null}}
    ) => {
      const fileInput = document.getElementById(
        'page-file-upload-input'
      ) as HTMLInputElement

      const file = event.target.files?.[0]
      if (file) {
        const randomId = Math.random().toString(36).substring(7)

        // The 'download' attribute is used to set the filename when downloading the file
        // This only works on same-origin URLs, hence it doesn't work with the Open Storage Gateway
        document.execCommand(
          'insertHTML',
          false,
          `<a id="${randomId}" download="${file.name}" href="#" target="_blank">${file.name}</a>`
        )

        const {fileUrl} = await uploadFile(file)

        const link = document.getElementById(randomId)

        if (link) {
          link.setAttribute('href', fileUrl)
          link.removeAttribute('id')
        } else {
          throw new Error('Could not find link element')
        }
      }

      if (fileInput) {
        // Optionally reset file input to allow re-uploading the same file
        fileInput.value = ''

        // Unregister listener
        fileInput.removeEventListener('change', handleFileChange)
      }
    }

    const alignmentTune: TuneOption = {
      type: 'groupTune',
      name: 'alignment',
      label: 'Alignment',
      tunes: [
        {
          name: 'left',
          Icon: FaAlignLeft,
          props: {
            textAlign: 'left'
          }
        },
        {
          name: 'center',
          Icon: FaAlignCenter,
          props: {
            textAlign: 'center'
          }
        },
        {
          name: 'right',
          Icon: FaAlignRight,
          props: {
            textAlign: 'right'
          }
        },
        {
          name: 'justify',
          Icon: FaAlignJustify,
          props: {
            textAlign: 'justify'
          }
        }
      ]
    }

    const styleTune: TuneOption = {
      type: 'groupTune',
      name: 'style',
      label: 'Style',
      tunes: [
        {
          name: 'bold',
          Icon: FaBold,
          onTune: () => {
            document.execCommand('bold')
          }
        },
        {
          name: 'italic',
          Icon: FaItalic,
          onTune: () => {
            document.execCommand('italic')
          }
        },
        {
          name: 'underline',
          Icon: FaUnderline,
          onTune: () => {
            document.execCommand('underline')
          }
        },
        {
          name: 'link',
          Icon: FaLink,
          onTune: async () => {
            const url = window.prompt('Enter the URL')

            if (url) {
              const selection = document.getSelection()

              document.execCommand(
                'insertHTML',
                false,
                `<a href="${url}" target="_blank">${selection}</a>`
              )
            }
          }
        },
        {
          name: 'unlink',
          Icon: FaUnlink,
          onTune: () => {
            document.execCommand('unlink', false)
          }
        },
        {
          name: 'file',
          Icon: FaFileUpload,
          onTune: async () => {
            const fileInput = document.getElementById('page-file-upload-input')

            if (fileInput) {
              // Register listener to handle file upload
              fileInput.addEventListener('change', handleFileChange)

              fileInput.click()
            }
          }
        }
      ]
    }

    const tunes = useTunes({
      props: {...rest, asAs},
      activeTunes: jaenField.activeTunes,
      tunes: [
        alignmentTune,
        ...(isRTF ? [styleTune, ...fieldStyleTunes] : []),
        ...jaenField.tunes
      ]
    })

    return (
      <HighlightTooltip
        id={jaenField.id || jaenField.name}
        author={jaenField.lastAuthor}
        actions={[
          <Button
            variant={
              // This variant is declared in gatsby-plugin-jaen's button recipe.
              'field-highlighter-tooltip-text'
            }
            key={`jaen-highlight-tooltip-text-${jaenField.name}`}>
            {/* The delays are v2's, which opened and closed on the same frame
                as the pointer; v3 waits 400ms and 150ms, long enough on a chip
                this small to read as a hint that never comes. The Portal is
                v2's too, which put every tooltip in one whatever the caller
                asked for. */}
            <Tooltip.Root
              openDelay={0}
              closeDelay={0}
              positioning={{placement: 'top-start'}}>
              <Tooltip.Trigger asChild>
                <Text>Text</Text>
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Positioner>
                  <Tooltip.Content>{`ID: ${jaenField.id}`}</Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
          </Button>,
          ...(isRTF
            ? [
                <TuneSelectorButton
                  key={`jaen-highlight-tooltip-tune-${jaenField.name}`}
                  aria-label="Customize"
                  tunes={[styleTune, ...fieldStyleTunes]}
                  activeTunes={tunes.activeTunes}
                  onTune={jaenField.tune}>
                  {/* The button's glyph, which v2 took as `icon`. */}
                  <Text as="span" fontSize="sm" fontFamily="serif">
                    T
                  </Text>
                </TuneSelectorButton>
              ]
            : []),
          <TuneSelectorButton
            key={`jaen-highlight-tooltip-tune-${jaenField.name}`}
            aria-label="Customize"
            tunes={[alignmentTune, ...jaenField.tunes]}
            activeTunes={tunes.activeTunes}
            onTune={jaenField.tune}
          />
        ]}
        isEditing={jaenField.isEditing}
        as={Wrapper}
        asAs={asAs}
        minW="1rem"
        className={jaenField.className}
        style={{
          ...jaenField.style,
          ...rest.style
        }}
        {...rest}
        {...tunes.activeProps}
        asProps={{
          outline: 'none',
          dangerouslySetInnerHTML: {__html: displayValue},
          contentEditable: jaenField.isEditing,
          onBlur: handleContentBlur,
          onPaste: (evt: React.ClipboardEvent<HTMLDivElement>) => {
            evt.preventDefault()

            if (isRTF) {
              let text =
                evt.clipboardData.getData('text/html') ||
                evt.clipboardData.getData('text')

              text = DOMPurify.sanitize(text, {
                ALLOWED_TAGS: ['br', 'span'],
                ALLOWED_ATTR: []
              })

              document.execCommand('insertHTML', false, text)
            } else {
              const text = evt.clipboardData.getData('text')

              document.execCommand('insertText', false, text)
            }
          }
        }}
        css={{
          // Links inside a text field are brand coloured, and they have to
          // match the brand colour the rest of the site uses for controls.
          // brand.300 is a light tint that reads as a different orange next
          // to a brand.500 button, so the light mode takes 500 and only the
          // dark mode keeps the lighter tint for legibility.
          //
          // The ampersand is required, it is not a style choice. v2's `sx`
          // took a bare element name as a nested selector; v3's `css` reads an
          // unprefixed key as a CONDITION and swaps it with the property,
          // turning this block into `{color: {a: 'brand.500'}}`. There is no
          // condition named `a`, so the whole thing is dropped without a
          // warning and every link a writer puts in a text field renders in
          // the surrounding text colour.
          '& a': {
            color: 'brand.500',
            textDecoration: 'underline',
            _dark: {
              color: 'brand.300'
            }
          }
        }}
      />
    )
  },
  {
    fieldType: 'IMA:TextField'
  }
)
