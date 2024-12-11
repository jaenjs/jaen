/**
 * GQty AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */

import {type ScalarsEnumsHash} from 'gqty'

export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]}
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
  | {[P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never}
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: {input: string; output: string}
  String: {input: string; output: string}
  Boolean: {input: boolean; output: boolean}
  Int: {input: number; output: number}
  Float: {input: number; output: number}
  Any: {input: any; output: any}
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.This scalar is serialized to a string in ISO 8601 format and parsed from a string in ISO 8601 format. */
  DateTimeISO: {input: any; output: any}
  File: {input: any; output: any}
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: {input: any; output: any}
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: {input: any; output: any}
  /** Custom scalar that handles both integers and floats */
  Number: {input: any; output: any}
  /** Represents NULL values */
  Void: {input: any; output: any}
}

export interface EnvelopeInput {
  replyTo?: InputMaybe<Scalars['String']['input']>
  subject: Scalars['String']['input']
  to: Array<Scalars['String']['input']>
}

export interface EnvelopeInput_1 {
  replyTo?: InputMaybe<Scalars['String']['input']>
  subject?: InputMaybe<Scalars['String']['input']>
  to?: InputMaybe<Array<Scalars['String']['input']>>
}

export interface EnvelopeInput_2 {
  replyTo?: InputMaybe<Scalars['String']['input']>
  subject?: InputMaybe<Scalars['String']['input']>
  to?: InputMaybe<Array<Scalars['String']['input']>>
}

export interface EnvelopeInput_3 {
  replyTo?: InputMaybe<Scalars['String']['input']>
  subject?: InputMaybe<Scalars['String']['input']>
  to?: InputMaybe<Array<Scalars['String']['input']>>
}

export interface InputInput {
  content: Scalars['String']['input']
  description: Scalars['String']['input']
  envelope: EnvelopeInput_2
  variables: Array<VariablesInput>
}

export interface InputInput_1 {
  content?: InputMaybe<Scalars['String']['input']>
  description?: InputMaybe<Scalars['String']['input']>
  envelope: EnvelopeInput_3
  parentId?: InputMaybe<Scalars['String']['input']>
  variables: Array<VariablesInput_1>
  verifyReplyTo?: InputMaybe<Scalars['Boolean']['input']>
}

export enum OAuthProvider {
  AZURE = 'AZURE',
  GOOGLE = 'GOOGLE'
}

export enum OAuthProviderInput {
  AZURE = 'AZURE',
  GOOGLE = 'GOOGLE'
}

export interface OmitInput {
  host: Scalars['String']['input']
  password: Scalars['String']['input']
  port: Scalars['Int']['input']
  secure: Scalars['Boolean']['input']
}

export interface SMTPOptionsInput {
  host: Scalars['String']['input']
  password: Scalars['String']['input']
  port: Scalars['Int']['input']
  secure: Scalars['Boolean']['input']
  user: Scalars['String']['input']
}

export interface VariablesInput {
  defaultValue?: InputMaybe<Scalars['String']['input']>
  description?: InputMaybe<Scalars['String']['input']>
  isConstant?: InputMaybe<Scalars['Boolean']['input']>
  isRequired?: InputMaybe<Scalars['Boolean']['input']>
  name: Scalars['String']['input']
}

export interface VariablesInput_1 {
  defaultValue?: InputMaybe<Scalars['String']['input']>
  description?: InputMaybe<Scalars['String']['input']>
  isConstant?: InputMaybe<Scalars['Boolean']['input']>
  isRequired?: InputMaybe<Scalars['Boolean']['input']>
  name: Scalars['String']['input']
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  Any: true,
  Boolean: true,
  DateTimeISO: true,
  File: true,
  ID: true,
  Int: true,
  JSON: true,
  JSONObject: true,
  Number: true,
  OAuthProvider: true,
  OAuthProviderInput: true,
  String: true,
  Void: true
}
export const generatedSchema = {
  Connection: {
    __typename: {__type: 'String!'},
    edges: {__type: '[Edge!]!'},
    nodes: {__type: '[Template!]!'},
    pageInfo: {__type: 'PageInfo!'},
    totalCount: {__type: 'Number!'}
  },
  Creator: {
    __typename: {__type: 'String!'},
    email: {__type: 'Email'},
    id: {__type: 'String!'},
    organization: {__type: 'Organization!'},
    organizationId: {__type: 'String!'}
  },
  Edge: {
    __typename: {__type: 'String!'},
    cursor: {__type: 'String!'},
    node: {__type: 'Template!'}
  },
  Email: {
    __typename: {__type: 'String!'},
    creator: {__type: 'Creator'},
    email: {__type: 'String!'},
    id: {__type: 'String!'},
    isEnabled: {__type: 'Boolean!'},
    oauthConfig: {__type: 'OauthConfig'},
    smtpConfig: {__type: 'SmtpConfig'},
    userId: {__type: 'String'}
  },
  Email_1: {
    __typename: {__type: 'String!'},
    creator: {__type: 'Creator'},
    email: {__type: 'String!'},
    id: {__type: 'String!'},
    isEnabled: {__type: 'Boolean!'},
    oauthConfig: {__type: 'OauthConfig'},
    smtpConfig: {__type: 'SmtpConfig'},
    userId: {__type: 'String'}
  },
  Envelope: {
    __typename: {__type: 'String!'},
    emailTemplateId: {__type: 'String!'},
    id: {__type: 'String!'},
    replyTo: {__type: 'String'},
    subject: {__type: 'String'},
    to: {__type: '[String!]!'}
  },
  EnvelopeInput: {
    replyTo: {__type: 'String'},
    subject: {__type: 'String!'},
    to: {__type: '[String!]!'}
  },
  EnvelopeInput_1: {
    replyTo: {__type: 'String'},
    subject: {__type: 'String'},
    to: {__type: '[String!]'}
  },
  EnvelopeInput_2: {
    replyTo: {__type: 'String'},
    subject: {__type: 'String'},
    to: {__type: '[String!]'}
  },
  EnvelopeInput_3: {
    replyTo: {__type: 'String'},
    subject: {__type: 'String'},
    to: {__type: '[String!]'}
  },
  InputInput: {
    content: {__type: 'String!'},
    description: {__type: 'String!'},
    envelope: {__type: 'EnvelopeInput_2!'},
    variables: {__type: '[VariablesInput!]!'}
  },
  InputInput_1: {
    content: {__type: 'String'},
    description: {__type: 'String'},
    envelope: {__type: 'EnvelopeInput_3!'},
    parentId: {__type: 'String'},
    variables: {__type: '[VariablesInput_1!]!'},
    verifyReplyTo: {__type: 'Boolean'}
  },
  OauthConfig: {
    __typename: {__type: 'String!'},
    accessToken: {__type: 'String!'},
    accessTokenExpiresAt: {__type: 'DateTimeISO!'},
    emailId: {__type: 'String!'},
    id: {__type: 'String!'},
    provider: {__type: 'OAuthProvider!'},
    refreshToken: {__type: 'String!'}
  },
  OmitInput: {
    host: {__type: 'String!'},
    password: {__type: 'String!'},
    port: {__type: 'Int!'},
    secure: {__type: 'Boolean!'}
  },
  Organization: {
    __typename: {__type: 'String!'},
    email: {__type: 'Email'},
    emailId: {__type: 'String'},
    emailTemplate: {__type: 'Template', __args: {id: 'String!'}},
    emailTemplates: {
      __type: 'Connection!',
      __args: {
        after: 'String',
        before: 'String',
        filters: 'JSONObject',
        first: 'Number',
        last: 'Number'
      }
    },
    id: {__type: 'String!'},
    redirectUrl: {__type: 'String'}
  },
  PageInfo: {
    __typename: {__type: 'String!'},
    endCursor: {__type: 'String'},
    hasNextPage: {__type: 'Boolean!'},
    hasPreviousPage: {__type: 'Boolean!'},
    startCursor: {__type: 'String'}
  },
  SMTPOptionsInput: {
    host: {__type: 'String!'},
    password: {__type: 'String!'},
    port: {__type: 'Int!'},
    secure: {__type: 'Boolean!'},
    user: {__type: 'String!'}
  },
  SmtpConfig: {
    __typename: {__type: 'String!'},
    emailId: {__type: 'String!'},
    host: {__type: 'String!'},
    id: {__type: 'String!'},
    password: {__type: 'String!'},
    port: {__type: 'Number!'},
    secure: {__type: 'Boolean!'},
    username: {__type: 'String!'}
  },
  Template: {
    __typename: {__type: 'String!'},
    content: {__type: 'String!'},
    createdAt: {__type: 'DateTimeISO!'},
    creatorId: {__type: 'String!'},
    description: {__type: 'String!'},
    envelope: {__type: 'Envelope'},
    id: {__type: 'String!'},
    links: {__type: '[Template!]!'},
    parent: {__type: 'Template'},
    parentId: {__type: 'String'},
    senderEmail: {__type: 'Email_1!'},
    transformer: {__type: 'String'},
    updatedAt: {__type: 'DateTimeISO!'},
    variables: {__type: '[Variables!]!'},
    verifyReplyTo: {__type: 'Boolean'}
  },
  User: {
    __typename: {__type: 'String!'},
    email: {__type: 'Email'},
    id: {__type: 'String!'},
    organization: {__type: 'Organization!'},
    organizationId: {__type: 'String!'}
  },
  Variables: {
    __typename: {__type: 'String!'},
    defaultValue: {__type: 'String'},
    description: {__type: 'String'},
    emailTemplateId: {__type: 'String'},
    id: {__type: 'String!'},
    isConstant: {__type: 'Boolean'},
    isRequired: {__type: 'Boolean'},
    name: {__type: 'String!'}
  },
  VariablesInput: {
    defaultValue: {__type: 'String'},
    description: {__type: 'String'},
    isConstant: {__type: 'Boolean'},
    isRequired: {__type: 'Boolean'},
    name: {__type: 'String!'}
  },
  VariablesInput_1: {
    defaultValue: {__type: 'String'},
    description: {__type: 'String'},
    isConstant: {__type: 'Boolean'},
    isRequired: {__type: 'Boolean'},
    name: {__type: 'String!'}
  },
  _createOAuthApp: {
    __typename: {__type: 'String!'},
    clientId: {__type: 'String!'},
    clientSecret: {__type: 'String!'},
    id: {__type: 'String!'},
    organizationId: {__type: 'String!'},
    type: {__type: 'OAuthProvider!'}
  },
  mutation: {
    __typename: {__type: 'String!'},
    oauthAppCreate: {
      __type: '_createOAuthApp!',
      __args: {
        clientId: 'String!',
        clientSecret: 'String!',
        type: 'OAuthProviderInput!'
      }
    },
    oauthAppDelete: {__type: '_createOAuthApp!', __args: {id: 'String!'}},
    organizationSetEmail: {
      __type: 'SmtpConfig!',
      __args: {config: 'OmitInput!', email: 'String!'}
    },
    sendEmail: {
      __type: 'String!',
      __args: {body: 'String', bodyHTML: 'String', envelope: 'EnvelopeInput!'}
    },
    sendTemplateMail: {
      __type: 'String!',
      __args: {envelope: 'EnvelopeInput_1', id: 'String!', values: 'JSONObject'}
    },
    templateCreate: {__type: 'Template!', __args: {input: 'InputInput!'}},
    templateDelete: {__type: 'Boolean!', __args: {id: 'String!'}},
    templateTransformer: {
      __type: 'Template!',
      __args: {id: 'ID!', transformer: 'String!'}
    },
    templateUpdate: {
      __type: 'Template!',
      __args: {id: 'String!', input: 'InputInput_1!'}
    },
    userEmailCreate: {
      __type: 'SmtpConfig!',
      __args: {config: 'OmitInput!', email: 'String!'}
    },
    userEmailDelete: {__type: 'Email!'},
    userEmailUpdate: {
      __type: 'SmtpConfig!',
      __args: {config: 'OmitInput!', email: 'String!'}
    }
  },
  query: {
    __typename: {__type: 'String!'},
    allTemplate: {
      __type: 'Connection!',
      __args: {
        after: 'String',
        before: 'String',
        filters: 'JSONObject',
        first: 'Number',
        last: 'Number'
      }
    },
    me: {__type: 'User!'},
    template: {__type: 'Template', __args: {id: 'String!'}}
  },
  subscription: {}
} as const

export interface Connection {
  __typename?: 'Connection'
  edges: Array<Edge>
  nodes: Array<Template>
  pageInfo: PageInfo
  totalCount: ScalarsEnums['Number']
}

export interface Creator {
  __typename?: 'Creator'
  email?: Maybe<Email>
  id: ScalarsEnums['String']
  organization: Organization
  organizationId: ScalarsEnums['String']
}

export interface Edge {
  __typename?: 'Edge'
  cursor: ScalarsEnums['String']
  node: Template
}

export interface Email {
  __typename?: 'Email'
  creator?: Maybe<Creator>
  email: ScalarsEnums['String']
  id: ScalarsEnums['String']
  isEnabled: ScalarsEnums['Boolean']
  oauthConfig?: Maybe<OauthConfig>
  smtpConfig?: Maybe<SmtpConfig>
  userId?: Maybe<ScalarsEnums['String']>
}

export interface Email_1 {
  __typename?: 'Email_1'
  creator?: Maybe<Creator>
  email: ScalarsEnums['String']
  id: ScalarsEnums['String']
  isEnabled: ScalarsEnums['Boolean']
  oauthConfig?: Maybe<OauthConfig>
  smtpConfig?: Maybe<SmtpConfig>
  userId?: Maybe<ScalarsEnums['String']>
}

export interface Envelope {
  __typename?: 'Envelope'
  emailTemplateId: ScalarsEnums['String']
  id: ScalarsEnums['String']
  replyTo?: Maybe<ScalarsEnums['String']>
  subject?: Maybe<ScalarsEnums['String']>
  to: Array<ScalarsEnums['String']>
}

export interface OauthConfig {
  __typename?: 'OauthConfig'
  accessToken: ScalarsEnums['String']
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  accessTokenExpiresAt: ScalarsEnums['DateTimeISO']
  emailId: ScalarsEnums['String']
  id: ScalarsEnums['String']
  provider: ScalarsEnums['OAuthProvider']
  refreshToken: ScalarsEnums['String']
}

export interface Organization {
  __typename?: 'Organization'
  email?: Maybe<Email>
  emailId?: Maybe<ScalarsEnums['String']>
  emailTemplate: (args: {id: ScalarsEnums['String']}) => Maybe<Template>
  emailTemplates: (args?: {
    after?: Maybe<ScalarsEnums['String']>
    before?: Maybe<ScalarsEnums['String']>
    filters?: Maybe<ScalarsEnums['JSONObject']>
    first?: Maybe<ScalarsEnums['Number']>
    last?: Maybe<ScalarsEnums['Number']>
  }) => Connection
  id: ScalarsEnums['String']
  redirectUrl?: Maybe<ScalarsEnums['String']>
}

export interface PageInfo {
  __typename?: 'PageInfo'
  endCursor?: Maybe<ScalarsEnums['String']>
  hasNextPage: ScalarsEnums['Boolean']
  hasPreviousPage: ScalarsEnums['Boolean']
  startCursor?: Maybe<ScalarsEnums['String']>
}

export interface SmtpConfig {
  __typename?: 'SmtpConfig'
  emailId: ScalarsEnums['String']
  host: ScalarsEnums['String']
  id: ScalarsEnums['String']
  password: ScalarsEnums['String']
  port: ScalarsEnums['Number']
  secure: ScalarsEnums['Boolean']
  username: ScalarsEnums['String']
}

export interface Template {
  __typename?: 'Template'
  content: ScalarsEnums['String']
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  createdAt: ScalarsEnums['DateTimeISO']
  creatorId: ScalarsEnums['String']
  description: ScalarsEnums['String']
  envelope?: Maybe<Envelope>
  id: ScalarsEnums['String']
  links: Array<Template>
  parent?: Maybe<Template>
  parentId?: Maybe<ScalarsEnums['String']>
  senderEmail: Email_1
  transformer?: Maybe<ScalarsEnums['String']>
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  updatedAt: ScalarsEnums['DateTimeISO']
  variables: Array<Variables>
  verifyReplyTo?: Maybe<ScalarsEnums['Boolean']>
}

export interface User {
  __typename?: 'User'
  email?: Maybe<Email>
  id: ScalarsEnums['String']
  organization: Organization
  organizationId: ScalarsEnums['String']
}

export interface Variables {
  __typename?: 'Variables'
  defaultValue?: Maybe<ScalarsEnums['String']>
  description?: Maybe<ScalarsEnums['String']>
  emailTemplateId?: Maybe<ScalarsEnums['String']>
  id: ScalarsEnums['String']
  isConstant?: Maybe<ScalarsEnums['Boolean']>
  isRequired?: Maybe<ScalarsEnums['Boolean']>
  name: ScalarsEnums['String']
}

export interface _createOAuthApp {
  __typename?: '_createOAuthApp'
  clientId: ScalarsEnums['String']
  clientSecret: ScalarsEnums['String']
  id: ScalarsEnums['String']
  organizationId: ScalarsEnums['String']
  type: ScalarsEnums['OAuthProvider']
}

export interface Mutation {
  __typename?: 'Mutation'
  oauthAppCreate: (args: {
    clientId: ScalarsEnums['String']
    clientSecret: ScalarsEnums['String']
    type: OAuthProviderInput
  }) => _createOAuthApp
  oauthAppDelete: (args: {id: ScalarsEnums['String']}) => _createOAuthApp
  organizationSetEmail: (args: {
    config: OmitInput
    email: ScalarsEnums['String']
  }) => SmtpConfig
  sendEmail: (args: {
    body?: Maybe<ScalarsEnums['String']>
    bodyHTML?: Maybe<ScalarsEnums['String']>
    envelope: EnvelopeInput
  }) => ScalarsEnums['String']
  sendTemplateMail: (args: {
    envelope?: Maybe<EnvelopeInput_1>
    id: ScalarsEnums['String']
    values?: Maybe<ScalarsEnums['JSONObject']>
  }) => ScalarsEnums['String']
  templateCreate: (args: {input: InputInput}) => Template
  templateDelete: (args: {
    id: ScalarsEnums['String']
  }) => ScalarsEnums['Boolean']
  templateTransformer: (args: {
    id: ScalarsEnums['ID']
    transformer: ScalarsEnums['String']
  }) => Template
  templateUpdate: (args: {
    id: ScalarsEnums['String']
    input: InputInput_1
  }) => Template
  userEmailCreate: (args: {
    config: OmitInput
    email: ScalarsEnums['String']
  }) => SmtpConfig
  userEmailDelete: Email
  userEmailUpdate: (args: {
    config: OmitInput
    email: ScalarsEnums['String']
  }) => SmtpConfig
}

export interface Query {
  __typename?: 'Query'
  allTemplate: (args?: {
    after?: Maybe<ScalarsEnums['String']>
    before?: Maybe<ScalarsEnums['String']>
    filters?: Maybe<ScalarsEnums['JSONObject']>
    first?: Maybe<ScalarsEnums['Number']>
    last?: Maybe<ScalarsEnums['Number']>
  }) => Connection
  me: User
  template: (args: {id: ScalarsEnums['String']}) => Maybe<Template>
}

export interface Subscription {
  __typename?: 'Subscription'
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
} & {
  OAuthProvider: OAuthProvider
  OAuthProviderInput: OAuthProviderInput
}
