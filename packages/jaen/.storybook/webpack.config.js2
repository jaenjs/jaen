const path = require('path')

module.exports = async ({config}) => {
  config.resolve.modules = [
    path.resolve(__dirname, '..', 'src'),
    'node_modules'
  ]

  // Alternately, for an alias:
  config.resolve.alias = {
    '@src': path.resolve(__dirname, '..', 'src')
  }

  return config
}
