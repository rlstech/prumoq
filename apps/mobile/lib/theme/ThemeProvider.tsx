import { useFonts } from 'expo-font';
import { createContext, ReactNode, useContext, useEffect } from 'react';
import { Text } from 'react-native';
import {
  Breakpoints,
  Colors,
  ComponentSize,
  DesignTokens,
  Elevation,
  FontFamily,
  FontSizes,
  Motion,
  Palette,
  Radius,
  Spacing,
  Typography,
} from '../constants';

export const fieldTheme = {
  tokens: DesignTokens,
  palette: Palette,
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  fontFamily: FontFamily,
  fontSizes: FontSizes,
  typography: Typography,
  elevation: Elevation,
  motion: Motion,
  breakpoints: Breakpoints,
  componentSize: ComponentSize,
} as const;

/** Fontes empacotadas com o app (não dependem de rede): Figtree no texto e
 * nos títulos, JetBrains Mono em números e códigos e Barlow Condensed só no
 * logotipo. */
const bundledFonts = {
  Figtree_400Regular: require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf'),
  Figtree_500Medium: require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
  Figtree_600SemiBold: require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
  Figtree_700Bold: require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
  Figtree_800ExtraBold: require('@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf'),
  BarlowCondensed_700Bold: require('@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf'),
  JetBrainsMono_500Medium: require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
  JetBrainsMono_600SemiBold: require('@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf'),
  JetBrainsMono_700Bold: require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
};

type FieldTheme = typeof fieldTheme;

const ThemeContext = createContext<FieldTheme>(fieldTheme);

let defaultFontConfigured = false;

function configureDefaultFont() {
  if (defaultFontConfigured) return;
  const TextWithDefaults = Text as typeof Text & {
    defaultProps?: { style?: unknown };
  };
  TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {};
  TextWithDefaults.defaultProps.style = [
    { fontFamily: FontFamily.regular },
    TextWithDefaults.defaultProps.style,
  ];
  defaultFontConfigured = true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts(bundledFonts);

  useEffect(() => {
    if (fontsLoaded || fontError) configureDefaultFont();
  }, [fontsLoaded, fontError]);

  return (
    <ThemeContext.Provider value={fieldTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): FieldTheme {
  return useContext(ThemeContext);
}
