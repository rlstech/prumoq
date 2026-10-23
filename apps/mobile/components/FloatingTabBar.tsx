import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconComponent } from '../lib/icons';
import { ComponentSize, Elevation, FontFamily, FontSizes, Palette, Radius, Spacing } from '../lib/constants';

export interface FloatingTab {
  /** Nome da rota no navegador de abas (ex.: 'nc/index'). */
  name: string;
  label: string;
  accessibilityLabel: string;
  Icon: IconComponent;
  /** Rotas fora do menu que mantêm esta aba acesa (ex.: 'historico'). */
  matches?: string[];
}

/** A aba fica acesa na própria rota, nas rotas irmãs ('nc/[ncId]' acende 'nc/index') e nas de `matches`. */
function tabOwnsRoute(tab: FloatingTab, routeName: string | undefined): boolean {
  if (!routeName) return false;
  if (routeName === tab.name || tab.matches?.includes(routeName)) return true;
  return tab.name.endsWith('/index') && routeName.startsWith(tab.name.slice(0, -'index'.length));
}

/** Subconjunto das props que o `Tabs` entrega ao `tabBar`. */
export interface FloatingTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

/**
 * Menu do app em pílula grafite solta da borda (Trena Suave). A aba ativa
 * vira uma pílula amarela com ícone e nome; as outras mostram só o ícone.
 * No tablet vira um trilho vertical à esquerda com a mesma linguagem.
 */
export function FloatingTabBar({
  state,
  navigation,
  tabs,
  rail = false,
}: FloatingTabBarProps & { tabs: FloatingTab[]; rail?: boolean }) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        rail ? styles.railWrap : styles.wrap,
        rail ? { paddingTop: insets.top + Spacing.lg } : { paddingBottom: Math.max(insets.bottom, Spacing.md) },
      ]}
    >
      <View accessibilityRole="tablist" style={[styles.bar, rail && styles.rail]}>
        {tabs.map(tab => {
          const route = state.routes.find(item => item.name === tab.name);
          if (!route) return null;
          const focused = tabOwnsRoute(tab, activeName);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (activeName !== route.name && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TabButton
              key={tab.name}
              tab={tab}
              focused={focused}
              onPress={onPress}
              showLabel={focused || rail}
              rail={rail}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({
  tab,
  focused,
  onPress,
  showLabel,
  rail,
}: {
  tab: FloatingTab;
  focused: boolean;
  onPress: () => void;
  showLabel: boolean;
  rail: boolean;
}) {
  const [hasFocus, setHasFocus] = useState(false);
  const { Icon } = tab;
  const color = focused ? Palette.onAccent : Palette.onBrandMuted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.accessibilityLabel}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onFocus={() => setHasFocus(true)}
      onBlur={() => setHasFocus(false)}
      style={({ pressed }) => [
        styles.item,
        showLabel && !rail && styles.itemWide,
        rail && styles.railItem,
        focused && styles.itemActive,
        pressed && !focused && styles.itemPressed,
        hasFocus && styles.itemFocus,
      ]}
    >
      <Icon size={22} color={color} strokeWidth={focused ? 1.9 : 1.8} />
      {showLabel ? (
        <Text numberOfLines={1} style={[styles.label, rail && styles.railLabel, { color: focused ? Palette.onAccent : Palette.onBrandMuted }]}>
          {tab.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Palette.canvas,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  railWrap: {
    backgroundColor: Palette.canvas,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  bar: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    height: ComponentSize.tabBar,
    borderRadius: Radius.full,
    backgroundColor: Palette.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    ...Elevation.floating,
  },
  rail: {
    width: ComponentSize.navigationRail,
    height: 'auto',
    flex: 1,
    maxWidth: undefined,
    borderRadius: Radius.xl,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  item: {
    height: 48,
    minWidth: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  itemWide: { paddingLeft: 14, paddingRight: 18 },
  railItem: {
    width: '100%',
    height: 64,
    borderRadius: Radius.md,
    flexDirection: 'column',
    gap: 4,
  },
  itemActive: { backgroundColor: Palette.accent },
  itemPressed: { backgroundColor: Palette.onBrandLine },
  itemFocus: { borderWidth: 2, borderColor: Palette.accent },
  label: { fontFamily: FontFamily.bold, fontSize: FontSizes.sm, lineHeight: 18 },
  railLabel: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, lineHeight: 16 },
});
