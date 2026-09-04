// tsconfig keeps rootDir at the package root because the sources live in three
// roots (src, shared, client), so the entry lands at dist/src/index.js rather
// than dist/index.js.
module.exports = require('./dist/src/index.js')
