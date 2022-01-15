import update from 'immutability-helper'
import * as React from 'react'

import {Backend} from '../backends/backend'
import Finder from '../components/organisms/Finder'
import {
  FinderData,
  FinderFileItem,
  FinderFolderItem,
  FinderMode,
  SnekFinderAction
} from '../components/organisms/Finder/types'
import ImageViewer from '../components/organisms/ImageViewer'
import PdfViewer from '../components/organisms/PdfViewer'
import SnekStudio from '../components/organisms/SnekStudio'

interface ToggleOptions {
  finderMode: FinderMode
  openFile?: {
    fileId: string
    preview: boolean
  }
}

interface ISnekFinderContext {
  element: JSX.Element
  toggle: {
    open: (options: ToggleOptions) => void
    close: () => void
    toggle: () => void
  }
  onAction: (action: SnekFinderAction) => void
}

const SnekFinderContext = React.createContext<ISnekFinderContext | undefined>(
  undefined
)

export const useSnekFinder = () => {
  const context = React.useContext(SnekFinderContext)

  if (!context) {
    throw new Error('useSnekFinder must be used within a SnekFinderProvider')
  }

  return context
}

export const SnekFinderProvider: React.FC<{
  backend: Backend
  initData: FinderData
  rootFileId: string
}> = ({backend, initData, rootFileId, children}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [mode, setMode] = React.useState<FinderMode>('browser')
  const [defaultItem, setDefaultItem] = React.useState<string | null>(null)
  const [data, setData] = React.useState<FinderData>(initData)

  const [openFile, setOpenFile] = React.useState<{
    fileId: string
    previewType: 'IMAGE_VIEWER' | 'PDF_VIEWER' | 'SNEK_STUDIO'
  } | null>(null)

  const openedFileItem = React.useMemo(() => {
    if (!openFile) {
      return null
    }

    const {fileId} = openFile

    const item = data[fileId]

    if (!item) {
      return null
    } else if ((item as any).isFolder) {
      return null
    }

    return item as FinderFileItem
  }, [openFile, data])

  React.useEffect(() => {
    const fn = async () => {
      const {data} = await backend.readIndex()

      alert(JSON.stringify(data))

      setData(data || initData)
    }

    fn()
  }, [])

  const handleDataChange = async (newData: any, action: SnekFinderAction) => {
    onAction(action)

    if (action.type === 'ADD') {
      const {uuid, file} = action.payload

      if (file) {
        const url = await backend.upload(file)

        newData[uuid] = update(newData[uuid], {
          src: {$set: url}
        })
      }
    }
    setData(newData)

    backend.writeIndex(newData)
  }

  const handleFileOpen = (fileId: string) => {
    const file = data[fileId]

    if (!(file as FinderFolderItem).isFolder) {
      const {mimeType} = file as FinderFileItem
      if (mimeType && mimeType.startsWith('image/')) {
        setOpenFile({fileId, previewType: 'IMAGE_VIEWER'})
      } else if (mimeType && mimeType.startsWith('application/pdf')) {
        setOpenFile({fileId, previewType: 'PDF_VIEWER'})
      }
    }
  }

  const handleFinderOpen = (options: ToggleOptions) => {
    setIsOpen(true)
    setMode(options.finderMode)

    if (options.openFile?.preview) {
      handleFileOpen(options.openFile.fileId)
    }
  }

  const handleFinderClose = () => {
    setIsOpen(false)
    setOpenFile(null)
  }

  const toggle = {
    open: handleFinderOpen,
    close: handleFinderClose,
    toggle: () => setIsOpen(!isOpen)
  }

  const onAction = (action: SnekFinderAction) => {
    return action
  }

  const finderElement = (
    <Finder
      data={data}
      mode={mode}
      rootUUID={rootFileId}
      onItemOpen={handleFileOpen}
      onDataChanged={handleDataChange}
      onSelectorClose={handleFinderClose}
      onSelectorSelect={item => alert('not implemented yet')}
    />
  )

  return (
    <SnekFinderContext.Provider
      value={{toggle, onAction, element: finderElement}}>
      {openFile && openedFileItem && (
        <>
          {openFile.previewType === 'IMAGE_VIEWER' && (
            <ImageViewer
              src={openedFileItem.src}
              onOpenStudio={() => {
                setOpenFile({...openFile, previewType: 'SNEK_STUDIO'})
              }}
              onClose={() => setOpenFile(null)}
            />
          )}
          {openFile.previewType === 'PDF_VIEWER' && (
            <PdfViewer
              src={openedFileItem.src}
              overlay
              toolbar
              onClose={() => setOpenFile(null)}
            />
          )}
          {openFile.previewType === 'SNEK_STUDIO' && (
            <SnekStudio
              src={openedFileItem.src}
              onComplete={async (blob, dataURL) => {
                const fileId = openFile.fileId
                setData(update(data, {[fileId]: {src: {$set: dataURL}}}))

                // upload blob to backend
                if (blob) {
                  const url = await backend.upload(
                    new File([blob], openedFileItem.name)
                  )

                  const newData = update(data, {
                    [fileId]: {src: {$set: url}}
                  })

                  setData(newData)

                  backend.writeIndex(newData)
                }
              }}
              onClose={() =>
                setOpenFile({...openFile, previewType: 'IMAGE_VIEWER'})
              }
            />
          )}
        </>
      )}
      {isOpen && <>{finderElement}</>}
      {children}
    </SnekFinderContext.Provider>
  )
}

export default SnekFinderProvider
