import {Story, ComponentMeta} from '@storybook/react'
import React from 'react'

import {Dashboard} from '.'
import {JaenProvider} from '../../utils/providers/JaenProvider'

export default {
  title: 'containers/Dashboard',
  component: Dashboard,
  decorators: [
    Story => (
      <JaenProvider templatesPaths={{}}>
        <Story />
      </JaenProvider>
    )
  ]
} as ComponentMeta<typeof Dashboard>

type ComponentProps = React.ComponentProps<typeof Dashboard>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Dashboard {...args} />

export const Basic: Story<ComponentProps> = Template.bind({})
Basic.args = {}
