export interface INotification {
  id: string // relative path to the notification file
  jaenFields: {
    [type: string]: {
      [name: string]: any
    }
  } | null
}
