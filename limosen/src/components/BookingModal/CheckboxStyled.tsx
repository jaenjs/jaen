import {Checkbox, CheckboxProps} from '@chakra-ui/react'
import {forwardRef} from 'react'

const bgColor = '#EDEDF0'
const controlColor = 'brand.500'
const focusColor = '#B4BBE2'

const defaultClasses = ({radius = '1px', controlRadius = '1px'}) => {
  return {
    h: '40px',
    px: '12px',
    w: 'fit-content',
    _checked: {
      bg: bgColor,
      h: '40px',
      px: '12px',
      borderRadius: radius
    },
    "span[class*='checkbox__control']:not([data-disabled])": {
      borderColor: controlColor,
      borderRadius: controlRadius,
      _checked: {
        bg: controlColor,
        borderColor: controlColor
      },
      _focus: {
        boxShadow: `0 0 0 2px ${focusColor}`,
        _checked: {
          boxShadow: `0 0 0 2px ${focusColor}`
        }
      },
      _after: {
        transitionProperty: 'all',
        transitionDuration: 'normal',
        content: `""`,
        position: 'absolute',
        width: '0px',
        height: '0px',
        bg: `transparent`,
        borderRadius: radius,
        zIndex: -1
      }
    },
    _hover: {
      "span[class*='checkbox__control']:not([data-disabled])": {
        _after: {
          width: '40px',
          height: '40px',
          bg: bgColor,
          borderColor: controlColor
        }
      }
    }
  }
}

export interface CheckboxStyledProps extends CheckboxProps {
  roundedFull?: boolean
}

export const CheckboxStyled = forwardRef<HTMLInputElement, CheckboxStyledProps>(
  ({children, spacing = '1rem', rounded, roundedFull, ...props}, ref) => {
    let classes = defaultClasses({})

    if (roundedFull) {
      classes = defaultClasses({radius: '99px', controlRadius: '99px'})
    }

    if (rounded) {
      classes = defaultClasses({radius: '8px', controlRadius: '2px'})
    }

    return (
      <Checkbox spacing={spacing} sx={classes} {...props} ref={ref}>
        {children}
      </Checkbox>
    )
  }
)
