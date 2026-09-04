import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider, useSession } from '../src/session.tsx';
import { Loading } from '../src/ui.tsx';
import { color } from '../src/theme.ts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados de hardware mudam pouco; evitar refetch agressivo mantém o app rápido.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Porteiro de navegação. Concentra em um lugar só a decisão de para onde o usuário vai:
 * sem sessão vai para o boas-vindas, sem perfil vai para o onboarding, o resto entra.
 */
function Gate() {
  const { user, needsOnboarding, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === 'onboarding';

    if (!user && !inAuth) router.replace('/(auth)/welcome');
    else if (user && needsOnboarding && !inOnboarding) router.replace('/onboarding');
    else if (user && !needsOnboarding && (inAuth || inOnboarding)) router.replace('/');
  }, [user, needsOnboarding, loading, segments, router]);

  if (loading) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style="light" />
            <Gate />
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
