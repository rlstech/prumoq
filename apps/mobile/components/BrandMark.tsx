import { Image } from 'react-native';

export type BrandMarkVariant = 'default' | 'onBrand';

interface Props {
  size?: number;
  variant?: BrandMarkVariant;
}

export function BrandMark({ size = 40, variant = 'default' }: Props) {
  return (
    <Image
      source={
        variant === 'onBrand'
          ? require('../assets/pq-monogram-on-brand.png')
          : require('../assets/pq-monogram-default.png')
      }
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
