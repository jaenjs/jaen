// pages
// snekfinder root url
import {store} from '@jaen/redux'
import {DeepPartial} from 'redux'
import {ISite} from '../../types'

type DataType = {
  site?: DeepPartial<ISite>
}

const getSiteData = (): DataType['site'] | undefined => {
  const state = store.getState()

  if (state.site) {
    return state.site
  }
}

export const runPublish = async () => {
  const data: DataType = {
    site: getSiteData()
  }

  return data
}
