/**
 * GQty AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */

import {SchemaUnionsKey, type ScalarsEnumsHash} from 'gqty'

export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends {[key: string]: unknown}> = {
  [K in keyof T]: T[K]
}
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>
}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>
}
export type MakeEmpty<T extends {[key: string]: unknown}, K extends keyof T> = {
  [_ in K]?: never
}
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never
    }
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: {input: string; output: string}
  String: {input: string; output: string}
  Boolean: {input: boolean; output: boolean}
  Int: {input: number; output: number}
  Float: {input: number; output: number}
  Any: {input: any; output: any}
  Date: {input: any; output: any}
  File: {input: any; output: any}
  JSON: {input: any; output: any}
  JSONObject: {
    input: Record<string, unknown>
    output: Record<string, unknown>
  }
  Number: {input: number; output: number}
  Void: {input: any; output: any}
}

export interface StoredFileArgsInput {
  id: Scalars['String']['input']
}

export interface UploadArgsInput {
  driver?: InputMaybe<Scalars['String']['input']>
  /**
   * The **`File`** interface provides information about files and allows JavaScript in a web page to access their content.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/File)
   * `File` class is a global reference for `import { File } from 'node:buffer'`
   * https://nodejs.org/api/buffer.html#class-file
   * @since v20.0.0
   */
  file: Scalars['File']['input']
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  Any: true,
  Boolean: true,
  Date: true,
  File: true,
  Float: true,
  ID: true,
  Int: true,
  JSON: true,
  JSONObject: true,
  Number: true,
  String: true,
  Void: true
}
export const generatedSchema = {
  DriverInfo: {
    __typename: {__type: 'String!'},
    configured: {__type: 'Boolean!'},
    isDefault: {__type: 'Boolean!'},
    name: {__type: 'String!'}
  },
  GitStatus: {
    __typename: {__type: 'String!'},
    branch: {__type: 'String!'},
    head: {__type: 'String'},
    remote: {__type: 'String'},
    root: {__type: 'String!'}
  },
  IStoredFile: {
    __typename: {__type: 'String!'},
    file_id: {__type: 'String!'},
    file_name: {__type: 'String'},
    file_size: {__type: 'Number'},
    file_unique_id: {__type: 'String!'},
    mime_type: {__type: 'String'},
    thumb: {__type: 'Thumb'},
    $on: {__type: '$IStoredFile!'}
  },
  StoredFile: {
    __typename: {__type: 'String!'},
    file_id: {__type: 'String!'},
    file_name: {__type: 'String'},
    file_size: {__type: 'Number'},
    file_unique_id: {__type: 'String!'},
    mime_type: {__type: 'String'},
    thumb: {__type: 'Thumb'}
  },
  StoredFileArgsInput: {id: {__type: 'String!'}},
  Thumb: {
    __typename: {__type: 'String!'},
    file_id: {__type: 'String!'},
    file_size: {__type: 'Number'},
    file_unique_id: {__type: 'String!'},
    height: {__type: 'Number'},
    width: {__type: 'Number'}
  },
  UploadArgsInput: {driver: {__type: 'String'}, file: {__type: 'File!'}},
  UploadResult: {
    __typename: {__type: 'String!'},
    driver: {__type: 'String!'},
    file_id: {__type: 'String!'},
    file_name: {__type: 'String'},
    file_size: {__type: 'Number'},
    file_unique_id: {__type: 'String!'},
    mime_type: {__type: 'String'},
    thumb: {__type: 'Thumb'},
    thumbUrl: {__type: 'String'},
    url: {__type: 'String!'}
  },
  mutation: {
    __typename: {__type: 'String!'},
    upload: {__type: 'UploadResult!', __args: {args: 'UploadArgsInput!'}}
  },
  query: {
    __typename: {__type: 'String!'},
    gitStore: {__type: 'GitStatus!'},
    storageDrivers: {__type: '[DriverInfo!]!'},
    storedFile: {
      __type: 'UploadResult',
      __args: {args: 'StoredFileArgsInput!'}
    }
  },
  subscription: {},
  [SchemaUnionsKey]: {IStoredFile: ['StoredFile', 'UploadResult']}
} as const

export interface DriverInfo {
  __typename?: 'DriverInfo'
  configured: ScalarsEnums['Boolean']
  isDefault: ScalarsEnums['Boolean']
  name: ScalarsEnums['String']
}

export interface GitStatus {
  __typename?: 'GitStatus'
  branch: ScalarsEnums['String']
  head?: Maybe<ScalarsEnums['String']>
  remote?: Maybe<ScalarsEnums['String']>
  root: ScalarsEnums['String']
}

/**
 * A file as the gateway describes it, whichever backend holds the bytes.
 */
export interface IStoredFile {
  __typename?: 'StoredFile' | 'UploadResult'
  /**
   * The opaque handle a caller keeps. Everything except a Telegram id carries
   * a driver prefix -- see `src/id.ts` for why the Telegram ones do not.
   */
  file_id: ScalarsEnums['String']
  file_name?: Maybe<ScalarsEnums['String']>
  file_size?: Maybe<ScalarsEnums['Number']>
  /**
   * Telegram's second, shorter identifier. Carried because the old gateway
   * returned it verbatim and consumers may have stored it; drivers that have
   * no such concept repeat `file_id`.
   */
  file_unique_id: ScalarsEnums['String']
  mime_type?: Maybe<ScalarsEnums['String']>
  /**
   * Only Telegram produces these, and only for images.
   */
  thumb?: Maybe<Thumb>
  $on: $IStoredFile
}

/**
 * A file as the gateway describes it, whichever backend holds the bytes.
 */
export interface StoredFile {
  __typename?: 'StoredFile'
  /**
   * The opaque handle a caller keeps. Everything except a Telegram id carries
   * a driver prefix -- see `src/id.ts` for why the Telegram ones do not.
   */
  file_id: ScalarsEnums['String']
  file_name?: Maybe<ScalarsEnums['String']>
  file_size?: Maybe<ScalarsEnums['Number']>
  /**
   * Telegram's second, shorter identifier. Carried because the old gateway
   * returned it verbatim and consumers may have stored it; drivers that have
   * no such concept repeat `file_id`.
   */
  file_unique_id: ScalarsEnums['String']
  mime_type?: Maybe<ScalarsEnums['String']>
  /**
   * Only Telegram produces these, and only for images.
   */
  thumb?: Maybe<Thumb>
}

export interface Thumb {
  __typename?: 'Thumb'
  file_id: ScalarsEnums['String']
  file_size?: Maybe<ScalarsEnums['Number']>
  file_unique_id: ScalarsEnums['String']
  height?: Maybe<ScalarsEnums['Number']>
  width?: Maybe<ScalarsEnums['Number']>
}

export interface UploadResult {
  __typename?: 'UploadResult'
  /**
   * Where the bytes went.
   */
  driver: ScalarsEnums['String']
  /**
   * The opaque handle a caller keeps. Everything except a Telegram id carries
   * a driver prefix -- see `src/id.ts` for why the Telegram ones do not.
   */
  file_id: ScalarsEnums['String']
  file_name?: Maybe<ScalarsEnums['String']>
  file_size?: Maybe<ScalarsEnums['Number']>
  /**
   * Telegram's second, shorter identifier. Carried because the old gateway
   * returned it verbatim and consumers may have stored it; drivers that have
   * no such concept repeat `file_id`.
   */
  file_unique_id: ScalarsEnums['String']
  mime_type?: Maybe<ScalarsEnums['String']>
  /**
   * Only Telegram produces these, and only for images.
   */
  thumb?: Maybe<Thumb>
  thumbUrl?: Maybe<ScalarsEnums['String']>
  /**
   * Ready-to-use URL. The only route that serves bytes.
   */
  url: ScalarsEnums['String']
}

export interface Mutation {
  __typename?: 'Mutation'
  /**
   * Stores a file and returns its handle.
   *
   * `driver` picks the backend; omitted, it follows DEFAULT_DRIVER. The
   * upload rides the GraphQL multipart request spec, which graphql-yoga
   * implements underneath Pylon, so `file` is a real File.
   */
  upload: (args: {args: UploadArgsInput}) => UploadResult
}

export interface Query {
  __typename?: 'Query'
  /**
   * State of the git-backed store, for operators.
   */
  gitStore: GitStatus
  /**
   * The backends this gateway can use, and which of them are usable.
   */
  storageDrivers: Array<DriverInfo>
  /**
   * Metadata for a stored file, without transferring it.
   *
   * Null when the id is unknown -- there is no separate `exists` flag,
   * because the null already says it. It does read the bytes to answer,
   * since no backend here keeps a metadata index; worth knowing before
   * calling it in a loop.
   */
  storedFile: (args: {args: StoredFileArgsInput}) => Maybe<UploadResult>
}

export interface Subscription {
  __typename?: 'Subscription'
}

export interface $IStoredFile {
  StoredFile?: StoredFile
  UploadResult?: UploadResult
}

export interface GeneratedSchema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

export type ScalarsEnums = {
  [Key in keyof Scalars]: Scalars[Key] extends {output: unknown}
    ? Scalars[Key]['output']
    : never
} & {}
