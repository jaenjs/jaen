import {GQtyError} from 'gqty'
import {EnvelopeInput, resolve} from './client'

export const sendTemplateMail = async (
  id: string,
  options?: {
    envelope?: Partial<EnvelopeInput>
    values?: Record<string, string>
  }
) => {
  try {
    await resolve(
      ({mutation}) => {
        const mail = mutation.sendTemplateMail({
          id,
          envelope: options?.envelope,
          values: options?.values
        })

        return mail
      },
      {
        cachePolicy: 'no-store'
      }
    )

    return {
      ok: true,
      message: 'Mail sent successfully'
    }
  } catch (error: any) {
    if (error instanceof GQtyError) {
      return {
        ok: false,
        message: 'Failed to send mail',
        errors: error.graphQLErrors
      }
    }

    return {
      ok: false,
      message: error.message
    }
  }
}
