import {
  createHistory,
  HistorySource,
  LocationProvider,
  Redirect,
  Router
} from '@reach/router'
import createHashSource from 'hash-source'
import AdminLayout from './layouts/Admin'

let source = createHashSource()
let history = createHistory(source as HistorySource)

const Admin = (props: any) => (
  <LocationProvider history={history}>
    <Router primary={false}>
      <Redirect from="/" to="/dashboard" noThrow />
      <AdminLayout default path="/" />
    </Router>
  </LocationProvider>
)

export default Admin
