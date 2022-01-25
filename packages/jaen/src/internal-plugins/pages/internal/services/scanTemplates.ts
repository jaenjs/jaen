import glob from 'glob'
export const scanTemplates = async (globPath: string) => {
  // load all the templates
  const templates = glob.sync(globPath)

  // loop and print path
  for (const template of templates) {
    console.log('TEMPLATE PATH', template)

    // register babel
    require('@babel/register')({
      presets: ['react'],
      extends: '../../.babelrc',
      ignore: [/node_modules/]
    })

    const esmRequire = require('esm')(module)

    // load the template
    const templateContent = esmRequire(template)
  }
}
