import {JaenSectionProvider} from '../../../utils/providers/JaenSectionProvider'
import {ConnectedSection} from '../../../utils/types'

const SectionField: React.FC<{
  name: string // chapterName
  sections: ConnectedSection[]
}> = ({name, sections}) => {
  return (
    <>
      {sections.map(s => (
        <JaenSectionProvider
          key={s.sectionOptions.name}
          chapterName={name}
          sectionId={s.sectionOptions.name}>
          {s.element}
        </JaenSectionProvider>
      ))}
    </>
  )
}

export default SectionField
