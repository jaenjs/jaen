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
  values: {
    slug: '',
    title: '',
    templateName: ''
  },
  templates: [
    {name: 'page', displayName: 'Page'},
    {name: 'blog', displayName: 'Blog'}
  ],
  onSubmit: values => {
    console.log('🚀 ~ file: PageCreator.stories.tsx ~ line 43 ~ values', values)
  },
  externalValidation: (valueName, value) => {
    const siblingsSlugs = ['slug-1', 'slug-2', 'slug-3']

    if (valueName === 'slug' && siblingsSlugs.includes(value)) {
      return 'This slug is already in use.'
    }
  },
  isOpen: true,
  onClose: () => {
    console.log('Closing modal')
  }
}
