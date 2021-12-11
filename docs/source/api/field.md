---
title: Field
description: Bring content editing to your website
---

Fields are a powerful way to extend your site with content editing capabilities. Fields are implemented as [React components](https://reactjs.org/), so they can be used on any page in the site. 

## Fields

Jaen provides a set of fields for you to use in your site. These fields should cope with most of the common use cases, but if you need something more specific, you can always [create your own](#field-api) field.

### Text

The most basic field is a text field. It is a simple text input that can be used to enter text.

```tsx
import {connectPage, Field } from '@jaenjs/jaen'

const Page = connectPage(() => (
  <Field.Text name="field1" label="Field 1" initValue="Test" />
), {
  displayName: 'Sample Page',
  id: 'SamplePage',
});
```

### Image

The image field is the Jaen field that allows you to embed images hosted on the IPFS. It requires both a fieldName and an initValue.

### Section

The section field manages [sections](./section) in your site. It allows to add, remove and reorder sections.

```tsx
import {connectPage, Field} from '@jaenjs/jaen'
import {CardSection} from './card-section'

const Page = connectPage(() => (
  <Field.Section name="field1" label="Field 1" sections={[CardSection]} />
), {
  displayName: 'Sample Page',
  id: 'SamplePage',
});
```

### Index

## Styling

## Field API

