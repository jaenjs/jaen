import {Center, CircularProgress} from '@chakra-ui/react'
import {navigate, PageProps} from 'gatsby'
import * as React from 'react'

import {useAppSelector} from '../../../store'
import {withRedux} from '../../../store/withRedux'
import {usePromiseEffect} from '../../hooks/usePromiseEffect'
import {JaenPageProvider} from '../../providers/JaenPageProvider'
import {useJaenContext} from '../../providers/JaenProvider'
import {JaenConnection, JaenPageOptions} from '../../types'

const Dynamic = ({...props}: Partial<PageProps>) => {
  const dynamicPaths = useAppSelector(state => state.dpaths.dynamicPaths)

  const path = React.useMemo(
    () => props.location?.pathname.split('/_')[1],
    [props.location?.pathname]
  )

  if (!path) {
    throw new Error('Something went wrong while preparing a dynamic page')
  }

  const pageId = React.useMemo(() => dynamicPaths[path], [path])

  const {templateLoader} = useJaenContext()

  React.useEffect(() => {
    // We can determine if a page has been moved by checking if the path is no longer in the dynamicPaths, if so
    // we search for the the new path in the dynamicPaths by pageId and redirect to it.

    if (!(path in dynamicPaths)) {
      const newPath = Object.keys(dynamicPaths).find(
        path => dynamicPaths[path] === pageId
      )
      console.log(
        '🚀 ~ file: dynamic.tsx ~ line 40 ~ React.useEffect ~ newPath',
        newPath
      )

      if (newPath) {
        console.log(
          '🚀 ~ file: dynamic.tsx ~ line 44 ~ React.useEffect ~ newPath',
          newPath
        )
        // Page has been moved, update to the new path
        navigate(`/_${newPath}`)
      } else {
        // Page has been deleted, redirect to the parent page
        navigate('/')
      }
    }
  }, [dynamicPaths])

  const template = useAppSelector(state => state.pages.pages[pageId]?.template)

  if (!template) {
    throw Error(
      'No template found in dynamic page. Page could also be not in state.'
    )
  }

  const {value: Component} = usePromiseEffect(async () => {
    // TODO: Remove this hack to ignore incorrect template names
    return await templateLoader('BlogPage' || template.name)
  }, [template])

  if (!Component) {
    return (
      <Center>
        <CircularProgress isIndeterminate color="green.300" />
      </Center>
    )
  }

  return (
    <Component
      jaenPageId={pageId}
      {...(props as PageProps)}
      data={{...props.data, staticJaenPage: null}}
    />
  )
}

export default withRedux(Dynamic)
