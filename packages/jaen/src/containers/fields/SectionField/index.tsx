import {JaenSectionProvider} from '../../../utils/providers/JaenSectionProvider'
import {JaenConnection, JaenSectionOptions} from '../../../utils/types'

const SectionField: React.FC<{
  name: string // chapterName
  sections: JaenConnection<{}, JaenSectionOptions>[]
}> = ({name, sections}) => {
  sections.forEach(e => {
    console.log('Options are ', e.options)
  })

  const S = sections[0]

  return (
    <JaenSectionProvider chapterName={name} sectionId="1">
      <h1>SectionField ({name})</h1>
      <S />
    </JaenSectionProvider>
  )
}

export default SectionField
