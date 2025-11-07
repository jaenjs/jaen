import React from 'react'
import {useRef, useEffect, useState} from 'react'

export const useScrollSync = (
  offset: number = 0,
  offsetTop?: number,
  noScroll?: boolean,
  speed?: number,
  sectionRef?: React.RefObject<HTMLDivElement>
) => {
  const [scrollTop, setScrollTop] = useState(0)

  const ref: React.RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScrollHandler = (e: Event) => {
      const target = e.target as Document

      setScrollTop(target.documentElement.scrollTop)
      if (sectionRef?.current?.offsetTop && !offsetTop) {
        offsetTop = sectionRef.current.offsetTop
        //alert(offsetTop)
      }

      if (ref.current) {
        ref.current!.scrollTop =
          (target.documentElement.scrollTop -
            (offsetTop ? offsetTop : ref.current!.offsetTop) -
            (noScroll ? 999999999 : offset)) /
          (1 / (speed ? speed : 1))
      }
    }

    window.addEventListener('scroll', onScrollHandler)

    return () => window.removeEventListener('scroll', onScrollHandler)
  }, [scrollTop])

  return {
    scrollTop,
    ref
  }
}
