import {PluginOptions, PageProps} from 'gatsby'

export interface JaenPluginOptions extends PluginOptions {
  plugins: string[]
  templates: {
    rootDir: string
    paths: {
      [key: string]: string
    }
  }
  UI?: {
    show: boolean
  }
}

export interface JaenConnection<ReactProps, Options>
  extends React.FC<ReactProps> {
  options: Options
}

export interface JaenSection {
  name: string
  ptrNext: string | null
  ptrPrev: string | null
  deleted?: true
}

export interface JaenSectionWithId extends JaenSection {
  id: string
}

export type JaenSectionData = JaenSection & JaenData

/**
 * This interace is used to define how a JaenData should look like.
 *
 * It contains the following properties:
 * - `jaenFields`: All the fields that are used in the section.
 */
export interface JaenData {
  jaenFields: {
    [name: string]: any
  } | null
}

/**
 * This interface is used to define the properties of the page.
 *
 * @extends JaenData
 *
 * It contains the following properties:
 * - `id`: The id of the page.
 * - `slug`: The slug of the page.
 * - `jaenPageMetadata`: The metadata of the page.
 * - `parent`: The parent of the page.
 * - `children`: The children of the page.
 * - `chapters`: All chapters with their sections included in the page.
 * - `jaenFields`: All the fields that are used in the page.
 */
export interface JaenPage extends JaenData {
  id: string
  slug: string
  jaenPageMetadata: {
    title: string
    isBlogPost?: boolean
    image?: string
    description?: string
    datePublished?: string
    canonical?: string
  }
  parent: {
    id: string
  } | null
  children: {
    id: string
  }[]
  chapters: {
    [chapterName: string]: {
      ptrHead: string | null
      ptrTail: string | null
      sections: {
        [uuid: string]: JaenSectionData
      }
    }
  } | null
  /**
   * Unique identifier of the page component name (e.g. `JaenPageHome`).
   * - Must be unique across all pages.
   * - Used to determine the component to render.
   * - Possible templateNames are specified in the `gatsby-config.js` file.
   */
  templateName: string | null
}

export interface JaenPageProps extends Omit<PageProps, 'data'> {
  data?: PageProps<{jaenPage: JaenPage | null}>['data']
}

export interface JaenPageOptions {
  /**
   * Specifies how the JaenPage is displayed in the the UI.
   */
  displayName: string
  /**
   * A list of jaen templates for this page.
   */
  children: JaenConnection<{}, JaenTemplateOptions>[]
}

export interface JaenTemplateOptions extends JaenPageOptions {
  /**
   * A unique identifier for the page.
   *
   * @example `ArticlePage`
   */
  name: string
}

export interface JaenSectionOptions {
  displayName: string
  name: string
}

export interface PopoverProps<RenderFn> {
  /**
   * When enabled the field will render the `PopoverSimpleAdd` renderer.
   * Else, the renderer of `onRenderPopover` will be used to render the popover.
   *
   * Warning: If true, this overrides the renderer of `onRenderPopover`!
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
   * Renders the popover content. Gets called when the field is hovered.
   *
   * Warning: Cannot be used together with `defaultPopover`!
   */
  onRenderPopover?: RenderFn
}
