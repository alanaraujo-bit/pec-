/**
 * Navegação principal.
 *
 * Quatro abas. Cada uma responde a uma pergunta diferente que o usuário realmente tem:
 * "o que está acontecendo?", "como está meu PC?", "onde eu estou?" e "quem sou eu aqui?".
 * Uma quinta aba precisaria justificar sua existência, e nenhuma justifica.
 */

import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, type as typo } from '../../src/theme.ts';
import { useSession } from '../../src/session.tsx';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 22 }}>
      <Text style={{ fontSize: 18, color: focused ? color.accent : color.textFaint }}>{glyph}</Text>
    </View>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  /**
   * Altura da barra. Usada em dois lugares, então vive numa constante só.
   *
   * A web precisa de mais espaço: o react-native-web monta rótulo e ícone com caixas de
   * linha próprias e o conteúdo pede ~68px, cortando o rótulo em alturas menores. No
   * nativo 58 é a medida padrão e correta. Separar evita duas coisas ruins: rótulo cortado
   * na verificação visual e uma barra desproporcional no aparelho.
   */
  const tabBarHeight = (Platform.OS === 'web' ? 78 : 58) + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: color.bg,
          borderTopColor: color.borderSoft,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 7,
          paddingBottom: insets.bottom + 7,
          elevation: 0,
        },
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textFaint,
        tabBarLabelStyle: { ...typo.label, fontSize: 10, lineHeight: 12, textTransform: 'none' as const, marginTop: 3 },
        // Sem o padding padrão do item, a altura da barra é só o que declaramos aqui.
        tabBarItemStyle: { paddingTop: 0, paddingBottom: 0 },
        /**
         * Reserva a altura da barra para o conteúdo de TODAS as telas de aba de uma vez.
         * Sem isso, o fim de cada lista fica escondido atrás da barra — e o usuário não
         * descobre que existe mais conteúdo ali embaixo.
         */
        sceneStyle: { backgroundColor: color.bg, paddingBottom: tabBarHeight },
        // Animação de aba na web tem custo e nenhum ganho.
        animation: Platform.OS === 'web' ? 'none' : 'shift',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rigs"
        options={{
          title: 'Meus PCs',
          tabBarIcon: ({ focused }) => <TabIcon glyph="▣" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◭" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◐" focused={focused} />,
        }}
        initialParams={{ handle: user?.handle }}
      />
    </Tabs>
  );
}
