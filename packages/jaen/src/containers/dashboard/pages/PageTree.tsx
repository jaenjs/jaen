import {useJaenPageTree} from '../../../utils/hooks/jaen'

export const PageTree: React.FC = () => {
  const pages = useJaenPageTree()

  return (
    <div>
      <h1>PageTree</h1>
    </div>
  )
}
