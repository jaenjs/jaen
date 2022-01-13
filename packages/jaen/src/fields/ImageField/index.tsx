import {useDisclosure} from '@chakra-ui/react'
import {getSrc, IGatsbyImageData} from 'gatsby-plugin-image'
import React from 'react'

import {connectField} from '../connectField'
import {
  JaenImage,
  JaenImageData,
  JaenImageProps,
  StaticImageElementType,
  useJaenPageImage
} from './JaenImage'
import UpdateModal from './components/UpdateModal'

export interface ImageFieldData extends JaenImageData {
  imageId?: string
}

export type ImageFieldProps = Partial<
  Pick<ImageFieldData, 'width' | 'height' | 'layout'>
> &
  Pick<
    JaenImageProps,
    'imgClassName' | 'imgStyle' | 'onError' | 'onLoad' | 'onStartLoad'
  >

const TextField = connectField<
  ImageFieldData,
  StaticImageElementType,
  ImageFieldProps
>(
  ({
    jaenField,
    imgStyle,
    imgClassName,
    width = 300,
    height = 300,
    layout = 'constrained'
  }) => {
    const value = {
      ...jaenField.staticValue,
      ...jaenField.value,
      internalImageUrl: jaenField?.value?.internalImageUrl
    }

    let gatsbyImage: IGatsbyImageData | undefined

    if (jaenField.staticValue) {
      // If staticValue is defined, the imageId must also be defined,
      // otherwise throw an error.

      const {imageId} = jaenField.staticValue

      if (!imageId) {
        throw new Error(
          'staticValue is defined, but staticValue.imageId is not. This is not allowed.'
        )
      }

      gatsbyImage = useJaenPageImage({id: imageId})
    }

    const updateable = !!value?.internalImageUrl || !!gatsbyImage

    const gatsbyImageSrc = gatsbyImage && getSrc(gatsbyImage)

    const updateDisclosure = useDisclosure()

    const handleUpdateValue = (data: Partial<ImageFieldData>) => {
      jaenField.onUpdateValue({
        layout, // ?
        width, // ?
        height, // ?
        title: data.title || 'Jaen Image', // ?
        alt: data.alt || 'Jaen Image', // ?
        ...value,
        ...data
      })
    }

    return (
      <>
        {updateable && (
          <UpdateModal
            {...updateDisclosure}
            data={{
              image: value?.internalImageUrl || gatsbyImageSrc || '',
              description: value?.alt || '',
              title: value?.title || ''
            }}
            onUpdate={({image: internalImageUrl, description: alt, title}) => {
              handleUpdateValue({
                internalImageUrl,
                alt,
                title
              })
            }}
            onDelete={() => handleUpdateValue({internalImageUrl: undefined})}
          />
        )}

        <JaenImage
          image={{
            title: value.title || 'A Jaen Image',
            alt: value.alt || 'A Jaen Image',
            internalImageUrl: value.internalImageUrl,
            layout: value.layout || layout,
            width,
            height,
            gatsbyImage
          }}
          className={jaenField.className}
          style={jaenField.style}
          imgClassName={imgClassName}
          imgStyle={imgStyle}
        />
      </>
    )
  },
  {
    fieldType: 'IMA:ImageField'
  }
)

export default TextField
