import {DeepPartial} from '@reduxjs/toolkit'

import {SiteRoutingSpecs, SiteType} from '../types'

export interface AuthState {
  authenticated: boolean
  loading: boolean
  isGuest?: boolean
}

export interface SiteState extends DeepPartial<SiteType> {
  routing: SiteRoutingSpecs
}

export type OptionsState = {
  isEditing: boolean
}

export type SFState = {
  initBackendLink?: string
}
