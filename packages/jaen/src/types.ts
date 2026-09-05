declare global {
  var __VERSION__: string

  var __JAEN_REMOTE__: {
    repository: string
    cwd?: string
  }

  var __JAEN_PYLON_URL__: string | undefined
  /**
   * Origin of the storage gateway that holds CMS media. Undefined falls back
   * to the public osg.snek.at, which is what every site used before this was
   * configurable.
   */
  var __JAEN_STORAGE_URL__: string | undefined
  var __JAEN_EMAILWERK_URL__: string | undefined

  /**
   * Two concerns behind one name, for historical reasons: the OIDC provider
   * jaen signs in against, and the Zitadel API it manages users through.
   *
   * Signing in is plain OIDC. `scope` and `rolesClaim` are the two places that
   * were Zitadel-shaped and are now overridable, so jaen works against any
   * provider. Both default to Zitadel's behaviour, so existing sites see no
   * change. `organizationId` is only read while deriving the default scope.
   *
   * User management stays Zitadel-specific and is not affected by either.
   */
  var __JAEN_ZITADEL_GQL__: {
    organizationId?: string
    clientId: string
    authority: string
    redirectUri: string
    projectIds?: string[]
    /** Overrides the derived scope entirely. */
    scope?: string
    /** Where the roles live in the token. Default Zitadel's own claim. */
    rolesClaim?: string
    /** GraphQL endpoint of the zitadel-gql server. Defaults to `${authority}/graphql`. */
    graphqlUrl?: string
  }

  interface Window {
    cookieConsent: CookieConsent

    /**
     * The consent button a visitor pressed before the bundle had hydrated,
     * recorded by the pre-paint script gatsby-plugin-jaen injects and replayed
     * by the banner when it mounts. Set to undefined once React is listening,
     * which is also the signal for that script to stand down.
     */
    __JAEN_COOKIE_CONSENT_EARLY_CLICK__?: string | null
  }
}

import type {PageProps as GatsbyPageProps} from 'gatsby'
import type {IGatsbyImageData} from 'gatsby-plugin-image'
import type * as FaIcons from 'react-icons/fa'

import {IBlockConnection} from './connectors/connect-block'
import {useAuth} from './contexts/auth'

type PageConfigLazyValue<T> =
  | T
  | ((context: {auth: ReturnType<typeof useAuth>}) => Promise<T> | T)

export interface PageConfig {
  label: string
  icon?: keyof typeof FaIcons

  childTemplates?: string[]

  breadcrumbs?: Array<
    PageConfigLazyValue<{
      label: string
      path: string
    }>
  >

  withoutJaenFrame?: boolean
  withoutJaenFrameStickyHeader?: boolean

  menu?: {
    path?: PageConfigLazyValue<string>
    label?: string
    group?: string
    groupLabel?: string
    order?: number
    type?: 'app' | 'user'
  }

  // auth
  auth?: {
    isRequired?: boolean
    isAdminRequired?: boolean
    roles?: string[]
  }

  layout?: {
    name: 'jaen'
    // default: 'content'. 'bare' is the page alone: no top padding, no
    // container and no footer, for the screens a phone shows for a moment
    // between two others (the OIDC callback), where imprint links are noise.
    type?: 'content' | 'form' | 'full' | 'bare'
  }

  showInNodeGraphVisualizer?: boolean
}

interface PageContext {
  pageConfig?: PageConfig
  jaenPageId?: string
}

export interface LayoutProps {
  pageProps: PageProps<
    {
      jaenPage?: JaenPage
      allJaenPage?: {
        nodes: Array<JaenPage>
      }
    },
    PageContext
  >

  children: React.ReactNode
}

export interface MediaNode {
  id: string
  fileUniqueId: string
  createdAt: string
  modifiedAt: string
  preview?: {
    url: string
  }
  url: string
  description?: string
  width: number
  height: number
  revisions?: Array<Omit<MediaNode, 'revisions'>>
  jaenPageId?: string
}

export interface Widget<T = object> {
  id: string
  createdAt: string
  modifiedAt: string
  name: string
  data?: T
}

export interface SiteMetadata {
  title?: string
  description?: string
  siteUrl?: string
  image?: string
  author?: {
    name?: string
  }
  organization: {
    name?: string
    url?: string
    logo?: string
  }
  social?: {
    twitter?: string // twitter username
    fbAppID?: string // FB ANALYTICS
  }
}

export interface ISite {
  siteMetadata: Partial<SiteMetadata>
}

export interface JaenTemplate {
  id: string
  label: string
  childTemplates: Array<JaenTemplate>
}

export interface IJaenView {
  path: string
  label: string
  Icon: React.ComponentType | null
  Component: React.ComponentType
  group?: string
  hasRoutes?: boolean
}

export type IJaenFields = Record<
  string,
  Record<
    string,
    {
      position?: number
      props?: Record<string, any>
      value: any
    }
  >
> | null

/**
 * The picture of a page, in the two shapes a page can carry it.
 *
 * `image` is the plain address and is the only thing pages published before
 * the media reference existed have. It is also what the SEO tags need, so it
 * is never going away.
 *
 * `imageId` and the build-time resolved `imageFile` are the optimised path,
 * added on top. Read them through `resolvePageMetadataImage` rather than by
 * hand, so a consumer never has to know which of the two it got.
 */
export interface JaenPageMetadataImage {
  image?: string | null
  imageId?: string | null
  imageFile?: {
    childImageSharp?: {
      gatsbyImageData: IGatsbyImageData
    } | null
  } | null
}

export interface JaenPageMetadata extends JaenPageMetadataImage {
  title: string
  description: string

  blogPost?: {
    date?: string
    author?: string
    category?: string
  }
}

export interface JaenPage {
  id: string
  slug: string
  path?: string
  createdBy: string
  createdAt: string
  modifiedAt: string
  jaenPageMetadata: Partial<JaenPageMetadata>
  jaenFields: IJaenFields
  mediaNodes: Array<{
    id: string
    description: string
    node: {
      childImageSharp: {
        gatsbyImageData: IGatsbyImageData
      }
    }
  }>
  parentPage: {
    id: string
  } | null
  childPages: Array<{id: string} & Partial<JaenPage>>
  childPagesOrder: string[]
  sections: IJaenSection[]
  [customFieldName: string]: any

  /**
   * Unique identifier of the page component name (e.g. `JaenPageHome`).
   * - Must be unique across all pages.
   * - Used to determine the component to render.
   */
  template: string | null
  /**
   * Path to the component to render.
   *
   * When `component` is null, the `template` is used to determine the component to render.
   */
  component: string | null
  deleted?: boolean
  excludedFromIndex?: boolean

  pageConfig: PageConfig | null
}

export interface IJaenSection {
  fieldName: string
  items: IJaenBlock[]
  ptrHead: string | null
  ptrTail: string | null
  position?: number
  props?: object
}

export interface SectionType {
  id: string
  /**
   * Position of the section inside its SectionField
   */
  position: number
  path: Array<{
    fieldName: string
    sectionId?: string
  }>
  Component?: IBlockConnection
}

export interface IJaenBlock {
  [customFieldName: string]: any
  id: string
  type: string
  ptrPrev: string | null
  ptrNext: string | null
  jaenFields: IJaenFields

  sections?: IJaenSection[]

  deleted?: true
}

export interface IJaenPopup {
  id: string // relative path to the notification file
  active: boolean
  jaenFields: IJaenFields
}

export interface IJaenConnection<ReactProps, Options>
  extends React.FC<ReactProps> {
  options: Options
}

export type PageProps<
  DataType = object,
  PageContextType = object
> = GatsbyPageProps<
  DataType & {
    jaenPage: JaenPage | null
    allJaenPage?: {nodes: Array<Partial<JaenPage>>}
  },
  PageContextType & PageContext
>

export interface IFormProps<Values> {
  values: Values
  onSubmit: (values: Values) => void
  externalValidation?: (
    valueName: keyof Values,
    value: string
  ) => string | undefined
}

export type MigrationData = Record<string, any>
