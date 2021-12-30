import {Story, ComponentMeta} from '@storybook/react'
import React from 'react'

import Component from '.'

export default {
  title: 'components/Dashboard',
  component: Component
} as ComponentMeta<typeof Component>

type ComponentProps = React.ComponentProps<typeof Component>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Component {...args} />

export const Dashboard: Story<ComponentProps> = Template.bind({})
Dashboard.args = {
  isOpen: true
}
