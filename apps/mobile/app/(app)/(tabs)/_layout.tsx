import { router, Tabs } from 'expo-router';
import { AlertTriangle, Building2, HardHat, Home, Star } from '../../../lib/icons';
import { FloatingTabBar, type FloatingTab, type FloatingTabBarProps } from '../../../components/FloatingTabBar';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';

/** Abas visíveis, na ordem do menu. As demais rotas do grupo ficam fora dele. */
const TABS: FloatingTab[] = [
  { name: 'index', label: 'Início', accessibilityLabel: 'Início', Icon: Home, matches: ['historico'] },
  { name: 'obras', label: 'Obras', accessibilityLabel: 'Obras', Icon: Building2 },
  { name: 'nc/index', label: 'NCs', accessibilityLabel: 'Não conformidades', Icon: AlertTriangle },
  { name: 'avaliacoes/index', label: 'Avaliar', accessibilityLabel: 'Avaliações de empreiteiros', Icon: Star },
  { name: 'perfil/index', label: 'Perfil', accessibilityLabel: 'Perfil', Icon: HardHat },
];

export default function TabsLayout() {
  const { isTablet } = useResponsiveLayout();

  return (
    <Tabs
      backBehavior="history"
      tabBar={props => (
        <FloatingTabBar {...(props as unknown as FloatingTabBarProps)} tabs={TABS} rail={isTablet} />
      )}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isTablet ? 'left' : 'bottom',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
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
          popToTopOnBlur: true,
        }}
      />
      <Tabs.Screen
        name="nc/index"
        options={{
          title: 'NCs',
        }}
      />
      <Tabs.Screen
        name="avaliacoes/index"
        options={{
          // "Avaliações" é longo para a pílula da aba ativa; o nome completo
          // fica no rótulo de acessibilidade do menu.
          title: 'Avaliar',
        }}
      />
      <Tabs.Screen name="historico" options={{ href: null }} />
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
        }}
      />
    </Tabs>
  );
}
