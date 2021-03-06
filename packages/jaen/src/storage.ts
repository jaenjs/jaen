export const upload = async (payload: object | Blob | File) => {
  const url = 'https://osg.snek.at/storage'

  const formData = new FormData()

  // payload to blob
  if (payload instanceof Blob || payload instanceof File) {
    formData.append('file', payload)
  } else {
    formData.append(
      'file',
      new File([JSON.stringify(payload)], 'jaen-index.json', {
        type: 'application/json'
      })
    )
  }

  const resp = await fetch(url, {
    body: formData,
    method: 'POST'
  })

  const json = await resp.json()

  return `${url}/${json.file_id}`
}

/**
 * Upload function for NodeJS
 */
export const nodejsSafeJsonUpload = async (payload: string) => {
  const FormData = require('form-data')

  const formData = new FormData()

  formData.append('file', payload, {
    knownLength: payload.length,
    filename: 'jaen-index.json',
    contentType: 'application/json'
  })

  const url = 'https://osg.snek.at/storage'

  const resp = await fetch(url, {
    body: formData,
    method: 'POST'
  })

  const json = await resp.json()

  return `${url}/${json.file_id}`
}
