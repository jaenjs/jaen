import {Box, useDisclosure} from '@chakra-ui/react'
import {useSnekFinder} from '@jaenjs/snek-finder'
import {getSrc, IGatsbyImageData} from 'gatsby-plugin-image'
import React from 'react'
import {connectField} from '../../index'
import UpdateModal from './components/UpdateModal'
import {
  JaenImage,
  JaenImageData,
  JaenImageProps,
  StaticImageElementType
} from './JaenImage'
import {useJaenPageImage} from './useJaenPageImage'

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

const ImageField = connectField<
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

    console.log(value, jaenField.value)

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

    const finder = useSnekFinder({
      mode: 'selector',
      onAction: action => {
        if (action.type === 'SELECTOR_SELECT') {
          handleUpdateValue({
            internalImageUrl: action.payload.item.src,
            title: action.payload.item.name,
            alt: action.payload.item.description
          })
        }
      }
    })

    const handleBoxClick = () => {
      if (updateable) {
        updateDisclosure.onOpen()
      } else {
        finder.toggleSelector()
      }
    }

    return (
      <>
        {finder.finderElement}
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

        <Box onClick={handleBoxClick}>
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
        </Box>
      </>
    )
  },
  {
    fieldType: 'IMA:ImageField'
  }
)

export default ImageField
