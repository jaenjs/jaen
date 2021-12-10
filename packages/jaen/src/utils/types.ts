import {PageProps} from 'gatsby'

import {connectPage} from './hooks/jaenPage'

export type ConnectedPage = typeof connectPage

/**
 * This interace is used to define how a JaenData should look like.
 *
 * It contains the following properties:
 * - `jaenFields`: All the fields that are used in the section.
 */
export interface JaenData {
  jaenFields: {
    jaenTextFields: {
      name: string
      value: string
    }[]
    jaenFileFields: {
      name: string
      value: object
    }[]
  } | null
}

/**
 * This interface is used to define the properties of the page.
 *
 * @extends PageSection The page is also a section and includes all the properties of a section except sectionName.
 *
 * It contains the following properties:
 * - `id`: The id of the page.
 * - `slug`: The slug of the page.
 * - `jaenPageMetadata`: The metadata of the page.
 * - `parent`: The parent of the page.
 * - `children`: The children of the page.
 * - `sections`: All sections included in the pae.
 * - `jaenFields`: All the fields that are used in the section.
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
      [uuid: string]: JaenData & {
        ptrTo: string | null
        ptrFrom: string | null
        componentName: string
      }
    }
  } | null
}

export type JaenPageProps = PageProps<{jaenPage: JaenPage | null}>

export interface JaenPageOptions {
  /**
   * A unique identifier for the page.
   *
   * @example `ArticlePage`
   *
   * Warning: This should only be used on template pages (`src/templates/` and not `src/pages/`).
   */
  template?: string
  /**
   * Specifies how the JaenPage is displayed in the the UI.
   */
  displayName: string
}
