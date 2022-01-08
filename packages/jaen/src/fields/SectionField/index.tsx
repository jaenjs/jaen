import {Box, Skeleton} from '@chakra-ui/react'
import deepmerge from 'deepmerge'
import * as React from 'react'

import {
  JaenSectionProvider,
  useJaenPageContext,
  useJaenSectionContext
} from '@src/internal/page'
import {useAppDispatch, useAppSelector} from '@src/internal/store'
import {
  section_add,
  section_remove
} from '@src/internal/store/slices/pagesSlice'
import {withRedux} from '@src/internal/store/withRedux'
import {
  JaenConnection,
  JaenSectionData,
  JaenSectionOptions,
  JaenSectionWithId
} from '@src/internal/types'

import {SectionAddPopover, SectionManagePopover} from './components/popovers'

export interface SectionFieldProps {
  name: string // chapterName
  displayName: string
  sections: JaenConnection<{}, JaenSectionOptions>[]
}

const SectionField = ({name, displayName, sections}: SectionFieldProps) => {
  const jaenSection = useJaenSectionContext()

  if (jaenSection) {
    name = `${jaenSection.chapterName}.${name}`
  }

  const dispatch = useAppDispatch()

  // sections to dictionary with key as section name
  const sectionsDict = sections.reduce<
    Record<
      string,
      {
        Component: JaenConnection<{}, JaenSectionOptions>
        options: JaenSectionOptions
      }
    >
  >(
    (acc, Section) => ({
      ...acc,
      [Section.options.name]: {
        Component: Section,
        options: Section.options
      }
    }),
    {}
  )

  const {staticJaenPage, jaenPageId} = useJaenPageContext()

  if (!jaenPageId) {
    throw new Error(
      'JaenPage id is undefined! connectField must be used within a JaenPage'
    )
  }

  const staticChapter = staticJaenPage?.chapters?.[name]

  const dynamicChapter = useAppSelector(
    state => state.pages.pages[jaenPageId]?.chapters?.[name],
    (l, r) => {
      if (!l || !r) {
        return false
      }

      const shouldUpdate =
        JSON.stringify(Object.keys(l.sections)) !==
        JSON.stringify(Object.keys(r.sections))

      if (shouldUpdate) {
        return false
      }

      for (const key in l.sections) {
        // TODO: check if the section is deleted
        if (l.sections[key].deleted !== r.sections[key].deleted) {
          return false
        }
      }

      return true
    }
  )

  const chapter = deepmerge(staticChapter || {}, dynamicChapter || {})

  const handleSectionAdd = React.useCallback(
    (
      sectionName: string,
      between: [JaenSectionWithId | null, JaenSectionWithId | null]
    ) => {
      dispatch(
        section_add({
          pageId: jaenPageId,
          chapterName: name,
          sectionName,
          between
        })
      )
    },
    []
  )

  const handleSectionAppend = React.useCallback(
    (sectionName: string, id: string, ptrNext: string | null) => {
      handleSectionAdd(sectionName, [
        {
          ...chapter.sections[id],
          id
        },
        ptrNext
          ? {
              ...chapter.sections[ptrNext],
              id: ptrNext
            }
          : null
      ])
    },
    [chapter.sections]
  )

  const handleSectionPrepend = React.useCallback(
    (sectionName: string, id: string, ptrPrev: string | null) => {
      handleSectionAdd(sectionName, [
        ptrPrev
          ? {
              ...chapter.sections[ptrPrev],
              id: ptrPrev
            }
          : null,
        {
          ...chapter.sections[id],
          id
        }
      ])
    },
    [chapter.sections]
  )

  const handleSectionDelete = React.useCallback(
    (
      id: string,
      between: [JaenSectionWithId | null, JaenSectionWithId | null]
    ) => {
      dispatch(
        section_remove({
          pageId: jaenPageId,
          sectionId: id,
          chapterName: name,
          between
        })
      )
    },
    []
  )

  const renderedSections = () => {
    const rendered = []

    let ptrHead = chapter.ptrHead

    if (!ptrHead || Object.keys(chapter.sections).length === 0) {
      return (
        <SectionAddPopover
          disabled={false}
          header={
            <>
              Add to <strong>{displayName}</strong>
            </>
          }
          sections={sections.map(s => ({
            name: s.options.name,
            displayName: s.options.displayName
          }))}
          onSelect={name => handleSectionAdd(name, [null, null])}>
          <Box>
            <Skeleton h="100" />
          </Box>
        </SectionAddPopover>
      )
    }

    while (ptrHead) {
      const section: JaenSectionData | undefined = chapter.sections[ptrHead]
      if (sectionsDict[section.name]) {
        const {Component, options} = sectionsDict[section.name]

        const element = (
          <SectionManagePopover
            key={ptrHead}
            id={ptrHead}
            ptrPrev={section.ptrPrev}
            ptrNext={section.ptrNext}
            header={options.displayName}
            disabled={false}
            onAppend={(id, ptrNext) =>
              handleSectionAppend(section.name, id, ptrNext)
            }
            onPrepend={(id, ptrPrev) =>
              handleSectionPrepend(section.name, id, ptrPrev)
            }
            onDelete={(id, ptrPrev, ptrNext) =>
              handleSectionDelete(id, [
                ptrPrev
                  ? {
                      ...chapter.sections[ptrPrev],
                      id: ptrPrev
                    }
                  : null,
                ptrNext
                  ? {
                      ...chapter.sections[ptrNext],
                      id: ptrNext
                    }
                  : null
              ])
            }
            trigger={
              <Box>
                <JaenSectionProvider
                  key={ptrHead}
                  chapterName={name}
                  sectionId={ptrHead}>
                  <Component />
                </JaenSectionProvider>
              </Box>
            }
          />
        )

        rendered.push(element)
      }

      ptrHead = section.ptrNext
    }

    return rendered
  }

  return <>{renderedSections()}</>
}

export default withRedux(SectionField)
