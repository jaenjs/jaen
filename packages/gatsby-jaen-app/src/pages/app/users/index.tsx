import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../../AppWrapper'
import {UsersView} from '../../../../shared/views/UsersView'

const UsersPage: React.FC<PageProps> = () => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {}
  }), [])

  return (
    <AppWrapper nav={nav}>
      <UsersView />
    </AppWrapper>
  )
}

export default UsersPage

export const pageConfig: PageConfig = {
  label: 'Users',
  icon: 'FaUsers',
  menu: {
    order: 20,
    type: 'app'
  },
  auth: {
    isRequired: false
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'
