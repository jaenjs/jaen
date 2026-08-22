export * from './connectors'
export * as zitadelGql from './clients/zitadel-gql'
export {
  AuthenticationProvider,
  useAuth,
  withAuthSecurity,
  checkUserRoles
} from './contexts/auth'
// The login page needs to collect a parked path too, not only the OIDC
// callback: someone who reaches /login already signed in has to be sent back
// where they came from rather than through the provider a second time.
export {rememberReturnTo, takeReturnTo} from './contexts/auth-context'
export {
  AuthUserProvider,
  AuthUser,
  AuthPasswordPolicy,
  useAuthUser
} from './contexts/auth-user'
export {
  CMSManagementProvider,
  useCMSManagementContext,
  DuplicateSlugError
} from './contexts/cms-management'
export {useContentManagement} from './hooks/use-content-management'
export {
  DarkMode,
  LightMode,
  useColorMode,
  useColorModeValue
} from './hooks/use-color-mode'
export type {ColorMode, ColorModeWithSystem} from './hooks/use-color-mode'
export {FieldHighlighterProvider} from './contexts/field-highlighter'
export {
  NotificationsProvider,
  useNotificationsContext
} from './contexts/notifications'
export {usePageContext, useJaenPageIndex, PageProvider} from './contexts/page'
export {useSectionBlockContext, SectionBlockContextType} from './contexts/block'
export {useEditingContext, EditingProvider} from './contexts/editing'
export {usePage} from './hooks/use-page'
export {useSectionField, UseSectionField} from './hooks/use-section-field'
export {Field} from './fields'
export type {ImageFieldProps, TextFieldProps} from './fields'
export {useField} from './hooks/use-field'
export {
  JaenPage,
  JaenPageMetadata,
  JaenPageMetadataImage,
  PageConfig,
  PageProps,
  JaenTemplate,
  MediaNode,
  LayoutProps,
  SiteMetadata,
  ISite as JaenSite,
  Widget
} from './types'
export {
  PageMetadataImage,
  PageMetadataImageProps,
  ResolvedPageMetadataImage,
  resolvePageMetadataImage
} from './components/PageMetadataImage'
export {generatePageOriginPath} from './utils/path'
export * from './utils/open-storage-gateway'

export {useDynamicPaths} from './hooks/use-dynamic-paths'
export {useMediaModal, MediaModalProvider} from './contexts/media-modal'

export {withRedux, useAppSelector} from './redux'

export {
  SiteMetadataProvider,
  useSiteMetadataContext
} from './contexts/site-metadata'

export {
  JaenUpdateModalProvider,
  useJaenUpdateModalContext
} from './contexts/jaen-update-modal'

export {
  bootstrapCookieConsent,
  CookieConsentProvider,
  useCookieConsentContext,
  useCookieConsentCategory,
  COOKIE_CONSENT_CHANGE_EVENT,
  CookieConsentChangeDetail
} from './contexts/cookie-consent'

export {WidgetProvider, useWidgetContext} from './contexts/widget'

export {useWidget} from './hooks/use-widget'

export {Head} from './Head'

export {PhotoProvider} from 'react-photo-view'

export * as osg from './utils/open-storage-gateway'
