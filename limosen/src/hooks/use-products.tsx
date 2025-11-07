import { useMemo } from 'react';
import { useJaenPageIndex, usePageContext, PageProvider } from 'jaen';
import { IGatsbyImageData } from 'gatsby-plugin-image';

export interface IJaenProduct {
  variants: Array<{
    id: string;
    shopifyId: string;
    taxable: boolean;
    sku: string;
    compareAtPrice: number | null;
    price: number;
    availableForSale: boolean;
  }>;
  hasOnlyDefaultVariant?: boolean;
  id: string;
  shopifyId: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  title: string;
  tags: Array<string>;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  totalInventory: number | null;
  createdAt: string;
  category: string;
  date: string;
  vendor: string;
  productType: string;
  media: Array<{
    id: string;
    image: {
      src: string;
      gatsbyImageData: IGatsbyImageData | null;
      altText: string | null;
    };
  }>;
  featuredMedia: {
    id: string;
    image: {
      src: string;
      gatsbyImageData: IGatsbyImageData | null;
      altText: string | null;
    };
  } | null;
  metafields: Array<{
    key: string;
    value: string;
    namespace: string;
  }>;
  index?: any;
  sections?: any;
}

interface IJaenPage {
  id: string;
  slug: string;
  jaenPageMetadata: {
    image?: string;
    description?: string;
    title?: string;
    blogPost?: {
      author: string
      category: string;
      date: string;
    };
  };
  sections: Array<Section>;
}

interface Section {
  fieldName: string;
  items: Array<{
    jaenFields: {
      [key: string]: {
        image: {
          value: string;
        };
      };
    };
    id: string;
    altText?: string;
  }>;
}

interface IJaenIndex {
  childPages: IJaenPage[];
  [key: string]: any;
}

interface UseJaenProductsOptions {
  unlimited?: boolean;
}

export const useJaenProducts = (
  productIndex: IJaenIndex,
  cmsmediapage: any,
  options?: UseJaenProductsOptions
) => {
  const index = productIndex;

  const { jaenPage } = usePageContext();
  const productHandle = jaenPage.buildPath.slice(1);

  const sectionFieldName = 'content';
  const globalMedia = (cmsmediapage?.jaenFields || {
    'IMA:MEDIA_NODES': {
      media_nodes: {
        value: {},
      },
    },
  })['IMA:MEDIA_NODES'].media_nodes.value;

  const transformToProduct = (jaenChildPage: IJaenPage, i: number): IJaenProduct => {
    const releaseDateStr = jaenChildPage.jaenPageMetadata?.blogPost?.date;
    const releaseDate = releaseDateStr ? new Date(releaseDateStr) : null;
    const isRecent =
      releaseDate &&
      (Date.now() - releaseDate.getTime()) / (1000 * 3600 * 24) < 30;

    const categoryStr = jaenChildPage.jaenPageMetadata?.blogPost?.category || "";
    const categoryTags = categoryStr
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
    const isOneOfMostRecent = i < 4;

    const tags = [
      ...categoryTags,
      ...(isRecent || isOneOfMostRecent ? ["Neu"] : [])
    ];

    return {
      variants: [
        {
          id: "VariantId",
          shopifyId: "your-shopify-id",
          taxable: true,
          sku: "SKU123",
          compareAtPrice: null,
          price: 29.99,
          availableForSale: true,
        },
      ],
      hasOnlyDefaultVariant: true,
      id: jaenPage.id,
      shopifyId: "your-shopify-id",
      handle: productHandle + jaenChildPage.slug || "none",
      description: jaenChildPage.jaenPageMetadata?.description || "",
      descriptionHtml: jaenChildPage.jaenPageMetadata?.description || "",
      title: jaenChildPage.jaenPageMetadata?.title || "",
      tags,
      status: "ACTIVE",
      totalInventory: 100,
      createdAt: releaseDateStr || "",
      category: jaenChildPage.jaenPageMetadata?.blogPost?.category || "",
      date: releaseDateStr || "",
      vendor: "VendorName",
      productType: "ProductType",
      media:
        jaenChildPage.sections
          ?.find(section => section.fieldName === sectionFieldName)
          ?.items.filter(item => item.jaenFields["IMA:ImageField"])
          ?.map(item => {
            const imageId = item.jaenFields["IMA:ImageField"].image.value;
            return {
              id: imageId,
              image: {
                src: globalMedia[imageId]?.preview?.url || "",
                gatsbyImageData: null,
                altText: globalMedia[imageId]?.altText || null,
              },
            };
          }) || [],
      featuredMedia: {
        id: "007",
        image: {
          src: jaenChildPage.jaenPageMetadata?.image || "",
          gatsbyImageData: null,
          altText: null,
        },
      },
      metafields: [],
      index: index,
      sections:
        jaenChildPage.sections
          ?.find(section => section.fieldName === "productImageSection")
          ?.items.map(item => {
            const imageId = item.jaenFields["IMA:ImageField"].image.value;
            return {
              item,
              id: item.id,
              image: {
                field: item.jaenFields["IMA:ImageField"],
                id: imageId,
                url: globalMedia[imageId]?.url,
                preview: globalMedia[imageId]?.preview.url,
                gatsbyImageData: null,
                altText: item.altText || null,
              },
            };
          }) || [],
    };
  };

  const products: IJaenProduct[] = index.childPages
    .filter(child => child.id !== jaenPage.id)
    .reverse()
    .map(transformToProduct)
    .slice(0, options?.unlimited ? undefined : 5);

  // Generate abcProducts
  const abcProducts = index.childPages
    .filter(child => child.id !== jaenPage.id)
    .reverse()
    .reduce<{ [key: string]: IJaenProduct[] }>((acc, jaenChildPage, i) => {
      const product = transformToProduct(jaenChildPage, i);
      const firstLetter = jaenChildPage.slug[0].toUpperCase();

      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }

      acc[firstLetter].push(product);

      return acc;
    }, {});

  const { featuredProducts, moreProducts } = useMemo(() => {
    const featuredProducts = products.slice(0, 4);
    const moreProducts = products.slice(4);
    return { featuredProducts, moreProducts };
  }, [products]);

  return {
    ...index,
    products,
    featuredProducts,
    moreProducts,
    abcProducts, // Include abcProducts in the return object
  };
};