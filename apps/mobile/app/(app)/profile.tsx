/**
 * Perfil — a identidade da pessoa dentro do universo PC.
 *
 * Serve tanto para o próprio usuário quanto para visitar outra pessoa: a mesma tela,
 * com as ações mudando conforme quem olha. O que aparece respeita a privacidade do dono
 * — máquinas privadas somem, valor só aparece se ele liberou.
 */

import { RefreshControl, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type FeedEvent } from '../../src/api.ts';
import { Avatar, Button, Divider, Empty, ErrorState, Loading, Panel, Pill, Screen, Txt } from '../../src/ui.tsx';
import { color, money, radius, space, timeAgo, verdictColor, type Verdict } from '../../src/theme.ts';
import { useSession } from '../../src/session.tsx';

interface ProfileResponse {
  user: {
    id: string;
    handle: string;
    displayName: string;
    bio: string | null;
    region: string;
    createdAt: string;
  };
  counts: { followers: number; following: number; events: number };
  isSelf: boolean;
  isFollowing: boolean;
  rigs: Array<{
    id: string;
    name: string;
    kind: string;
    isPrimary: boolean;
    componentCount: number;
    setupScore: number;
    tier: string;
    verdict: string;
    status: string;
    estimatedFps: number | null;
    value: { total: number; currency: string } | null;
    highlights: { cpu: string | null; gpu: string | null };
  }>;
  events: FeedEvent[];
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Txt variant="subheading">{value}</Txt>
      <Txt variant="label" tone="faint">
        {label.toUpperCase()}
      </Txt>
    </View>
  );
}

export default function Profile() {
  const params = useLocalSearchParams<{ handle?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut } = useSession();

  // Sem handle na rota, o perfil é o do próprio usuário — é o caso da aba.
  const handle = params.handle ?? user?.handle;

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['profile', handle],
    queryFn: () => api.get<ProfileResponse>(`/users/${handle}`),
    enabled: Boolean(handle),
  });

  const follow = useMutation({
    mutationFn: (next: boolean) =>
      next ? api.put(`/users/${handle}/follow`) : api.del(`/users/${handle}/follow`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', handle] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  if (!handle || isLoading) return <Loading />;
  if (error || !data) {
    return (
      <Screen scroll>
        <ErrorState message={(error as Error)?.message ?? 'Erro'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const totalValue = data.rigs.reduce((sum, r) => sum + (r.value?.total ?? 0), 0);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.textFaint} />
      }
    >
      {params.handle && params.handle !== user?.handle ? (
        <View style={{ paddingTop: space.md, paddingBottom: space.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Txt variant="smallStrong" tone="faint">
              ← Voltar
            </Txt>
          </Pressable>
        </View>
      ) : null}

      {/* Cabeçalho */}
      <Animated.View entering={FadeIn.duration(300)} style={{ paddingTop: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Avatar name={data.user.displayName} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading" numberOfLines={1}>
              {data.user.displayName}
            </Txt>
            <Txt variant="small" tone="faint">
              @{data.user.handle}
            </Txt>
          </View>
        </View>

        {data.user.bio ? (
          <Txt variant="body" tone="dim">
            {data.user.bio}
          </Txt>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.xxl }}>
          <Stat value={data.rigs.length} label={data.rigs.length === 1 ? 'PC' : 'PCs'} />
          <Stat value={data.counts.followers} label="seguidores" />
          <Stat value={data.counts.following} label="seguindo" />
        </View>

        {data.isSelf ? null : (
          <Button
            label={data.isFollowing ? 'Seguindo' : 'Seguir'}
            variant={data.isFollowing ? 'secondary' : 'primary'}
            size="sm"
            loading={follow.isPending}
            onPress={() => follow.mutate(!data.isFollowing)}
          />
        )}
      </Animated.View>

      <View style={{ height: space.xxl }} />

      {/* Máquinas */}
      <View style={{ marginBottom: space.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <Txt variant="label" tone="faint" style={{ flex: 1 }}>
            SETUP
          </Txt>
          {data.isSelf && totalValue > 0 ? (
            <Txt variant="small" tone="faint">
              {money(totalValue, data.rigs[0]?.value?.currency ?? 'BRL')} no total
            </Txt>
          ) : null}
        </View>

        {data.rigs.length === 0 ? (
          <Empty
            title={data.isSelf ? 'Você ainda não cadastrou um PC' : 'Nenhuma máquina pública'}
            description={
              data.isSelf
                ? 'Cadastre sua máquina para receber o diagnóstico e aparecer nos rankings.'
                : 'Esta pessoa não tornou nenhuma máquina pública.'
            }
            actionLabel={data.isSelf ? 'Cadastrar meu PC' : undefined}
            onAction={data.isSelf ? () => router.push('/rigs') : undefined}
          />
        ) : (
          <View style={{ gap: space.md }}>
            {data.rigs.map((rig, index) => {
              // O veredito vem do engine. O app nunca reinventa julgamento de domínio.
              const tint = verdictColor[rig.verdict as Verdict] ?? color.textDim;
              return (
                <Animated.View key={rig.id} entering={FadeInDown.delay(index * 60).duration(320)}>
                  <Panel onPress={() => router.push(`/rigs/${rig.id}`)} style={{ gap: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Txt variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
                        {rig.name}
                      </Txt>
                      {rig.isPrimary ? <Pill label="Principal" tint={color.accent} background={color.accentSoft} /> : null}
                      <Txt variant="heading" style={{ color: tint }}>
                        {rig.setupScore}
                      </Txt>
                    </View>

                    {rig.highlights.cpu || rig.highlights.gpu ? (
                      <View style={{ gap: 3 }}>
                        {rig.highlights.cpu ? (
                          <Txt variant="small" tone="dim" numberOfLines={1}>
                            {rig.highlights.cpu}
                          </Txt>
                        ) : null}
                        {rig.highlights.gpu ? (
                          <Txt variant="small" tone="dim" numberOfLines={1}>
                            {rig.highlights.gpu}
                          </Txt>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Txt variant="small" tone="faint" style={{ flex: 1 }} numberOfLines={1}>
                        {rig.status}
                      </Txt>
                      {rig.estimatedFps ? (
                        <Txt variant="small" tone="faint">
                          ~{rig.estimatedFps} FPS
                        </Txt>
                      ) : null}
                      {rig.value ? (
                        <Txt variant="small" tone="faint">
                          · {money(rig.value.total, rig.value.currency)}
                        </Txt>
                      ) : null}
                    </View>
                  </Panel>
                </Animated.View>
              );
            })}
          </View>
        )}
      </View>

      {/* Atividade */}
      {data.events.length > 0 ? (
        <View>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            ATIVIDADE
          </Txt>
          <Panel style={{ paddingVertical: space.xs }}>
            {data.events.map((event, index) => (
              <View key={event.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => router.push(`/events/${event.id}`)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ paddingVertical: space.md, gap: 4 }}>
                    <Txt variant="smallStrong" numberOfLines={2}>
                      {event.title}
                    </Txt>
                    <Txt variant="small" tone="faint">
                      {timeAgo(event.createdAt)}
                      {event.commentCount > 0 ? ` · ${event.commentCount} comentários` : ''}
                    </Txt>
                  </View>
                </Pressable>
              </View>
            ))}
          </Panel>
        </View>
      ) : null}

      {/* Sair fica no fim, discreto: é uma saída, não uma ação principal. */}
      {data.isSelf ? (
        <View style={{ marginTop: space.xxxl, alignItems: 'center' }}>
          <Button label="Sair da conta" variant="ghost" size="sm" onPress={() => void signOut()} />
        </View>
      ) : null}
    </Screen>
  );
}
