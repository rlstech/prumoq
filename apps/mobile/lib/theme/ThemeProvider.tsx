import { useFonts } from '@expo-google-fonts/ibm-plex-sans/useFonts';
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

const bundledFonts = {
  IBMPlexSans_400Regular: require('@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf'),
  IBMPlexSans_500Medium: require('@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf'),
  IBMPlexSans_600SemiBold: require('@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf'),
  IBMPlexSans_700Bold: require('@expo-google-fonts/ibm-plex-sans/700Bold/IBMPlexSans_700Bold.ttf'),
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
