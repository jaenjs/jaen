import {Center, CircularProgress} from '@chakra-ui/react'
import {PageProps} from 'gatsby'
import * as React from 'react'

import {useAppSelector} from '../../../store'
import {withRedux} from '../../../store/withRedux'
import {JaenPageProvider} from '../../providers/JaenPageProvider'
import {useJaenContext} from '../../providers/JaenProvider'
import {JaenConnection, JaenPageOptions} from '../../types'

const Dynamic = (props: Partial<PageProps & {jaenPageId: string}>) => {
  const {templateLoader} = useJaenContext()

  const [Component, setComponent] = React.useState<JaenConnection<
    PageProps,
    JaenPageOptions
  > | null>(null)

  const template = useAppSelector(
    state => state.pages[props.jaenPageId!]?.template
  )

  if (!template) {
    throw Error(
      'No template found in dynamic page. Page could also be not in state.'
    )
  }

  React.useEffect(() => {
    const loadTemplate = async () => {
      const Component = await templateLoader(template.name)

      setComponent(Component)
    }

    loadTemplate()
  }, [template])

  if (!Component) {
    return (
      <Center>
        <CircularProgress isIndeterminate color="green.300" />
      </Center>
    )
  }

  return (
    <JaenPageProvider staticJaenPage={null}>
      {<Component {...(props as PageProps)} />}
    </JaenPageProvider>
  )
}

export default withRedux(Dynamic)
