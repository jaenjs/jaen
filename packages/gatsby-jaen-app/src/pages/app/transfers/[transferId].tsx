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
  auth: {
    isRequired: false
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'
