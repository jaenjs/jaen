import {PageConfig, PageProps} from 'jaen'
import {useEffect} from 'react'
import {navigate} from 'gatsby'
import {intlText} from '../../lib/intl'

const Page: React.FC<PageProps> = ({}) => {
  // redirect to ./templates
  useEffect(() => {
    navigate('./templates')
  }, [])

  return null
}

export default Page

export const pageConfig: PageConfig = {
  label: intlText('EmailwerkTemplatesPageTitle', 'Templates'),
  layout: {
    name: 'jaen'
  },
  breadcrumbs: [
    {
      label: intlText('EmailwerkBreadcrumbsRoot', 'Emailwerk'),
      path: '/emailwerk/'
    }
  ],
  auth: {
    isRequired: true,
    isAdminRequired: true
  }
}
