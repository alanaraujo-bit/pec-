/**
 * Sessão do usuário.
 *
 * Um contexto só, com o mínimo: quem está logado e se o onboarding falta. O roteamento
 * decide o resto a partir disso — sem máquina de estado espalhada por telas.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setToken, type AuthResponse, type SessionUser } from './api.ts';

interface SessionState {
  user: SessionUser | null;
  needsOnboarding: boolean;
  /** `true` enquanto restauramos a sessão salva — evita piscar a tela de login. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    handle: string;
    displayName: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Chamado ao concluir o onboarding. */
  markOnboarded: () => void;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<SessionUser & { needsOnboarding: boolean }>('/auth/me');
      setUser({ id: me.id, handle: me.handle, displayName: me.displayName, region: me.region });
      setNeedsOnboarding(me.needsOnboarding);
    } catch {
      // Token inválido ou expirado: volta ao estado deslogado sem alarde.
      setUser(null);
      await setToken(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const adopt = useCallback(async (res: AuthResponse) => {
    await setToken(res.token);
    setUser(res.user);
    setNeedsOnboarding(res.needsOnboarding);
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      user,
      needsOnboarding,
      loading,
      signIn: async (email, password) => {
        adopt(await api.post<AuthResponse>('/auth/login', { email, password }));
      },
      signUp: async (input) => {
        adopt(await api.post<AuthResponse>('/auth/register', { ...input, region: 'BR' }));
      },
      signOut: async () => {
        await setToken(null);
        setUser(null);
        setNeedsOnboarding(false);
      },
      markOnboarded: () => setNeedsOnboarding(false),
      refresh,
    }),
    [user, needsOnboarding, loading, adopt, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de SessionProvider');
  return ctx;
}
