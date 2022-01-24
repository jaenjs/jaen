import {PageProps} from 'gatsby'
import {IGatsbyImageData} from 'gatsby-plugin-image'
import {IBaseEntity, IMigrationEntity} from '../../index'

export interface IJaenTemplate {
  name: string
  displayName: string
  children: {
    name: string
    displayName: string
  }[]
}

export interface IJaenPage {
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
  jaenFields: {
    [type: string]: {
      [name: string]: any
    }
  } | null
  jaenFiles: {
    file: {
      id: string
      gatsbyImageData: IGatsbyImageData
    }
  }[]
  parent: {
    id: string
  } | null
  children: {
    id: string
    deleted?: true
  }[]
  chapters: {
    [chapterName: string]: {
      ptrHead: string | null
      ptrTail: string | null
      sections: {
        [uuid: string]: {
          name: string
          ptrNext: string | null
          ptrPrev: string | null
          jaenFields: {
            [type: string]: {
              [name: string]: any
            }
          } | null
          deleted?: true
        }
      }
    }
  } | null
  /**
   * Unique identifier of the page component name (e.g. `JaenPageHome`).
   * - Must be unique across all pages.
   * - Used to determine the component to render.
   * - Possible templates are specified in the `gatsby-config.js` file.
   */
  template: Omit<IJaenTemplate, 'children'> | null
  deleted?: true
}

export type ITreeJaenPage = Pick<
  IJaenPage,
  | 'id'
  | 'parent'
  | 'children'
  | 'slug'
  | 'jaenPageMetadata'
  | 'template'
  | 'deleted'
>

export type IJaenPages = {
  [uuid: string]: IJaenPage
}

export type IJaenPageProps = PageProps<
  {staticJaenPage: IJaenPage | null},
  {jaenPageId: string}
>

export interface IPagesMigrationBase {
  [uuid: string]: IBaseEntity
}

export type IPagesMigration = {
  [uuid: string]: IMigrationEntity
}

export interface IJaenConnection<ReactProps, Options>
  extends React.FC<ReactProps> {
  options: Options
}

export interface IFormProps<Values> {
  values: Values
  onSubmit: (values: Values) => void
  externalValidation?: (
    valueName: keyof Values,
    value: string
  ) => string | undefined
}