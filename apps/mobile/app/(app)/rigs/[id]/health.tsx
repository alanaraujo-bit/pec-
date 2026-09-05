/**
 * Saúde do PC — eixo próprio, tela própria.
 *
 * A decisão de desenho que carrega a tela: **o que é grátis vem primeiro e vem marcado.**
 * Um app de hardware que responde "limpe a poeira" tem menos a ganhar do que um que
 * responde "troque a placa" — e é exatamente por isso que essa hierarquia precisa estar
 * escrita no layout, e não deixada ao acaso da ordenação.
 *
 * A tela não julga nada: status, textos, ordem e a marca de "não custa nada" vêm prontos
 * do engine. Aqui só se decide onde cada coisa aparece.
 */

import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type HealthResponse, type HealthStatus } from '../../../../src/api.ts';
import { Divider, ErrorState, Loading, Panel, Pill, Screen, Txt } from '../../../../src/ui.tsx';
import { color, radius, space } from '../../../../src/theme.ts';

/**
 * Verde é reservado no produto para "está tudo bem" — aqui ele marca a saúde em ordem,
 * que é o mesmo significado que ele tem no veredito do diagnóstico.
 */
const STATUS_TINT: Record<HealthStatus, string> = {
  good: color.good,
  watch: color.medium,
  'at-risk': color.high,
  critical: color.critical,
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  good: 'Em ordem',
  watch: 'De olho',
  'at-risk': 'Atenção',
  critical: 'Crítico',
};

const AREA_LABEL: Record<string, string> = {
  thermal: 'Refrigeração',
  power: 'Energia',
  wear: 'Desgaste',
  storage: 'Armazenamento',
  compatibility: 'Montagem',
  maintenance: 'Manutenção',
};

function CheckCard({ check }: { check: HealthResponse['health']['checks'][number] }) {
  const tint = STATUS_TINT[check.status];

  return (
    <Panel style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }} />
        <Txt variant="label" style={{ color: tint, flex: 1 }}>
          {(AREA_LABEL[check.area] ?? check.area).toUpperCase()}
        </Txt>
        {/*
          A etiqueta mais importante da tela. Marca o que a pessoa resolve hoje à noite
          sem gastar — e diferencia este eixo de uma lista de peças para comprar.
        */}
        {check.costsMoney ? null : (
          <Pill label="Não custa nada" tint={color.good} background={color.goodSoft} />
        )}
      </View>

      <Txt variant="subheading">{check.what}</Txt>
      <Txt variant="body" tone="dim">
        {check.why}
      </Txt>

      {check.how ? (
        <>
          <Divider />
          <Txt variant="small" tone="dim">
            {check.how}
          </Txt>
        </>
      ) : null}

      {check.technical.length > 0 ? (
        <View style={{ gap: 2 }}>
          {check.technical.map((line) => (
            <Txt key={line} variant="small" tone="faint">
              {line}
            </Txt>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

export default function Health() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['health', id],
    queryFn: () => api.get<HealthResponse>(`/rigs/${id}/health`),
  });

  if (isLoading) return <Loading />;
  if (error || !data) {
    return (
      <Screen scroll>
        <ErrorState message={(error as Error)?.message ?? 'Erro'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const { health } = data;
  const tint = STATUS_TINT[health.status];
  const free = health.checks.filter((c) => !c.costsMoney);
  const paid = health.checks.filter((c) => c.costsMoney);

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Txt variant="smallStrong" tone="faint">
            ← Voltar
          </Txt>
        </Pressable>
      </View>

      <Animated.View entering={FadeIn.duration(300)} style={{ gap: space.md, marginBottom: space.xl }}>
        <Txt variant="label" tone="faint">
          SAÚDE DO PC
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.md }}>
          <Txt variant="display" style={{ color: tint }}>
            {health.score}
          </Txt>
          <Pill label={STATUS_LABEL[health.status]} tint={tint} />
        </View>
        <Txt variant="heading">{health.headline}</Txt>
        <Txt variant="body" tone="dim">
          {health.summary}
        </Txt>
        <Txt variant="small" tone="faint">
          Saúde é condição, não velocidade: um PC modesto pode ter saúde perfeita, e um PC
          caro e mal cuidado, não.
        </Txt>
      </Animated.View>

      {/* O que não custa nada, primeiro. É a hierarquia que define o eixo. */}
      {free.length > 0 ? (
        <View style={{ marginBottom: space.xl, gap: space.md }}>
          <Txt variant="label" tone="faint">
            DÁ PARA RESOLVER SEM GASTAR
          </Txt>
          {free.map((check, i) => (
            <Animated.View key={check.id} entering={FadeInDown.delay(i * 50).duration(300)}>
              <CheckCard check={check} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {paid.length > 0 ? (
        <View style={{ marginBottom: space.xl, gap: space.md }}>
          <Txt variant="label" tone="faint">
            EXIGE TROCA DE PEÇA
          </Txt>
          {paid.map((check, i) => (
            <Animated.View key={check.id} entering={FadeInDown.delay(i * 50).duration(300)}>
              <CheckCard check={check} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {health.passing.length > 0 ? (
        <View style={{ marginBottom: space.xl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            EM ORDEM
          </Txt>
          <Panel style={{ gap: space.md }}>
            {health.passing.map((item, i) => (
              <View key={item.area}>
                {i > 0 ? <Divider style={{ marginBottom: space.md }} /> : null}
                <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                  <Txt variant="bodyStrong" style={{ color: color.good }}>
                    ✓
                  </Txt>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="bodyStrong">{item.label}</Txt>
                    <Txt variant="small" tone="dim">
                      {item.reason}
                    </Txt>
                  </View>
                </View>
              </View>
            ))}
          </Panel>
        </View>
      ) : null}

      {/* O que o produto não sabe fica escrito, não escondido. */}
      <View
        style={{
          padding: space.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.borderSoft,
          gap: space.sm,
          marginBottom: space.xxl,
        }}
      >
        <Txt variant="label" tone="faint">
          O QUE ESTA AVALIAÇÃO NÃO ALCANÇA
        </Txt>
        {health.limitations.map((limitation) => (
          <Txt key={limitation} variant="small" tone="faint">
            • {limitation}
          </Txt>
        ))}
      </View>
    </Screen>
  );
}
