import React from 'react';
import { chakra } from '@chakra-ui/react';

export const Logo = (props: any) => {
  // color is irrelevant now but kept for API compatibility
  const color = props.color || '#000';

  return (
    <chakra.svg
      xmlns="http://www.w3.org/2000/svg"
      width="full"
      height="full"
      maxH={32}
      //py={2}
      viewBox="0 0 2446 1497"
      preserveAspectRatio="xMidYMid meet"
      {...props}
      color={color}
    >
      {/* Render the raster PNG inside the SVG canvas */}
      <image
        href="/images/everything/logo.png"
        x="0"
        y="0"
        width="2446"
        height="1497"
        preserveAspectRatio="xMidYMid meet"
      />
    </chakra.svg>
  );
};

export default Logo;
