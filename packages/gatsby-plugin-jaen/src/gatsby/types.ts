import {PluginOptions} from 'gatsby'
import type {feedbackIntegration} from '@sentry/gatsby'

export interface JaenPluginOptions extends PluginOptions {
  zitadel: {
    organizationId: string
    clientId: string
    authority: string
    redirectUri: string
  }

  googleAnalytics?: {
    trackingIds?: string[]
  }

  sentry?: {
    org: string
    project: string
    dsn: string
    feedbackIntegration?: Parameters<typeof feedbackIntegration>[0]
  }
}
