import {Card} from '@jaen/internal-plugins/admin/ui/components/Card'
import {useSnekFinder} from '@jaenjs/snek-finder'

export const FilesContainer = () => {
  const finder = useSnekFinder({mode: 'browser'})

  return <Card>{finder.finderElement}</Card>
}
