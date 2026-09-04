/**
 * Mercado — peças anunciadas por quem realmente usou.
 *
 * A diferença desta tela para um classificado qualquer está numa coisa só: cada anúncio
 * mostra, ao lado do preço, como aquele preço se compara à faixa que o engine estima para
 * a peça. Isso vale para o anúncio dos outros e para o seu — o Pecê não protege vendedor.
 */

import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type Listing, type MarketResponse } from '../../../src/api.ts';
import { Divider, Empty, ErrorState, Loading, Panel, Pill, Screen, Txt } from '../../../src/ui.tsx';
import {
  categoryIcon,
  categoryLabel,
  color,
  money,
  radius,
  space,
} from '../../../src/theme.ts';

/** As categorias que de fato circulam no mercado de usados. Não é o catálogo inteiro. */
const FILTERS = ['GPU', 'CPU', 'RAM', 'STORAGE', 'MOTHERBOARD', 'PSU', 'MONITOR'] as const;

/**
 * Cor da leitura de preço.
 *
 * Verde é reservado no produto para "está tudo bem" — aqui ele marca o preço dentro da
 * faixa, que é exatamente isso. Preço alto usa a escala de severidade, sem virar acusação.
 */
const FAIRNESS_TINT: Record<string, string> = {
  'below-range': color.accent,
  'in-range': color.good,
  'above-range': color.medium,
  'far-above-range': color.high,
};

const FAIRNESS_LABEL: Record<string, string> = {
  'below-range': 'Abaixo da faixa',
  'in-range': 'Na faixa',
  'above-range': 'Acima da faixa',
  'far-above-range': 'Bem acima',
};

function ListingRow({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const fairness = listing.priceAssessment?.fairness;

  return (
    <Panel onPress={onPress} style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.sm,
            backgroundColor: color.raised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt variant="subheading" tone="dim">
            {categoryIcon[listing.component.category] ?? '▢'}
          </Txt>
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Txt variant="bodyStrong" numberOfLines={2}>
            {listing.component.fullName}
          </Txt>
          <Txt variant="small" tone="faint">
            {categoryLabel[listing.component.category] ?? listing.component.category} · @
            {listing.seller.handle}
          </Txt>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Txt variant="mono">{money(listing.askingPrice, listing.currency)}</Txt>
          {listing.status === 'reserved' ? <Pill label="Reservada" tint={color.medium} /> : null}
        </View>
      </View>

      {fairness ? (
        <>
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: FAIRNESS_TINT[fairness] ?? color.textFaint,
              }}
            />
            <Txt variant="small" tone="dim" style={{ flex: 1 }}>
              {FAIRNESS_LABEL[fairness]} — estimada em{' '}
              {money(listing.priceAssessment!.suggestedLow, listing.currency)} a{' '}
              {money(listing.priceAssessment!.suggestedHigh, listing.currency)}
            </Txt>
          </View>
        </>
      ) : null}
    </Panel>
  );
}

export default function Market() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['market', category],
    queryFn: () => api.get<MarketResponse>(`/market${category ? `?category=${category}` : ''}`),
  });

  return (
    <Screen scroll>
      <Animated.View entering={FadeIn.duration(300)} style={{ paddingTop: space.xl, gap: space.sm }}>
        <Txt variant="title">Mercado</Txt>
        <Txt variant="body" tone="dim">
          Peças de gente que usou de verdade. Cada preço vem com a faixa que o Pecê estima
          para aquela peça — inclusive quando a conta não fecha.
        </Txt>
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: space.xl, marginHorizontal: -space.xl }}
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}
      >
        {[null, ...FILTERS].map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c ?? 'all'}
              onPress={() => setCategory(c)}
              style={({ pressed }) => ({
                backgroundColor: active ? color.accentSoft : 'transparent',
                borderColor: active ? color.accentDim : color.border,
                borderWidth: 1,
                borderRadius: radius.full,
                paddingHorizontal: 14,
                paddingVertical: 7,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Txt variant="smallStrong" tone={active ? 'accent' : 'dim'}>
                {c === null ? 'Tudo' : (categoryLabel[c] ?? c)}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: space.xl, gap: space.md }}>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : data && data.listings.length > 0 ? (
          data.listings.map((listing, i) => (
            <Animated.View
              key={listing.id}
              entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(300)}
            >
              <ListingRow listing={listing} onPress={() => router.push(`/market/${listing.id}`)} />
            </Animated.View>
          ))
        ) : (
          <Empty
            title="Nada anunciado por aqui ainda"
            description={
              category
                ? 'Ninguém está vendendo peça desta categoria agora. Tente outra, ou anuncie a sua.'
                : 'O mercado começa quando alguém anuncia. Uma peça que saiu do seu PC pode servir para outra pessoa.'
            }
            actionLabel="Anunciar uma peça minha"
            onAction={() => router.push('/rigs')}
          />
        )}
      </View>
    </Screen>
  );
}
