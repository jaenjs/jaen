import type {GatsbyBrowser} from 'gatsby'
import AdminToolbar from './ui/layouts/AdminToolbar'

export const wrapPageElement: GatsbyBrowser['wrapPageElement'] = ({
  element
}) => {
  return (
    <>
      <AdminToolbar />
      {element}
    </>
  )
}
