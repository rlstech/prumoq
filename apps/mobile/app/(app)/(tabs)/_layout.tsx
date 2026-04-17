import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LayoutGrid, Building2, AlertTriangle, User } from 'lucide-react-native';
import { Colors, FontSizes } from '../../../lib/constants';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color }) => <LayoutGrid size={19} color={color} />,
        }}
      />
      <Tabs.Screen
        name="obras/index"
        options={{
          title: 'Obras',
          tabBarIcon: ({ color }) => <Building2 size={19} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nc/index"
        options={{
          title: 'NCs',
          tabBarIcon: ({ color }) => <AlertTriangle size={19} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil/index"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <User size={19} color={color} />,
        }}
      />
      {/* Hide deep routes from tab bar */}
      <Tabs.Screen name="obras/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="obras/[id]/ambiente/[ambId]/index" options={{ href: null }} />
      <Tabs.Screen name="obras/[id]/ambiente/[ambId]/fvs/[fvsId]/index" options={{ href: null }} />
      <Tabs.Screen name="obras/[id]/ambiente/[ambId]/fvs/[fvsId]/verificacao/nova" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 72,
    paddingBottom: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabLabel: {
    fontSize: FontSizes.tiny,
  },
  tabIcon: {
    marginTop: 2,
  },
});
