import {INotification} from '../types'

export interface IJaenState {
  notifications: {
    nodes: {
      [id: string]: INotification
    }
  }
}
