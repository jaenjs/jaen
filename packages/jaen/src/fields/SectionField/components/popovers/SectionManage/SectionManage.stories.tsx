import {Button} from '@chakra-ui/react'
import {ComponentMeta, Story} from '@storybook/react'
import React from 'react'

import Component from '.'

export default {
  title: 'fields/SectionField/components/popovers/SectionManage',
  component: Component
} as ComponentMeta<typeof Component>

type ComponentProps = React.ComponentProps<typeof Component>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Component {...args} />

export const Example: Story<ComponentProps> = Template.bind({})
Example.args = {
  trigger: <Button>Manage Section</Button>,
  header: <h2>Box Section</h2>
}
