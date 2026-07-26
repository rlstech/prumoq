import { useWindowDimensions } from 'react-native';
import { Breakpoints } from '../lib/constants';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= Breakpoints.tablet;
  const isDesktop = width >= Breakpoints.desktop;

  return {
    width,
    height,
    isCompact: !isTablet,
    isTablet,
    isDesktop,
    contentWidth: Math.min(width, Breakpoints.maxContent),
  };
}
