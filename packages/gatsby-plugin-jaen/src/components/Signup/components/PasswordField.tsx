import {
  Field,
  IconButton,
  Input,
  InputGroup,
  InputProps,
  mergeRefs,
  useDisclosure
} from '@chakra-ui/react'
import {forwardRef, useMemo, useRef} from 'react'
import {useIntl} from 'react-intl'
import {FaEye} from '@react-icons/all-files/fa/FaEye'
import {FaEyeSlash} from '@react-icons/all-files/fa/FaEyeSlash'

/**
 * v3's InputProps no longer carries the field-level flags, so the two this
 * component forwards to Field.Root have to be declared here. Both drop the
 * `is` prefix in line with the rest of the v3 API; nothing outside Signup
 * consumes this component, so no public surface moves. The exported
 * PasswordField in components/shared is a separate copy.
 */
export interface PasswordFieldProps extends InputProps {
  invalid?: boolean
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({invalid, required, ...props}, ref) => {
    const intl = useIntl()
    const {open, onToggle} = useDisclosure()
    const inputRef = useRef<HTMLInputElement>(null)

    /**
     * v3 replaced the useMergeRefs hook with a plain mergeRefs(). Calling it
     * bare would hand React a new callback on every render, which detaches and
     * reattaches the input each time and would drop the focus that
     * onClickReveal just placed; useMemo restores the hook's stable identity.
     */
    const mergeRef = useMemo(() => mergeRefs(inputRef, ref), [ref])

    const onClickReveal = () => {
      onToggle()
      if (inputRef.current) {
        inputRef.current.focus({preventScroll: true})
      }
    }

    return (
      <Field.Root
        id="login_form_password"
        invalid={invalid}
        required={required}>
        <Field.Label htmlFor="password">
          {intl.formatMessage({
            id: 'PasswordFieldLabel',
            defaultMessage: 'Password'
          })}
        </Field.Label>
        <InputGroup
          endElement={
            // `text` is defined in theme/recipes/button.ts, but v3 takes the
            // variant union from Chakra's shipped recipes.gen.d.ts, which only
            // learns about theme recipes when `chakra typegen` regenerates it.
            // Nothing here runs typegen, so the literal needs the cast.
            <IconButton
              variant="text"
              color="brand.500"
              aria-label={
                open
                  ? intl.formatMessage({
                      id: 'PasswordFieldMaskAriaLabel',
                      defaultMessage: 'Mask password'
                    })
                  : intl.formatMessage({
                      id: 'PasswordFieldRevealAriaLabel',
                      defaultMessage: 'Reveal password'
                    })
              }
              onClick={onClickReveal}>
              {open ? <FaEyeSlash /> : <FaEye />}
            </IconButton>
          }>
          <Input
            id="password"
            ref={mergeRef}
            name="password"
            type={open ? 'text' : 'password'}
            autoComplete="current-password"
            required
            {...props}
          />
        </InputGroup>
        <Field.ErrorText>
          {props.name === 'password' &&
            intl.formatMessage({
              id: 'PasswordFieldRequiredError',
              defaultMessage: 'Password is required'
            })}
        </Field.ErrorText>
      </Field.Root>
    )
  }
)

PasswordField.displayName = 'PasswordField'
