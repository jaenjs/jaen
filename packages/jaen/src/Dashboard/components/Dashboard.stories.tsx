import {ComponentMeta, Story} from '@storybook/react'
import React from 'react'
import {FiFile} from 'react-icons/fi'

import Component from '.'

export default {
  title: 'Dashboard/components',
  component: Component
} as ComponentMeta<typeof Component>

type ComponentProps = React.ComponentProps<typeof Component>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Component {...args} />

export const Dashboard: Story<ComponentProps> = Template.bind({})
Dashboard.args = {
  isOpen: true,
  tabs: {
    pages: {
      name: 'Pages',
      icon: FiFile,
      element: <p>Pages tab</p>
    },
    files: {
      name: 'Files',
      icon: FiFile,
      element: <p>Files tab</p>
    }
  }
}
