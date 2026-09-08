import {HStack} from '@chakra-ui/react'
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef
} from 'react'

import {createPortal} from 'react-dom'

export const FIELD_HIGHLIGHTER_CLASSNAMES = {
  JAEN_HIGHLIGHT_FRAME: 'jaen-highlight-frame',
  JAEN_HIGHLIGHT_TOOLTIP: 'jaen-highlight-tooltip'
}

export interface FieldHighlighterProviderContextValue {
  ref: (ref: HTMLDivElement | null, actions: React.ReactNode[]) => void
}

export const FieldHighlighterProviderContext =
  createContext<FieldHighlighterProviderContextValue>({
    ref: () => {}
  })

export interface HighlightProviderProps {
  path: string
  children: React.ReactNode
}

interface TooltipProps {
  actions: React.ReactNode[]
}

const Tooltip = forwardRef<HTMLDivElement, TooltipProps>((props, ref) => {
  // const jaenTheme = useJaenTheme()

  return (
    <HStack
      ref={ref}
      id="momo"
      w="fit-content"
      mt="-6"
      p="1"
      mx="auto"
      justifyContent="center"
      gap="1"
      pointerEvents="all">
      {/* <Button size="xs" colorScheme="blackAlpha">
      Edit block
    </Button> */}
      {props.actions.map((action, index) => (
        <React.Fragment key={index}>{action}</React.Fragment>
      ))}
    </HStack>
  )
})

export const FieldHighlighterProvider: React.FC<
  HighlightProviderProps
> = props => {
  const fields = useRef<
    Array<{
      ref: HTMLDivElement | null
      tooltipButtons: React.ReactNode[]
    }>
  >([])

  useEffect(() => {
    fields.current = []
    // The frame outlives a page change now, so a navigation with a field still
    // focused would leave it standing at the old page's coordinates.
    hideHighlightRef.current()
  }, [props.path])

  const tooltipHightRef = useRef<HTMLDivElement | null>(null)

  const [tooltipButtons, setTooltipButtons] = React.useState<React.ReactNode[]>(
    []
  )

  /**
   * The frame and the tooltip's container, built once and kept.
   *
   * Both used to be created inside `setHighlight` and thrown away by the blur
   * that followed, so every move of the caret from one field to the next
   * replaced the container React's tooltip portal was mounted into. A new
   * container is a new mount: the tooltip, its tune selectors and their Chakra
   * tooltips came down and went back up on each focus, and that is the largest
   * part of what the measurement in
   * `docs/architecture/editing-performance.md` calls the blur to the next
   * painted frame. Positioning a node that already exists costs a style
   * recalculation of one element instead.
   */
  const frameRootRef = useRef<HTMLDivElement | null>(null)
  const [tooltipRoot, setTooltipRoot] = React.useState<HTMLDivElement | null>(
    null
  )

  const resizeObserver = useRef<ResizeObserver | null>(null)
  /**
   * The page scroll at the moment the field was focused, which is what the
   * observer below adds to a viewport rectangle to get a document one. It is a
   * ref rather than a closure because the observer outlives the focus that
   * created it now.
   */
  const scrollAt = useRef({left: 0, top: 0})

  /**
   * `hideHighlight` is declared below, and the effect above runs before it
   * exists on the first render, so the effect reaches it through a ref.
   */
  const hideHighlightRef = useRef<() => void>(() => {})

  const ensureRoots = () => {
    const appRoot = document.getElementById('___gatsby')

    if (!appRoot) {
      alert('appRoot root not found, please contact support')
      return null
    }

    let frameRoot = frameRootRef.current

    if (!frameRoot || !frameRoot.isConnected) {
      frameRoot = appRoot.appendChild(document.createElement('div'))
      frameRoot.classList.add(FIELD_HIGHLIGHTER_CLASSNAMES.JAEN_HIGHLIGHT_FRAME)
      frameRoot.style.position = 'absolute'

      const tooltipRootNode = frameRoot.appendChild(
        document.createElement('div')
      )

      tooltipRootNode.classList.add(
        FIELD_HIGHLIGHTER_CLASSNAMES.JAEN_HIGHLIGHT_TOOLTIP
      )

      tooltipRootNode.style.position = 'sticky'
      // move tooltip above element
      tooltipRootNode.style.top = `3.5rem`
      tooltipRootNode.style.pointerEvents = 'none'
      tooltipRootNode.style.zIndex = '999'
      tooltipRootNode.style.width = '100%'
      tooltipRootNode.tabIndex = -1

      frameRootRef.current = frameRoot
      setTooltipRoot(tooltipRootNode)
    }

    return frameRoot
  }

  const setHighlight = (element: HTMLElement) => {
    const frameRoot = ensureRoots()

    if (!frameRoot) return

    frameRoot.style.display = ''

    // include scroll
    scrollAt.current = {
      left: window.pageXOffset || document.documentElement.scrollLeft,
      top: window.pageYOffset || document.documentElement.scrollTop
    }

    if (!resizeObserver.current) {
      resizeObserver.current = new ResizeObserver(entries => {
        const entry = entries[0]

        if (!entry) return

        const elementRect = entry.target.getBoundingClientRect()
        const root = frameRootRef.current

        if (!root) return

        root.style.top = `${elementRect.top + scrollAt.current.top}px`
        root.style.left = `${elementRect.left + scrollAt.current.left}px`
        root.style.width = `${elementRect.width}px`
        root.style.height = `${elementRect.height}px`
      })
    }

    resizeObserver.current.disconnect()
    resizeObserver.current.observe(element)

    const field = fields.current.find(item => item.ref === element)

    setTooltipButtons(field?.tooltipButtons ?? [])
  }

  const hideHighlight = () => {
    const frameRoot = frameRootRef.current

    if (frameRoot) {
      frameRoot.style.display = 'none'
    }

    resizeObserver.current?.disconnect()
  }

  hideHighlightRef.current = hideHighlight

  const findClosestParentMatching = (
    element: HTMLElement,
    find: (element: HTMLElement) => boolean
  ) => {
    let currentElement: HTMLElement | null = element
    let index = -1

    while (currentElement) {
      index++
      if (find(currentElement)) {
        return {element: currentElement, index}
      }

      currentElement = currentElement.parentElement
    }

    return null
  }

  const mouseEnterHandler = useCallback((e: MouseEvent) => {
    const element = e.target as HTMLElement

    element.focus({
      preventScroll: true
    })
  }, [])

  const mouseLeaveHandler = useCallback((e: MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement

    const nextItem = Object.values(fields.current).find(
      item => item.ref === relatedTarget
    )

    if (nextItem) {
      nextItem?.ref?.focus({
        preventScroll: true
      })
    } else {
      const closestParent = findClosestParentMatching(relatedTarget, element =>
        fields.current.some(item => item.ref === element)
      )

      if (closestParent) {
        const closestItem = fields.current.find(
          item => item.ref === closestParent.element
        )

        closestItem?.ref?.focus({
          preventScroll: true
        })
      }
    }
  }, [])

  const focusHandler = useCallback((e: FocusEvent) => {
    const element = e.target as HTMLElement

    // set the cursor to the end of the element if it is a contenteditable element
    if (element.isContentEditable) {
      const range = document.createRange()
      const selection = window.getSelection()

      if (!selection) return

      range.selectNodeContents(element)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    setHighlight(element)
  }, [])

  const blurHandler = useCallback((e: FocusEvent) => {
    const highlightRoot = frameRootRef.current

    if (!highlightRoot || highlightRoot.style.display === 'none') return

    // Check if the blur event is caused by a click on the tooltip
    // check if tooltip ref contains relatedTarget

    if (tooltipHightRef.current?.contains(e.relatedTarget as Node)) {
      return
    }

    const element = e.currentTarget as HTMLElement

    // Do not remove the highlight if the new focus is on a child of the original element
    if (element?.contains(e.relatedTarget as Node)) {
      return
    }

    // check if relatedTarget is the the highlight tooltip
    if (highlightRoot.contains(e.relatedTarget as Node)) {
      return
    }

    hideHighlight()
  }, [])

  const ref = useCallback(
    (ref: HTMLDivElement | null, tooltipButtons: React.ReactNode[]) => {
      if (ref) {
        const fieldIndex = fields.current.findIndex(item => item.ref === ref)

        const field = fields.current[fieldIndex]

        if (field?.ref) {
          // remove old event listeners
          field.ref.removeEventListener('mouseenter', mouseEnterHandler)
          field.ref.removeEventListener('mouseleave', mouseLeaveHandler)
          field.ref.removeEventListener('focus', focusHandler)
          field.ref.removeEventListener('blur', blurHandler)
        }

        ref.addEventListener('mouseenter', mouseEnterHandler)
        ref.addEventListener('mouseleave', mouseLeaveHandler)
        ref.addEventListener('focus', focusHandler)
        ref.addEventListener('blur', blurHandler)

        // Push or replace the field
        if (fieldIndex !== -1) {
          fields.current[fieldIndex] = {
            ref,
            tooltipButtons
          }
        } else {
          fields.current.push({
            ref,
            tooltipButtons
          })
        }
      }
    },
    [
      // itemsRef.current,
      mouseEnterHandler,
      mouseLeaveHandler,
      focusHandler,
      blurHandler
    ]
  )

  /**
   * The tooltip, portalled into a container that does not move.
   *
   * `createPortal` used to be called inside the focus handler and its result
   * put into state, which meant a new portal into a new container on every
   * focus. Here the container is built once and only the buttons change, so
   * focusing the next field re-renders the tooltip's own contents and touches
   * nothing else.
   */
  const portaledTooltip = React.useMemo(() => {
    if (!tooltipRoot) return null

    return createPortal(
      <Tooltip actions={tooltipButtons} ref={tooltipHightRef} />,
      tooltipRoot
    )
  }, [tooltipRoot, tooltipButtons])

  /**
   * The value handed to every field, and it must not change identity.
   *
   * It was an object literal, so every render of this provider gave all forty
   * three fields of a page a new context value and re-rendered every one of
   * them. The provider renders on each focus, which is how leaving one field
   * for the next cost a render of the whole page. `ref` is a `useCallback`
   * over four handlers that never change, so the value below is stable for the
   * provider's life.
   */
  const contextValue = React.useMemo(() => ({ref}), [ref])

  return (
    <FieldHighlighterProviderContext.Provider value={contextValue}>
      {portaledTooltip}
      {props.children}
    </FieldHighlighterProviderContext.Provider>
  )
}

export interface UseHighlightProps {
  tooltipButtons: React.ReactNode[]
}

export const useHighlight = ({tooltipButtons}: UseHighlightProps) => {
  const {ref} = useContext(FieldHighlighterProviderContext)

  const refOnly = useCallback(
    (theRef: HTMLDivElement | null) => {
      ref(theRef, tooltipButtons)
    },
    [tooltipButtons, ref]
  )

  return {
    ref: refOnly
  }
}

export default FieldHighlighterProvider
