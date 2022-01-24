import {Router} from '@reach/router'
import {Link} from 'gatsby'

import Dynamic from './dynamic'

const _ = ({}) => (
  <>
    {'Dynamic Routing'}
    <Router>
      <Dynamic path="/_/*" />
    </Router>
    <Link to="/_/Page Test">click to redirect to page test</Link>
  </>
)

export default _
