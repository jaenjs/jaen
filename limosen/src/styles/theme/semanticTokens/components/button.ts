const smtButtonComponent = {
  solid: {
    color: {
      default: 'white',
      _dark: 'white'
    },
    bgColor: {
      default: 'brand.700',
      _dark: 'brand.700'
    },
    hover: {
      bgColor: {
        default: 'brand.600',
        _dark: 'brand.600'
      }
    },
    active: {
      bgColor: {
        default: 'brand.600',
        _dark: 'brand.600'
      }
    },
    disabled: {
      bgColor: {
        default: 'gray.300',
        _dark: 'gray.600'
      },
      color: {
        default: 'gray.500',
        _dark: 'gray.500'
      }
    }
  },
  ghost: {
    hover: {
      outline: {
        color: {
          default: 'brand.700',
          _dark: 'brand.700'
        }
      },
      bgColor: {
        default: 'gray.100',
        _dark: 'gray.700'
      }
    }
  },
  ghostHoverOpacity: {
    active: {
      color: {
        default: 'brand.700',
        _dark: 'brand.700'
      }
    }
  },
  outline: {
    color: {
      default: 'brand.700',
      _dark: 'brand.700'
    },
    borderColor: {
      default: 'brand.700',
      _dark: 'brand.800'
    },
    hover: {
      borderColor: {
        default: 'brand.700',
        _dark: 'brand.800'
      },
      color: {
        default: 'white',
        _dark: 'gray.200'
      },
      bgColor: {
        default: 'brand.700',
        _dark: 'brand.800'
      }
    }
  },
  ghostHoverOutline: {
    color: {
      default: 'gray.500',
      _dark: 'gray.600'
    },
    hover: {
      borderColor: {
        default: 'theme.500',
        _dark: 'theme.800'
      },
      color: {
        default: 'theme.500',
        _dark: 'theme.500'
      }
    }
  },
  // COLOR VARIANTS
  filledGreen: {
    color: {
      default: 'gray.800',
      _dark: 'gray.200'
    },
    bgColor: {
      default: 'flat.se.green.500',
      _dark: 'flat.se.green.700'
    },
    hover: {
      bgColor: {
        default: 'flat.se.green.550',
        _dark: 'flat.se.green.600'
      }
    },
    loading: {
      bgColor: {
        default: 'flat.se.green.300',
        _dark: 'flat.se.green.400'
      }
    }
  },
  filledYellow: {
    color: {
      default: 'gray.800',
      _dark: 'gray.200'
    },
    bgColor: {
      default: 'yellow.400',
      _dark: 'yellow.700'
    },
    hover: {
      bgColor: {
        default: 'yellow.300',
        _dark: 'yellow.600'
      }
    },
    loading: {
      bgColor: {
        default: 'yellow.300',
        _dark: 'yellow.400'
      }
    }
  },
  filledRed: {
    color: {
      default: 'white',
      _dark: 'gray.200'
    },
    bgColor: {
      default: 'red.400',
      _dark: 'red.700'
    },
    hover: {
      bgColor: {
        default: 'red.300',
        _dark: 'red.600'
      }
    },
    loading: {
      bgColor: {
        default: 'red.300',
        _dark: 'red.400'
      }
    }
  }
};

export default smtButtonComponent;
