import React, {useEffect, useMemo, useState} from 'react'
import {MediaNode, uploadFile, useField, usePageContext} from 'jaen'
import {v4 as uuidv4} from 'uuid'

import {Media, MediaProps} from '../components/cms/Media/Media'
import {useCMSManagement, withCMSManagement} from '../connectors/cms-management'
import {generatePdfCover} from '../lib/generate-pdf-cover'

export interface MediaContainerProps {
  isSelector?: boolean
  defaultSelected?: string
  jaenPageId?: string
  onSelect?: (mediaNode: MediaNode) => void
  accept?: Record<string, string[]>
}

const MediaContainer: React.FC<MediaContainerProps> = props => {
  const [jaenPageId, setJaenPageId] = useState<string | undefined>(
    props.jaenPageId
  )

  useEffect(() => {
    setJaenPageId(props.jaenPageId)
  }, [props.jaenPageId])

  const onJaenPageSelect = (id: string | null) => {
    setJaenPageId(id || undefined)
  }

  const field = useField<{
    [id: string]: MediaNode
  }>('media_nodes', 'IMA:MEDIA_NODES')
  const [mediaNodes, setMediaNodes] = useState<{
    [id: string]: MediaNode
  }>(field.staticValue || {})

  const manager = useCMSManagement()

  useEffect(() => {
    setMediaNodes(field.value || field.staticValue || {})
  }, [field.value, field.staticValue])

  const [defaultSelected, setDefaultSelected] = useState<string | undefined>(
    props.defaultSelected
  )

  useEffect(() => {
    setDefaultSelected(props.defaultSelected)
  }, [props.defaultSelected])

  const onUpload = async (files: File[]) => {
    try {
      const uploadedMediaNodes = await Promise.all(
        files.map(async file => {
          const {data, fileUrl, fileThumbUrl} = await uploadFile(file)

          let width = 0
          let height = 0
          let thumbUrl = fileThumbUrl

          // Handle image files
          if (data.mime_type.startsWith('image/')) {
            try {
              const dimensions = await new Promise<{
                width: number
                height: number
              }>(resolve => {
                const img = new Image()
                img.onload = () =>
                  resolve({width: img.width, height: img.height})
                img.onerror = () => resolve({width: 0, height: 0})
                img.src = fileUrl
              })
              width = dimensions.width
              height = dimensions.height
            } catch {
              width = 0
              height = 0
            }
          }

          // Handle PDF cover preview
          else if (data.mime_type === 'application/pdf') {
            try {
              const blob = await generatePdfCover(file)

              const {fileUrl: coverImageUrl} = await uploadFile(blob) // uploadFile should accept a Blob too
              thumbUrl = coverImageUrl

              const img = new Image()
              await new Promise<void>(resolve => {
                img.onload = () => {
                  width = img.width
                  height = img.height
                  resolve()
                }
                img.src = coverImageUrl
              })
            } catch {
              width = 0
              height = 0
            }
          }

          const newMediaNode: MediaNode = {
            id: uuidv4(),
            mimeType: data.mime_type,
            fileUniqueId: data.file_unique_id,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            description: data.file_name,
            preview: thumbUrl ? {url: thumbUrl} : undefined,
            url: fileUrl,
            width,
            height,
            revisions: [],
            jaenPageId
          }

          return newMediaNode
        })
      )

      field.write({
        ...mediaNodes,
        ...uploadedMediaNodes.reduce<{[id: string]: MediaNode}>(
          (acc, mediaNode) => {
            acc[mediaNode.id] = mediaNode
            return acc
          },
          {}
        )
      })
    } catch (error) {
      return
    }
  }

  const onClone = (mediaId: string) => {
    // Clone media
    const mediaToClone = mediaNodes[mediaId]

    if (mediaToClone) {
      const clonedMedia = {
        ...mediaToClone,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        revisions: []
      }

      field.write({
        ...mediaNodes,
        [clonedMedia.id]: clonedMedia
      })

      setDefaultSelected(clonedMedia.id)
    }
  }

  const onDownload = (mediaId: string) => {
    // Download media
    const mediaToDownload = mediaNodes[mediaId]

    if (mediaToDownload) {
      void fetch(mediaToDownload.url)
        .then(async response => {
          if (!response.ok) {
            throw new Error(
              `Failed to download photo: ${response.status} ${response.statusText}`
            )
          }

          const blob = await response.blob()
          const blobUrl = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = mediaToDownload.url.replace(/^.*[\\/]/, '')
          a.click()
          a.remove()
        })
        .catch(error => {
          // Handle download error gracefully, show error message to user, etc.
        })
    }
  }

  const onDelete = (mediaId: string) => {
    const mutableMediaNodes = {...mediaNodes}

    delete mutableMediaNodes[mediaId]

    field.write(mutableMediaNodes)
  }

  const onUpdate: MediaProps['onUpdate'] = async (mediaId, media) => {
    const mutableMediaNodes = {...mediaNodes}

    // Update media
    const foundMedia = mutableMediaNodes[mediaId]

    if (!foundMedia) {
      return
    }

    const updatedMedia = {
      ...foundMedia,
      ...media
    }

    // skip if no changes were made
    if (JSON.stringify(foundMedia) === JSON.stringify(updatedMedia)) {
      return
    }

    const preparedRevision = {
      ...foundMedia
    }

    delete preparedRevision.revisions

    // add revision
    updatedMedia.revisions = [
      ...(updatedMedia.revisions || []),
      preparedRevision
    ]

    // delete file from media because it should not be saved
    delete updatedMedia.file

    if (media.file) {
      try {
        // upload new file
        const {fileUrl, fileThumbUrl, data} = await uploadFile(media.file)

        updatedMedia.mimeType = data.mime_type

        updatedMedia.fileUniqueId = data.file_unique_id

        updatedMedia.modifiedAt = new Date().toISOString()
        updatedMedia.url = fileUrl
        updatedMedia.preview = fileThumbUrl ? {url: fileThumbUrl} : undefined

        const dimensions = await new Promise<{width: number; height: number}>(
          resolve => {
            const img = new Image()
            img.onload = () => {
              resolve({width: img.width, height: img.height})
            }
            img.src = fileUrl
          }
        )

        updatedMedia.width = dimensions.width
        updatedMedia.height = dimensions.height
      } catch (error) {
        // Handle upload error gracefully, show error message to user, etc.
        return
      }
    }

    mutableMediaNodes[mediaId] = updatedMedia

    field.write(mutableMediaNodes)
  }

  const onSelect = (mediaId: string) => {
    const selectedMediaNode = mediaNodes[mediaId]

    if (props.isSelector && props.onSelect && selectedMediaNode) {
      props.onSelect(selectedMediaNode)
    }
  }

  const mediaNodesValues = useMemo(() => {
    const values = Object.values(mediaNodes)

    // if selector and jaenPageId is set, filter mediaNodes by jaenPageId
    if (props.isSelector && jaenPageId) {
      return values.filter(mediaNode => mediaNode.jaenPageId === jaenPageId)
    }

    return values
  }, [mediaNodes, jaenPageId])

  return (
    <Media
      isSelector={props.isSelector}
      defaultSelected={defaultSelected}
      tree={manager.tree}
      mediaNodes={mediaNodesValues}
      onUpload={onUpload}
      onClone={onClone}
      onDownload={onDownload}
      onDelete={onDelete}
      onUpdate={onUpdate}
      onSelect={onSelect}
      onJaenPageSelect={onJaenPageSelect}
      accept={props.accept}
    />
  )
}

export default withCMSManagement(MediaContainer)
