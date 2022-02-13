import {useAppDispatch, withRedux} from '@jaen/redux'
import {updateSiteMetadata} from '@jaen/redux/slices/site'
import {useSite} from '@jaen/services/site'
import {ISite} from '@jaen/types'
import SettingsTab from './components/Settings'

export const SettingsContainer = withRedux(() => {
  const dispatch = useAppDispatch()
  const data = useSite()

  const handleUpdate = (data: ISite) => {
    alert(`update site: ${JSON.stringify(data)}`)
    if (data.siteMetadata) {
      dispatch(updateSiteMetadata(data.siteMetadata))
    }
  }

  return <SettingsTab data={data} onUpdate={handleUpdate} />
})
