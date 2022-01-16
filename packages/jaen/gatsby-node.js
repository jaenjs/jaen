require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
    target: 'esnext'
  }
})

module.exports = require('./src/internal/gatsby/node.ts')
