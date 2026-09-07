import {Box, BoxProps, Text} from '@chakra-ui/react'
import React, {forwardRef, useCallback, useMemo} from 'react'

import {useHighlight} from '../../../contexts/field-highlighter'
import type {JaenAuthor} from '../../../redux/apply-change'

export interface HighlightTooltipProps extends Omit<BoxProps, 'children'> {
  id: string
  children?:
    | React.ReactNode
    | ((props: {
        id: string
        ref: (node: HTMLDivElement) => void
        tabIndex?: number
      }) => React.ReactNode)
  /**
   * The codemod rewrote this to `asChild`, which is a different feature: it
   * tells a Chakra component to merge itself into its child. This component
   * reads `as` and renders it as the wrapper, so the two are not
   * interchangeable. v3 still has the polymorphic `as`, and v2's `As` alias was
   * only ever ElementType.
   */
  as?: React.ElementType
  asProps?: Record<string, unknown>
  asAs?: React.ElementType
  actions: React.ReactNode[]
  isEditing?: boolean
  /**
   * Who last wrote this field, out of the shared draft. It rides at the end of
   * the field's own chrome, because the value in front of the editor may have
   * been written by somebody else in another browser a moment ago and a CMS
   * that lets that happen silently is worse than one that never shared at all.
   */
  author?: JaenAuthor
}

/** "Florian Kleber, 22:04". A name and a clock, in the reader's own locale. */
const AuthorChip: React.FC<{author: JaenAuthor}> = ({author}) => {
  const at = new Date(author.at)
  const when = isNaN(at.getTime())
    ? ''
    : at.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})

  return (
    <Text
      as="span"
      fontSize="xs"
      opacity={0.75}
      px="1.5"
      whiteSpace="nowrap"
      data-jaen-field-author={author.sub}>
      {[author.name, when].filter(Boolean).join(', ')}
    </Text>
  )
}

export const HighlightTooltip = forwardRef<
  HTMLDivElement,
  HighlightTooltipProps
>(
  (
    {id, actions, author, as, asProps, asAs, isEditing, children, ...props},
    ref
  ) => {
    const tooltipButtons = useMemo(
      () =>
        author
          ? [
              ...actions,
              <AuthorChip key={`jaen-field-author-${id}`} author={author} />
            ]
          : actions,
      [actions, author, id]
    )

    const {ref: highlightRef} = useHighlight({tooltipButtons})

    const setRefs = useCallback(
      (node: HTMLDivElement) => {
        // handle ref and highlightRef

        if (typeof ref === 'function') {
          ref(node)
        } else {
          if (ref) ref.current = node
        }

        highlightRef(node)
      },
      [ref, highlightRef]
    )

    const Wrapper = as || Box

    const memoedChildren = useMemo(() => {
      if (typeof children === 'function') {
        return children({id, ref: setRefs, tabIndex: isEditing ? 1 : undefined})
      }

      return children
    }, [setRefs, isEditing, children])

    if (typeof children === 'function') {
      return (
        <Wrapper
          {...props}
          {...asProps}
          ref={setRefs}
          tabIndex={isEditing ? 1 : undefined}
          as={asAs}
          id={id}
          _focus={{
            outline: 'none'
          }}>
          {memoedChildren}
        </Wrapper>
      )
    }

    return (
      <Wrapper
        {...props}
        {...asProps}
        ref={setRefs}
        as={asAs}
        id={id}
        tabIndex={isEditing ? 1 : undefined}
        _focus={{
          outline: 'none'
        }}>
        {memoedChildren}
      </Wrapper>
    )
  }
)
