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
import {useState} from 'react'
import {FaCloudUploadAlt} from '@react-icons/all-files/fa/FaCloudUploadAlt'

export interface FormMediaChooserProps {
  onChoose: () => void
  value?: string
  onRemove: () => void
  description?: string
}

export const FormMediaChooser: React.FC<FormMediaChooserProps> = props => {
  const [isLoading, setIsLoading] = useState(false)

  /**
   * v2's <Image fallback> is gone in v3. It preloaded the src and showed the
   * placeholder until that succeeded, keeping it up forever if the load failed,
   * which is what remembering the src that fired onLoad reproduces. Comparing
   * against the src rather than holding a boolean means a new src brings the
   * placeholder back without a resetting effect.
   */
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const src = props.value

  const onChoose = async () => {
    setIsLoading(true)
    try {
      await props.onChoose()
    } catch (e) {}
    setIsLoading(false)
  }

  return (
    <Stack direction="row" gap="6" align="center" width="full">
      <Box boxSize={36} minW="36" borderRadius="surface" bg="bg.subtle">
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
      </Box>
      <Stack>
        <HStack gap="5">
          <Button loading={isLoading} variant="outline" onClick={onChoose}>
            <FaCloudUploadAlt />
            Choose media
          </Button>
          {props.value && (
            <Button variant="ghost" onClick={props.onRemove}>
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
