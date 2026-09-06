/**
 * A number that is not there yet.
 *
 * A KPI, a stat card or a count in a heading waits as a grey block the width
 * of a number, never as `0` and never as an empty cell (design-consistency.md,
 * rule 3): a dispatcher reading "0 Fahrten" at a glance would believe it. The
 * block is inline and 1em tall, so it sits exactly where the number will sit
 * and takes the text style of its parent.
 *
 * `fillWith` is the catalogue's `fill` for a template whose value is a node,
 * so "Heute ({count})" can carry this block in place of the count.
 */
import React, {type ReactNode} from 'react'
import {Skeleton, type SkeletonProps} from '@chakra-ui/react'

export interface NumberSkeletonProps extends SkeletonProps {
  /** How many digits wide, 3 by default. */
  chars?: number
}

export function NumberSkeleton({chars = 3, ...rest}: NumberSkeletonProps) {
  return (
    <Skeleton
      as="span"
      display="inline-block"
      h="1em"
      w={`${chars}ch`}
      verticalAlign="-0.1em"
      rounded="sm"
      data-skeleton="number"
      {...rest}
    />
  )
}

/**
 * `fill` with nodes: every `{key}` in the template becomes the value of that
 * key, a string or an element. Unknown keys stay as they are.
 */
export function fillWith(template: string, values: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/\{(\w+)\}/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <React.Fragment key={i}>{part in values ? values[part] : `{${part}}`}</React.Fragment>
        ) : (
          part
        )
      )}
    </>
  )
}
