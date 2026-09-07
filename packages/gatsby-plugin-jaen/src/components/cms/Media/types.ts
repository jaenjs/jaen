export type MediaPreviewState = 'PREVIEW' | 'EDIT' | false

/**
 * A node of the grid. It is jaen's MediaNode, and where an app's folder put
 * it there it also carries the gateway's `mimeType`, which is the one thing
 * the grid reads to decide between a picture and a document.
 */
export type {MediaFolderNode} from '../../../contexts/jaen-frame-menu'
