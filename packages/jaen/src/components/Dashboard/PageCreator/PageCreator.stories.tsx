import {Story, ComponentMeta} from '@storybook/react'
import React from 'react'

import {PageCreator} from '.'

export default {
  title: 'components/PageCreator',
  component: PageCreator
} as ComponentMeta<typeof PageCreator>

type ComponentProps = React.ComponentProps<typeof PageCreator>

// Create a template for the component
const Template: Story<ComponentProps> = args => <PageCreator {...args} />

export const Basic: Story<ComponentProps> = Template.bind({})
Basic.args = {
  templates: [
    {name: 'page', displayName: 'Page'},
    {name: 'blog', displayName: 'Blog'}
  ],
  onCreate: values => {
    console.log('🚀 ~ file: PageCreator.stories.tsx ~ line 23 ~ values', values)

    return true
  },
  isOpen: true,
  onClose: () => {
    console.log('Closing modal')
  }
}

export const ErrorOnCreate: Story<ComponentProps> = Template.bind({})
ErrorOnCreate.args = {
  ...Basic.args,
  onCreate: () => {
    return false
  }
}
