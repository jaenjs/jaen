export type { SearchIndex } from './types';

import { useMemo } from 'react';
import { FaFlask } from '@react-icons/all-files/fa/FaFlask';
import { TSearchResults } from '../../utils/search/types';
import useDocsSearch from './use-docs-search';
import useSocialSearch from './use-social-search';
import TbBooks from '../../components/icons/tabler/TbBooks';
import TbUsers from '../../components/icons/tabler/TbUsers';
import TbApple from '../../components/icons/tabler/TbApple';

const useSearch = (
  query?: string
): {
  searchResult: TSearchResults;
  isLoading: boolean;
} => {
  const docsSearch = useDocsSearch(query || '');
  const socialSearch = useSocialSearch(query);

  const searchResult = useMemo(() => {
    return {
      docs: {
        title: 'Rezepte',
        sections: docsSearch.searchResults.filter((section) =>
          !!section.to?.startsWith('/recipes/') ||
          !!section.results[0]?.to?.startsWith('/recipes/')
        ),
        icon: <TbBooks />
      },
      blog: {
        title: 'Blog',
        sections: docsSearch.searchResults.filter((section) =>
          !!section.to?.startsWith('/docs/') ||
          !!section.results[0]?.to?.startsWith('/docs/')
        ),
        icon: <TbApple />
      },
      //...socialSearch.searchResults
    };
  }, [docsSearch, socialSearch]);

  const isLoading = docsSearch.isLoading || socialSearch.isLoading;

  return {
    searchResult,
    isLoading
  };
};

export default useSearch;
