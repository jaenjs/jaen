import {Button} from '@chakra-ui/react'
import {Story, ComponentMeta} from '@storybook/react'
import React from 'react'

import Component from '.'

export default {
  title: 'Dashboard/Hotbar',
  component: Component
} as ComponentMeta<typeof Component>

type ComponentProps = React.ComponentProps<typeof Component>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Component {...args} />

export const ExampleHotbar: Story<ComponentProps> = Template.bind({})
ExampleHotbar.args = {
  startItems: [<Button>Start item 1</Button>, <Button>Start item 2</Button>],
  endItems: [<Button>End item 1</Button>, <Button>End item 2</Button>]
}
