/**
 * Detalhe do anúncio.
 *
 * A tela mostra o preço pedido e, logo abaixo, onde ele cai dentro da faixa estimada —
 * a mesma faixa para o vendedor e para o comprador. É o oposto de um classificado, onde
 * só o vendedor sabe se o preço é bom.
 *
 * Quando é o próprio anúncio, as ações de manutenção aparecem aqui mesmo: reservar,
 * marcar vendida, retirar do ar. Marcar vendida remove a peça da máquina — e a tela avisa
 * isso antes, porque é uma mudança no PC, não só no anúncio.
 */

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type ListingDetail } from '../../../src/api.ts';
import {
  Button,
  Divider,
  ErrorState,
  Loading,
  Panel,
  Pill,
  Screen,
  Txt,
} from '../../../src/ui.tsx';
import { categoryLabel, color, money, radius, space } from '../../../src/theme.ts';

const CONDITION_LABEL: Record<string, string> = {
  new: 'Novo',
  'like-new': 'Seminovo',
  used: 'Usado',
  worn: 'Bem usado',
};

const FAIRNESS_TINT: Record<string, string> = {
  'below-range': color.accent,
  'in-range': color.good,
  'above-range': color.medium,
  'far-above-range': color.high,
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Anunciada',
  reserved: 'Reservada',
  sold: 'Vendida',
  withdrawn: 'Retirada',
};

/**
 * Onde o preço pedido cai dentro da faixa.
 *
 * É desenho, não cálculo: a posição vem dos números que o servidor mandou. A tela não
 * decide se o preço é justo — ela mostra o que o engine já decidiu.
 */
function PriceScale({
  asking,
  low,
  high,
  tint,
}: {
  asking: number;
  low: number;
  high: number;
  tint: string;
}) {
  // A régua vai de um pouco antes da faixa até um pouco depois, para a faixa ter tamanho.
  const from = Math.min(low * 0.7, asking * 0.95);
  const to = Math.max(high * 1.35, asking * 1.05);
  const pos = (v: number) => Math.max(0, Math.min(1, (v - from) / (to - from)));

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: color.raised }}>
        <View
          style={{
            position: 'absolute',
            left: `${pos(low) * 100}%`,
            width: `${(pos(high) - pos(low)) * 100}%`,
            height: 8,
            borderRadius: 4,
            backgroundColor: color.goodSoft,
            borderWidth: 1,
            borderColor: color.good,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: `${pos(asking) * 100}%`,
            marginLeft: -5,
            top: -3,
            width: 10,
            height: 14,
            borderRadius: 3,
            backgroundColor: tint,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt variant="small" tone="faint">
          {money(low)}
        </Txt>
        <Txt variant="small" tone="faint">
          faixa estimada
        </Txt>
        <Txt variant="small" tone="faint">
          {money(high)}
        </Txt>
      </View>
    </View>
  );
}

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmingSale, setConfirmingSale] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => api.get<ListingDetail>(`/market/${id}`),
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/market/${id}`, body),
    onSuccess: async () => {
      setConfirmingSale(false);
      await queryClient.invalidateQueries({ queryKey: ['listing', id] });
      await queryClient.invalidateQueries({ queryKey: ['market'] });
      await queryClient.invalidateQueries({ queryKey: ['rigs'] });
    },
  });

  const withdraw = useMutation({
    mutationFn: () => api.del(`/market/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['market'] });
      router.back();
    },
  });

  if (isLoading) return <Loading />;
  if (error || !data) {
    return (
      <Screen scroll>
        <ErrorState message={(error as Error)?.message ?? 'Erro'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const { listing, isSeller } = data;
  const assessment = listing.priceAssessment;
  const tint = assessment ? (FAIRNESS_TINT[assessment.fairness] ?? color.textDim) : color.textDim;

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Txt variant="smallStrong" tone="faint">
            ← Voltar
          </Txt>
        </Pressable>
      </View>

      <Animated.View entering={FadeIn.duration(300)} style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Pill label={categoryLabel[listing.component.category] ?? listing.component.category} />
          {listing.status !== 'active' ? (
            <Pill
              label={STATUS_LABEL[listing.status] ?? listing.status}
              tint={listing.status === 'sold' ? color.textFaint : color.medium}
            />
          ) : null}
        </View>
        <Txt variant="title">{listing.component.fullName}</Txt>
        <Txt variant="small" tone="faint">
          {CONDITION_LABEL[listing.condition] ?? listing.condition} · lançamento{' '}
          {listing.component.releaseYear} · de @{listing.seller.handle}
        </Txt>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ marginTop: space.xl }}>
        <Panel style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <Txt variant="display">{money(listing.askingPrice, listing.currency)}</Txt>
            {assessment ? (
              <Txt variant="small" style={{ color: tint }}>
                {assessment.deltaPercent > 0 ? '+' : ''}
                {assessment.deltaPercent}% vs. estimativa
              </Txt>
            ) : null}
          </View>

          {assessment ? (
            <>
              <PriceScale
                asking={listing.askingPrice}
                low={assessment.suggestedLow}
                high={assessment.suggestedHigh}
                tint={tint}
              />
              <Divider />
              <Txt variant="small" tone="dim">
                {assessment.note}
              </Txt>
            </>
          ) : (
            <Txt variant="small" tone="dim">
              Não temos preço de referência para esta peça no catálogo, então não dá para dizer
              se este valor está alto ou baixo. Preferimos admitir isso a chutar uma faixa.
            </Txt>
          )}
        </Panel>
      </Animated.View>

      {listing.description ? (
        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={{ marginTop: space.lg }}>
          <Panel>
            <Txt variant="body" tone="dim">
              {listing.description}
            </Txt>
          </Panel>
        </Animated.View>
      ) : null}

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        {isSeller ? (
          <>
            {listing.status === 'sold' ? (
              <Panel style={{ gap: space.sm }}>
                <Txt variant="bodyStrong">Peça vendida</Txt>
                <Txt variant="small" tone="dim">
                  Ela saiu da análise da máquina e ficou registrada na evolução do seu PC. A
                  história não some — só o hardware.
                </Txt>
              </Panel>
            ) : confirmingSale ? (
              <Panel style={{ gap: space.md, borderColor: color.border }}>
                <Txt variant="bodyStrong">Marcar como vendida?</Txt>
                <Txt variant="small" tone="dim">
                  A peça sai da máquina e o diagnóstico é recalculado sem ela. Isso não pode ser
                  desfeito — mas a peça continua na evolução do seu PC.
                </Txt>
                <Button
                  label="Vendi, e quero contar no meu perfil"
                  size="sm"
                  loading={update.isPending}
                  onPress={() =>
                    update.mutate({ status: 'sold', removeFromRig: true, publishEvent: true })
                  }
                />
                <Button
                  label="Vendi, sem publicar nada"
                  variant="secondary"
                  size="sm"
                  loading={update.isPending}
                  onPress={() =>
                    update.mutate({ status: 'sold', removeFromRig: true, publishEvent: false })
                  }
                />
                <Button
                  label="Cancelar"
                  variant="ghost"
                  size="sm"
                  onPress={() => setConfirmingSale(false)}
                />
              </Panel>
            ) : (
              <>
                <Button label="Marcar como vendida" onPress={() => setConfirmingSale(true)} />
                <Button
                  label={listing.status === 'reserved' ? 'Voltar a anunciar' : 'Marcar como reservada'}
                  variant="secondary"
                  loading={update.isPending}
                  onPress={() =>
                    update.mutate({ status: listing.status === 'reserved' ? 'active' : 'reserved' })
                  }
                />
                <Button
                  label="Retirar do ar"
                  variant="danger"
                  loading={withdraw.isPending}
                  onPress={() => withdraw.mutate()}
                />
              </>
            )}
          </>
        ) : (
          <Button
            label={`Ver o perfil de @${listing.seller.handle}`}
            variant="secondary"
            onPress={() => router.push(`/profile?handle=${listing.seller.handle}`)}
          />
        )}
      </View>

      <View
        style={{
          marginTop: space.xxl,
          padding: space.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.borderSoft,
        }}
      >
        <Txt variant="small" tone="faint">
          O Pecê aproxima as pessoas e diz o que a peça vale. A negociação e o pagamento
          acontecem entre vocês, fora do app — e é assim de propósito: não temos como garantir
          uma transação que não passa por aqui.
        </Txt>
      </View>
    </Screen>
  );
}
