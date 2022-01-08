import type {PageProps, PluginOptions} from 'gatsby'

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

export interface JaenSectionOptions {
  displayName: string
  name: string
}

export interface JaenTemplate {
  name: string
  displayName: string
  children: {
    name: string
    displayName: string
  }[]
}
export type JaenTemplateWithoutChildren = Omit<JaenTemplate, 'children'>

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
 * This interface is used to define how a JaenData should look like.
 *
 * It contains the following properties:
 * - `jaenFields`: All the fields that are used in the section.
 */
export interface JaenData {
  jaenFields: {
    [type: string]: {
      [name: string]: any
    }
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
   * - Possible JaenTemplateWithoutChildren are specified in the `gatsby-config.js` file.
   */
  template: JaenTemplateWithoutChildren | null
}

export type TreeJaenPage = Pick<
  JaenPage,
  'id' | 'parent' | 'children' | 'slug' | 'jaenPageMetadata' | 'template'
> & {deleted?: true}

export interface JaenConnection<ReactProps, Options>
  extends React.FC<ReactProps> {
  options: Options
}

export type JaenPageProps = PageProps<
  {staticJaenPage: JaenPage | null},
  {jaenPageId: string}
>

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

export interface FormProps<Values> {
  values: Values
  onSubmit: (values: Values) => void
  externalValidation?: (
    valueName: keyof Values,
    value: string
  ) => string | undefined
}
