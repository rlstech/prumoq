import { router, Tabs } from 'expo-router';
import { AlertTriangle, Building2, ClipboardCheck, LayoutGrid, User } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import {
  Colors,
  ComponentSize,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
} from '../../../lib/constants';

export default function TabsLayout() {
  const { isTablet } = useResponsiveLayout();

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarPosition: isTablet ? 'left' : 'bottom',
        tabBarActiveTintColor: Colors.brandSignature,
        tabBarInactiveTintColor: isTablet ? Colors.textSecondary : 'rgba(255,255,255,0.58)',
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
          tabBarIcon: ({ color }) => <LayoutGrid size={21} color={color} strokeWidth={2.1} />,
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
          tabBarIcon: ({ color }) => <Building2 size={21} color={color} strokeWidth={2.1} />,
        }}
      />
      <Tabs.Screen
        name="nc/index"
        options={{
          title: 'NCs',
          tabBarAccessibilityLabel: 'Não conformidades',
          tabBarIcon: ({ color }) => <AlertTriangle size={21} color={color} strokeWidth={2.1} />,
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
          tabBarIcon: ({ color }) => <ClipboardCheck size={21} color={color} strokeWidth={2.1} />,
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
          tabBarIcon: ({ color }) => <User size={21} color={color} strokeWidth={2.1} />,
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
    // Mesma família do azul da capa do dashboard: a pílula flutuante lê como
    // a mesma superfície da marca, não como uma barra preta genérica.
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
    borderRightColor: Colors.brandDark,
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
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.tiny,
  },
  tabIcon: { marginTop: 1 },
});
