/**
 * The one way to wait (okf/architecture/design-consistency.md, rule 3): a
 * view renders its skeleton, its content or its error, never a spinner and
 * never the word "Loading". Screens import from here:
 * `import {TableSkeleton, NumberSkeleton} from '../components/skeletons'`.
 */
export {TableSkeleton} from './TableSkeleton'
export type {TableSkeletonProps, SkeletonColumn} from './TableSkeleton'
export {ListSkeleton} from './ListSkeleton'
export type {ListSkeletonProps} from './ListSkeleton'
export {NumberSkeleton, fillWith} from './NumberSkeleton'
export type {NumberSkeletonProps} from './NumberSkeleton'
export {DetailSkeleton} from './DetailSkeleton'
export type {DetailSkeletonProps} from './DetailSkeleton'
