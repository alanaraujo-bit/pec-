/**
 * Home.
 *
 * Duas camadas, nesta ordem: primeiro o que o PC do próprio usuário precisa dizer a ele,
 * depois o que está acontecendo no mundo dos PCs.
 *
 * A tira de inteligência pessoal no topo é o que faz o app parecer vivo ao abrir sem
 * copiar a lógica de rede social de maximizar tempo de tela — ela responde "e o meu PC?",
 * que é a pergunta que trouxe a pessoa aqui.
 */

import { useCallback } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type FeedEvent, type FeedResponse } from '../../src/api.ts';
import { Avatar, Divider, Empty, ErrorState, Loading, Pill, Screen, Txt } from '../../src/ui.tsx';
import { ReactionControl, type ReactionKind } from '../../src/components/ReactionControl.tsx';
import { color, radius, severityColor, space, timeAgo, verdictColor, type Severity, type Verdict } from '../../src/theme.ts';

const EVENT_LABEL: Record<string, string> = {
  UPGRADE: 'Upgrade',
  BUILD: 'Montagem',
  BENCHMARK: 'Benchmark',
  MAINTENANCE: 'Manutenção',
  PURCHASE: 'Compra',
  SALE: 'Venda',
  SETUP: 'Setup',
  ACHIEVEMENT: 'Conquista',
  MILESTONE: 'Marco',
  DISCUSSION: 'Discussão',
};

/**
 * Tira de inteligência pessoal.
 *
 * Discreta de propósito: uma linha de status, não um painel. Quando o PC está saudável
 * ela precisa transmitir tranquilidade — não pode parecer um alerta desligado.
 */
function PersonalStrip({ personal }: { personal: NonNullable<FeedResponse['personal']> }) {
  const router = useRouter();
  const tint = verdictColor[personal.verdict as Verdict] ?? color.textDim;
  const healthy = personal.verdict === 'healthy';

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Pressable
        onPress={() => router.push(`/rigs/${personal.rigId}/intelligence`)}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: color.borderSoft,
            backgroundColor: color.surface,
            padding: space.lg,
            gap: space.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {/* Ponto de status: o sinal mais barato que existe, e o mais legível. */}
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tint }} />
            <Txt variant="label" tone="faint">
              {personal.rigName.toUpperCase()}
            </Txt>
            <View style={{ flex: 1 }} />
            <Txt variant="label" style={{ color: tint }}>
              {personal.setupScore}
            </Txt>
          </View>

          <Txt variant="subheading" style={{ lineHeight: 23 }}>
            {healthy ? 'Seu PC está equilibrado.' : personal.topFinding?.what ?? personal.status}
          </Txt>

          <Txt variant="small" tone="dim">
            {healthy
              ? 'Nada a fazer agora. Toque para ver o diagnóstico completo.'
              : 'Toque para entender o porquê e ver as opções.'}
          </Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function EventCard({ event, index }: { event: FeedEvent; index: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const react = useMutation({
    mutationFn: (kind: ReactionKind | null) =>
      kind ? api.put(`/events/${event.id}/reaction`, { kind }) : api.del(`/events/${event.id}/reaction`),
    // Atualização otimista: a reação precisa parecer instantânea, e a rede pode demorar.
    onMutate: async (kind) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previous = queryClient.getQueryData<FeedResponse>(['feed']);

      queryClient.setQueryData<FeedResponse>(['feed'], (old) => {
        if (!old) return old;
        return {
          ...old,
          events: old.events.map((e) => {
            if (e.id !== event.id) return e;
            const counts = { ...e.reactions };
            if (e.viewerReaction) counts[e.viewerReaction] -= 1;
            if (kind) counts[kind] += 1;
            return { ...e, reactions: counts, viewerReaction: kind };
          }),
        };
      });

      return { previous };
    },
    onError: (_err, _kind, context) => {
      if (context?.previous) queryClient.setQueryData(['feed'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  const payload = event.payload as { from?: string; to?: string; scoreDelta?: number } | null;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 45).duration(320)}>
      <View style={{ paddingVertical: space.lg, gap: space.md }}>
        {/* Cabeçalho: quem, o quê, quando. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Pressable onPress={() => router.push(`/profile?handle=${event.author.handle}`)}>
            <Avatar name={event.author.displayName} size={34} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt variant="bodyStrong" numberOfLines={1}>
                {event.author.displayName}
              </Txt>
              <Txt variant="small" tone="faint">
                @{event.author.handle}
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <Txt variant="small" tone="faint">
                {EVENT_LABEL[event.kind] ?? event.kind}
              </Txt>
              <Txt variant="small" tone="faint">
                ·
              </Txt>
              <Txt variant="small" tone="faint">
                {timeAgo(event.createdAt)}
              </Txt>
            </View>
          </View>
        </View>

        <Txt variant="subheading" style={{ lineHeight: 23 }}>
          {event.title}
        </Txt>

        {event.body ? (
          <Txt variant="body" tone="dim">
            {event.body}
          </Txt>
        ) : null}

        {/*
          Quando o evento é uma troca de peça, mostramos a transição de forma estruturada.
          É o que diferencia este feed de uma rede social genérica: o acontecimento tem forma.
        */}
        {payload?.from && payload?.to ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              backgroundColor: color.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.borderSoft,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
            }}
          >
            <View style={{ flex: 1 }}>
              <Txt variant="small" tone="faint" numberOfLines={1}>
                {payload.from}
              </Txt>
            </View>
            <Txt variant="small" tone="accent">
              →
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt variant="smallStrong" numberOfLines={1}>
                {payload.to}
              </Txt>
            </View>
            {typeof payload.scoreDelta === 'number' && payload.scoreDelta !== 0 ? (
              <Pill
                label={`${payload.scoreDelta > 0 ? '+' : ''}${payload.scoreDelta}`}
                tint={payload.scoreDelta > 0 ? color.good : color.textDim}
              />
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl, marginTop: 2 }}>
          <ReactionControl
            current={event.viewerReaction}
            counts={event.reactions}
            onReact={(kind) => react.mutate(kind)}
            onClear={() => react.mutate(null)}
          />
          <Pressable
            onPress={() => router.push(`/events/${event.id}`)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Txt variant="smallStrong" tone="faint">
              {event.commentCount > 0 ? `${event.commentCount} comentários` : 'Comentar'}
            </Txt>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function Home() {
  const router = useRouter();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get<FeedResponse>('/feed'),
  });

  const onRefresh = useCallback(() => void refetch(), [refetch]);

  if (isLoading) return <Loading label="Carregando" />;

  if (error) {
    return (
      <Screen scroll>
        <ErrorState message={(error as Error).message} onRetry={onRefresh} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={color.textFaint} />
      }
    >
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Txt variant="title">Início</Txt>
      </View>

      {data?.personal ? (
        <View style={{ marginBottom: space.xl }}>
          <PersonalStrip personal={data.personal} />
        </View>
      ) : (
        <View style={{ marginBottom: space.xl }}>
          <Empty
            title="Cadastre seu PC"
            description="Com as peças cadastradas, o Pecê diz o que está segurando sua máquina — e o que não vale a pena trocar."
            actionLabel="Começar"
            onAction={() => router.push('/rigs')}
          />
        </View>
      )}

      {data && data.events.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.xs }}>
            ACONTECENDO
          </Txt>
          {data.events.map((event, index) => (
            <View key={event.id}>
              <Divider />
              <EventCard event={event} index={index} />
            </View>
          ))}
        </>
      ) : (
        <Empty
          title="Ainda está quieto por aqui"
          description="Siga outras pessoas ou publique o seu primeiro acontecimento para o feed ganhar vida."
        />
      )}
    </Screen>
  );
}
