/**
 * Anunciar uma peça do PC.
 *
 * Dois cuidados que definem esta tela:
 *
 * 1. **A faixa vem antes do campo de preço.** O usuário vê quanto a peça vale segundo o
 *    engine e só então escolhe. O caminho inverso — digitar primeiro e ser julgado depois —
 *    transformaria a estimativa numa reprovação.
 *
 * 2. **A tela não calcula nada.** O retorno enquanto se digita vem das faixas que a API
 *    mandou junto do rascunho, com rótulo e explicação já escritos pelo engine. É a mesma
 *    regra que o servidor aplica ao salvar, então a tela nunca desmente o resultado.
 */

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, ApiError, type ListingDraftResponse, type RigDetailResponse } from '../../../../src/api.ts';
import {
  Button,
  Divider,
  ErrorState,
  Field,
  Loading,
  Panel,
  Pill,
  Screen,
  SectionLabel,
  Txt,
} from '../../../../src/ui.tsx';
import { categoryIcon, categoryLabel, color, money, radius, space } from '../../../../src/theme.ts';

const FAIRNESS_TINT: Record<string, string> = {
  'below-range': color.accent,
  'in-range': color.good,
  'above-range': color.medium,
  'far-above-range': color.high,
};

export default function SellPart() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [publishEvent, setPublishEvent] = useState(false);

  const rig = useQuery({
    queryKey: ['rig', id],
    queryFn: () => api.get<RigDetailResponse>(`/rigs/${id}`),
  });

  const draft = useQuery({
    queryKey: ['listing-draft', id, selected],
    queryFn: () => api.get<ListingDraftResponse>(`/rigs/${id}/components/${selected}/listing-draft`),
    enabled: selected !== null,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<{ listing: { id: string } }>('/market', {
        rigComponentId: selected,
        askingPrice: Number(price),
        description: description.trim() || null,
        publishEvent,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['market'] });
      router.replace(`/market/${result.listing.id}`);
    },
  });

  if (rig.isLoading) return <Loading />;
  if (rig.error || !rig.data) {
    return (
      <Screen scroll>
        <ErrorState
          message={(rig.error as Error)?.message ?? 'Erro'}
          onRetry={() => void rig.refetch()}
        />
      </Screen>
    );
  }

  const parts = rig.data.rig.components;
  const numericPrice = Number(price.replace(',', '.'));
  const bands = draft.data?.bands ?? [];
  // A tela só localiza o preço na faixa que o engine mandou; quem julga é o engine.
  const band = bands.find((b) => b.to === null || numericPrice <= b.to) ?? null;
  const tint = band ? (FAIRNESS_TINT[band.fairness] ?? color.textDim) : color.textDim;

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
        <Txt variant="title">Anunciar uma peça</Txt>
        <Txt variant="body" tone="dim">
          Escolha a peça que vai sair de {rig.data.rig.name}. Mostramos quanto ela vale antes de
          você decidir o preço — e a peça só sai da máquina quando a venda for confirmada.
        </Txt>
      </Animated.View>

      <SectionLabel>Peça</SectionLabel>
      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        {parts.map((item) => {
          const active = selected === item.id;
          return (
            <Panel
              key={item.id}
              onPress={() => {
                setSelected(item.id);
                setPrice('');
              }}
              style={{
                borderColor: active ? color.accentDim : color.borderSoft,
                backgroundColor: active ? color.accentSoft : color.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Txt variant="subheading" tone="dim">
                  {categoryIcon[item.component.category] ?? '▢'}
                </Txt>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {item.component.fullName}
                  </Txt>
                  <Txt variant="small" tone="faint">
                    {categoryLabel[item.component.category] ?? item.component.category}
                  </Txt>
                </View>
                {active ? <Pill label="Selecionada" tint={color.accent} /> : null}
              </View>
            </Panel>
          );
        })}
      </View>

      {selected ? (
        draft.isLoading ? (
          <Loading label="Calculando quanto vale" />
        ) : draft.data?.alreadyListed ? (
          <Panel style={{ gap: space.md }}>
            <Txt variant="bodyStrong">Esta peça já está anunciada</Txt>
            <Txt variant="small" tone="dim">
              Uma peça tem um anúncio aberto de cada vez. Abra o anúncio existente para mudar o
              preço ou retirá-lo do ar.
            </Txt>
            <Button
              label="Abrir o anúncio"
              size="sm"
              onPress={() => router.push(`/market/${draft.data!.alreadyListed!.id}`)}
            />
          </Panel>
        ) : draft.data?.draft ? (
          <Animated.View entering={FadeInDown.duration(320)} style={{ gap: space.xl }}>
            <Panel style={{ gap: space.md }}>
              <Txt variant="label" tone="faint">
                FAIXA ESTIMADA
              </Txt>
              <Txt variant="title">
                {money(draft.data.draft.guidance.suggestedLow, draft.data.draft.guidance.currency)} a{' '}
                {money(draft.data.draft.guidance.suggestedHigh, draft.data.draft.guidance.currency)}
              </Txt>
              <Divider />
              <Txt variant="small" tone="dim">
                {draft.data.draft.guidance.note} Costuma sair rápido a partir de{' '}
                {money(draft.data.draft.guidance.quickSale, draft.data.draft.guidance.currency)}.
              </Txt>
            </Panel>

            <Field
              label="Seu preço"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder={String(draft.data.draft.guidance.suggestedLow)}
              hint="Você decide. A faixa é referência, não regra."
            />

            {price.length > 0 && numericPrice > 0 && band ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: space.md,
                  padding: space.lg,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: color.borderSoft,
                }}
              >
                <View style={{ width: 6, borderRadius: 3, backgroundColor: tint }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="smallStrong" style={{ color: tint }}>
                    {band.label}
                  </Txt>
                  <Txt variant="small" tone="dim">
                    {band.note}
                  </Txt>
                </View>
              </View>
            ) : null}

            <Field
              label="Detalhes (opcional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Nota fiscal, tempo de uso, motivo da venda…"
              multiline
              numberOfLines={3}
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />

            {/* Consentimento, do mesmo jeito que na troca de peça: o padrão é não publicar. */}
            <Pressable onPress={() => setPublishEvent((v) => !v)}>
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: publishEvent ? color.accent : color.border,
                    backgroundColor: publishEvent ? color.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {publishEvent ? (
                    <Txt variant="smallStrong" style={{ color: '#04101F' }}>
                      ✓
                    </Txt>
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="bodyStrong">Contar no meu perfil</Txt>
                  <Txt variant="small" tone="faint">
                    Publica um evento avisando que você está vendendo. Desmarcado, o anúncio
                    aparece só no mercado.
                  </Txt>
                </View>
              </View>
            </Pressable>

            {create.error ? (
              <Txt variant="small" style={{ color: color.critical }}>
                {(create.error as ApiError).message}
              </Txt>
            ) : null}

            <Button
              label="Publicar anúncio"
              disabled={!(numericPrice > 0)}
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
          </Animated.View>
        ) : (
          <Panel style={{ gap: space.sm }}>
            <Txt variant="bodyStrong">Sem preço de referência</Txt>
            <Txt variant="small" tone="dim">
              {draft.data?.unpricedReason ??
                'Não temos preço de referência para esta peça no catálogo.'}{' '}
              Preferimos dizer isso a inventar uma faixa — você ainda pode vendê-la fora do app.
            </Txt>
          </Panel>
        )
      ) : null}
    </Screen>
  );
}
