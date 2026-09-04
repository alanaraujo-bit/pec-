/**
 * Detalhe da máquina: as peças, o valor e os atalhos para diagnóstico e evolução.
 */

import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type Diagnosis, type SetupScore } from '../../../../src/api.ts';
import { Button, Divider, ErrorState, Loading, Panel, Pill, Screen, Txt } from '../../../../src/ui.tsx';
import {
  categoryIcon,
  categoryLabel,
  color,
  money,
  radius,
  space,
  verdictColor,
  type Verdict,
} from '../../../../src/theme.ts';

interface RigDetail {
  rig: {
    id: string;
    name: string;
    kind: string;
    isPrimary: boolean;
    visibility: string;
    showValue: boolean;
    owner: { id: string; handle: string; displayName: string };
    components: Array<{
      id: string;
      quantity: number;
      condition: string;
      component: {
        id: string;
        category: string;
        brand: string;
        model: string;
        fullName: string;
        releaseYear: number;
      };
    }>;
  };
  score: SetupScore;
  diagnosis: Diagnosis;
  value: { total: number; rangeLow: number; rangeHigh: number; currency: string } | null;
  isOwner: boolean;
}

/** Ordem de exibição: as peças que definem a máquina primeiro, periféricos por último. */
const CATEGORY_ORDER = [
  'CPU',
  'GPU',
  'MOTHERBOARD',
  'RAM',
  'STORAGE',
  'PSU',
  'COOLER',
  'CASE',
  'FAN',
  'MONITOR',
  'KEYBOARD',
  'MOUSE',
  'HEADSET',
  'MICROPHONE',
  'WEBCAM',
  'MOUSEPAD',
  'CONTROLLER',
];

export default function RigDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rig', id],
    queryFn: () => api.get<RigDetail>(`/rigs/${id}`),
  });

  const remove = useMutation({
    mutationFn: (rigComponentId: string) => api.del(`/rigs/${id}/components/${rigComponentId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rig', id] });
      await queryClient.invalidateQueries({ queryKey: ['intelligence', id] });
      await queryClient.invalidateQueries({ queryKey: ['rigs'] });
    },
  });

  const toggleValueVisibility = useMutation({
    mutationFn: (showValue: boolean) => api.patch(`/rigs/${id}`, { showValue }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rig', id] }),
  });

  if (isLoading) return <Loading />;
  if (error || !data) {
    return (
      <Screen scroll>
        <ErrorState message={(error as Error)?.message ?? 'Erro'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const { rig, score, diagnosis, value, isOwner } = data;
  const tint = verdictColor[diagnosis.verdict as Verdict] ?? color.textDim;
  const hasComponents = rig.components.length > 0;

  const sorted = [...rig.components].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.component.category) - CATEGORY_ORDER.indexOf(b.component.category),
  );

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Txt variant="smallStrong" tone="faint">
            ← Voltar
          </Txt>
        </Pressable>
      </View>

      <Animated.View entering={FadeIn.duration(300)} style={{ gap: space.sm, marginBottom: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Txt variant="title" style={{ flex: 1 }}>
            {rig.name}
          </Txt>
          {rig.isPrimary ? <Pill label="Principal" tint={color.accent} background={color.accentSoft} /> : null}
        </View>
        {!isOwner ? (
          <Txt variant="small" tone="faint">
            de @{rig.owner.handle}
          </Txt>
        ) : null}
      </Animated.View>

      {hasComponents ? (
        <>
          {/* Bloco de diagnóstico: leva para a tela que importa. */}
          <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ marginBottom: space.xl }}>
            <Pressable
              onPress={() => router.push(`/rigs/${id}/intelligence`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <View
                style={{
                  backgroundColor: color.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: color.borderSoft,
                  padding: space.lg,
                  gap: space.md,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="label" tone="faint">
                      SETUP SCORE
                    </Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                      <Txt variant="display" style={{ color: tint }}>
                        {score.total}
                      </Txt>
                      <Txt variant="small" tone="faint">
                        de 100
                      </Txt>
                    </View>
                  </View>
                  {diagnosis.performance.fps ? (
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Txt variant="label" tone="faint">
                        FPS ESTIMADO
                      </Txt>
                      <Txt variant="title">{diagnosis.performance.fps.fps}</Txt>
                    </View>
                  ) : null}
                </View>

                <Divider />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }} />
                  <Txt variant="small" tone="dim" style={{ flex: 1 }} numberOfLines={2}>
                    {diagnosis.headline}
                  </Txt>
                  <Txt variant="smallStrong" tone="accent">
                    Ver
                  </Txt>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Valor estimado. Sempre como faixa, nunca como número exato. */}
          {value ? (
            <Animated.View entering={FadeInDown.delay(120).duration(320)} style={{ marginBottom: space.xl }}>
              <Panel style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Txt variant="label" tone="faint" style={{ flex: 1 }}>
                    VALOR ESTIMADO
                  </Txt>
                  {isOwner ? (
                    <Pressable
                      onPress={() => toggleValueVisibility.mutate(!rig.showValue)}
                      hitSlop={8}
                    >
                      <Txt variant="label" tone={rig.showValue ? 'accent' : 'faint'}>
                        {rig.showValue ? 'PÚBLICO' : 'PRIVADO'}
                      </Txt>
                    </Pressable>
                  ) : null}
                </View>

                <Txt variant="title">{money(value.total, value.currency)}</Txt>

                <Txt variant="small" tone="faint">
                  Faixa realista: {money(value.rangeLow, value.currency)} a{' '}
                  {money(value.rangeHigh, value.currency)}. É uma estimativa a partir das suas peças,
                  da idade e do mercado — não uma avaliação.
                </Txt>
              </Panel>
            </Animated.View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
            <Button
              label="Ver evolução"
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => router.push(`/rigs/${id}/history`)}
            />
            {isOwner ? (
              <Button
                label="Adicionar peça"
                size="sm"
                style={{ flex: 1 }}
                onPress={() => router.push(`/rigs/${id}/add`)}
              />
            ) : null}
          </View>

          <Button
            label="Comparar com outro PC"
            variant="secondary"
            size="sm"
            style={{ marginBottom: space.xxl }}
            onPress={() => router.push(`/compare?left=${id}`)}
          />
        </>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: space.xxl, gap: space.lg }}>
          <Panel style={{ gap: space.md }}>
            <Txt variant="subheading">Cadastre as peças</Txt>
            <Txt variant="body" tone="dim">
              Com processador e placa de vídeo já dá para começar a análise. Quanto mais peças,
              mais preciso fica o diagnóstico.
            </Txt>
            <Button label="Adicionar peça" onPress={() => router.push(`/rigs/${id}/add`)} />
          </Panel>
        </Animated.View>
      )}

      {hasComponents ? (
        <View style={{ marginBottom: space.xl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            PEÇAS ({rig.components.length})
          </Txt>

          <Panel style={{ paddingVertical: space.xs }}>
            {sorted.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingVertical: space.md,
                  }}
                >
                  <Txt variant="body" tone="faint" style={{ width: 20, textAlign: 'center' }}>
                    {categoryIcon[item.component.category] ?? '·'}
                  </Txt>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="smallStrong" numberOfLines={1}>
                      {item.quantity > 1 ? `${item.quantity}× ` : ''}
                      {item.component.model}
                    </Txt>
                    <Txt variant="small" tone="faint">
                      {categoryLabel[item.component.category] ?? item.component.category} ·{' '}
                      {item.component.brand}
                    </Txt>
                  </View>

                  {isOwner ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      {/* Trocar preserva a peça antiga no histórico; remover não. */}
                      <Pressable
                        onPress={() =>
                          router.push(
                            `/rigs/${id}/add?replaces=${item.id}` +
                              `&replacesName=${encodeURIComponent(item.component.model)}` +
                              `&replacesCategory=${item.component.category}`,
                          )
                        }
                        hitSlop={8}
                        accessibilityLabel={`Trocar ${item.component.model}`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
                      >
                        <Txt variant="small" tone="accent">
                          trocar
                        </Txt>
                      </Pressable>

                      <Pressable
                        onPress={() => remove.mutate(item.id)}
                        hitSlop={8}
                        accessibilityLabel={`Remover ${item.component.model}`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
                      >
                        <Txt variant="small" tone="faint">
                          ✕
                        </Txt>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </Panel>
        </View>
      ) : null}
    </Screen>
  );
}
