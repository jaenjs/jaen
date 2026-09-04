import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../../AppWrapper'
import {UserDetailView} from '../../../../shared/views/UserDetailView'

const UserDetailPage: React.FC<PageProps> = ({params}) => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {userId: params.userId ?? ''}
  }), [params.userId])

  return (
    <AppWrapper nav={nav}>
      <UserDetailView />
    </AppWrapper>
  )
}

export default UserDetailPage

export const pageConfig: PageConfig = {
  label: 'User Detail',
  auth: {
    isRequired: false
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'
