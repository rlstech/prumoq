import { router, Tabs } from 'expo-router';
import { AlertTriangle, Building2, ClipboardCheck, LayoutGrid, User } from '../../../lib/icons';
import { StyleSheet, View } from 'react-native';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import type { IconComponent } from '../../../lib/icons';
import {
  Colors,
  ComponentSize,
  FontFamily,
  FontSizes,
  Palette,
  Radius,
  Spacing,
} from '../../../lib/constants';

/** Ícone da aba: o item ativo ganha o bloco amarelo atrás do ícone. */
function TabIcon({ Icon, color, focused }: { Icon: IconComponent; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconSlot, focused && styles.iconSlotActive]}>
      <Icon size={20} color={focused ? Palette.onAccent : color} />
    </View>
  );
}

export default function TabsLayout() {
  const { isTablet } = useResponsiveLayout();

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarPosition: isTablet ? 'left' : 'bottom',
        tabBarActiveTintColor: Palette.accent,
        tabBarInactiveTintColor: Palette.onBrandMuted,
        tabBarStyle: [styles.tabBar, isTablet && styles.navigationRail],
        tabBarItemStyle: [styles.tabItem, isTablet && styles.railItem],
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarAccessibilityLabel: 'Início',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={LayoutGrid} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="obras"
        listeners={{
          tabPress: event => {
            event.preventDefault();
            router.replace('/(app)/(tabs)/obras');
          },
        }}
        options={{
          title: 'Obras',
          tabBarAccessibilityLabel: 'Obras',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Building2} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="nc/index"
        options={{
          title: 'NCs',
          tabBarAccessibilityLabel: 'Não conformidades',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={AlertTriangle} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="avaliacoes/index"
        options={{
          // "Avaliações" não cabe na aba: são 5 abas dividindo 360–411dp, o que
          // dá ~69dp cada, e o rótulo saía como "Avaliaçõ…". O nome completo
          // fica no rótulo de acessibilidade.
          title: 'Avaliar',
          tabBarAccessibilityLabel: 'Avaliações de empreiteiros',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={ClipboardCheck} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="avaliacoes/nova" options={{ href: null }} />
      <Tabs.Screen name="avaliacoes/[id]/pdf" options={{ href: null }} />
      <Tabs.Screen
        name="nc/[ncId]"
        options={{
          href: null,
        }}
      />
      {/* Rota interna do Perfil: precisa ser declarada com href null, senão o
          Expo Router a promoveria a uma sexta aba. */}
      <Tabs.Screen name="perfil/sincronizacao" options={{ href: null }} />
      <Tabs.Screen
        name="perfil/index"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Perfil',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={User} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: ComponentSize.tabBar,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    borderTopWidth: 0,
    // Mesmo grafite da capa do dashboard.
    backgroundColor: Colors.brand,
    // 8dp em vez de 12dp de margem lateral: devolve 8dp para os rótulos, que em
    // aparelhos de 360dp era a diferença entre caber e cortar.
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  navigationRail: {
    width: ComponentSize.navigationRail,
    height: '100%',
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: Palette.onBrandLine,
  },
  tabItem: {
    minHeight: 52,
    borderRadius: Radius.md,
  },
  railItem: {
    maxHeight: 72,
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  tabLabel: {
    // O <Label> do react-navigation não tem largura definida: fica com largura
    // automática dentro do item, e nesse modo o texto é medido em torno de
    // metade do real — "Início" virava "Iníc…" num item de 79dp. alignSelf
    // stretch é o equivalente do flex: 1 no eixo transversal de uma coluna:
    // dá ao rótulo a largura do item, e o textAlign center do próprio Label
    // mantém o alinhamento.
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
  },
  // O contêiner padrão do ícone tem 31×28: o bloco do item ativo é mais largo.
  tabIcon: { marginTop: 1, width: 36, height: 26 },
  iconSlot: {
    width: 36,
    height: 26,
    borderRadius: Radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotActive: { backgroundColor: Palette.accent },
});
