import loadable from '@loadable/component'
import type {GatsbyBrowser} from 'gatsby'

const AdminToolbar = loadable(() => import('./ui/layouts/AdminToolbar'))

export const wrapPageElement: GatsbyBrowser['wrapPageElement'] = ({
  element
}) => {
  return (
    <>
      <AdminToolbar />
      <>{element}</>
    </>
  )
}
