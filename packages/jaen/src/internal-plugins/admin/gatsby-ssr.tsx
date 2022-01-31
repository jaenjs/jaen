import loadable from '@loadable/component'
import type {GatsbyBrowser} from 'gatsby'

const AdminToolbar = loadable(() => import('./ui/layouts/AdminToolbar'))

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = ({
  element
}) => {
  return (
    <>
      <AdminToolbar />
      <>{element}</>
    </>
  )
}
