import {Story, Meta} from '@storybook/react'

import PagesTab from '.'

export default {
  title: 'components/Dashboard/tabs/Pages',
  component: PagesTab
} as Meta

const Template: Story = args => <PagesTab {...args} />

export const Primary = Template.bind({})

Primary.args = {}
