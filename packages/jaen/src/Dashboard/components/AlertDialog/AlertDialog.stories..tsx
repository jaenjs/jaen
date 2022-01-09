import {ComponentMeta, Story} from '@storybook/react'
import React from 'react'

import Component from '.'

export default {
  title: 'AlertDialog',
  component: Component
} as ComponentMeta<typeof Component>

type ComponentProps = React.ComponentProps<typeof Component>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Component {...args} />

export const Create: Story<ComponentProps> = Template.bind({})

Create.args = {
  title: 'Should create a new page?',
  body: 'This page will be created with the default template.',
  buttons: {
    left: {
      text: 'Cancel2',
      onClick: () => null
    },
    right: {
      text: 'Create',
      colorScheme: 'green',
      onClick: () => null
    }
  },
  isOpen: true,
  onOpen: () => null,
  onClose: () => null
}
