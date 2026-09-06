import React, {useState, useCallback, useMemo} from 'react'
import {
  HStack,
  Button,
  Box,
  Text,
  Image,
  Stack,
  Center,
  Skeleton
} from '@chakra-ui/react'
import {FaCloudUploadAlt} from '@react-icons/all-files/fa/FaCloudUploadAlt'
import {useDropzone} from 'react-dropzone'

export interface FormImageChooserProps {
  onChoose: (file: File) => void
  value?: string
  onRemove: () => void
  description?: string
}

export const FormImageChooser: React.FC<FormImageChooserProps> = props => {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  const onChoose = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setIsLoading(true)

        // Simulate a delay for demonstration purposes
        setTimeout(() => {
          setIsLoading(false)
          setSelectedImage(acceptedFiles[0]!)
          props.onChoose(acceptedFiles[0]!)
        }, 1000)
      }
    },
    [props]
  )

  const onRemoveImage = () => {
    setSelectedImage(null)
    props.onRemove()
  }

  /**
   * v2's <Image fallback> is gone in v3. It preloaded the src and showed the
   * placeholder until that succeeded, which is what remembering the src that
   * fired onLoad reproduces.
   *
   * The URL has to be held across renders for that to work. v2 built a new one
   * on every render, so its fallback never settled: each render handed the
   * image a src it had not seen, the placeholder came back, and the load
   * started over. The placeholder is restored; that loop is not.
   */
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const src = useMemo(
    () => (selectedImage ? URL.createObjectURL(selectedImage) : props.value),
    [selectedImage, props.value]
  )

  const {getRootProps, getInputProps, open} = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif']
    },
    onDrop: onChoose,
    multiple: false
  })

  return (
    <Stack direction="row" gap="6" align="center" width="full">
      <Box
        boxSize={36}
        minW="36"
        borderRadius="surface"
        bg="bg.subtle"
        cursor="pointer"
        {...getRootProps()}>
        {src ? (
          <>
            {loadedSrc !== src && <Skeleton borderRadius="surface" boxSize="100%" />}
            <Image
              borderRadius="surface"
              boxSize="100%"
              display={loadedSrc === src ? undefined : 'none'}
              src={src}
              onLoad={() => {
                setLoadedSrc(src)
              }}
            />
          </>
        ) : (
          <Center boxSize="100%" borderRadius="surface">
            <Text color="muted" fontSize="sm">
              No image
            </Text>
          </Center>
        )}
        <input {...getInputProps()} />
      </Box>
      <Stack>
        <HStack gap="5">
          <Button loading={isLoading} variant="outline" onClick={open}>
            <FaCloudUploadAlt />
            Choose media
          </Button>
          {selectedImage && (
            <Button variant="ghost" onClick={onRemoveImage}>
              Remove
            </Button>
          )}
        </HStack>
        <Text fontSize="sm" mt="3" color="muted">
          {props.description}
        </Text>
      </Stack>
    </Stack>
  )
}
