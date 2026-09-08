/**
 * Every GraphQL document the jaen client sends, validated against the agent's
 * own generated schema.
 *
 * The client is hand written on purpose (`packages/jaen/src/clients/agent`),
 * because a generated client would be a second copy of the same five documents
 * that has to be regenerated on both sides of one repository. The cost of that
 * is exactly this: a field renamed on the agent's side is not a compile error
 * anywhere, it is a `GRAPHQL_VALIDATION_FAILED` at runtime that refuses the
 * whole operation rather than one field, so a save that carries an editor's
 * work is simply never made.
 *
 * Pylon derives the schema from the agent's TypeScript, and two of its rules
 * are the ones that bite. A `number` argument becomes the scalar `Number` and
 * not `Int`, so an operation declaring `Int` is refused before the resolver is
 * reached. And a `Record<string, X>` becomes `JSONObject` and takes no
 * subselection while a typed interface becomes an object type and demands one,
 * so guessing wrong about one field of the draft delta fails the read entirely.
 *
 * This asks the schema rather than a person. Written by
 * tests/10-draft-persistence.ipynb.
 */
const fs = require('fs')
const path = require('path')

const repo = process.env.JAEN_REPO || path.resolve(__dirname, '..', '..')
const {buildSchema, parse, validate} = require(
  path.join(repo, 'node_modules', 'graphql')
)

const schemaPath =
  process.env.JAEN_AGENT_SCHEMA ||
  path.join(repo, 'packages', 'jaen-agent', '.pylon', 'schema.graphql')

const clientPath =
  process.env.JAEN_AGENT_CLIENT ||
  path.join(repo, 'packages', 'jaen', 'src', 'clients', 'agent', 'index.ts')

if (!fs.existsSync(schemaPath)) {
  console.log(
    JSON.stringify({skipped: 'no generated agent schema at ' + schemaPath})
  )
  process.exit(0)
}

const schema = buildSchema(fs.readFileSync(schemaPath, 'utf8'))
const client = fs.readFileSync(clientPath, 'utf8')

// Every template literal in the client that is an operation of its own.
const documents = [
  ...client.matchAll(/`((?:query|mutation)\s+JaenAgent[\s\S]*?)`/g)
].map(match => match[1])

const results = documents.map(document => {
  const name = document.split(/[\s(]/)[1]

  let errors

  try {
    errors = validate(schema, parse(document))
  } catch (error) {
    errors = [error]
  }

  return {name, errors: errors.map(error => error.message)}
})

console.log(
  JSON.stringify(
    {
      schema: schemaPath,
      client: clientPath,
      documents: results,
      invalid: results.filter(result => result.errors.length).length
    },
    null,
    1
  )
)
