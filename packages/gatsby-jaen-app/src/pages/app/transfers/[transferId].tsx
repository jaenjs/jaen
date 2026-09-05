import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../../AppWrapper'
import {TransferDetailView} from '../../../../shared/views/TransferDetailView'

const TransferDetailPage: React.FC<PageProps> = ({params}) => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {transferId: params.transferId ?? ''}
  }), [params.transferId])

  return (
    <AppWrapper nav={nav}>
      <TransferDetailView />
    </AppWrapper>
  )
}

export default TransferDetailPage

export const pageConfig: PageConfig = {
  label: 'Transfer Detail',
  // Every /app route is for a signed-in person. jaen sends anybody else to
  // /login and brings them back here afterwards. Which role they need is the
  // backend's decision, made per field, and the shell's, made per nav item.
  auth: {
    isRequired: true
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'
