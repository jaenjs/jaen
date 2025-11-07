import React, { useMemo } from 'react';
import {
  Button,
  HStack,
  Image,
  Text,
  VStack,
  ButtonProps
} from '@chakra-ui/react';
import { Link } from 'gatsby-plugin-jaen'; // use the same Link you already use elsewhere
import { useI18nL10nContext } from 'gatsby-plugin-i18n-l10n';

/**
 * Return the autonym (self-name) for a locale, e.g.:
 *   "en-US" -> "English"
 *   "de-AT" -> "Deutsch"
 *   "tr-TR" -> "Türkçe"
 * No hardcoding, uses Intl.DisplayNames. Falls back to the locale code if unavailable.
 */
export const autonym = (loc: string): string => {
  const base = (loc || '').split('-')[0] || loc;
  try {
    // Use the base language itself as the display locale to get the autonym.
    const dn = new Intl.DisplayNames([base], { type: 'language' });
    return dn.of(base) ?? loc;
  } catch {
    return loc;
  }
};

type Props = {
  onSelect?: () => void;                 // e.g. close modal after click
  resolveLanguageName?: (locale: string) => string; // defaults to autonym()
  buttonProps?: ButtonProps;             // style overrides for each button
  /**
   * Optional flags mapping: keys can be exact locales ("de-AT") or base codes ("de").
   * If no match, no flag is rendered for that locale.
   */
  flags?: Record<string, string>;
};

export default function ChakraLanguageSwitcher({
  onSelect,
  resolveLanguageName,
  buttonProps,
  flags
}: Props) {
  const { translations = [], locale: currentLocale } = useI18nL10nContext();

  // Default to autonym if caller doesn't provide a name resolver.
  const labelFor = useMemo(
    () => resolveLanguageName ?? autonym,
    [resolveLanguageName]
  );

  const isActive = (loc: string) => {
    const a = (currentLocale || '').toLowerCase();
    const b = (loc || '').toLowerCase();
    return a === b || a.startsWith(b) || b.startsWith(a);
  };

  const flagFor = (loc: string) => {
    if (!flags) return undefined;
    const exact = flags[loc];
    if (exact) return exact;
    const base = (loc || '').split('-')[0];
    return flags[base];
  };

  return (
    <VStack align="stretch" spacing={3}>
      {translations.map(({ locale, path }) => {
        const active = isActive(locale);
        const label = labelFor(locale);
        const flagSrc = flagFor(locale);

        return (
          <Button
            key={locale}
            as={Link}
            href={path}                  // jaen Link uses "href"
            onClick={onSelect}
            justifyContent="flex-start"
            variant={active ? 'solid' : 'ghost'}
            color="limosen.text.primary"
            _hover={{ bg: 'whiteAlpha.200' }}
            {...buttonProps}
          >
            <HStack spacing={3}>
              {flagSrc ? (
                <Image
                  src={flagSrc}
                  alt={label}
                  width="28px"
                  height="28px"
                  objectFit="cover"
                />
              ) : null}
              <Text>{label}</Text>
            </HStack>
          </Button>
        );
      })}
    </VStack>
  );
}
