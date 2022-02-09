import AdminToolbarContainer from '@jaen/ui/AdminToolbar'
import {GatsbyBrowser} from 'gatsby'

export * from './src/gatsby/wrapper'

export const wrapPageElement: GatsbyBrowser['wrapPageElement'] = ({
  element
}) => {
  const pathname = window.location.pathname

  if (pathname.startsWith('/jaen/admin')) {
    return element
  }

  return (
    <>
      <AdminToolbarContainer sticky />
      {element}
    </>
  )
}
