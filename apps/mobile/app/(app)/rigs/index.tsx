/**
 * Meus PCs.
 *
 * Um usuário pode ter várias máquinas — principal, notebook, PC de trabalho, PC antigo —
 * e cada uma tem identidade, saúde e score próprios. A lista mostra o essencial de cada
 * uma sem obrigar a entrar: score, status e as duas peças que definem a máquina.
 */

import { useState } from 'react';
import { Modal, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { api, type RigSummary } from '../../../src/api.ts';
import { Button, Empty, ErrorState, Field, Loading, Panel, Screen, Txt } from '../../../src/ui.tsx';
import { color, radius, space, verdictColor, type Verdict } from '../../../src/theme.ts';

const KIND_LABEL: Record<string, string> = {
  desktop: 'Desktop',
  laptop: 'Notebook',
  'console-pc': 'Console PC',
  server: 'Servidor',
};

function ScoreBadge({ score, verdict }: { score: number; verdict: string }) {
  const tint = verdictColor[verdict as Verdict] ?? color.textDim;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Txt variant="title" style={{ color: tint, letterSpacing: -1 }}>
        {score}
      </Txt>
      <Txt variant="label" tone="faint">
        SCORE
      </Txt>
    </View>
  );
}

function RigCard({ rig, index }: { rig: RigSummary; index: number }) {
  const router = useRouter();
  const tint = verdictColor[rig.verdict as Verdict] ?? color.textDim;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)}>
      <Panel onPress={() => router.push(`/rigs/${rig.id}`)} style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Txt variant="heading" numberOfLines={1}>
                {rig.name}
              </Txt>
              {rig.isPrimary ? (
                <View
                  style={{
                    backgroundColor: color.accentSoft,
                    borderRadius: radius.full,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Txt variant="label" tone="accent">
                    PRINCIPAL
                  </Txt>
                </View>
              ) : null}
            </View>
            <Txt variant="small" tone="faint">
              {KIND_LABEL[rig.kind] ?? rig.kind} · {rig.componentCount}{' '}
              {rig.componentCount === 1 ? 'peça' : 'peças'}
            </Txt>
          </View>
          {rig.componentCount > 0 ? <ScoreBadge score={rig.setupScore} verdict={rig.verdict} /> : null}
        </View>

        {rig.componentCount === 0 ? (
          <Txt variant="small" tone="dim">
            Cadastre as peças para receber o diagnóstico.
          </Txt>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }} />
            <Txt variant="small" tone="dim" style={{ flex: 1 }} numberOfLines={1}>
              {rig.status}
            </Txt>
            {rig.estimatedFps !== null ? (
              <Txt variant="smallStrong" tone="faint">
                ~{rig.estimatedFps} FPS
              </Txt>
            ) : null}
          </View>
        )}
      </Panel>
    </Animated.View>
  );
}

export default function Rigs() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['rigs'],
    queryFn: () => api.get<{ rigs: RigSummary[] }>('/rigs'),
  });

  const create = useMutation({
    mutationFn: (rigName: string) => api.post<{ rig: { id: string } }>('/rigs', { name: rigName }),
    onSuccess: async (result) => {
      setCreating(false);
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['rigs'] });
      // Máquina sem peça não serve para nada: já leva para o cadastro.
      router.push(`/rigs/${result.rig.id}/add`);
    },
  });

  if (isLoading) return <Loading />;

  return (
    <>
      <Screen
        scroll
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.textFaint} />
        }
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: space.md,
            paddingBottom: space.xl,
          }}
        >
          <Txt variant="title">Meus PCs</Txt>
          <Pressable
            onPress={() => setCreating(true)}
            hitSlop={10}
            accessibilityLabel="Adicionar máquina"
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: radius.full,
              backgroundColor: color.raised,
              borderWidth: 1,
              borderColor: color.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Txt variant="subheading" tone="dim">
              +
            </Txt>
          </Pressable>
        </View>

        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : data && data.rigs.length > 0 ? (
          <View style={{ gap: space.md }}>
            {data.rigs.map((rig, index) => (
              <RigCard key={rig.id} rig={rig} index={index} />
            ))}
          </View>
        ) : (
          <Empty
            title="Nenhuma máquina ainda"
            description="Cadastre seu computador para descobrir o que está segurando ele — e quanto ele vale."
            actionLabel="Cadastrar meu PC"
            onAction={() => setCreating(true)}
          />
        )}
      </Screen>

      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable
          onPress={() => setCreating(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: space.xl }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: color.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: color.border,
              padding: space.xl,
              gap: space.xl,
            }}
          >
            <View style={{ gap: space.sm }}>
              <Txt variant="heading">Nova máquina</Txt>
              <Txt variant="small" tone="dim">
                Dê um nome para reconhecer depois.
              </Txt>
            </View>

            <Field
              placeholder="PC Principal"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={40}
              onSubmitEditing={() => name.trim() && create.mutate(name.trim())}
            />

            <View style={{ gap: space.sm }}>
              <Button
                label="Criar"
                onPress={() => create.mutate(name.trim())}
                disabled={name.trim().length === 0}
                loading={create.isPending}
              />
              <Button label="Cancelar" variant="ghost" onPress={() => setCreating(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
