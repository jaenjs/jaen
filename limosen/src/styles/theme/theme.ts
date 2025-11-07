// theme.ts
import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "light", // app defaults to light
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50:  "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#d4af37", // gold
    600: "#b8932f",
    700: "#9a7b26",
    800: "#7a611d",
    900: "#5a4815",
  },
  neutral: {
    200: "#1b1b1b",
    250: "#1c1c1d",
    300: "#1f1f1f",
    350: "#252525",
    400: "#2a2a2a",
    500: "#333333",
    700: "#424242",
  },
  // optional warm accent for homepage CTAs (use via colorScheme="limosen")
  limosen: {
    50:  "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
  },
};

// ✅ Add Segoe UI for headings & body
const fonts = {
  heading: '"Segoe UI", sans-serif',
  body: '"Segoe UI", sans-serif',
};

const semanticTokens = {
  colors: {
    // ---- App-wide (light) defaults you already had ----
    "bg.canvas":      { default: "white" },
    "bg.header":      { default: "white" },
    "bg.section":     { default: "white" },
    "bg.surface":     { default: "white" },
    "bg.surfaceAlt":  { default: "gray.50" },
    "text.primary":   { default: "blackAlpha.900" },
    "text.secondary": { default: "blackAlpha.700" },
    "text.muted":     { default: "blackAlpha.600" },
    "border.faint":   { default: "blackAlpha.100" },
    "border.subtle":  { default: "gray.200" },
    accent:           { default: "brand.500" },
    "accent.emphasis":{ default: "brand.600" },
    "accent.muted":   { default: "brand.200" },
    "accent.on":      { default: "black" },

    // ---- Limosen (homepage) semantic tokens (dark-look surfaces) ----
    // Exact colors requested:
    // banner: #1b1b1b, nav top: #1c1c1c, über uns: #2f2f2f,
    // fleet background: #1b1b1b, cards: #252525, cars backdrop: white, footer: #0f0f0f
    "limosen.bg.canvas":     { default: "#1b1b1b" },  // overall dark canvas (hero area / page body on that page)
    "limosen.bg.banner":     { default: "#1b1b1b" },  // top banner (HeaderBar)
    "limosen.bg.navTop":     { default: "#1c1c1c" },  // TopNavigation background/mega
    "limosen.bg.about":      { default: "#2f2f2f" },  // Über uns section
    "limosen.bg.fleet":      { default: "#1b1b1b" },  // Fahrzeugflotte section background
    "limosen.bg.card":       { default: "#252525" },  // all cards on that page
    "limosen.bg.carsBackdrop": { default: "white" },  // image wrapper "behind cars" (white)
    "limosen.bg.footer":     { default: "#0f0f0f" },  // footer
    // Generic surfaces if you want to reuse:
    "limosen.bg.section":    { default: "neutral.200" },
    "limosen.bg.surface":    { default: "neutral.350" },
    "limosen.bg.surfaceAlt": { default: "neutral.300" },

    // Text in dark sections
    "limosen.text.primary":   { default: "whiteAlpha.900" },
    "limosen.text.secondary": { default: "whiteAlpha.800" },
    "limosen.text.muted":     { default: "whiteAlpha.700" },

    // Borders for dark sections
    "limosen.border.faint":  { default: "whiteAlpha.100" },
    "limosen.border.subtle": { default: "whiteAlpha.200" },

    // Accent for homepage — uses your gold by default
    "limosen.accent":          { default: "brand.500" },
    "limosen.accent.emphasis": { default: "brand.600" },
    "limosen.accent.on":       { default: "black" },
  },
};

const components = {
  Button: {
    defaultProps: { colorScheme: "brand" },
    variants: {
      solid: {
        bg: "accent",
        color: "accent.on",
        _hover: { bg: "accent.emphasis" },
        _active: { bg: "brand.700" },
      },
      // Homepage-only look via variant="limosen"
      limosen: {
        bg: "limosen.accent",
        color: "limosen.accent.on",
        _hover: { bg: "limosen.accent.emphasis" },
        _active: { bg: "brand.700" },
      },
      ghost: {
        _hover: { bg: "blackAlpha.50" },
        _active: { bg: "blackAlpha.100" },
      },
    },
  },
  Card: {
    variants: {
      limosen: {
        container: {
          bg: "limosen.bg.card",
          color: "limosen.text.primary",
          borderColor: "limosen.border.subtle",
          borderWidth: "1px",
          borderRadius: "xl",
        },
      },
    },
  },
};

const layerStyles = {
  // Page wrapper for the Limosen homepage
  "limosen.page": {
    bg: "limosen.bg.canvas",
    color: "limosen.text.primary",
    minH: "100dvh",
  },
  // Generic surface using limosen tokens
  "limosen.surface": {
    bg: "limosen.bg.surface",
    color: "limosen.text.primary",
    borderColor: "limosen.border.subtle",
    borderWidth: "1px",
    borderRadius: "xl",
  },
};

export const theme = extendTheme({
  config,
  colors,
  fonts, // ← added here
  semanticTokens,
  components,
  layerStyles,
});

export default theme;
