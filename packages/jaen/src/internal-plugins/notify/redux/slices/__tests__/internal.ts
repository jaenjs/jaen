import {actions, reducers} from '../internal'

describe('notifications', () => {
  const reducer = reducers.notifications

  it('creates a notification when a field is written', () => {
    expect(
      reducer(
        undefined,
        actions.field_write({
          notificationId: 'notification-id',
          fieldType: 'field-type',
          fieldName: 'field-name',
          value: 'value'
        })
      )
    ).toEqual({
      nodes: {
        'notification-id': {
          id: 'notification-id',
          jaenFields: {
            'field-type': {
              'field-name': 'value'
            }
          }
        }
      }
    })
  })

  it('creates a new fieldname when a field with new name is written on a existing notification', () => {
    const previousState = {
      nodes: {
        'notification-id': {
          id: 'notification-id',
          jaenFields: {
            'field-type': {
              'field-name': 'value'
            }
          }
        }
      }
    }

    expect(
      reducer(
        previousState,
        actions.field_write({
          notificationId: 'notification-id',
          fieldType: 'field-type',
          fieldName: 'field-name-2',
          value: 'value'
        })
      )
    ).toEqual({
      nodes: {
        'notification-id': {
          id: 'notification-id',
          jaenFields: {
            'field-type': {
              'field-name': 'value',
              'field-name-2': 'value'
            }
          }
        }
      }
    })
  })

  it('creates a new fieltype when a field with new type is written on a existing notificaiton', () => {
    const previousState = {
      nodes: {
        'notification-id': {
          id: 'notification-id',
          jaenFields: {
            'field-type': {
              'field-name': 'value'
            }
          }
        }
      }
    }

    expect(
      reducer(
        previousState,
        actions.field_write({
          notificationId: 'notification-id',
          fieldType: 'field-type-2',
          fieldName: 'field-name',
          value: 'value'
        })
      )
    ).toEqual({
      nodes: {
        'notification-id': {
          id: 'notification-id',
          jaenFields: {
            'field-type': {
              'field-name': 'value'
            },
            'field-type-2': {
              'field-name': 'value'
            }
          }
        }
      }
    })
  })
})
