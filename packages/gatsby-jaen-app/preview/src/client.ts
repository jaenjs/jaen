/**
 * Re-export the GQty client from the parent package.
 * Vite alias `@client` points to ../client/limosen.
 */
export {
  resolve,
  client,
  useQuery,
  useMutation,
  schema,
} from '@client/index'

export type {
  Transfer,
  UserNode,
  HumanUser,
} from '@client/schema.generated'
