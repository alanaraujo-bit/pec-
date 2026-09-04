/**
 * Rankings.
 *
 * Ordenados por Setup Score, equilíbrio ou eficiência — nunca por quanto a máquina custou.
 * O valor aparece como contexto, e é justamente aí que o ranking fica interessante: dá
 * para ver um PC mais barato acima de um mais caro, que é exatamente o argumento do produto.
 */

import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { api } from '../../src/api.ts';
import { Avatar, Empty, ErrorState, Loading, Panel, Screen, Txt } from '../../src/ui.tsx';
import { color, money, radius, space } from '../../src/theme.ts';

interface RankingEntry {
  position: number;
  rigId: string;
  rigName: string;
  owner: { handle: string; displayName: string; avatarUrl: string | null };
  setupScore: number;
  tier: string;
  dimensions: Array<{ dimension: string; score: number }>;
  estimatedValue: number | null;
  currency: string;
  cpu: string | null;
  gpu: string | null;
}

const SCOPES = [
  { key: 'global', label: 'Geral', hint: 'Melhor conjunto, considerando tudo' },
  { key: 'balance', label: 'Equilíbrio', hint: 'Máquinas mais bem casadas' },
  { key: 'efficiency', label: 'Eficiência', hint: 'Mais desempenho por watt' },
  { key: 'following', label: 'Quem eu sigo', hint: 'Só as pessoas que você acompanha' },
] as const;

function medalColor(position: number): string {
  if (position === 1) return '#E5C158';
  if (position === 2) return '#B9C0C9';
  if (position === 3) return '#C98B5E';
  return color.textFaint;
}

export default function Rankings() {
  const router = useRouter();
  const [scope, setScope] = useState<string>('global');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['rankings', scope],
    queryFn: () => api.get<{ scope: string; criterion: string; entries: RankingEntry[] }>(`/rankings?scope=${scope}`),
  });

  const activeScope = SCOPES.find((s) => s.key === scope)!;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.textFaint} />
      }
    >
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Txt variant="title">Ranking</Txt>
      </View>

      {/* Seletor de critério. Cada aba muda o que está sendo medido, e o texto diz qual. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}
        style={{ marginBottom: space.md, marginHorizontal: -space.xl, paddingHorizontal: space.xl }}
      >
        {SCOPES.map((option) => {
          const active = option.key === scope;
          return (
            <Pressable
              key={option.key}
              onPress={() => setScope(option.key)}
              style={({ pressed }) => ({
                backgroundColor: active ? color.accent : color.surface,
                borderColor: active ? color.accent : color.border,
                borderWidth: 1,
                borderRadius: radius.full,
                paddingHorizontal: space.lg,
                paddingVertical: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Txt variant="smallStrong" style={{ color: active ? '#04101F' : color.textDim }}>
                {option.label}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      <Txt variant="small" tone="faint" style={{ marginBottom: space.xl }}>
        {activeScope.hint}. O ranking nunca premia quem gastou mais.
      </Txt>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : data && data.entries.length > 0 ? (
        <Panel style={{ paddingVertical: space.xs }}>
          {data.entries.map((entry, index) => (
            <Animated.View key={entry.rigId} entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}>
              <Pressable
                onPress={() => router.push(`/rigs/${entry.rigId}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingVertical: space.md,
                    borderTopWidth: index > 0 ? 1 : 0,
                    borderTopColor: color.borderSoft,
                  }}
                >
                  <Txt
                    variant="bodyStrong"
                    style={{ width: 24, textAlign: 'center', color: medalColor(entry.position) }}
                  >
                    {entry.position}
                  </Txt>

                  <Avatar name={entry.owner.displayName} size={32} />

                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="smallStrong" numberOfLines={1}>
                      {entry.rigName}
                    </Txt>
                    <Txt variant="small" tone="faint" numberOfLines={1}>
                      {[entry.cpu, entry.gpu].filter(Boolean).join(' · ') || `@${entry.owner.handle}`}
                    </Txt>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt variant="bodyStrong">{entry.setupScore}</Txt>
                    {entry.estimatedValue ? (
                      <Txt variant="small" tone="faint">
                        {money(entry.estimatedValue, entry.currency)}
                      </Txt>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </Panel>
      ) : (
        <Empty
          title="Ranking vazio"
          description={
            scope === 'following'
              ? 'Siga outras pessoas para comparar as máquinas de quem você acompanha.'
              : 'Assim que houver máquinas públicas cadastradas, elas aparecem aqui.'
          }
        />
      )}
    </Screen>
  );
}
