import DiscardButton from './hotbar/DiscardButton'
import EditButton from './hotbar/EditButton'
import PublishButton from './hotbar/PublishButton'
import FilesTab from './tabs/FilesTab'
import PagesTab from './tabs/PagesTab'
import SettingsTab from './tabs/SettingsTab'

export const UI = {
  hotbar: {
    start: [<EditButton />, <DiscardButton />],
    end: [<PublishButton />]
  },
  tabs: {
    start: [
      {
        label: 'Pages',
        content: <PagesTab />
      },
      {
        label: 'Files',
        content: <FilesTab />
      }
    ],
    end: [
      {
        label: 'Settings',
        content: <SettingsTab />
      }
    ]
  }
}
