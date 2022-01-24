import {Center, CircularProgress} from '@chakra-ui/react'
import {useAppSelector, withRedux} from '@internal/redux'
import {useJaenTemplates, useSiteContext} from '@internal/services/site'
import {usePromiseEffect} from '@internal/utils/hooks/usePromiseEffect'
import {RouteComponentProps} from '@reach/router'
import {navigate, PageProps} from 'gatsby'
import * as React from 'react'

const Dynamic = (props: RouteComponentProps & Partial<PageProps>) => {
  const dynamicPaths = useAppSelector(
    state => state.internal.routing.dynamicPaths
  )

  const path = props.location?.hash?.substring(1)

  if (typeof window === 'undefined') {
    return <>dynamic</>
  }

  if (!path) {
    throw new Error('Something went wrong while preparing a dynamic page')
  }

  const {pageId, templateName} = React.useMemo(() => dynamicPaths[path], [path])

  const {templateLoader} = useSiteContext()

  React.useEffect(() => {
    // We can determine if a page has been moved by checking if the path is no longer in the dynamicPaths, if so
    // we search for the the new path in the dynamicPaths by pageId and redirect to it.

    if (!(path in dynamicPaths)) {
      const newPath = Object.keys(dynamicPaths).find(
        path => dynamicPaths[path]?.pageId === pageId
      )

      if (newPath) {
        // Page has been moved, update to the new path
        navigate(`/_#${newPath}`)
      } else {
        // Page has been deleted, redirect to the parent page
        navigate('/')
      }
    }
  }, [dynamicPaths])

  const template = useJaenTemplates().find(t => t.name === templateName)

  if (!template) {
    throw Error(
      'No template found in dynamic page. Page could also be not in state.'
    )
  }

  const {value: Component} = usePromiseEffect(async () => {
    // TODO: Remove this hack to ignore incorrect template names
    return await templateLoader(templateName)
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
      {...(props as any)}
      pageContext={{...props.pageContext, jaenPageId: pageId}}
      data={{...props.data, staticJaenPage: null}}
    />
  )
}

export default withRedux(Dynamic)
