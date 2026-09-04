/**
 * GQty AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */

import { SchemaUnionsKey, type ScalarsEnumsHash } from 'gqty';

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Any: { input: any; output: any };
  Date: { input: any; output: any };
  File: { input: any; output: any };
  JSON: { input: any; output: any };
  JSONObject: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  Number: { input: number; output: number };
  Void: { input: any; output: any };
}

export interface BookTransferArgsInput {
  details?: InputMaybe<DetailsInput>;
  dropoffLocation: Scalars['String']['input'];
  extras?: InputMaybe<Array<ExtrasInput>>;
  passengers?: InputMaybe<Array<PassengersInput>>;
  payingParty?: InputMaybe<Scalars['String']['input']>;
  paymentMethode?: InputMaybe<Scalars['String']['input']>;
  pickupDateTime: Scalars['String']['input'];
  pickupLocation: Scalars['String']['input'];
  referenceId?: InputMaybe<Scalars['String']['input']>;
  subject?: InputMaybe<Scalars['String']['input']>;
}

export enum CarClass {
  BUSINESS_CLASS = 'BUSINESS_CLASS',
  BUSINESS_VAN = 'BUSINESS_VAN',
  ELECTRIC_CLASS = 'ELECTRIC_CLASS',
  FIRST_CLASS = 'FIRST_CLASS'
}

export interface CarsArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  driverId?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  skip?: InputMaybe<Scalars['Number']['input']>;
  take?: InputMaybe<Scalars['Number']['input']>;
}

export interface CreateTransferArgsInput {
  carId?: InputMaybe<Scalars['String']['input']>;
  customerId: Scalars['String']['input'];
  details?: InputMaybe<DetailsInput>;
  dropoffLocation: Scalars['String']['input'];
  extras?: InputMaybe<Array<ExtrasInput>>;
  passengers?: InputMaybe<Array<PassengersInput>>;
  payingParty?: InputMaybe<Scalars['String']['input']>;
  paymentMethode?: InputMaybe<Scalars['String']['input']>;
  pickupDateTime: Scalars['String']['input'];
  pickupLocation: Scalars['String']['input'];
  price?: InputMaybe<Scalars['Number']['input']>;
  referenceId?: InputMaybe<Scalars['String']['input']>;
  subject?: InputMaybe<Scalars['String']['input']>;
}

export interface CurrentUserArgsInput {
  organizationId?: InputMaybe<Scalars['String']['input']>;
}

export interface CustomerLocationsArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  skip?: InputMaybe<Scalars['Number']['input']>;
  take?: InputMaybe<Scalars['Number']['input']>;
}

export interface DataArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
}

export interface DetailsInput {
  childSeats?: InputMaybe<Scalars['String']['input']>;
  extraTime?: InputMaybe<Scalars['String']['input']>;
  flightNumber?: InputMaybe<Scalars['String']['input']>;
  luggage?: InputMaybe<Scalars['String']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  preferredCarClass?: InputMaybe<Scalars['String']['input']>;
  preferredCarName?: InputMaybe<Scalars['String']['input']>;
  transferCategory?: InputMaybe<TransferCategory>;
  transferType?: InputMaybe<TransferType>;
}

export interface DriverLocationsArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  skip?: InputMaybe<Scalars['Number']['input']>;
  take?: InputMaybe<Scalars['Number']['input']>;
}

export enum ExtraType {
  BOOSTER_SEAT = 'BOOSTER_SEAT',
  CHILD_SEAT = 'CHILD_SEAT',
  EXTRA_LUGGAGE = 'EXTRA_LUGGAGE',
  MEET_AND_GREET = 'MEET_AND_GREET',
  PET_TRANSPORT = 'PET_TRANSPORT',
  WAITING_TIME = 'WAITING_TIME',
  WATER_BOTTLE = 'WATER_BOTTLE',
  WHEELCHAIR = 'WHEELCHAIR'
}

export interface ExtrasArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
}

export interface ExtrasInput {
  amount?: InputMaybe<Scalars['Number']['input']>;
  type: Scalars['String']['input'];
}

export interface GrantsArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
}

export interface IsUniqueArgsInput {
  loginName: Scalars['String']['input'];
}

export interface KeysInput {
  auth?: InputMaybe<Scalars['String']['input']>;
  p256dh?: InputMaybe<Scalars['String']['input']>;
}

export interface PassengersArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
}

export interface PassengersInput {
  email?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
}

export enum PayingParty {
  CUSTOMER = 'CUSTOMER',
  PASSENGER = 'PASSENGER'
}

export enum PaymentMethode {
  CARD = 'CARD',
  CASH = 'CASH',
  INVOICE = 'INVOICE',
  VOUCHER = 'VOUCHER'
}

export interface ProfilesArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
  organizationId?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['String']['input'];
}

export interface ProfilesArgsInput_1 {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
}

export interface ReferencedByArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
}

export interface RolesArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
}

export interface SetDriverLocationArgsInput {
  accuracy?: InputMaybe<Scalars['Number']['input']>;
  altitude?: InputMaybe<Scalars['Number']['input']>;
  altitudeAccuracy?: InputMaybe<Scalars['Number']['input']>;
  heading?: InputMaybe<Scalars['Number']['input']>;
  latitude: Scalars['Number']['input'];
  longitude: Scalars['Number']['input'];
  recordedAtISO?: InputMaybe<Scalars['String']['input']>;
  speed?: InputMaybe<Scalars['Number']['input']>;
}

export interface SetPushSubscriptionsSubscriptionsInput {
  deviceId?: InputMaybe<Scalars['String']['input']>;
  endpoint: Scalars['String']['input'];
  expirationTime?: InputMaybe<Scalars['Number']['input']>;
  keys?: InputMaybe<KeysInput>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
}

export enum TransferCategory {
  DISTANCE = 'DISTANCE',
  FLATRATE = 'FLATRATE',
  HOURLY = 'HOURLY'
}

export enum TransferState {
  ABORTED = 'ABORTED',
  ASSIGNED = 'ASSIGNED',
  AT_PICKUP = 'AT_PICKUP',
  CANCELED = 'CANCELED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NO_SHOW = 'NO_SHOW',
  ONGOING = 'ONGOING',
  ON_THE_WAY = 'ON_THE_WAY',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  TERMINATED = 'TERMINATED'
}

export enum TransferType {
  ONE_WAY = 'ONE_WAY',
  RETURN_TRIP = 'RETURN_TRIP'
}

export interface TransfersArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  customerId?: InputMaybe<Scalars['String']['input']>;
  driverId?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  fromISO?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Number']['input']>;
  state?: InputMaybe<TransferState>;
  take?: InputMaybe<Scalars['Number']['input']>;
  toISO?: InputMaybe<Scalars['String']['input']>;
}

export interface UserArgsInput {
  id: Scalars['String']['input'];
  organizationId?: InputMaybe<Scalars['String']['input']>;
}

export interface UserDataArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
  organizationId?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['String']['input'];
}

export enum UserState {
  USER_STATE_ACTIVE = 'USER_STATE_ACTIVE',
  USER_STATE_DELETED = 'USER_STATE_DELETED',
  USER_STATE_INACTIVE = 'USER_STATE_INACTIVE',
  USER_STATE_INITIAL = 'USER_STATE_INITIAL',
  USER_STATE_LOCKED = 'USER_STATE_LOCKED',
  USER_STATE_UNSPECIFIED = 'USER_STATE_UNSPECIFIED'
}

export interface UsersArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
  limit?: InputMaybe<Scalars['Number']['input']>;
  organizationId?: InputMaybe<Scalars['String']['input']>;
}

export interface UsersByRoleArgsInput {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Number']['input']>;
  last?: InputMaybe<Scalars['Number']['input']>;
  limit?: InputMaybe<Scalars['Number']['input']>;
  organizationId?: InputMaybe<Scalars['String']['input']>;
  roleKey: Scalars['String']['input'];
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  Any: true,
  Boolean: true,
  CarClass: true,
  Date: true,
  ExtraType: true,
  File: true,
  Float: true,
  ID: true,
  Int: true,
  JSON: true,
  JSONObject: true,
  Number: true,
  PayingParty: true,
  PaymentMethode: true,
  String: true,
  TransferCategory: true,
  TransferState: true,
  TransferType: true,
  UserState: true,
  Void: true
};
export const generatedSchema = {
  BookTransferArgsInput: {
    details: { __type: 'DetailsInput' },
    dropoffLocation: { __type: 'String!' },
    extras: { __type: '[ExtrasInput!]' },
    passengers: { __type: '[PassengersInput!]' },
    payingParty: { __type: 'String' },
    paymentMethode: { __type: 'String' },
    pickupDateTime: { __type: 'String!' },
    pickupLocation: { __type: 'String!' },
    referenceId: { __type: 'String' },
    subject: { __type: 'String' }
  },
  Car: {
    __typename: { __type: 'String!' },
    carClass: { __type: 'CarClass' },
    carName: { __type: 'String' },
    color: { __type: 'String!' },
    createdAt: { __type: 'Date!' },
    driver: { __type: 'IUserNode' },
    driverId: { __type: 'String' },
    driverName: { __type: 'String' },
    id: { __type: 'ID!' },
    licensePlate: { __type: 'String!' },
    updatedAt: { __type: 'Date!' }
  },
  CarConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[CarEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  CarEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'Car!' }
  },
  Car_1PrismaCarNode: {
    __typename: { __type: 'String!' },
    carClass: { __type: 'CarClass' },
    carName: { __type: 'String' },
    color: { __type: 'String!' },
    createdAt: { __type: 'Date!' },
    driverId: { __type: 'String' },
    id: { __type: 'String!' },
    licensePlate: { __type: 'String!' },
    updatedAt: { __type: 'Date!' }
  },
  CarsArgsInput: {
    after: { __type: 'String' },
    driverId: { __type: 'String' },
    first: { __type: 'Number' },
    skip: { __type: 'Number' },
    take: { __type: 'Number' }
  },
  CreateTransferArgsInput: {
    carId: { __type: 'String' },
    customerId: { __type: 'String!' },
    details: { __type: 'DetailsInput' },
    dropoffLocation: { __type: 'String!' },
    extras: { __type: '[ExtrasInput!]' },
    passengers: { __type: '[PassengersInput!]' },
    payingParty: { __type: 'String' },
    paymentMethode: { __type: 'String' },
    pickupDateTime: { __type: 'String!' },
    pickupLocation: { __type: 'String!' },
    price: { __type: 'Number' },
    referenceId: { __type: 'String' },
    subject: { __type: 'String' }
  },
  CurrentUserArgsInput: { organizationId: { __type: 'String' } },
  CustomerData: {
    __typename: { __type: 'String!' },
    createdAt: { __type: 'Date!' },
    id: { __type: 'ID!' },
    transfers: {
      __type: 'TransferConnection!',
      __args: { args: 'TransfersArgsInput' }
    },
    updatedAt: { __type: 'Date!' },
    user: { __type: 'IUserNode' },
    userId: { __type: 'String!' }
  },
  CustomerLocation: {
    __typename: { __type: 'String!' },
    accuracy: { __type: 'Number' },
    altitude: { __type: 'Number' },
    altitudeAccuracy: { __type: 'Number' },
    createdAt: { __type: 'Date!' },
    customer: { __type: 'IUserNode' },
    customerId: { __type: 'String!' },
    heading: { __type: 'Number' },
    id: { __type: 'ID!' },
    latitude: { __type: 'Number!' },
    longitude: { __type: 'Number!' },
    recordedAt: { __type: 'Date' },
    speed: { __type: 'Number' },
    updatedAt: { __type: 'Date!' }
  },
  CustomerLocationConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[CustomerLocationEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  CustomerLocationEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'CustomerLocation!' }
  },
  CustomerLocationsArgsInput: {
    after: { __type: 'String' },
    first: { __type: 'Number' },
    skip: { __type: 'Number' },
    take: { __type: 'Number' }
  },
  CustomerProfile: {
    __typename: { __type: 'String!' },
    address: { __type: 'String!' },
    avatarUrl: { __type: 'String' },
    displayName: { __type: 'String' },
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    id: { __type: 'ID!' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' },
    preferredLanguage: { __type: 'String' },
    user: { __type: 'IUserNode!' }
  },
  DataArgsInput: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' }
  },
  DetailsInput: {
    childSeats: { __type: 'String' },
    extraTime: { __type: 'String' },
    flightNumber: { __type: 'String' },
    luggage: { __type: 'String' },
    message: { __type: 'String' },
    preferredCarClass: { __type: 'String' },
    preferredCarName: { __type: 'String' },
    transferCategory: { __type: 'TransferCategory' },
    transferType: { __type: 'TransferType' }
  },
  DriverData: {
    __typename: { __type: 'String!' },
    cars: { __type: 'CarConnection!', __args: { args: 'CarsArgsInput' } },
    color: { __type: 'String!' },
    createdAt: { __type: 'Date!' },
    id: { __type: 'ID!' },
    payoutPercent: { __type: 'Number!' },
    stats: { __type: 'JSONObject' },
    transfers: {
      __type: 'TransferConnection!',
      __args: { args: 'TransfersArgsInput' }
    },
    updatedAt: { __type: 'Date!' },
    user: { __type: 'IUserNode' },
    userId: { __type: 'String!' }
  },
  DriverLocation: {
    __typename: { __type: 'String!' },
    accuracy: { __type: 'Number' },
    altitude: { __type: 'Number' },
    altitudeAccuracy: { __type: 'Number' },
    createdAt: { __type: 'Date!' },
    driver: { __type: 'IUserNode' },
    driverId: { __type: 'String!' },
    heading: { __type: 'Number' },
    id: { __type: 'ID!' },
    latitude: { __type: 'Number!' },
    longitude: { __type: 'Number!' },
    recordedAt: { __type: 'Date' },
    speed: { __type: 'Number' },
    updatedAt: { __type: 'Date!' }
  },
  DriverLocationConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[DriverLocationEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  DriverLocationEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'DriverLocation!' }
  },
  DriverLocationsArgsInput: {
    after: { __type: 'String' },
    first: { __type: 'Number' },
    skip: { __type: 'Number' },
    take: { __type: 'Number' }
  },
  DriverProfile: {
    __typename: { __type: 'String!' },
    avatarUrl: { __type: 'String' },
    car: { __type: 'String' },
    displayName: { __type: 'String' },
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    id: { __type: 'ID!' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' },
    preferredLanguage: { __type: 'String' },
    user: { __type: 'IUserNode!' }
  },
  ExtrasArgsInput: { after: { __type: 'String' }, first: { __type: 'Number' } },
  ExtrasInput: { amount: { __type: 'Number' }, type: { __type: 'String!' } },
  Grant: {
    __typename: { __type: 'String!' },
    changeDate: { __type: 'String' },
    creationDate: { __type: 'String' },
    id: { __type: 'ID!' },
    organizationId: { __type: 'String' },
    projectId: { __type: 'String' },
    projectName: { __type: 'String' },
    state: { __type: 'String' }
  },
  GrantConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[GrantEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  GrantEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'Grant!' }
  },
  GrantNode: {
    __typename: { __type: 'String!' },
    changeDate: { __type: 'String' },
    creationDate: { __type: 'String' },
    id: { __type: 'ID!' },
    organizationId: { __type: 'String' },
    projectId: { __type: 'String' },
    projectName: { __type: 'String' },
    state: { __type: 'String' }
  },
  GrantsArgsInput: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' }
  },
  HumanUser: {
    __typename: { __type: 'String!' },
    addPushSubscription: {
      __type: '[ZitadelUserPushSubscription!]!',
      __args: { subscription: 'SetPushSubscriptionsSubscriptionsInput!' }
    },
    changeDate: { __type: 'String!' },
    creationDate: { __type: 'String!' },
    data: { __type: 'UserDataConnection!', __args: { args: 'DataArgsInput' } },
    getPushSubscriptions: { __type: '[ZitadelUserPushSubscription!]' },
    grants: { __type: 'GrantConnection!', __args: { args: 'GrantsArgsInput' } },
    id: { __type: 'ID!' },
    loginNames: { __type: '[String!]!' },
    preferences: { __type: 'Preferences!' },
    preferredLoginName: { __type: 'String!' },
    profiles: {
      __type: 'ProfileConnection!',
      __args: { args: 'ProfilesArgsInput_1' }
    },
    removePushSubscription: {
      __type: '[ZitadelUserPushSubscription!]!',
      __args: { endpoint: 'String!' }
    },
    resourceOwner: { __type: 'String!' },
    roles: { __type: 'RoleConnection!', __args: { args: 'RolesArgsInput' } },
    sequence: { __type: 'String!' },
    state: { __type: 'UserState!' },
    userName: { __type: 'String!' }
  },
  IGrantNode: {
    __typename: { __type: 'String!' },
    changeDate: { __type: 'String' },
    creationDate: { __type: 'String' },
    id: { __type: 'ID!' },
    organizationId: { __type: 'String' },
    projectId: { __type: 'String' },
    projectName: { __type: 'String' },
    state: { __type: 'String' },
    $on: { __type: '$IGrantNode!' }
  },
  ILocationNode: {
    __typename: { __type: 'String!' },
    accuracy: { __type: 'Number' },
    altitude: { __type: 'Number' },
    altitudeAccuracy: { __type: 'Number' },
    createdAt: { __type: 'Date!' },
    heading: { __type: 'Number' },
    id: { __type: 'ID!' },
    latitude: { __type: 'Number!' },
    longitude: { __type: 'Number!' },
    recordedAt: { __type: 'Date' },
    speed: { __type: 'Number' },
    updatedAt: { __type: 'Date!' },
    $on: { __type: '$ILocationNode!' }
  },
  INode: {
    __typename: { __type: 'String!' },
    id: { __type: 'ID!' },
    $on: { __type: '$INode!' }
  },
  IRoleNode: {
    __typename: { __type: 'String!' },
    displayName: { __type: 'String' },
    id: { __type: 'ID!' },
    key: { __type: 'String!' },
    $on: { __type: '$IRoleNode!' }
  },
  IUserDataNode: {
    __typename: { __type: 'String!' },
    id: { __type: 'ID!' },
    $on: { __type: '$IUserDataNode!' }
  },
  IUserNode: {
    __typename: { __type: 'String!' },
    changeDate: { __type: 'String!' },
    creationDate: { __type: 'String!' },
    grants: { __type: 'GrantConnection!' },
    id: { __type: 'ID!' },
    loginNames: { __type: '[String!]!' },
    preferredLoginName: { __type: 'String!' },
    resourceOwner: { __type: 'String!' },
    roles: { __type: 'RoleConnection!' },
    sequence: { __type: 'String!' },
    state: { __type: 'UserState!' },
    userName: { __type: 'String!' },
    $on: { __type: '$IUserNode!' }
  },
  IUserProfileNode: {
    __typename: { __type: 'String!' },
    avatarUrl: { __type: 'String' },
    displayName: { __type: 'String' },
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    id: { __type: 'ID!' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' },
    preferredLanguage: { __type: 'String' },
    user: { __type: 'IUserNode!' },
    $on: { __type: '$IUserProfileNode!' }
  },
  IsUniqueArgsInput: { loginName: { __type: 'String!' } },
  Keys: {
    __typename: { __type: 'String!' },
    auth: { __type: 'String' },
    p256dh: { __type: 'String' }
  },
  KeysInput: { auth: { __type: 'String' }, p256dh: { __type: 'String' } },
  LocationNode: {
    __typename: { __type: 'String!' },
    accuracy: { __type: 'Number' },
    altitude: { __type: 'Number' },
    altitudeAccuracy: { __type: 'Number' },
    createdAt: { __type: 'Date!' },
    heading: { __type: 'Number' },
    id: { __type: 'ID!' },
    latitude: { __type: 'Number!' },
    longitude: { __type: 'Number!' },
    recordedAt: { __type: 'Date' },
    speed: { __type: 'Number' },
    updatedAt: { __type: 'Date!' }
  },
  MachineUser: {
    __typename: { __type: 'String!' },
    changeDate: { __type: 'String!' },
    creationDate: { __type: 'String!' },
    data: { __type: 'UserDataConnection!', __args: { args: 'DataArgsInput' } },
    grants: { __type: 'GrantConnection!', __args: { args: 'GrantsArgsInput' } },
    id: { __type: 'ID!' },
    loginNames: { __type: '[String!]!' },
    preferredLoginName: { __type: 'String!' },
    resourceOwner: { __type: 'String!' },
    roles: { __type: 'RoleConnection!', __args: { args: 'RolesArgsInput' } },
    sequence: { __type: 'String!' },
    state: { __type: 'UserState!' },
    userName: { __type: 'String!' }
  },
  Node: { __typename: { __type: 'String!' }, id: { __type: 'ID!' } },
  PageInfo: {
    __typename: { __type: 'String!' },
    endCursor: { __type: 'String' },
    hasNextPage: { __type: 'Boolean!' },
    hasPreviousPage: { __type: 'Boolean!' },
    startCursor: { __type: 'String' }
  },
  Passenger: {
    __typename: { __type: 'String!' },
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    id: { __type: 'ID!' },
    language: { __type: 'String' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' },
    transferId: { __type: 'String!' }
  },
  PassengerConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[PassengerEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  PassengerEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'Passenger!' }
  },
  Passenger_1PrismaPassengerNode: {
    __typename: { __type: 'String!' },
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    id: { __type: 'String!' },
    language: { __type: 'String' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' },
    transferId: { __type: 'String!' }
  },
  PassengersArgsInput: {
    after: { __type: 'String' },
    first: { __type: 'Number' }
  },
  PassengersInput: {
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    language: { __type: 'String' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' }
  },
  Preferences: {
    __typename: { __type: 'String!' },
    preferredLanguage: { __type: 'String' }
  },
  PrismaCustomerDataNode: {
    __typename: { __type: 'String!' },
    createdAt: { __type: 'Date!' },
    id: { __type: 'String!' },
    updatedAt: { __type: 'Date!' },
    userId: { __type: 'String!' }
  },
  PrismaDriverDataNode: {
    __typename: { __type: 'String!' },
    color: { __type: 'String!' },
    createdAt: { __type: 'Date!' },
    id: { __type: 'String!' },
    payoutPercent: { __type: 'Number!' },
    updatedAt: { __type: 'Date!' },
    userId: { __type: 'String!' }
  },
  ProfileConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[ProfileEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  ProfileEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'IUserProfileNode!' }
  },
  ProfilesArgsInput: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' },
    organizationId: { __type: 'String' },
    userId: { __type: 'String!' }
  },
  ProfilesArgsInput_1: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' }
  },
  ReferencedByArgsInput: {
    after: { __type: 'String' },
    first: { __type: 'Number' }
  },
  Role: {
    __typename: { __type: 'String!' },
    displayName: { __type: 'String' },
    id: { __type: 'ID!' },
    key: { __type: 'String!' }
  },
  RoleConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[RoleEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  RoleEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'Role!' }
  },
  RoleNode: {
    __typename: { __type: 'String!' },
    displayName: { __type: 'String' },
    id: { __type: 'ID!' },
    key: { __type: 'String!' }
  },
  RolesArgsInput: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' }
  },
  SetDriverLocationArgsInput: {
    accuracy: { __type: 'Number' },
    altitude: { __type: 'Number' },
    altitudeAccuracy: { __type: 'Number' },
    heading: { __type: 'Number' },
    latitude: { __type: 'Number!' },
    longitude: { __type: 'Number!' },
    recordedAtISO: { __type: 'String' },
    speed: { __type: 'Number' }
  },
  SetPushSubscriptionsSubscriptionsInput: {
    deviceId: { __type: 'String' },
    endpoint: { __type: 'String!' },
    expirationTime: { __type: 'Number' },
    keys: { __type: 'KeysInput' },
    userAgent: { __type: 'String' }
  },
  Transfer: {
    __typename: { __type: 'String!' },
    car: { __type: 'Car' },
    carId: { __type: 'String' },
    customer: { __type: 'IUserNode' },
    customerId: { __type: 'String!' },
    details: { __type: 'TransferDetails' },
    driver: { __type: 'IUserNode' },
    driverId: { __type: 'String' },
    dropoffLocation: { __type: 'String!' },
    endDateTime: { __type: 'Date' },
    extras: {
      __type: 'TransferExtraConnection!',
      __args: { args: 'ExtrasArgsInput' }
    },
    id: { __type: 'ID!' },
    passengers: {
      __type: 'PassengerConnection!',
      __args: { args: 'PassengersArgsInput' }
    },
    payingParty: { __type: 'PayingParty!' },
    paymentMethode: { __type: 'PaymentMethode' },
    pickupDateTime: { __type: 'Date!' },
    pickupLocation: { __type: 'String!' },
    price: { __type: 'Number' },
    reference: { __type: 'Transfer' },
    referenceId: { __type: 'String' },
    referencedBy: {
      __type: 'TransferConnection!',
      __args: { args: 'ReferencedByArgsInput' }
    },
    requestedAt: { __type: 'Date!' },
    startDateTime: { __type: 'Date' },
    state: { __type: 'TransferState!' },
    subject: { __type: 'String' },
    transferCategory: { __type: 'TransferCategory!' },
    transferType: { __type: 'TransferType!' }
  },
  TransferConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[TransferEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  TransferDetails: {
    __typename: { __type: 'String!' },
    childSeats: { __type: 'String' },
    extraTime: { __type: 'String' },
    flightNumber: { __type: 'String' },
    luggage: { __type: 'String' },
    message: { __type: 'String' },
    preferredCarClass: { __type: 'CarClass' },
    preferredCarName: { __type: 'String' },
    transferId: { __type: 'String!' }
  },
  TransferDetails_1PrismaTransferDetailsNode: {
    __typename: { __type: 'String!' },
    childSeats: { __type: 'String' },
    extraTime: { __type: 'String' },
    flightNumber: { __type: 'String' },
    luggage: { __type: 'String' },
    message: { __type: 'String' },
    preferredCarClass: { __type: 'CarClass' },
    preferredCarName: { __type: 'String' },
    transferId: { __type: 'String!' }
  },
  TransferEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'Transfer!' }
  },
  TransferExtra: {
    __typename: { __type: 'String!' },
    amount: { __type: 'Number!' },
    id: { __type: 'ID!' },
    transferId: { __type: 'String!' },
    type: { __type: 'ExtraType!' }
  },
  TransferExtraConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[TransferExtraEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  TransferExtraEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'TransferExtra!' }
  },
  TransferExtra_1PrismaTransferExtraNode: {
    __typename: { __type: 'String!' },
    amount: { __type: 'Number!' },
    id: { __type: 'String!' },
    transferId: { __type: 'String!' },
    type: { __type: 'ExtraType!' }
  },
  TransfersArgsInput: {
    after: { __type: 'String' },
    customerId: { __type: 'String' },
    driverId: { __type: 'String' },
    first: { __type: 'Number' },
    fromISO: { __type: 'String' },
    skip: { __type: 'Number' },
    state: { __type: 'TransferState' },
    take: { __type: 'Number' },
    toISO: { __type: 'String' }
  },
  Type: {
    __typename: { __type: 'String!' },
    carClass: { __type: 'CarClass' },
    carName: { __type: 'String' },
    color: { __type: 'String!' },
    createdAt: { __type: 'Date!' },
    driverId: { __type: 'String' },
    id: { __type: 'String!' },
    licensePlate: { __type: 'String!' },
    updatedAt: { __type: 'Date!' }
  },
  UserArgsInput: {
    id: { __type: 'String!' },
    organizationId: { __type: 'String' }
  },
  UserConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[UserEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  UserDataArgsInput: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' },
    organizationId: { __type: 'String' },
    userId: { __type: 'String!' }
  },
  UserDataConnection: {
    __typename: { __type: 'String!' },
    edges: { __type: '[UserDataEdge!]!' },
    pageInfo: { __type: 'PageInfo!' },
    totalCount: { __type: 'Number!' }
  },
  UserDataEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'IUserDataNode!' }
  },
  UserDataNode: { __typename: { __type: 'String!' }, id: { __type: 'ID!' } },
  UserEdge: {
    __typename: { __type: 'String!' },
    cursor: { __type: 'String!' },
    node: { __type: 'IUserNode!' }
  },
  UserNode: {
    __typename: { __type: 'String!' },
    changeDate: { __type: 'String!' },
    creationDate: { __type: 'String!' },
    grants: { __type: 'GrantConnection!', __args: { args: 'GrantsArgsInput' } },
    id: { __type: 'ID!' },
    loginNames: { __type: '[String!]!' },
    preferredLoginName: { __type: 'String!' },
    resourceOwner: { __type: 'String!' },
    roles: { __type: 'RoleConnection!', __args: { args: 'RolesArgsInput' } },
    sequence: { __type: 'String!' },
    state: { __type: 'UserState!' },
    userName: { __type: 'String!' }
  },
  UserProfile: {
    __typename: { __type: 'String!' },
    avatarUrl: { __type: 'String' },
    displayName: { __type: 'String' },
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    id: { __type: 'ID!' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' },
    preferredLanguage: { __type: 'String' },
    user: { __type: 'IUserNode!' }
  },
  UserProfileNode: {
    __typename: { __type: 'String!' },
    avatarUrl: { __type: 'String' },
    displayName: { __type: 'String' },
    email: { __type: 'String' },
    firstName: { __type: 'String' },
    id: { __type: 'ID!' },
    lastName: { __type: 'String' },
    phone: { __type: 'String' },
    preferredLanguage: { __type: 'String' },
    user: { __type: 'IUserNode!' }
  },
  UsersArgsInput: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' },
    limit: { __type: 'Number' },
    organizationId: { __type: 'String' }
  },
  UsersByRoleArgsInput: {
    after: { __type: 'String' },
    before: { __type: 'String' },
    first: { __type: 'Number' },
    last: { __type: 'Number' },
    limit: { __type: 'Number' },
    organizationId: { __type: 'String' },
    roleKey: { __type: 'String!' }
  },
  ZitadelUserPushSubscription: {
    __typename: { __type: 'String!' },
    deviceId: { __type: 'String' },
    endpoint: { __type: 'String!' },
    expirationTime: { __type: 'Number' },
    keys: { __type: 'Keys' },
    userAgent: { __type: 'String' }
  },
  mutation: {
    __typename: { __type: 'String!' },
    addTransferExtra: {
      __type: 'Transfer!',
      __args: { amount: 'Number', transferId: 'String!', type: 'String!' }
    },
    assignCar: {
      __type: 'Transfer!',
      __args: { carId: 'String!', transferId: 'String!' }
    },
    assignDriver: {
      __type: 'Transfer!',
      __args: { driverId: 'String!', transferId: 'String!' }
    },
    bookTransfer: {
      __type: 'Transfer!',
      __args: { args: 'BookTransferArgsInput!' }
    },
    createTransfer: {
      __type: 'Transfer!',
      __args: { args: 'CreateTransferArgsInput!' }
    },
    removeTransferExtra: {
      __type: 'Transfer!',
      __args: { transferId: 'String!', type: 'String!' }
    },
    setDriverColor: {
      __type: 'Boolean!',
      __args: { color: 'String!', userId: 'String!' }
    },
    setDriverLocation: {
      __type: 'DriverLocation!',
      __args: { args: 'SetDriverLocationArgsInput!' }
    },
    setPrice: {
      __type: 'Transfer!',
      __args: { price: 'Number!', transferId: 'String!' }
    },
    updateTransferState: {
      __type: 'Transfer!',
      __args: { state: 'TransferState!', transferId: 'String!' }
    }
  },
  query: {
    __typename: { __type: 'String!' },
    cars: { __type: 'CarConnection!', __args: { args: 'CarsArgsInput' } },
    currentUser: {
      __type: 'IUserNode!',
      __args: { args: 'CurrentUserArgsInput' }
    },
    customerLocations: {
      __type: 'CustomerLocationConnection!',
      __args: { args: 'CustomerLocationsArgsInput' }
    },
    driverLocations: {
      __type: 'DriverLocationConnection!',
      __args: { args: 'DriverLocationsArgsInput' }
    },
    getCurrentUserColor: { __type: 'String!' },
    getDriverColor: { __type: 'String!', __args: { userId: 'String!' } },
    isUnique: { __type: 'Boolean', __args: { args: 'IsUniqueArgsInput!' } },
    passengers: {
      __type: 'PassengerConnection!',
      __args: { args: 'PassengersArgsInput' }
    },
    profiles: {
      __type: 'ProfileConnection!',
      __args: { args: 'ProfilesArgsInput!' }
    },
    transfers: {
      __type: 'TransferConnection!',
      __args: { args: 'TransfersArgsInput' }
    },
    user: { __type: 'IUserNode!', __args: { args: 'UserArgsInput!' } },
    userData: {
      __type: 'UserDataConnection!',
      __args: { args: 'UserDataArgsInput!' }
    },
    users: { __type: 'UserConnection!', __args: { args: 'UsersArgsInput' } },
    usersByRole: {
      __type: 'UserConnection!',
      __args: { args: 'UsersByRoleArgsInput!' }
    }
  },
  subscription: {},
  [SchemaUnionsKey]: {
    INode: [
      'CustomerData',
      'CustomerLocation',
      'CustomerProfile',
      'DriverData',
      'DriverLocation',
      'DriverProfile',
      'Grant',
      'GrantNode',
      'LocationNode',
      'Node',
      'Role',
      'RoleNode',
      'UserDataNode',
      'UserProfile',
      'UserProfileNode'
    ],
    IUserDataNode: ['CustomerData', 'DriverData', 'UserDataNode'],
    ILocationNode: ['CustomerLocation', 'DriverLocation', 'LocationNode'],
    IUserProfileNode: [
      'CustomerProfile',
      'DriverProfile',
      'UserProfile',
      'UserProfileNode'
    ],
    IGrantNode: ['Grant', 'GrantNode'],
    IUserNode: ['HumanUser', 'MachineUser', 'UserNode'],
    IRoleNode: ['Role', 'RoleNode']
  }
} as const;

/**
 * Car domain model (DB-backed).
 * - Constructor parameter-properties define public fields
 * - Optimized for: Object.assign(new Car(), r)
 * - No __typename
 */
export interface Car {
  __typename?: 'Car';
  carClass?: Maybe<CarClass>;
  carName?: Maybe<Scalars['String']['output']>;
  /**
   * Hex color in format "#RRGGBB"
   */
  color?: Scalars['String']['output'];
  createdAt?: Scalars['Date']['output'];
  /**
   * Resolves the driver user (if driverId is set).
   */
  driver?: Maybe<IUserNode>;
  driverId?: Maybe<Scalars['String']['output']>;
  driverName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  licensePlate?: Scalars['String']['output'];
  updatedAt?: Scalars['Date']['output'];
}

/**
 * Wraps a list of car edges plus pagination state in Relay connection format.
 */
export interface CarConnection {
  __typename?: 'CarConnection';
  edges: Array<CarEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface CarEdge {
  __typename?: 'CarEdge';
  cursor?: Scalars['String']['output'];
  node: Car;
}

export interface Car_1PrismaCarNode {
  __typename?: 'Car_1PrismaCarNode';
  carClass?: Maybe<CarClass>;
  carName?: Maybe<Scalars['String']['output']>;
  /**
   * Hex color in format "#RRGGBB"
   */
  color?: Scalars['String']['output'];
  createdAt?: Scalars['Date']['output'];
  driverId?: Maybe<Scalars['String']['output']>;
  id?: Scalars['String']['output'];
  licensePlate?: Scalars['String']['output'];
  updatedAt?: Scalars['Date']['output'];
}

export interface CustomerData {
  __typename?: 'CustomerData';
  createdAt?: Scalars['Date']['output'];
  id?: Scalars['ID']['output'];
  /**
   * Resolves transfers for this customer (Transfer.customerId == CustomerData.userId)
   * as Relay connection.
   */
  transfers: (args?: {
    args?: Maybe<TransfersArgsInput>;
  }) => TransferConnection;
  updatedAt?: Scalars['Date']['output'];
  user?: Maybe<IUserNode>;
  userId?: Scalars['String']['output'];
}

/**
 * CustomerLocation domain model (DB-backed).
 * - Constructor parameter-properties define public fields
 * - Optimized for: Object.assign(new CustomerLocation(), r)
 * - No __typename
 */
export interface CustomerLocation {
  __typename?: 'CustomerLocation';
  accuracy?: Maybe<Scalars['Number']['output']>;
  altitude?: Maybe<Scalars['Number']['output']>;
  altitudeAccuracy?: Maybe<Scalars['Number']['output']>;
  createdAt?: Scalars['Date']['output'];
  customer?: Maybe<IUserNode>;
  customerId?: Scalars['String']['output'];
  heading?: Maybe<Scalars['Number']['output']>;
  id?: Scalars['ID']['output'];
  latitude?: Scalars['Number']['output'];
  longitude?: Scalars['Number']['output'];
  recordedAt?: Maybe<Scalars['Date']['output']>;
  speed?: Maybe<Scalars['Number']['output']>;
  updatedAt?: Scalars['Date']['output'];
}

/**
 * Wraps a list of customer location edges plus pagination state in Relay connection format.
 */
export interface CustomerLocationConnection {
  __typename?: 'CustomerLocationConnection';
  edges: Array<CustomerLocationEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface CustomerLocationEdge {
  __typename?: 'CustomerLocationEdge';
  cursor?: Scalars['String']['output'];
  node: CustomerLocation;
}

/**
 * Represents a customer user coming from Zitadel.
 * The instance type is what makes `... on CustomerProfile` resolve correctly.
 */
export interface CustomerProfile {
  __typename?: 'CustomerProfile';
  address?: Scalars['String']['output'];
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  preferredLanguage?: Maybe<Scalars['String']['output']>;
  user: IUserNode;
}

export interface DriverData {
  __typename?: 'DriverData';
  /**
   * Resolves cars assigned to this driver (Car.driverId == DriverData.userId)
   * as Relay connection.
   */
  cars: (args?: { args?: Maybe<CarsArgsInput> }) => CarConnection;
  color?: Scalars['String']['output'];
  createdAt?: Scalars['Date']['output'];
  id?: Scalars['ID']['output'];
  payoutPercent?: Scalars['Number']['output'];
  stats?: Maybe<Scalars['JSONObject']['output']>;
  /**
   * Resolves transfers assigned to this driver (Transfer.driverId == DriverData.userId)
   * as Relay connection.
   */
  transfers: (args?: {
    args?: Maybe<TransfersArgsInput>;
  }) => TransferConnection;
  updatedAt?: Scalars['Date']['output'];
  user?: Maybe<IUserNode>;
  userId?: Scalars['String']['output'];
}

/**
 * DriverLocation domain model (DB-backed).
 * - Constructor parameter-properties define public fields
 * - Optimized for: Object.assign(new DriverLocation(), r)
 * - No __typename
 */
export interface DriverLocation {
  __typename?: 'DriverLocation';
  accuracy?: Maybe<Scalars['Number']['output']>;
  altitude?: Maybe<Scalars['Number']['output']>;
  altitudeAccuracy?: Maybe<Scalars['Number']['output']>;
  createdAt?: Scalars['Date']['output'];
  driver?: Maybe<IUserNode>;
  driverId?: Scalars['String']['output'];
  heading?: Maybe<Scalars['Number']['output']>;
  id?: Scalars['ID']['output'];
  latitude?: Scalars['Number']['output'];
  longitude?: Scalars['Number']['output'];
  recordedAt?: Maybe<Scalars['Date']['output']>;
  speed?: Maybe<Scalars['Number']['output']>;
  updatedAt?: Scalars['Date']['output'];
}

/**
 * Wraps a list of driver location edges plus pagination state in Relay connection format.
 */
export interface DriverLocationConnection {
  __typename?: 'DriverLocationConnection';
  edges: Array<DriverLocationEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface DriverLocationEdge {
  __typename?: 'DriverLocationEdge';
  cursor?: Scalars['String']['output'];
  node: DriverLocation;
}

/**
 * Represents a driver user coming from Zitadel.
 * The instance type is what makes `... on DriverProfile` resolve correctly.
 */
export interface DriverProfile {
  __typename?: 'DriverProfile';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  car?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  preferredLanguage?: Maybe<Scalars['String']['output']>;
  user: IUserNode;
}

/**
 * Represents one grant assignment returned by Zitadel.
 * The id is synthesized from stable fields so this can be used like a Relay node.
 */
export interface Grant {
  __typename?: 'Grant';
  changeDate?: Maybe<Scalars['String']['output']>;
  creationDate?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  organizationId?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  projectName?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
}

/**
 * Wraps grant edges plus pagination state.
 * Having edges + pageInfo makes schema tools detect this as Relay connection.
 */
export interface GrantConnection {
  __typename?: 'GrantConnection';
  edges: Array<GrantEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface GrantEdge {
  __typename?: 'GrantEdge';
  cursor?: Scalars['String']['output'];
  node: Grant;
}

export interface GrantNode {
  __typename?: 'GrantNode';
  changeDate?: Maybe<Scalars['String']['output']>;
  creationDate?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  organizationId?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  projectName?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
}

export interface HumanUser {
  __typename?: 'HumanUser';
  addPushSubscription: (args: {
    subscription: SetPushSubscriptionsSubscriptionsInput;
  }) => Array<ZitadelUserPushSubscription>;
  changeDate?: Scalars['String']['output'];
  creationDate?: Scalars['String']['output'];
  data: (args?: { args?: Maybe<DataArgsInput> }) => UserDataConnection;
  getPushSubscriptions?: Maybe<Array<ZitadelUserPushSubscription>>;
  grants: (args?: { args?: Maybe<GrantsArgsInput> }) => GrantConnection;
  id?: Scalars['ID']['output'];
  loginNames?: Array<Scalars['String']['output']>;
  preferences: Preferences;
  preferredLoginName?: Scalars['String']['output'];
  profiles: (args?: { args?: Maybe<ProfilesArgsInput_1> }) => ProfileConnection;
  removePushSubscription: (args: {
    endpoint: Scalars['String']['input'];
  }) => Array<ZitadelUserPushSubscription>;
  resourceOwner?: Scalars['String']['output'];
  roles: (args?: { args?: Maybe<RolesArgsInput> }) => RoleConnection;
  sequence?: Scalars['String']['output'];
  state?: UserState;
  userName?: Scalars['String']['output'];
}

export interface IGrantNode {
  __typename?: 'Grant' | 'GrantNode';
  changeDate?: Maybe<Scalars['String']['output']>;
  creationDate?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  organizationId?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  projectName?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  $on: $IGrantNode;
}

export interface ILocationNode {
  __typename?: 'CustomerLocation' | 'DriverLocation' | 'LocationNode';
  accuracy?: Maybe<Scalars['Number']['output']>;
  altitude?: Maybe<Scalars['Number']['output']>;
  altitudeAccuracy?: Maybe<Scalars['Number']['output']>;
  createdAt?: Scalars['Date']['output'];
  heading?: Maybe<Scalars['Number']['output']>;
  id?: Scalars['ID']['output'];
  latitude?: Scalars['Number']['output'];
  longitude?: Scalars['Number']['output'];
  recordedAt?: Maybe<Scalars['Date']['output']>;
  speed?: Maybe<Scalars['Number']['output']>;
  updatedAt?: Scalars['Date']['output'];
  $on: $ILocationNode;
}

export interface INode {
  __typename?:
    | 'CustomerData'
    | 'CustomerLocation'
    | 'CustomerProfile'
    | 'DriverData'
    | 'DriverLocation'
    | 'DriverProfile'
    | 'Grant'
    | 'GrantNode'
    | 'LocationNode'
    | 'Node'
    | 'Role'
    | 'RoleNode'
    | 'UserDataNode'
    | 'UserProfile'
    | 'UserProfileNode';
  id?: Scalars['ID']['output'];
  $on: $INode;
}

export interface IRoleNode {
  __typename?: 'Role' | 'RoleNode';
  displayName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  key?: Scalars['String']['output'];
  $on: $IRoleNode;
}

export interface IUserDataNode {
  __typename?: 'CustomerData' | 'DriverData' | 'UserDataNode';
  id?: Scalars['ID']['output'];
  $on: $IUserDataNode;
}

export interface IUserNode {
  __typename?: 'HumanUser' | 'MachineUser' | 'UserNode';
  changeDate?: Scalars['String']['output'];
  creationDate?: Scalars['String']['output'];
  grants: GrantConnection;
  id?: Scalars['ID']['output'];
  loginNames?: Array<Scalars['String']['output']>;
  preferredLoginName?: Scalars['String']['output'];
  resourceOwner?: Scalars['String']['output'];
  roles: RoleConnection;
  sequence?: Scalars['String']['output'];
  state?: UserState;
  userName?: Scalars['String']['output'];
  $on: $IUserNode;
}

export interface IUserProfileNode {
  __typename?:
    | 'CustomerProfile'
    | 'DriverProfile'
    | 'UserProfile'
    | 'UserProfileNode';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  preferredLanguage?: Maybe<Scalars['String']['output']>;
  user: IUserNode;
  $on: $IUserProfileNode;
}

export interface Keys {
  __typename?: 'Keys';
  auth?: Maybe<Scalars['String']['output']>;
  p256dh?: Maybe<Scalars['String']['output']>;
}

export interface LocationNode {
  __typename?: 'LocationNode';
  accuracy?: Maybe<Scalars['Number']['output']>;
  altitude?: Maybe<Scalars['Number']['output']>;
  altitudeAccuracy?: Maybe<Scalars['Number']['output']>;
  createdAt?: Scalars['Date']['output'];
  heading?: Maybe<Scalars['Number']['output']>;
  id?: Scalars['ID']['output'];
  latitude?: Scalars['Number']['output'];
  longitude?: Scalars['Number']['output'];
  recordedAt?: Maybe<Scalars['Date']['output']>;
  speed?: Maybe<Scalars['Number']['output']>;
  updatedAt?: Scalars['Date']['output'];
}

export interface MachineUser {
  __typename?: 'MachineUser';
  changeDate?: Scalars['String']['output'];
  creationDate?: Scalars['String']['output'];
  data: (args?: { args?: Maybe<DataArgsInput> }) => UserDataConnection;
  grants: (args?: { args?: Maybe<GrantsArgsInput> }) => GrantConnection;
  id?: Scalars['ID']['output'];
  loginNames?: Array<Scalars['String']['output']>;
  preferredLoginName?: Scalars['String']['output'];
  resourceOwner?: Scalars['String']['output'];
  roles: (args?: { args?: Maybe<RolesArgsInput> }) => RoleConnection;
  sequence?: Scalars['String']['output'];
  state?: UserState;
  userName?: Scalars['String']['output'];
}

export interface Node {
  __typename?: 'Node';
  id?: Scalars['ID']['output'];
}

/**
 * Carries pagination state for a sliced collection.
 * This follows the Relay `PageInfo` shape so tooling can detect connections.
 */
export interface PageInfo {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage?: Scalars['Boolean']['output'];
  hasPreviousPage?: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
}

/**
 * Passenger domain model (DB-backed).
 * - Constructor parameter-properties define public fields
 * - Optimized for: Object.assign(new Passenger(), r)
 * - No __typename
 */
export interface Passenger {
  __typename?: 'Passenger';
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  language?: Maybe<Scalars['String']['output']>;
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  transferId?: Scalars['String']['output'];
}

/**
 * Wraps a list of passenger edges plus pagination state in Relay connection format.
 */
export interface PassengerConnection {
  __typename?: 'PassengerConnection';
  edges: Array<PassengerEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface PassengerEdge {
  __typename?: 'PassengerEdge';
  cursor?: Scalars['String']['output'];
  node: Passenger;
}

export interface Passenger_1PrismaPassengerNode {
  __typename?: 'Passenger_1PrismaPassengerNode';
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['String']['output'];
  language?: Maybe<Scalars['String']['output']>;
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  transferId?: Scalars['String']['output'];
}

export interface Preferences {
  __typename?: 'Preferences';
  preferredLanguage?: Maybe<Scalars['String']['output']>;
}

export interface PrismaCustomerDataNode {
  __typename?: 'PrismaCustomerDataNode';
  createdAt?: Scalars['Date']['output'];
  id?: Scalars['String']['output'];
  updatedAt?: Scalars['Date']['output'];
  userId?: Scalars['String']['output'];
}

export interface PrismaDriverDataNode {
  __typename?: 'PrismaDriverDataNode';
  /**
   * Hex color in format "#RRGGBB"
   */
  color?: Scalars['String']['output'];
  createdAt?: Scalars['Date']['output'];
  id?: Scalars['String']['output'];
  payoutPercent?: Scalars['Number']['output'];
  updatedAt?: Scalars['Date']['output'];
  userId?: Scalars['String']['output'];
}

export interface ProfileConnection {
  __typename?: 'ProfileConnection';
  edges: Array<ProfileEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface ProfileEdge {
  __typename?: 'ProfileEdge';
  cursor?: Scalars['String']['output'];
  node: IUserProfileNode;
}

/**
 * Represents a single project role derived from Zitadel grants.
 * The id is deterministic so the object can behave like a Relay node.
 */
export interface Role {
  __typename?: 'Role';
  displayName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  key?: Scalars['String']['output'];
}

/**
 * Wraps role edges plus pagination state.
 * Keeping exact field names enables Relay/Voyager auto-detection.
 */
export interface RoleConnection {
  __typename?: 'RoleConnection';
  edges: Array<RoleEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface RoleEdge {
  __typename?: 'RoleEdge';
  cursor?: Scalars['String']['output'];
  node: Role;
}

export interface RoleNode {
  __typename?: 'RoleNode';
  displayName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  key?: Scalars['String']['output'];
}

export interface Transfer {
  __typename?: 'Transfer';
  car?: Maybe<Car>;
  carId?: Maybe<Scalars['String']['output']>;
  customer?: Maybe<IUserNode>;
  customerId?: Scalars['String']['output'];
  details?: Maybe<TransferDetails>;
  driver?: Maybe<IUserNode>;
  driverId?: Maybe<Scalars['String']['output']>;
  dropoffLocation?: Scalars['String']['output'];
  endDateTime?: Maybe<Scalars['Date']['output']>;
  extras: (args?: { args?: Maybe<ExtrasArgsInput> }) => TransferExtraConnection;
  id?: Scalars['ID']['output'];
  passengers: (args?: {
    args?: Maybe<PassengersArgsInput>;
  }) => PassengerConnection;
  payingParty?: PayingParty;
  paymentMethode?: Maybe<PaymentMethode>;
  pickupDateTime?: Scalars['Date']['output'];
  pickupLocation?: Scalars['String']['output'];
  price?: Maybe<Scalars['Number']['output']>;
  /**
   * The origin transfer this one references (e.g. for return trips).
   * The origin transfer's id IS its "code".
   */
  reference?: Maybe<Transfer>;
  referenceId?: Maybe<Scalars['String']['output']>;
  /**
   * All transfers that reference this one (i.e. this is the origin).
   */
  referencedBy: (args?: {
    args?: Maybe<ReferencedByArgsInput>;
  }) => TransferConnection;
  requestedAt?: Scalars['Date']['output'];
  startDateTime?: Maybe<Scalars['Date']['output']>;
  state?: TransferState;
  subject?: Maybe<Scalars['String']['output']>;
  transferCategory?: TransferCategory;
  transferType?: TransferType;
}

export interface TransferConnection {
  __typename?: 'TransferConnection';
  edges: Array<TransferEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

/**
 * TransferDetails domain model (DB-backed).
 * - Constructor parameter-properties define public fields
 * - Optimized for: Object.assign(new TransferDetails(), r)
 * - No __typename
 */
export interface TransferDetails {
  __typename?: 'TransferDetails';
  childSeats?: Maybe<Scalars['String']['output']>;
  extraTime?: Maybe<Scalars['String']['output']>;
  flightNumber?: Maybe<Scalars['String']['output']>;
  luggage?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  preferredCarClass?: Maybe<CarClass>;
  preferredCarName?: Maybe<Scalars['String']['output']>;
  transferId?: Scalars['String']['output'];
}

export interface TransferDetails_1PrismaTransferDetailsNode {
  __typename?: 'TransferDetails_1PrismaTransferDetailsNode';
  childSeats?: Maybe<Scalars['String']['output']>;
  extraTime?: Maybe<Scalars['String']['output']>;
  flightNumber?: Maybe<Scalars['String']['output']>;
  luggage?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  preferredCarClass?: Maybe<CarClass>;
  preferredCarName?: Maybe<Scalars['String']['output']>;
  transferId?: Scalars['String']['output'];
}

export interface TransferEdge {
  __typename?: 'TransferEdge';
  cursor?: Scalars['String']['output'];
  node: Transfer;
}

/**
 * TransferExtra domain model (DB-backed).
 * Represents a single addon attached to a transfer (e.g. child seat × 2).
 *
 * Optimized for: Object.assign(new TransferExtra(), row)
 */
export interface TransferExtra {
  __typename?: 'TransferExtra';
  amount?: Scalars['Number']['output'];
  id?: Scalars['ID']['output'];
  transferId?: Scalars['String']['output'];
  type?: ExtraType;
}

export interface TransferExtraConnection {
  __typename?: 'TransferExtraConnection';
  edges: Array<TransferExtraEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface TransferExtraEdge {
  __typename?: 'TransferExtraEdge';
  cursor?: Scalars['String']['output'];
  node: TransferExtra;
}

export interface TransferExtra_1PrismaTransferExtraNode {
  __typename?: 'TransferExtra_1PrismaTransferExtraNode';
  amount?: Scalars['Number']['output'];
  id?: Scalars['String']['output'];
  transferId?: Scalars['String']['output'];
  type?: ExtraType;
}

export interface Type {
  __typename?: 'Type';
  carClass?: Maybe<CarClass>;
  carName?: Maybe<Scalars['String']['output']>;
  /**
   * Hex color in format "#RRGGBB"
   */
  color?: Scalars['String']['output'];
  createdAt?: Scalars['Date']['output'];
  driverId?: Maybe<Scalars['String']['output']>;
  id?: Scalars['String']['output'];
  licensePlate?: Scalars['String']['output'];
  updatedAt?: Scalars['Date']['output'];
}

/**
 * Wraps a list of edges plus pagination state in Relay connection format.
 * Keeping exact field names makes schema tools detect it as a Relay connection.
 */
export interface UserConnection {
  __typename?: 'UserConnection';
  edges: Array<UserEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface UserDataConnection {
  __typename?: 'UserDataConnection';
  edges: Array<UserDataEdge>;
  pageInfo: PageInfo;
  totalCount?: Scalars['Number']['output'];
}

export interface UserDataEdge {
  __typename?: 'UserDataEdge';
  cursor?: Scalars['String']['output'];
  node: IUserDataNode;
}

export interface UserDataNode {
  __typename?: 'UserDataNode';
  id?: Scalars['ID']['output'];
}

export interface UserEdge {
  __typename?: 'UserEdge';
  cursor?: Scalars['String']['output'];
  node: IUserNode;
}

export interface UserNode {
  __typename?: 'UserNode';
  changeDate?: Scalars['String']['output'];
  creationDate?: Scalars['String']['output'];
  grants: (args?: { args?: Maybe<GrantsArgsInput> }) => GrantConnection;
  id?: Scalars['ID']['output'];
  loginNames?: Array<Scalars['String']['output']>;
  preferredLoginName?: Scalars['String']['output'];
  resourceOwner?: Scalars['String']['output'];
  roles: (args?: { args?: Maybe<RolesArgsInput> }) => RoleConnection;
  sequence?: Scalars['String']['output'];
  state?: UserState;
  userName?: Scalars['String']['output'];
}

export interface UserProfile {
  __typename?: 'UserProfile';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  preferredLanguage?: Maybe<Scalars['String']['output']>;
  user: IUserNode;
}

export interface UserProfileNode {
  __typename?: 'UserProfileNode';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Scalars['ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  preferredLanguage?: Maybe<Scalars['String']['output']>;
  user: IUserNode;
}

export interface ZitadelUserPushSubscription {
  __typename?: 'ZitadelUserPushSubscription';
  deviceId?: Maybe<Scalars['String']['output']>;
  endpoint?: Scalars['String']['output'];
  expirationTime?: Maybe<Scalars['Number']['output']>;
  keys?: Maybe<Keys>;
  userAgent?: Maybe<Scalars['String']['output']>;
}

export interface Mutation {
  __typename?: 'Mutation';
  addTransferExtra: (args: {
    amount?: Maybe<Scalars['Number']['input']>;
    transferId: Scalars['String']['input'];
    type: Scalars['String']['input'];
  }) => Transfer;
  assignCar: (args: {
    carId: Scalars['String']['input'];
    transferId: Scalars['String']['input'];
  }) => Transfer;
  assignDriver: (args: {
    driverId: Scalars['String']['input'];
    transferId: Scalars['String']['input'];
  }) => Transfer;
  bookTransfer: (args: { args: BookTransferArgsInput }) => Transfer;
  createTransfer: (args: { args: CreateTransferArgsInput }) => Transfer;
  removeTransferExtra: (args: {
    transferId: Scalars['String']['input'];
    type: Scalars['String']['input'];
  }) => Transfer;
  setDriverColor: (args: {
    color: Scalars['String']['input'];
    userId: Scalars['String']['input'];
  }) => Scalars['Boolean']['output'];
  setDriverLocation: (args: {
    args: SetDriverLocationArgsInput;
  }) => DriverLocation;
  setPrice: (args: {
    price: Scalars['Number']['input'];
    transferId: Scalars['String']['input'];
  }) => Transfer;
  updateTransferState: (args: {
    state: TransferState;
    transferId: Scalars['String']['input'];
  }) => Transfer;
}

export interface Query {
  __typename?: 'Query';
  cars: (args?: { args?: Maybe<CarsArgsInput> }) => CarConnection;
  currentUser: (args?: { args?: Maybe<CurrentUserArgsInput> }) => IUserNode;
  customerLocations: (args?: {
    args?: Maybe<CustomerLocationsArgsInput>;
  }) => CustomerLocationConnection;
  driverLocations: (args?: {
    args?: Maybe<DriverLocationsArgsInput>;
  }) => DriverLocationConnection;
  getCurrentUserColor?: Scalars['String']['output'];
  getDriverColor: (args: {
    userId: Scalars['String']['input'];
  }) => Scalars['String']['output'];
  isUnique: (args: {
    args: IsUniqueArgsInput;
  }) => Maybe<Scalars['Boolean']['output']>;
  passengers: (args?: {
    args?: Maybe<PassengersArgsInput>;
  }) => PassengerConnection;
  profiles: (args: { args: ProfilesArgsInput }) => ProfileConnection;
  transfers: (args?: {
    args?: Maybe<TransfersArgsInput>;
  }) => TransferConnection;
  user: (args: { args: UserArgsInput }) => IUserNode;
  userData: (args: { args: UserDataArgsInput }) => UserDataConnection;
  users: (args?: { args?: Maybe<UsersArgsInput> }) => UserConnection;
  usersByRole: (args: { args: UsersByRoleArgsInput }) => UserConnection;
}

export interface Subscription {
  __typename?: 'Subscription';
}

export interface $IGrantNode {
  Grant?: Grant;
  GrantNode?: GrantNode;
}

export interface $ILocationNode {
  CustomerLocation?: CustomerLocation;
  DriverLocation?: DriverLocation;
  LocationNode?: LocationNode;
}

export interface $INode {
  CustomerData?: CustomerData;
  CustomerLocation?: CustomerLocation;
  CustomerProfile?: CustomerProfile;
  DriverData?: DriverData;
  DriverLocation?: DriverLocation;
  DriverProfile?: DriverProfile;
  Grant?: Grant;
  GrantNode?: GrantNode;
  LocationNode?: LocationNode;
  Node?: Node;
  Role?: Role;
  RoleNode?: RoleNode;
  UserDataNode?: UserDataNode;
  UserProfile?: UserProfile;
  UserProfileNode?: UserProfileNode;
}

export interface $IRoleNode {
  Role?: Role;
  RoleNode?: RoleNode;
}

export interface $IUserDataNode {
  CustomerData?: CustomerData;
  DriverData?: DriverData;
  UserDataNode?: UserDataNode;
}

export interface $IUserNode {
  HumanUser?: HumanUser;
  MachineUser?: MachineUser;
  UserNode?: UserNode;
}

export interface $IUserProfileNode {
  CustomerProfile?: CustomerProfile;
  DriverProfile?: DriverProfile;
  UserProfile?: UserProfile;
  UserProfileNode?: UserProfileNode;
}

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}
