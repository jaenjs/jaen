import {Box} from '@chakra-ui/react'
import React from 'react'
import {PluginStore} from 'react-pluggable'
import {IJaenPlugin} from '../../plugins'
import {updateEntity} from '../../services/migration'
import {AdminFunctions} from '../admin/AdminPlugin'
import {IPagesMigration, IPagesMigrationBase} from './types'
import {FilesContainer} from './ui/tabs/Files'
import {PagesContainer} from './ui/tabs/Pages'
import {EditButtonGroup, HomeButton, PublishButton} from './ui/toolbar'

const Test = () => {
  return (
    <Box>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
      <h1>DASHBOARD</h1>
    </Box>
  )
}

class PagesPlugin implements IJaenPlugin {
  pluginStore!: PluginStore

  getPluginName(): string {
    // Do not change this because it is used in the migrations
    // When changing this, the migrations based on this plugin will not be
    // executed anymore.
    return 'JaenPages@0.0.1'
  }

  getDependencies(): string[] {
    return ['JaenAdmin@0.0.1']
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore
  }

  activate(): void {
    this.pluginStore.executeFunction(AdminFunctions.addRoute, {
      path: '/dashboard',
      name: 'Dashboard',
      rtlName: 'لوحة القيادة',
      icon: null,
      component: Test,
      layout: ''
    })

    this.pluginStore.executeFunction(AdminFunctions.addRoute, {
      path: '/pages',
      name: 'Pages',
      rtlName: 'لوحة القيادة',
      icon: null,
      component: PagesContainer,
      layout: ''
    })

    this.pluginStore.executeFunction(AdminFunctions.addRoute, {
      path: '/files',
      name: 'Files',
      rtlName: 'لوحة القيادة',
      icon: null,
      component: FilesContainer,
      layout: ''
    })

    this.pluginStore.executeFunction(
      AdminFunctions.addToolbarItem,
      <>
        <HomeButton />
        <EditButtonGroup />
        <PublishButton />
      </>
    )
  }

  deactivate(): void {
    //
  }

  async migrate(base: IPagesMigrationBase, migration: IPagesMigration) {
    for (const id of Object.keys(migration)) {
      base[id] = await updateEntity(base[id], migration[id])
    }

    return base
  }
}

export default PagesPlugin
