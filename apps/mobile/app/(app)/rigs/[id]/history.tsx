/**
 * Evolução e memória do PC.
 *
 * Duas leituras da mesma história:
 *  - a linha de trocas de peça (o "RTX 3070 → RTX 3090 Ti" que o produto promete);
 *  - a curva do Setup Score ao longo do tempo, que mostra se as decisões deram certo.
 *
 * É isso que transforma o app em memória viva da máquina, e não num cadastro estático.
 */

import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { api } from '../../../../src/api.ts';
import { Divider, Empty, ErrorState, Loading, Panel, Screen, Txt } from '../../../../src/ui.tsx';
import { categoryLabel, color, money, radius, space, verdictColor, type Verdict } from '../../../../src/theme.ts';

interface HistoryResponse {
  snapshots: Array<{
    id: string;
    at: string;
    setupScore: number;
    verdict: string;
    estimatedFps: number | null;
    valueTotal: number | null;
    trigger: string;
    summary: { headline?: string; topFinding?: { what: string; severity: string } | null };
  }>;
  evolution: Array<{
    at: string;
    category: string;
    from: { name: string; model: string; usedFor: number | null } | null;
    to: { name: string; model: string };
    paidAmount: number | null;
    paidCurrency: string | null;
  }>;
}

const TRIGGER_LABEL: Record<string, string> = {
  created: 'Máquina cadastrada',
  'component-added': 'Peça adicionada',
  'component-replaced': 'Peça trocada',
  'component-removed': 'Peça removida',
  'profile-changed': 'Perfil de uso alterado',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['history', id],
    queryFn: () => api.get<HistoryResponse>(`/rigs/${id}/history`),
  });

  if (isLoading) return <Loading />;
  if (error || !data) {
    return (
      <Screen scroll>
        <ErrorState message={(error as Error)?.message ?? 'Erro'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  // Mais recente primeiro: é o que a pessoa quer ver ao abrir.
  const snapshots = [...data.snapshots].reverse();
  const maxScore = Math.max(...data.snapshots.map((s) => s.setupScore), 100);

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Txt variant="smallStrong" tone="faint">
            ← Voltar
          </Txt>
        </Pressable>
      </View>

      <Txt variant="title" style={{ marginBottom: space.xxl }}>
        Evolução
      </Txt>

      {/* Curva do score. Barras simples: um gráfico completo aqui seria enfeite. */}
      {data.snapshots.length >= 2 ? (
        <View style={{ marginBottom: space.xxl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            SETUP SCORE AO LONGO DO TEMPO
          </Txt>
          <Panel style={{ gap: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 }}>
              {data.snapshots.map((snapshot) => {
                const tint = verdictColor[snapshot.verdict as Verdict] ?? color.textDim;
                return (
                  <View
                    key={snapshot.id}
                    style={{
                      flex: 1,
                      height: `${Math.max(6, (snapshot.setupScore / maxScore) * 100)}%`,
                      backgroundColor: tint,
                      opacity: 0.75,
                      borderRadius: 3,
                      minWidth: 6,
                    }}
                  />
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="small" tone="faint">
                {data.snapshots[0]!.setupScore} no começo
              </Txt>
              <Txt variant="smallStrong" style={{ color: color.good }}>
                {data.snapshots[data.snapshots.length - 1]!.setupScore} agora
              </Txt>
            </View>
          </Panel>
        </View>
      ) : null}

      {/* A linha de trocas — o PC Evolution do produto. */}
      {data.evolution.length > 0 ? (
        <View style={{ marginBottom: space.xxl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            TROCAS DE PEÇA
          </Txt>
          <View style={{ gap: space.md }}>
            {[...data.evolution].reverse().map((step, index) => (
              <Animated.View key={`${step.at}-${index}`} entering={FadeInDown.delay(index * 60).duration(320)}>
                <Panel style={{ gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Txt variant="label" tone="faint" style={{ flex: 1 }}>
                      {(categoryLabel[step.category] ?? step.category).toUpperCase()}
                    </Txt>
                    <Txt variant="small" tone="faint">
                      {formatDate(step.at)}
                    </Txt>
                  </View>

                  {/* Antes → depois, na vertical: lê como uma linha do tempo. */}
                  <View style={{ gap: space.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          borderWidth: 1.5,
                          borderColor: color.textFaint,
                        }}
                      />
                      <Txt variant="small" tone="faint" style={{ flex: 1 }} numberOfLines={1}>
                        {step.from?.model}
                      </Txt>
                      {step.from?.usedFor ? (
                        <Txt variant="small" tone="faint">
                          {step.from.usedFor > 365
                            ? `${Math.round(step.from.usedFor / 365)} ano(s)`
                            : `${step.from.usedFor} dias`}
                        </Txt>
                      ) : null}
                    </View>

                    {/* Conector alinhado ao centro dos marcadores (7px de largura). */}
                    <View style={{ width: 7, height: 12, alignItems: 'center' }}>
                      <View style={{ width: 1, flex: 1, backgroundColor: color.border }} />
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.accent }} />
                      <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                        {step.to.model}
                      </Txt>
                      {step.paidAmount ? (
                        <Txt variant="small" tone="faint">
                          {money(step.paidAmount, step.paidCurrency ?? 'BRL')}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                </Panel>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Histórico de inteligência: o que o sistema pensava a cada momento. */}
      <View>
        <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
          HISTÓRICO DE ANÁLISES
        </Txt>

        {snapshots.length === 0 ? (
          <Empty
            title="Sem histórico ainda"
            description="Conforme você cadastra e troca peças, o Pecê guarda o que mudou e o que ele achava a cada momento."
          />
        ) : (
          <Panel style={{ paddingVertical: space.xs }}>
            {snapshots.map((snapshot, index) => {
              const tint = verdictColor[snapshot.verdict as Verdict] ?? color.textDim;
              const previous = snapshots[index + 1];
              const delta = previous ? snapshot.setupScore - previous.setupScore : null;

              return (
                <View key={snapshot.id}>
                  {index > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
                    <View style={{ paddingTop: 5 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tint }} />
                    </View>

                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <Txt variant="smallStrong" style={{ flex: 1 }}>
                          {TRIGGER_LABEL[snapshot.trigger] ?? snapshot.trigger}
                        </Txt>
                        <Txt variant="smallStrong" tone="dim">
                          {snapshot.setupScore}
                        </Txt>
                        {delta !== null && delta !== 0 ? (
                          <View
                            style={{
                              backgroundColor: delta > 0 ? color.goodSoft : color.criticalSoft,
                              borderRadius: radius.full,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                            }}
                          >
                            <Txt
                              variant="label"
                              style={{ color: delta > 0 ? color.good : color.critical }}
                            >
                              {delta > 0 ? '+' : ''}
                              {delta}
                            </Txt>
                          </View>
                        ) : null}
                      </View>

                      {snapshot.summary?.topFinding ? (
                        <Txt variant="small" tone="faint" numberOfLines={1}>
                          {snapshot.summary.topFinding.what}
                        </Txt>
                      ) : (
                        <Txt variant="small" tone="faint">
                          Sem pendências
                        </Txt>
                      )}

                      <Txt variant="small" tone="faint">
                        {formatDate(snapshot.at)}
                        {snapshot.estimatedFps ? ` · ~${snapshot.estimatedFps} FPS` : ''}
                      </Txt>
                    </View>
                  </View>
                </View>
              );
            })}
          </Panel>
        )}
      </View>
    </Screen>
  );
}
