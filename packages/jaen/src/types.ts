import {IUser} from './services/api/types'

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export interface IJaenConfig {
  templates: {
    rootDir: string
    paths: {
      [templateName: string]: string
    }
  }
  staticDataPath: string
}

export interface IJaenStaticData {
  [appname: string]: any
}

export interface IJaenConnection<ReactProps, Options>
  extends React.FC<ReactProps> {
  options: Options
}

export interface IAuth {
  isAuthenticated: boolean
  user: IUser | null
}
