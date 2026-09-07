import React, {useEffect, useMemo, useState} from 'react'
import {MediaNode, uploadFile, useField, useNotificationsContext} from 'jaen'
import {v4 as uuidv4} from 'uuid'

import {Media, MediaProps} from '../components/cms/Media/Media'
import {TreeNode} from '../components/cms/Pages/components/PageVisualizer'
import type {
  MediaFolderNode,
  MediaFolderTreeNode
} from '../contexts/jaen-frame-menu'
import {useCMSManagement, withCMSManagement} from '../connectors/cms-management'
import {useJaenFrameMenuContext} from '../contexts/jaen-frame-menu'

export interface MediaContainerProps {
  isSelector?: boolean
  defaultSelected?: string
  jaenPageId?: string
  onSelect?: (mediaNode: MediaNode) => void
}

const MediaContainer: React.FC<MediaContainerProps> = props => {
  const {toast} = useNotificationsContext()

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

  /**
   * The folders an app registered, the way the frame's menu entries are
   * registered: whoever mounts inside the frame calls registerMediaFolders
   * and its entries appear in the tree here. Nothing about vehicles or
   * documents is known in this plugin, see the context and
   * okf/architecture/media.md, "One gallery, jaen's".
   */
  const {mediaFolders} = useJaenFrameMenuContext()

  /** Every tree id that belongs to a folder of an app, the folder included. */
  const folderIds = useMemo(() => {
    const ids = new Set<string>()

    const walk = (node: MediaFolderTreeNode) => {
      ids.add(node.id)
      node.children.forEach(walk)
    }

    mediaFolders.forEach(folder => {
      ids.add(folder.id)
      folder.tree.forEach(walk)
    })

    return ids
  }, [mediaFolders])

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
    // The gallery disables the control inside an app folder; this is the
    // same refusal one layer down, so a drop that got past the UI writes no
    // page image under a folder's id.
    if (folderIds.has(jaenPageId ?? '')) {
      return
    }

    try {
      const uploadedMediaNodes = await Promise.all(
        files.map(async file => {
          const {data, fileUrl, fileThumbUrl} = await uploadFile(file)
          /**
           * Dimensions come from actually loading the image, and the failure
           * path matters: without an `onerror` this promise never settles, so
           * anything the browser refuses to render -- a wrong content type, a
           * blocked request, a file that is not an image at all -- left the
           * upload hanging forever with nothing in the console. It is treated
           * as "unknown size" instead, which the media node tolerates.
           */
          const dimensions = await new Promise<{width: number; height: number}>(
            resolve => {
              const img = new Image()

              img.onload = () => {
                resolve({width: img.width, height: img.height})
              }
              img.onerror = () => {
                console.warn(
                  'jaen: could not read the dimensions of the uploaded file',
                  fileUrl
                )
                resolve({width: 0, height: 0})
              }

              img.src = fileUrl
            }
          )

          const newMediaNode: MediaNode = {
            id: uuidv4(),
            fileUniqueId: data.file_unique_id,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            description: data.file_name,
            preview: fileThumbUrl ? {url: fileThumbUrl} : undefined,
            url: fileUrl,
            width: dimensions.width,
            height: dimensions.height,
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
      /**
       * This used to swallow the error and return. An upload that failed for
       * any reason -- a rejected request, a gateway error, an expired session
       * -- therefore looked exactly like a button that does nothing, with an
       * empty console. Two separate upload defects hid behind it.
       */
      console.error('jaen: uploading media failed', error)

      toast({
        position: 'top-right',
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Could not upload the file',
        status: 'error'
      })
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
        .catch(() => {
          // Handle download error gracefully, show error message to user, etc.
        })
    }
  }

  /** Which folder a node came from, empty for a page image. */
  const folderOfNode = useMemo(() => {
    const owner = new Map<string, (typeof mediaFolders)[number]>()

    mediaFolders.forEach(folder => {
      folder.nodes.forEach(node => {
        owner.set(node.id, folder)
      })
    })

    return owner
  }, [mediaFolders])

  const onDelete = (mediaId: string) => {
    /**
     * A node of an app folder is not in the CMS field, so deleting it here
     * would write nothing and leave the row where it is. The folder's own
     * onDelete removes the thing behind it (a car's picture, a document
     * row) and its read then answers one node fewer.
     */
    const folder = folderOfNode.get(mediaId)

    if (folder) {
      if (folder.onDelete) {
        void Promise.resolve(folder.onDelete(mediaId)).catch(error => {
          console.error('jaen: deleting the media node failed', error)

          toast({
            position: 'top-right',
            title: 'Delete failed',
            description:
              error instanceof Error
                ? error.message
                : 'Could not delete the file',
            status: 'error'
          })
        })
      }

      return
    }

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
    const values: MediaFolderNode[] = Object.values(mediaNodes)

    // if selector and jaenPageId is set, filter mediaNodes by jaenPageId
    if (props.isSelector && jaenPageId) {
      return values.filter(mediaNode => mediaNode.jaenPageId === jaenPageId)
    }

    /**
     * The app's folders bring their own nodes, read from its backend rather
     * than from the CMS field, and they go into the same grid as the page
     * images. A selector chooses a page image and nothing else fits in a
     * jaen field, so it sees none of them.
     */
    if (props.isSelector) {
      return values
    }

    return values.concat(...mediaFolders.map(folder => folder.nodes))
  }, [mediaNodes, jaenPageId, mediaFolders, props.isSelector])

  /**
   * The folders' entries merged into the page tree, one branch per folder
   * after the pages. `showInNodeGraphVisualizer` is what the tree node of
   * the pages carries; nothing draws these in the graph, and it is false
   * for that reason.
   */
  const tree = useMemo(() => {
    if (props.isSelector || mediaFolders.length === 0) {
      return manager.tree
    }

    const asTreeNode = (node: MediaFolderTreeNode): TreeNode => ({
      id: node.id,
      label: node.label,
      children: node.children.map(asTreeNode),
      showInNodeGraphVisualizer: false
    })

    return [
      ...manager.tree,
      ...mediaFolders.map(folder => ({
        id: folder.id,
        label: folder.label,
        children: folder.tree.map(asTreeNode),
        showInNodeGraphVisualizer: false
      }))
    ]
  }, [manager.tree, mediaFolders, props.isSelector])

  return (
    <Media
      isSelector={props.isSelector}
      defaultSelected={defaultSelected}
      tree={tree}
      mediaNodes={mediaNodesValues}
      onUpload={onUpload}
      onClone={onClone}
      onDownload={onDownload}
      onDelete={onDelete}
      onUpdate={onUpdate}
      onSelect={onSelect}
      onJaenPageSelect={onJaenPageSelect}
      folders={props.isSelector ? undefined : mediaFolders}
    />
  )
}

export default withCMSManagement(MediaContainer)
