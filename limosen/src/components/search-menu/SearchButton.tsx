import { withRedux } from 'jaen';
import { Button, ButtonProps, Kbd } from '@chakra-ui/react';
import { FC } from 'react';
import { SearchIcon } from '@chakra-ui/icons';

interface ISearchButtonProps extends ButtonProps {
  openModal: () => void;
  navigate: (isUp: boolean) => void;
}

/**
 * Search button component - shows a button that opens the search menu
 */
const SearchButton: FC<ISearchButtonProps> = withRedux(
  ({ openModal, navigate, ...props }) => {
    // const [isMobile] = useMediaQuery('(max-width: 768px)'); // Adjust the breakpoint as needed

    const onKeyPress = (e: any) => {
      if (e.key === 'Enter') {
        openModal;
      } else if (e.key === 'ArrowDown') {
        navigate(false);
      } else if (e.key === 'ArrowUp') {
        navigate(true);
      }
    };

    // if (isMobile) {
    //   return (
    //     <IconButton
    //       size="sm"
    //       variant="outline"
    //       bgColor="blackAlpha.50"
    //       color="topNav.input.color"
    //       borderColor="topNav.input.borderColor"
    //       fontWeight="normal"
    //       icon={<SearchIcon />}
    //       aria-label="Search"
    //       onClick={openModal}
    //       onKeyDown={onKeyPress}
    //     >
    //       <Kbd
    //         borderBottomWidth={1}
    //         background="transparent"
    //         borderRadius={4}
    //         py={0.5}
    //         ml={3}
    //         opacity={0.7}
    //       >
    //         /
    //       </Kbd>
    //     </IconButton>
    //   );
    // }

    return (
      <Button
        display="flex"
        mx={4}
        size="sm"
        minH="10"
        variant="outline"
        bgColor="blackAlpha.50"
        color="topNav.input.color"
        borderColor="brad.700"
        fontWeight="normal"
        _hover={{
          borderColor: 'topNav.input.hover.borderColor'
        }}
        // _active={{
        //   bgColor: 'topNav.input.active.bgColor'
        // }}
        _active={{
          bgColor: { base: 'white', md: 'transparent' }
        }}
        _focus={{
          bgColor: { base: 'white', md: 'transparent' }
        }}
        onFocus={e => {
          e.currentTarget.addEventListener('keypress', onKeyPress);
        }}
        onBlur={e => {
          e.currentTarget.removeEventListener('keypress', onKeyPress);
        }}
        onClick={openModal}
        {...props}
      >
        {/* Type{' '} */}
        <Kbd
          borderBottomWidth={1}
          borderRadius={4}
          py={0.5}
          mr={2}
          //bgColor={'transparent'}
          //borderColor={'topNav.input.borderColor'}
          variant="outline"
          bgColor="blackAlpha.50"
          color="topNav.input.color"
          borderColor="topNav.input.borderColor"
          fontWeight="normal"
          _hover={{
            borderColor: 'topNav.input.hover.borderColor'
          }}
          _active={{
            bgColor: 'topNav.input.active.bgColor'
          }}
          onFocus={e => {
            e.currentTarget.addEventListener('keypress', onKeyPress);
          }}
          onBlur={e => {
            e.currentTarget.removeEventListener('keypress', onKeyPress);
          }}
          onClick={openModal}
        >
          /
        </Kbd>
        Suche
      </Button>
    );
  }
);

export default SearchButton;
