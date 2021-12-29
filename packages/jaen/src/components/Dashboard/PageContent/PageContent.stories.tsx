import {Story, Meta} from '@storybook/react'

import PageContent from '.'

export default {
  title: 'components/Dashboard/PageContent',
  component: PageContent
} as Meta

const Template: Story = args => <PageContent {...args} />

export const Primary = Template.bind({})

Primary.args = {}
