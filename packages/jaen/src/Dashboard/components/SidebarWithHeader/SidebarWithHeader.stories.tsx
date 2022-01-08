import {ComponentMeta, Story} from '@storybook/react'
import React from 'react'
import {FiFile} from 'react-icons/fi'

import Component from '.'

export default {
  title: 'Dashboard/components/SidebarWithHeader',
  component: Component
} as ComponentMeta<typeof Component>

type ComponentProps = React.ComponentProps<typeof Component>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Component {...args} />

export const SidebarWithHeader: Story<ComponentProps> = Template.bind({})
SidebarWithHeader.args = {
  sidebarItems: {
    'tab-1': {
      name: 'Pages',
      icon: FiFile
    }
  },
  children: <>SidebarWithHeader</>,
  onCloseDashboard: () => null
}
