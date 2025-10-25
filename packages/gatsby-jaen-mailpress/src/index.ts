import {GQtyError} from 'gqty'
import type {GraphQLError} from 'graphql'

import {EnvelopeInput, resolve} from './client'

export interface SendTemplateMailOptions {
  envelope?: Partial<EnvelopeInput>
  values?: Record<string, unknown>
}

export type SendTemplateMailResult =
  | {
      ok: true
      message: string
    }
  | {
      ok: false
      message: string
      errors?: readonly GraphQLError[]
    }

export const sendTemplateMail = async (
  id: string,
  options?: SendTemplateMailOptions
): Promise<SendTemplateMailResult> => {
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
