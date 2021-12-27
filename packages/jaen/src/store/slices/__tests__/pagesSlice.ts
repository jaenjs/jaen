import {DEFAULT_PAGE_METADATA} from '../../../constants'
import reducer, {
  JaenPagesState,
  page_updateOrCreate,
  page_markForDeletion,
  section_add,
  field_write
} from '../pagesSlice'

const previousState: JaenPagesState[] = [
  {
    id: 'JaenPage foo-bar-baz-1',
    parent: null,
    children: [],
    slug: 'test',
    jaenPageMetadata: {
      title: 'test',
      isBlogPost: true,
      image: 'test',
      description: 'test',
      datePublished: 'test',
      canonical: 'test'
    },
    chapters: {
      Chapter1: {
        ptrHead: 'JaenSection foo-bar-baz-1',
        ptrTail: 'JaenSection foo-bar-baz-2',
        sections: {
          'JaenSection foo-bar-baz-1': {
            jaenFields: null,
            name: 'AboutSection',
            ptrNext: 'JaenSection foo-bar-baz-2',
            ptrPrev: null // this is the first section of the chapter
          },
          'JaenSection foo-bar-baz-2': {
            jaenFields: null,
            name: 'AboutSection',
            ptrNext: null, // this is the last section of the chapter
            ptrPrev: 'JaenSection foo-bar-baz-1'
          }
        }
      },
      Chapter2: {
        ptrHead: 'JaenSection foo-bar-baz-3',
        ptrTail: 'JaenSection foo-bar-baz-5',
        sections: {
          'JaenSection foo-bar-baz-3': {
            jaenFields: null,
            name: 'AboutSection',
            ptrNext: 'JaenSection foo-bar-baz-4',
            ptrPrev: null // this is the first section of the chapter
          },
          'JaenSection foo-bar-baz-4': {
            jaenFields: null,
            name: 'AboutSection',
            ptrNext: 'JaenSection foo-bar-baz-5',
            ptrPrev: 'JaenSection foo-bar-baz-3'
          },
          'JaenSection foo-bar-baz-5': {
            jaenFields: null,
            name: 'AboutSection',
            ptrNext: null, // this is the last section of the chapter
            ptrPrev: 'JaenSection foo-bar-baz-4'
          }
        }
      }
    }
  },
  {
    id: 'JaenPage foo-bar-baz-2',
    parent: null,
    children: [
      {
        id: 'JaenPage foo-bar-baz-2-1'
      }
    ],
    slug: 'test-2',
    jaenPageMetadata: {
      title: 'test',
      isBlogPost: true,
      image: 'test',
      description: 'test',
      datePublished: 'test',
      canonical: 'test'
    }
  },
  {
    id: 'JaenPage foo-bar-baz-2-1',
    parent: {
      id: 'JaenPage foo-bar-baz-2'
    },
    children: [],
    slug: 'test-2',
    jaenPageMetadata: {
      title: 'test',
      isBlogPost: true,
      image: 'test',
      description: 'test',
      datePublished: 'test',
      canonical: 'test'
    }
  }
]

test('should return the initial state', () => {
  expect(reducer(undefined, {} as any)).toEqual([])
})

describe('page_updateOrCreate', () => {
  test('should handle a page creation with a empty payload', () => {
    const result = reducer([], page_updateOrCreate({}))

    // Expect the result to be not bigger than length 1
    expect(result.length).toBe(1)

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        children: [],
        parent: null,
        slug: undefined,
        jaenFields: null,
        jaenPageMetadata: DEFAULT_PAGE_METADATA
      })
    )
  })
  test('should handle a page creation with payload', () => {
    const jaenPageMetadata = {
      title: 'test',
      isBlogPost: true,
      image: 'test',
      description: 'test',
      datePublished: 'test',
      canonical: 'test'
    }

    const result = reducer(
      [],
      page_updateOrCreate({
        slug: 'test',
        jaenPageMetadata
      })
    )

    expect(result[result.length - 1]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        children: [],
        parent: null,
        slug: 'test',
        jaenFields: null,
        jaenPageMetadata
      })
    )
  })
  test('should create a page with a parent (state contains parent page)', () => {
    const result = reducer(
      previousState,
      page_updateOrCreate({
        slug: 'test',
        parent: {id: previousState[0].id},
        jaenPageMetadata: DEFAULT_PAGE_METADATA
      })
    )

    // Expect that the result is one bigger than the previous state
    expect(result.length).toBe(previousState.length + 1)

    const parentPage = result[0]
    const addedPage = result[result.length - 1]

    // Expect that addedPage.id is in the children of the parentPage
    expect(parentPage.children).toEqual(
      expect.arrayContaining([expect.objectContaining({id: addedPage.id})])
    )
  })
  test('should create a page with a parent (state does not contain parent page)', () => {
    const payload = {
      slug: 'test',
      parent: {id: 'JaenPage foo-bar-baz-1'},
      jaenPageMetadata: DEFAULT_PAGE_METADATA
    }

    const result = reducer([], page_updateOrCreate(payload))

    // Expect that the result is two bigger
    expect(result.length).toBe(2)

    const parentPage = result[1] // The second page is the parentPage
    const addedPage = result[0] // The first page is the added page

    // Expect that addedPage.id is in the children of the parentPage
    expect(parentPage.children).toEqual(
      expect.arrayContaining([expect.objectContaining({id: addedPage.id})])
    )

    // Expect that the parentPage is the actual parent of the addedPage
    expect(addedPage.parent?.id).toEqual(parentPage.id)
  })
  test('should handle a slug update (state contains page)', () => {
    const payload = {
      slug: 'test-2',
      id: previousState[0].id
    }

    const result = reducer(previousState, page_updateOrCreate(payload))

    // Expect that the result is not bigger than the previous state
    expect(result.length).toBe(previousState.length)

    // Expect the slug to be updated
    expect(result[0].slug).toBe(payload.slug)
  })
  test('should handle a slug update (state does not contain page)', () => {
    const payload = {
      slug: 'test-2',
      id: 'JaenPage foo-bar-baz-2'
    }

    const result = reducer([], page_updateOrCreate(payload))

    // Expect the result to be length 1
    expect(result.length).toBe(1)

    // Expect the slug to be updated
    expect(result[0].slug).toBe(payload.slug)
  })
  test('should handle a jaenPageMetadata update', () => {
    const payload = {
      id: previousState[0].id,
      jaenPageMetadata: {
        title: 'This is a updated title',
        isBlogPost: false,
        image: 'updated image',
        description: 'updated description',
        datePublished: 'updated datePublished',
        canonical: 'updated canonical'
      }
    }

    const result = reducer(previousState, page_updateOrCreate(payload))

    // Expect that the result is not bigger than the previous state
    expect(result.length).toBe(previousState.length)

    // Expect the jaenPageMetadata to be updated
    expect(result[0].jaenPageMetadata).toEqual(
      expect.objectContaining(payload.jaenPageMetadata)
    )
  })
  test('should handle a update with a state that does not include the page to be updated', () => {
    const payload = {
      id: 'JaenPage foo-bar-baz-3',
      slug: 'updated-slug'
    }

    const result = reducer(previousState, page_updateOrCreate(payload))

    // Expect that the result is one bigger than the previous state
    expect(result.length).toBe(previousState.length + 1)

    // Expect the slug to be updated
    expect(result[result.length - 1].slug).toBe(payload.slug)
  })
  test('should handle a page move to a new parent (state includes page, old parent and new parent)', () => {
    const payload = {
      id: previousState[2].id,
      parent: {id: previousState[0].id},
      fromId: previousState[1].id
    }

    const result = reducer(previousState, page_updateOrCreate(payload))

    // Expect that the result is not bigger than the previous state
    expect(result.length).toBe(previousState.length)

    // Expect the parent to be updated
    expect(result[0].children).toEqual(
      expect.arrayContaining([expect.objectContaining({id: payload.id})])
    )

    // Expect the old parent to be updated
    expect(result[1].children).toEqual(
      expect.not.arrayContaining([expect.objectContaining({id: payload.id})])
    )

    // Expect the page to be updated
    expect(result[2].parent?.id).toEqual(payload.parent.id)
  })
  test('should handle a page move to a new parent (state includes page, old parent)', () => {
    const payload = {
      id: previousState[2].id,
      parent: {id: 'JaenPage foo-bar-baz-new-parent'},
      fromId: previousState[1].id
    }

    const result = reducer(previousState, page_updateOrCreate(payload))

    // Expect that the result is one bigger than the previous state
    expect(result.length).toBe(previousState.length + 1)

    // Expect the parent to be updated
    expect(result[result.length - 1].children).toEqual(
      expect.arrayContaining([expect.objectContaining({id: payload.id})])
    )

    // Expect the old parent to be updated
    expect(result[1].children).toEqual(
      expect.not.arrayContaining([expect.objectContaining({id: payload.id})])
    )

    // Expect the page to be updated
    expect(result[2].parent?.id).toEqual(payload.parent.id)
  })
  test('should handle a page move to a new parent (state includes page)', () => {
    const payload = {
      id: previousState[2].id,
      parent: {id: 'JaenPage foo-bar-baz-new-parent'},
      fromId: 'JaenPage foo-bar-baz-old-parent'
    }

    const result = reducer(previousState, page_updateOrCreate(payload))

    // Expect that the result is two bigger than the previous state
    expect(result.length).toBe(previousState.length + 2)

    // Find parentPage and oldParentPage in the result
    const parentPage = result.find(page => page.id === payload.parent.id)
    const oldParentPage = result.find(page => page.id === payload.fromId)

    // Expect the parent to be defined
    expect(parentPage).toBeDefined()
    // Expect the old parent to be defined
    expect(oldParentPage).toBeDefined()

    if (parentPage && oldParentPage) {
      // Expect the parent to be updated

      expect(parentPage.children).toEqual(
        expect.arrayContaining([expect.objectContaining({id: payload.id})])
      )

      // Expect the old parent to be updated
      expect(oldParentPage.children).toEqual(
        expect.not.arrayContaining([expect.objectContaining({id: payload.id})])
      )
    }

    // Expect the page to be updated
    expect(result[2].parent?.id).toEqual(payload.parent.id)
  })
  test('should handle a page move to a new parent', () => {
    const payload = {
      id: 'JaenPage foo-bar-baz-new-page',
      parent: {id: 'JaenPage foo-bar-baz-new-parent'},
      fromId: 'JaenPage foo-bar-baz-old-parent'
    }

    const result = reducer(previousState, page_updateOrCreate(payload))

    // Expect that the result is three bigger than the previous state
    expect(result.length).toBe(previousState.length + 3)

    // Find page,  parentPage and oldParentPage in the result
    const page = result.find(page => page.id === payload.id)
    const parentPage = result.find(page => page.id === payload.parent.id)
    const oldParentPage = result.find(page => page.id === payload.fromId)

    // Expect the page to be defined
    expect(page).toBeDefined()
    // Expect the parent to be defined
    expect(parentPage).toBeDefined()
    // Expect the old parent to be defined
    expect(oldParentPage).toBeDefined()

    if (page && parentPage && oldParentPage) {
      // Expect the parent to be updated
      expect(parentPage.children).toEqual(
        expect.arrayContaining([expect.objectContaining({id: payload.id})])
      )

      // Expect the old parent to be updated
      expect(oldParentPage.children).toEqual(
        expect.not.arrayContaining([expect.objectContaining({id: payload.id})])
      )

      // Expect the page to be updated
      expect(page.parent?.id).toEqual(payload.parent.id)
    }
  })
  test('should throw error on page move while creating', () => {
    const payload = {
      parent: {id: 'JaenPage foo-bar-baz-new-parent'},
      fromId: 'JaenPage foo-bar-baz-old-parent'
    }

    expect(() => reducer(previousState, page_updateOrCreate(payload))).toThrow(
      'Cannot move a page that is being created.'
    )
  })
})

describe('page_markForDeletion', () => {
  test('should delete a page (state includes page)', () => {
    const result = reducer(
      previousState,
      page_markForDeletion(previousState[0].id)
    )

    // Expect the result length to be the same as the previous state
    expect(result.length).toBe(previousState.length)

    // Expect the page to be marked as deleted
    expect(result[0].deleted).toBe(true)
  })
  test('should delete a page (state does not include page)', () => {
    const payload = 'JaenPage foo-bar-baz-marked-as-deleted'
    const result = reducer(previousState, page_markForDeletion(payload))

    // Expect the result length to be one one bigger than the previous state
    expect(result.length).toBe(previousState.length + 1)

    // Find the page in the result
    const page = result.find(page => page.id === payload)

    // Expect the page to be defined
    expect(page).toBeDefined()

    if (page) {
      // Expect the page to be marked as deleted
      expect(page.deleted).toBe(true)
    }
  })
})

describe('section_add', () => {
  test('should add a section as first chapter element', () => {
    const payload = {
      pageId: 'JaenPage foo-bar-baz-1',
      chapterName: 'Chapter1',
      sectionName: 'AboutSection',
      between: [
        null,
        {
          id: 'JaenSection foo-bar-baz-1',
          ptrNext: 'JaenSection foo-bar-baz-2',
          ptrPrev: null
        }
      ]
    }

    const result = reducer(previousState, section_add(payload as any))

    // Expect
    const page = result.find(page => page.id === payload.pageId)

    const prevNodes = previousState[0].chapters![payload.chapterName]!.sections
    const sections = page!.chapters![payload.chapterName]!.sections

    //> Conditions
    // Expect the chapter to be of length prevChapter length + 1
    expect(Object.keys(sections).length).toBe(Object.keys(prevNodes).length + 1)

    // get the section of chapter that was added to the object
    const sectionKey = Object.keys(sections)[Object.keys(sections).length - 1]

    // Expect the pointers to be correct
    const p1 = sections['JaenSection foo-bar-baz-1']
    expect({ptrPrev: p1.ptrPrev, ptrNext: p1.ptrNext}).toEqual(
      expect.objectContaining({
        ptrPrev: sectionKey,
        ptrNext: 'JaenSection foo-bar-baz-2'
      })
    )

    const p2 = sections[sectionKey]
    expect({ptrPrev: p2.ptrPrev, ptrNext: p2.ptrNext}).toEqual(
      expect.objectContaining({
        ptrPrev: null,
        ptrNext: 'JaenSection foo-bar-baz-1'
      })
    )

    // Expect that the head pointer is correct
    expect(page!.chapters![payload.chapterName]!.ptrHead).toEqual(sectionKey)
  })
  test('should add a section as last chapter element', () => {
    const payload = {
      pageId: 'JaenPage foo-bar-baz-1',
      chapterName: 'Chapter1',
      sectionName: 'AboutSection',
      between: [
        {
          id: 'JaenSection foo-bar-baz-2',
          ptrNext: null,
          ptrPrev: 'JaenSection foo-bar-baz-1'
        },
        null
      ]
    }

    const result = reducer(previousState, section_add(payload as any))

    // Expect
    const page = result.find(page => page.id === payload.pageId)

    const prevNodes = previousState[0].chapters![payload.chapterName]!.sections
    const sections = page!.chapters![payload.chapterName]!.sections

    //> Conditions
    // Expect the chapter to be of length prevChapter length + 1
    expect(Object.keys(sections).length).toBe(Object.keys(prevNodes).length + 1)

    // get the section of chapter that was added to the object
    const sectionKey = Object.keys(sections)[Object.keys(sections).length - 1]

    // Expect the pointers to be correct
    // prev last section ("JaenSection foo-bar-baz-2") -> ptrPrev: "JaenSection foo-bar-baz-1"; ptrNext: newSectionId;

    const p1 = sections['JaenSection foo-bar-baz-2']
    expect({ptrPrev: p1.ptrPrev, ptrNext: p1.ptrNext}).toEqual(
      expect.objectContaining({
        ptrPrev: 'JaenSection foo-bar-baz-1',
        ptrNext: sectionKey
      })
    )

    const p2 = sections[sectionKey]
    expect({ptrPrev: p2.ptrPrev, ptrNext: p2.ptrNext}).toEqual(
      expect.objectContaining({
        ptrPrev: 'JaenSection foo-bar-baz-2',
        ptrNext: null
      })
    )

    // Expect that the tail pointer is correct
    expect(page!.chapters![payload.chapterName]!.ptrTail).toEqual(sectionKey)
  })
  test('should add a section between two chapters', () => {
    const payload = {
      pageId: 'JaenPage foo-bar-baz-1',
      chapterName: 'Chapter1',
      sectionName: 'AboutSection',
      between: [
        {
          id: 'JaenSection foo-bar-baz-1',
          ptrNext: 'JaenSection foo-bar-baz-2',
          ptrPrev: null
        },
        {
          id: 'JaenSection foo-bar-baz-2',
          ptrNext: null,
          ptrPrev: 'JaenSection foo-bar-baz-1'
        }
      ]
    }

    const result = reducer(previousState, section_add(payload as any))

    // Expect
    const page = result.find(page => page.id === payload.pageId)

    const prevNodes = previousState[0].chapters![payload.chapterName]!.sections
    const sections = page!.chapters![payload.chapterName]!.sections

    //> Conditions
    // Expect the chapter to be of length prevChapter length + 1
    expect(Object.keys(sections).length).toBe(Object.keys(prevNodes).length + 1)

    // get the section of chapter that was added to the object
    const sectionKey = Object.keys(sections)[Object.keys(sections).length - 1]

    // Expect the pointers to be correct

    const p1 = sections['JaenSection foo-bar-baz-1']
    expect({ptrPrev: p1.ptrPrev, ptrNext: p1.ptrNext}).toEqual(
      expect.objectContaining({
        ptrPrev: null,
        ptrNext: sectionKey
      })
    )

    const p2 = sections[sectionKey]
    expect({ptrPrev: p2.ptrPrev, ptrNext: p2.ptrNext}).toEqual(
      expect.objectContaining({
        ptrPrev: 'JaenSection foo-bar-baz-1',
        ptrNext: 'JaenSection foo-bar-baz-2'
      })
    )

    const p3 = sections['JaenSection foo-bar-baz-2']
    expect({ptrPrev: p3.ptrPrev, ptrNext: p3.ptrNext}).toEqual(
      expect.objectContaining({
        ptrPrev: sectionKey,
        ptrNext: null
      })
    )
  })
})

describe('field_write', () => {
  test('should add a field to a page', () => {
    const payload = {
      pageId: 'JaenPage foo-bar-baz-1',
      fieldName: 'foo',
      value: 'bar'
    }

    const result = reducer(previousState, field_write(payload))

    // Expect the field to be added to the page
    const page = result.find(page => page.id === payload.pageId)
    expect(page!.jaenFields).toEqual(
      expect.objectContaining({
        [payload.fieldName]: payload.value
      })
    )
  })
  test('should add a field to a page section', () => {
    const payload = {
      pageId: 'JaenPage foo-bar-baz-1',
      section: {
        chapterName: 'Chapter1',
        sectionName: 'JaenSection foo-bar-baz-1'
      },
      fieldName: 'foo',
      value: 'bar'
    }

    const result = reducer(previousState, field_write(payload))

    // Expect the field to be added to the page
    const page = result.find(page => page.id === payload.pageId)
    expect(
      page!.chapters![payload.section.chapterName]!.sections[
        payload.section.sectionName
      ]!.jaenFields
    ).toEqual(
      expect.objectContaining({
        [payload.fieldName]: payload.value
      })
    )
  })
})
