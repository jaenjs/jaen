import {Button} from '@chakra-ui/react'
import {FiHome} from '@react-icons/all-files/fi/FiHome'
import {Link} from 'gatsby'

export const HomeButton = () => {
  const siteTitle = 'Ballons & Balloons' // useStaticQuery site meta data

  return (
    <Link to="/">
      <Button size="xs" variant={'darkghost'} leftIcon={<FiHome />}>
        Ballons & Ballons
      </Button>
    </Link>
  )
}
