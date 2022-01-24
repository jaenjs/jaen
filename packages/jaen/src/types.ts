export interface IJaenConfig {
  templates: {
    rootDir: string
    paths: {
      [templateName: string]: string
    }
  }
  staticDataPath: string
}

export interface IJaenStaticData {
  [appname: string]: any
}
