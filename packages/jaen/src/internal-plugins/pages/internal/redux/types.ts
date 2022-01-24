import {IJaenPage} from '../../types'

export interface IJaenState {
  status: {
    isEditing: boolean
    changes: {
      [pageId: string]: {
        total: number
      }
    }
  }
  pages: {
    lastAddedNodeId?: string
    nodes: {
      [uuid: string]: Partial<IJaenPage>
    }
  }
  routing: {
    dynamicPaths: {
      [path: string]: {
        pageId: string
        templateName: string
      }
    }
  }
}

//> Other types
export type IJaenSection = NonNullable<
  IJaenPage['chapters']
>[string]['sections'][string]

export type IJaenSectionWithId = IJaenSection & {
  id: string
}
