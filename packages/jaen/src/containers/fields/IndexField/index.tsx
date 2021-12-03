import {Badge, Box, Center} from '@chakra-ui/layout'
import {
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger
} from '@chakra-ui/popover'
import {Skeleton} from '@chakra-ui/skeleton'
import {useCMSContext, usePage, usePages} from '@contexts/cms'
import {useTemplate} from '@contexts/template'
import {PopoverSimpleAdd} from '@src/containers/renderer/IndexField'
import {resolveDynamicPath} from '@src/utils'
import * as siteActions from '@store/actions/siteActions'
import {useAppSelector, useAppDispatch} from '@store/index'
import {withRedux} from '@store/withRedux'
import * as React from 'react'
import {v4 as uuidv4} from 'uuid'

import {IndexRenderArgs, IndexRenderFn} from './renderer'

export interface IndexFieldProps {
  /**
   * Overrides the default slug on which the IndexField is configured.
   */
  fixedSlug?: string
  /**
   * When enabled the IndexField will render the `PopoverSimpleAdd` renderer.
   * Else, the renderer of `onRenderPopover` will be used to render the popover.
   *
   * @default false
   *
   * Warning: Overrides the renderer of `onRenderPopover`!
   */
  defaultPopover?: boolean
  /**
   * Options for the popover that appears when hovering the field (if editing).
   */
  popoverOptions?: Partial<{
    /**
     * The header of the rendered popover.
     * Overrides the default header.
     *
     * @default undefined
     */
    header: React.ReactNode
  }>
  /**
   * Renders the popover content. Gets called when the IndexField is hovered.
   *
   * Warning: Cannot be used together with `defaultPopover`!
   */
  onRenderPopover?: IndexRenderFn
  /**
   * Renders the content of the IndexField.
   *
   * @param {PageType} page The page object associated with the field or the fixed slug.
   */
  onRender: IndexRenderFn
}

/**
 * IndexField is a field that grants access to the page it is configured on.
 * By default, this is the page on which the Component it is implement on.
 *
 * The IndexField can be configured to render a popover when hovered (in editing mode).
 * This popover can be customized by setting setting `popoverOptions`.
 *
 * @example
 * ```tsx
 *  <fields.IndexField
      onRender={({page, addPage}) => (
        <>
          <h1>This are the children of {page.pageMetadata.title}</h1>
          {page.children.map(e => (
            <>
              <fields.TextField
                fieldName="heading"
                initValue="This is a sample heading of a child page"
                pageId={e.page.id}
              />
            </>
          ))}
        </>
      )}
      defaultPopover
    />
 * ```
 *
 *
 */
const IndexField: React.FC<IndexFieldProps> = ({
  fixedSlug,
  defaultPopover = false,
  popoverOptions,
  onRender,
  onRenderPopover = defaultPopover ? PopoverSimpleAdd : undefined
}) => {
  const cmsContext = useCMSContext()
  const {jaenPageContext} = useTemplate()
  const allSitePage = usePages()
  const indexPage = usePage(fixedSlug || jaenPageContext.id)

  const nodes = allSitePage.nodes

  if (!indexPage) {
    throw new Error(`Page not found: ${fixedSlug || jaenPageContext.id}`)
  }

  const dispatch = useAppDispatch()

  // Wrap siteActions.addPage in a dispatch call
  const addPage: IndexRenderArgs['addPage'] = page => {
    // Check if page.id is defined and generate a new if not (uuid4)
    if (!page.id) {
      page.id = `SitePage /${uuidv4()}`
    }

    // Check if page.slug is defined and generate a random slug if not
    if (!page.slug) {
      // Generate a random slug with the page title as prefix
      page.slug = `${page.pageMetadata?.title?.toLocaleLowerCase()}-${Math.random()
        .toString(36)
        .substring(7, 15)}`
    }

    // Check if the slug is already taken
    // A slug is taken if the page sibling with the same slug exists
    // Siblings are pages with the same parent
    const isSlugTaken = indexPage.children.some(
      child => child.page.slug === page.slug
    )

    if (isSlugTaken) {
      throw new Error(`Slug ${page.slug} is already taken`)
    }

    // Set page.parent to the index page
    page.parent = {
      id: indexPage.id
    }

    // Set page.path to the index page + the slug
    //page.path = `${indexPage.path} + ${page.slug}`

    // Check if page.children is defined and generate an empty array if not
    if (!page.children) {
      page.children = []
    }

    // Add the page as node
    // @ts-ignore
    nodes[page.id] = page

    dispatch(siteActions.addPage({pageId: page.id, page, nodes}))

    // update routing
    const dynamicPaths = resolveDynamicPath(page.id, allSitePage)
    dispatch(siteActions.updateSiteRouting({dynamicPaths}))
  }

  const templates = React.useMemo(
    () => cmsContext.templates.map(e => e.TemplateName),
    [cmsContext.templates]
  )

  // Check if the page children are not a empty list
  const shouldRenderSkeleton = indexPage.children.length === 0

  // Check the store options to see if we should render the popover
  const isEditing = useAppSelector(state => state.options.isEditing)

  // Call onRender and save the Element to a variable
  const content = onRender({page: indexPage, templates, addPage})

  // Do not render the popover if we are not editing or if there is no popover content
  if (!isEditing || !onRenderPopover) {
    return content
  }

  // Render the popover
  return (
    <Popover trigger="hover" placement="auto" closeDelay={5000}>
      <PopoverTrigger>
        {shouldRenderSkeleton ? (
          <Box w="full">
            <Skeleton height="20" />
          </Box>
        ) : (
          <Box>{content}</Box>
        )}
      </PopoverTrigger>
      <PopoverContent>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader>
          <Center>
            {popoverOptions?.header || (
              <Center>
                {indexPage.pageMetadata?.title}
                <Badge>{indexPage.template}</Badge>
              </Center>
            )}
          </Center>
        </PopoverHeader>
        <PopoverBody>
          {onRenderPopover({page: indexPage, templates, addPage})}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

export default withRedux(IndexField)
