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
 * v2's InputProps carried isInvalid and isRequired and this component read them
 * straight off it. v3's does not, so they are spelled out here rather than
 * renamed to the v3 spelling: this component is re-exported from the package
 * index, so the two names are its published surface and dropping the prefix
 * would break call sites outside this repo for no visual gain. The Signup copy
 * under components/Signup is private and does rename them.
 */
export interface PasswordFieldProps extends InputProps {
  isInvalid?: boolean
  isRequired?: boolean
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({isInvalid, isRequired, ...props}, ref) => {
    const intl = useIntl()
    const {open, onToggle} = useDisclosure()
    const inputRef = useRef<HTMLInputElement>(null)

    /**
     * v3 ships mergeRefs, the bare function behind v2's useMergeRefs. Without
     * the memo a fresh callback ref on every render would detach and reattach
     * the input, which loses focus mid-typing.
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
        invalid={isInvalid}
        required={isRequired}>
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
