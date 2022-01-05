import {Center, CircularProgress} from '@chakra-ui/react'
import {PageProps} from 'gatsby'
import * as React from 'react'

import {useAppSelector} from '../../../store'
import {withRedux} from '../../../store/withRedux'
import {usePromiseEffect} from '../../hooks/usePromiseEffect'
import {JaenPageProvider} from '../../providers/JaenPageProvider'
import {useJaenContext} from '../../providers/JaenProvider'
import {JaenConnection, JaenPageOptions} from '../../types'

const Dynamic = ({
  jaenPageId,
  ...props
}: Partial<PageProps & {jaenPageId: string}>) => {
  const {templateLoader} = useJaenContext()

  console.log(
    '🚀 ~ file: dynamic.tsx ~ line 12 ~ Dynamic ~ jaenPageId',
    jaenPageId
  )

  const template = useAppSelector(state => state.pages[jaenPageId!]?.template)

  if (!template) {
    throw Error(
      'No template found in dynamic page. Page could also be not in state.'
    )
  }

  const {value: Component} = usePromiseEffect(async () => {
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
      jaenPageId={jaenPageId!}
      {...(props as PageProps)}
      data={{...props.data, staticJaenPage: null}}
    />
  )
}

export default withRedux(Dynamic)
