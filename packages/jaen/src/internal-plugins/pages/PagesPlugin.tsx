import {Box} from '@chakra-ui/react'
import React from 'react'
import {IPlugin, PluginStore} from 'react-pluggable'
import {AdminFunctions} from '../../UIPlugin'
import {FilesContainer} from './ui/tabs/Files'
import {PagesContainer} from './ui/tabs/Pages'
import {EditButtonGroup, HomeButton, PublishButton} from './ui/toolbar'
import {FaPager} from '@react-icons/all-files/fa/FaPager'
import {BsFiles} from '@react-icons/all-files/bs/BsFiles'

const Test = () => {
  return (
    <Box>
      <h1>DASHBOARD</h1>
    </Box>
  )
}

class PagesPlugin implements IPlugin {
  pluginStore!: PluginStore

  getPluginName(): string {
    // Do not change this because it is used in the migrations
    // When changing this, the migrations based on this plugin will not be
    // executed anymore.
    return 'JaenPages@0.0.1'
  }

  getDependencies(): string[] {
    return ['JaenUI@0.0.1']
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore
  }

  activate(): void {}

  deactivate(): void {
    //
  }
}

export default PagesPlugin
