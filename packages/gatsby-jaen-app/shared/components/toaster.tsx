/**
 * The app's toasts. One store, one viewport, mounted once by the shell.
 *
 * jaen mounts a Toaster of its own for the CMS, but that one is wired to the
 * CMS's notification context, not to Chakra's `createToaster`, and a screen
 * inside the app should not reach into the CMS to say "saved". Screens import
 * `toaster` from here and call `toaster.success({title})`, `toaster.error(...)`
 * or `toaster.promise(...)`. The viewport sits below the sticky CMS frame at
 * the top, where the bottom navigation cannot cover it on a phone.
 */
import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster
} from '@chakra-ui/react'

export const toaster = createToaster({
  placement: 'top-end',
  pauseOnPageIdle: true,
  // Clear of the 4rem CMS frame, which is sticky on every app route.
  offsets: {top: '5rem', right: '1rem', left: '1rem', bottom: '1rem'}
})

export function AppToaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{mdDown: '4'}}>
        {toast => (
          <Toast.Root width={{md: 'sm'}}>
            {toast.type === 'loading' ? (
              <Spinner size="sm" color="colorPalette.solid" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {toast.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
