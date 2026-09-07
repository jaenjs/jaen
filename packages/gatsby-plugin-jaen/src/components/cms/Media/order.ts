/**
 * The order of the grid, in one place, because two of them decide it: the
 * container merges the CMS field with the folders an app registered, and the
 * gallery filters that list down to the selected tree entry.
 */

/**
 * Newest first, and a node without a readable `createdAt` sorts last rather
 * than poisoning the comparison: `new Date(undefined).getTime()` is NaN, a
 * comparator that answers NaN is read as "equal", and the transitivity the
 * sort relies on goes with it, which leaves entries around it unordered too.
 */
export const byCreatedAtDescending = (
  a: {createdAt?: string},
  b: {createdAt?: string}
): number => {
  const at = (node: {createdAt?: string}) => {
    const value = node.createdAt ? new Date(node.createdAt).getTime() : 0

    return Number.isFinite(value) ? value : 0
  }

  return at(b) - at(a)
}
