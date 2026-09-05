// src/index.ts
//
// The package entry, which is what package.json's `main` and `types` point
// at. Gatsby never reads it: the two sites list the plugin in gatsby-config
// and the screens are the pages under src/pages. It names the few things a
// site could import from the package on purpose, and nothing else.
//
// The 2500 line data layer that used to live here is gone. What it had that
// the reduced layer lacked is back in its proper place: the role split as
// useCaller in shared/auth.ts, the toasts as shared/components/toaster.tsx,
// and the driver's position sharing in shared/views/MeView.tsx.
export {useCaller, resetCaller} from '../shared/auth'
export {usePushNotifications} from './hooks/usePushNotifications'
export {AppWrapper} from './AppWrapper'
export {useI18nCode} from '../shared/i18n'
