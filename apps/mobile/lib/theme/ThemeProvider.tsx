import { useFonts } from '@expo-google-fonts/barlow/useFonts';
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

/** Fontes empacotadas com o app (não dependem de rede): Barlow no texto,
 * Barlow Condensed nos títulos e JetBrains Mono em números e códigos. */
const bundledFonts = {
  Barlow_400Regular: require('@expo-google-fonts/barlow/400Regular/Barlow_400Regular.ttf'),
  Barlow_500Medium: require('@expo-google-fonts/barlow/500Medium/Barlow_500Medium.ttf'),
  Barlow_600SemiBold: require('@expo-google-fonts/barlow/600SemiBold/Barlow_600SemiBold.ttf'),
  Barlow_700Bold: require('@expo-google-fonts/barlow/700Bold/Barlow_700Bold.ttf'),
  BarlowCondensed_600SemiBold: require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'),
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
