import {Button, ButtonGroup, IconButton} from '@chakra-ui/react'
import {ComponentMeta, Story} from '@storybook/react'
import React from 'react'
import {FiFile, FiTrash} from 'react-icons/fi'

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
  hotbar: {
    startItems: [
      <ButtonGroup isAttached variant="outline">
        <Button mr="-px">Edit</Button>
        <IconButton
          aria-label="Add to friends"
          icon={<FiTrash color="orange" />}
        />
      </ButtonGroup>
    ],
    endItems: [<Button variant="outline">Publish2</Button>]
  },
  sidebarItems: {
    'tab-1': {
      name: 'Pages',
      icon: FiFile
    }
  },
  children: <>SidebarWithHeader</>,
  onCloseDashboard: () => null
}
