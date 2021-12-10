interface JaenAbstractField {
  id: string
  name: string
}

interface JaenImage extends JaenAbstractField {}
interface JaenText extends JaenAbstractField {
  value: string
}
interface JaenDocument extends JaenAbstractField {}

interface JaenFields {
  images: JaenImage[]
  text: JaenText[]
  documents: JaenDocument[]
}

interface JaenSection {
  id: string
  name: string
  position: number
  fields: JaenFields
  sections: JaenSection[]
}

interface JaenPage {
  id: string
  fields: JaenFields
  sections: JaenSection[]
}

const ada: JaenPage = {
  id: '',
  fields: {
    images: [],
    text: [
      {
        id: '',
        jaenPageId: '',
        name: '',
        value: "I'm Ada, a programmer living in Berlin."
      }
    ],
    documents: []
  },
  sections: []
}
