import {useToast} from '@chakra-ui/react'
import {PublishButton} from '@components/molecules/buttons'
import {storageGet} from '@src/contexts/cms'
import {useJaenCoreContext} from '@src/contexts/core'
import {JaenPagesEntity, JaenPagesPublish} from '@src/types'
import {resolvePath} from '@src/utils'
import {store} from '@store/index'
import {withRedux} from '@store/withRedux'
import gql from 'graphql-tag'
import React from 'react'

const processPublish = async () => {
  const {upload} = await import('@src/storage')

  const {allSitePage} = storageGet()

  const allNodes = allSitePage.nodes

  const state = store.getState()

  const createdAt = new Date().toISOString()

  const newPages: {[id: string]: JaenPagesEntity} = {}

  // upload nodes to ipfs
  const nodes = state.site.allSitePage?.nodes

  if (nodes) {
    for (const [id, node] of Object.entries(nodes)) {
      const path = resolvePath(id, allNodes as any)
      const paylaod = {...node, path}

      const url = await upload(paylaod)
      newPages[id] = {context: {fileUrl: url, createdAt}}
    }
  }

  const siteMetadataPayload = state.site.siteMetadata

  const newSiteMetadata = siteMetadataPayload
    ? await upload(siteMetadataPayload)
    : undefined

  const publishData: JaenPagesPublish = {
    site: newSiteMetadata
      ? {
          context: {
            createdAt,
            fileUrl: newSiteMetadata
          }
        }
      : undefined,
    snekFinder: state.sf.initBackendLink
      ? {
          context: {
            createdAt,
            fileUrl: state.sf.initBackendLink
          }
        }
      : undefined,
    pages: newPages
  }

  return publishData
}

const Button: React.FC = () => {
  const core = useJaenCoreContext()
  const toast = useToast()

  const isDisabled = core.getAuthState().isGuest

  const publish = async () => {
    const {BifrostBridge} = await import('@snek-at/bridge')

    const Bridge = new BifrostBridge({
      httpUrl: 'https://origin.snek.at/graphql'
    })

    const {upload} = await import('@src/storage')
    const url = await upload(await processPublish())

    const publishRes = await Bridge.session.mutate<{
      jaenPublishFormPage: {result: string}
    }>(
      gql`
        mutation JaenPublishMutation($values: GenericScalar!, $url: String!) {
          jaenPublishFormPage(values: $values, url: $url) {
            result
            errors {
              name
              errors
            }
          }
        }
      `,
      {
        url: '/jaen-publish',
        values: {git_remote: core.remote, jaendata_url: url}
      }
    )

    if (publishRes.data?.jaenPublishFormPage?.result === 'OK') {
      toast({
        title: 'Successfully published.',
        status: 'success',
        duration: 9000,
        isClosable: true
      })
    } else {
      toast({
        title: 'Publish failed.',
        status: 'error',
        duration: 9000,
        isClosable: true
      })
    }
  }

  return (
    <PublishButton disabled={isDisabled} onPublishClick={() => publish()} />
  )
}

export default withRedux(Button)
