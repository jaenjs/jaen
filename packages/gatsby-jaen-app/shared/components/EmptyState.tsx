/**
 * The honest rendering of an empty list: a word, optionally a reason and a
 * button. Screens pass their own strings from their own catalogue, the
 * default title is the common one.
 */
import React from 'react'
import {EmptyState as ChakraEmptyState, VStack} from '@chakra-ui/react'
import {FaInbox} from '@react-icons/all-files/fa/FaInbox'
import {useI18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'

export interface EmptyStateProps extends Omit<ChakraEmptyState.RootProps, 'title'> {
  title?: string
  description?: string
  icon?: React.ReactNode
}

export function EmptyState({title, description, icon, children, ...rest}: EmptyStateProps) {
  const code = useI18nCode()
  const {strings} = getI18nCommon(code)

  return (
    <ChakraEmptyState.Root size="md" {...rest}>
      <ChakraEmptyState.Content>
        <ChakraEmptyState.Indicator>{icon ?? <FaInbox />}</ChakraEmptyState.Indicator>
        <VStack textAlign="center" gap="1">
          <ChakraEmptyState.Title>{title ?? strings.EmptyTitle}</ChakraEmptyState.Title>
          {description && (
            <ChakraEmptyState.Description>{description}</ChakraEmptyState.Description>
          )}
        </VStack>
        {children}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  )
}
