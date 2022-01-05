import {Router} from '@reach/router'
import {Link, PageProps} from 'gatsby'

import Dynamic from './dynamic'

const _ = ({}) => (
  <>
    {'Dynamic Routing'}
    <Router>
      <Dynamic path="/_/:jaenPageId" />
    </Router>
    <Link to="/_/Page Test">click to redirect to page test</Link>
  </>
)

export default _
