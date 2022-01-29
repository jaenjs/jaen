import {Box, Skeleton} from '@chakra-ui/react'
import {
  useAppDispatch,
  useAppSelector,
  withRedux
} from '@jaen-pages/internal/redux'
import {internalActions} from '@jaen-pages/internal/redux/slices'
import {
  IJaenSection,
  IJaenSectionWithId
} from '@jaen-pages/internal/redux/types'
import {useJaenPageContext} from '@jaen-pages/internal/services/page'
import {
  JaenSectionProvider,
  useJaenSectionContext
} from '@jaen-pages/internal/services/section'
import deepmerge from 'deepmerge'
import * as React from 'react'
import {ISectionConnection} from '../../index'
import {SectionAddPopover, SectionManagePopover} from './components/popovers'

export interface SectionFieldProps {
  name: string // chapterName
  displayName: string
  sections: ISectionConnection[]
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
        Component: ISectionConnection
        options: {displayName: string; name: string}
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

  const {jaenPage} = useJaenPageContext()

  if (!jaenPage.id) {
    throw new Error(
      'JaenPage id is undefined! connectField must be used within a JaenPage'
    )
  }

  const staticChapter = jaenPage?.chapters?.[name]

  const dynamicChapter = useAppSelector(
    state => state.internal.pages.nodes[jaenPage.id]?.chapters?.[name],
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
      between: [IJaenSectionWithId | null, IJaenSectionWithId | null]
    ) => {
      dispatch(
        internalActions.section_add({
          pageId: jaenPage.id,
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
      between: [IJaenSectionWithId | null, IJaenSectionWithId | null]
    ) => {
      dispatch(
        internalActions.section_remove({
          pageId: jaenPage.id,
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
      const section: IJaenSection | undefined = chapter.sections[ptrHead]
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
