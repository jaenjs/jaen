import {createHistory, HistorySource, Router} from '@reach/router'
import {Link} from 'gatsby'
import createHashSource from 'hash-source'
import Dynamic from './dynamic'

let source = createHashSource()
let history = createHistory(source as HistorySource)

const _ = ({}) => (
  <>
    {'Dynamic Routing'}
    <Router primary={false}>
      <Dynamic path="/_" />
    </Router>
    <Link to="/_#/Page Test">click to redirect to page test</Link>
  </>
)

export default _
