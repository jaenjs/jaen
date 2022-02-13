import {Button} from '@chakra-ui/react'
import {useSite} from '@jaen/services/site'
import {FiHome} from '@react-icons/all-files/fi/FiHome'
import {Link} from 'gatsby'

export const HomeButton = () => {
  const site = useSite()

  return (
    <Button size="xs" variant={'darkghost'} leftIcon={<FiHome />}>
      <Link to="/">{site.siteMetadata.title || 'Home'}</Link>
    </Button>
  )
}
