import {ComponentMeta, Story} from '@storybook/react'
import React from 'react'

import {JaenPageProvider} from '@src/utils/providers/JaenPageProvider'

import Component from '.'

export default {
  title: 'containers/fields/SectionField',
  component: Component,
  decorators: [
    Story => (
      <JaenPageProvider
        staticJaenPage={{
          id: `JaenPage jaen-page-1`,
          slug: 'jaen-page-1',
          parent: null,
          children: [
            {
              id: `JaenPage jaen-page-2`
            }
          ],
          jaenPageMetadata: {
            title: 'Jaen Page 1',
            description: 'Jaen Page 1 description',
            image: 'https://via.placeholder.com/300x200',
            canonical: 'https://jaen.com/jaen-page-1',
            datePublished: '2020-01-01',
            isBlogPost: false
          },
          jaenFields: null,
          chapters: {},
          templateName: 'BlogPage'
        }}>
        <Story />
      </JaenPageProvider>
    )
  ]
} as ComponentMeta<typeof Component>

type ComponentProps = React.ComponentProps<typeof Component>

// Create a template for the component
const Template: Story<ComponentProps> = args => <Component {...args} />

export const Basic: Story<ComponentProps> = Template.bind({})
Basic.args = {}
