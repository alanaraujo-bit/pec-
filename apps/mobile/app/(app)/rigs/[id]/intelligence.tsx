/**
 * Diagnóstico — a tela que justifica o produto existir.
 *
 * Ordem da leitura, e ela é deliberada:
 *   1. o veredito, em uma frase;
 *   2. o que fazer, por prioridade;
 *   3. por que, em linguagem de gente;
 *   4. como resolver, com opções reais;
 *   5. o técnico, só para quem pedir.
 *
 * Progressive disclosure de verdade: o iniciante lê três linhas e entende; o entusiasta
 * abre e vê o teto de CPU, o teto de GPU e a resolução considerada. Nenhum dos dois é
 * penalizado pelo outro.
 *
 * O caso `healthy` recebe tratamento próprio e afirmativo. Um PC saudável não é uma tela
 * vazia — é o melhor resultado possível, e precisa parecer isso.
 */

import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type Diagnosis, type Finding, type Scenario, type SetupScore } from '../../../../src/api.ts';
import { Divider, ErrorState, Loading, Meter, Panel, Pill, Screen, Txt } from '../../../../src/ui.tsx';
import {
  categoryLabel,
  color,
  money,
  radius,
  severityColor,
  severityLabel,
  severitySoft,
  space,
  verdictColor,
  type Severity,
  type Verdict,
} from '../../../../src/theme.ts';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface IntelligenceResponse {
  diagnosis: Diagnosis;
  score: SetupScore;
  scenarios: Scenario[];
}

const VERDICT_TITLE: Record<Verdict, string> = {
  healthy: 'Equilibrado',
  'minor-improvements': 'Bom, com ajustes',
  'attention-needed': 'Precisa de atenção',
  critical: 'Ação urgente',
};

// ---------------------------------------------------------------------------

/** Achado com revelação progressiva. Fechado mostra o quê; aberto mostra tudo. */
function FindingItem({ finding, index }: { finding: Finding; index: number }) {
  const [open, setOpen] = useState(false);
  const [technical, setTechnical] = useState(false);

  const severity = finding.severity as Severity;
  const tint = severityColor[severity];

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setOpen((v) => !v);
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).duration(300)}>
      <Pressable onPress={toggle} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <View
          style={{
            backgroundColor: color.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: open ? color.border : color.borderSoft,
            overflow: 'hidden',
          }}
        >
          {/* Faixa de severidade: cor no lugar certo, sem pintar o cartão inteiro. */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 3, backgroundColor: tint }} />
            <View style={{ flex: 1, padding: space.lg, gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Pill label={severityLabel[severity]} tint={tint} background={severitySoft[severity]} />
                {finding.category ? (
                  <Txt variant="label" tone="faint">
                    {(categoryLabel[finding.category] ?? finding.category).toUpperCase()}
                  </Txt>
                ) : null}
                <View style={{ flex: 1 }} />
                <Txt variant="small" tone="faint">
                  {open ? '−' : '+'}
                </Txt>
              </View>

              <Txt variant="subheading" style={{ lineHeight: 23 }}>
                {finding.what}
              </Txt>

              {finding.expectedGain && !open ? (
                <Txt variant="smallStrong" style={{ color: tint }}>
                  {finding.expectedGain}
                </Txt>
              ) : null}

              {open ? (
                <View style={{ gap: space.lg, marginTop: space.xs }}>
                  <View style={{ gap: space.sm }}>
                    <Txt variant="label" tone="faint">
                      POR QUE
                    </Txt>
                    <Txt variant="body" tone="dim">
                      {finding.why}
                    </Txt>
                  </View>

                  {finding.how ? (
                    <View style={{ gap: space.sm }}>
                      <Txt variant="label" tone="faint">
                        COMO RESOLVER
                      </Txt>
                      <Txt variant="body" tone="dim">
                        {finding.how}
                      </Txt>
                    </View>
                  ) : null}

                  {finding.expectedGain ? (
                    <View
                      style={{
                        backgroundColor: severitySoft[severity],
                        borderRadius: radius.sm,
                        paddingVertical: space.sm,
                        paddingHorizontal: space.md,
                      }}
                    >
                      <Txt variant="smallStrong" style={{ color: tint }}>
                        Ganho esperado: {finding.expectedGain}
                      </Txt>
                    </View>
                  ) : null}

                  {/* Camada técnica: só aparece quando o usuário pede. */}
                  {finding.technical.length > 0 ? (
                    <View style={{ gap: space.sm }}>
                      <Pressable
                        onPress={() => {
                          LayoutAnimation.configureNext(
                            LayoutAnimation.create(160, 'easeInEaseOut', 'opacity'),
                          );
                          setTechnical((v) => !v);
                        }}
                        hitSlop={8}
                      >
                        <Txt variant="smallStrong" tone="accent">
                          {technical ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
                        </Txt>
                      </Pressable>

                      {technical ? (
                        <View
                          style={{
                            gap: 6,
                            backgroundColor: color.bg,
                            borderRadius: radius.sm,
                            borderWidth: 1,
                            borderColor: color.borderSoft,
                            padding: space.md,
                          }}
                        >
                          {finding.technical.map((line) => (
                            <Txt key={line} variant="small" tone="faint">
                              {line}
                            </Txt>
                          ))}
                          {finding.confidence !== 'high' ? (
                            <Txt variant="small" style={{ color: color.medium, marginTop: 4 }}>
                              Confiança {finding.confidence === 'medium' ? 'média' : 'baixa'} — é uma
                              estimativa, não uma medição.
                            </Txt>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

const TIER_TITLE: Record<string, string> = {
  economic: 'Econômico',
  balanced: 'Equilibrado',
  enthusiast: 'Entusiasta',
};

const TIER_DESC: Record<string, string> = {
  economic: 'Menor investimento que resolve',
  balanced: 'Melhor relação entre gasto e ganho',
  enthusiast: 'O máximo que sua máquina aproveita',
};

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false);
  const recommended = scenario.tier === 'balanced';
  const warnings = scenario.compatibility.issues.filter((i) => i.level === 'warning');

  return (
    <Pressable
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
        setOpen((v) => !v);
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: recommended ? color.accentDim : color.borderSoft,
          padding: space.lg,
          gap: space.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Txt variant="label" tone={recommended ? 'accent' : 'faint'}>
            {TIER_TITLE[scenario.tier]?.toUpperCase()}
          </Txt>
          {recommended ? <Pill label="Recomendado" tint={color.accent} background={color.accentSoft} /> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt variant="subheading" numberOfLines={2}>
              {scenario.component.model}
            </Txt>
            <Txt variant="small" tone="faint" style={{ marginTop: 2 }}>
              {TIER_DESC[scenario.tier]}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="bodyStrong">{money(scenario.estimatedCost, scenario.currency)}</Txt>
            <Txt variant="small" style={{ color: color.good }}>
              +{scenario.gainPercent}%
            </Txt>
          </View>
        </View>

        {/* Antes → depois em FPS. É o número que a pessoa realmente quer ver. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Txt variant="small" tone="faint">
            {scenario.fpsBefore} FPS
          </Txt>
          <View style={{ flex: 1 }}>
            <Meter value={(scenario.fpsBefore / scenario.fpsAfter) * 100} tint={color.textFaint} height={3} />
          </View>
          <Txt variant="smallStrong" style={{ color: color.good }}>
            {scenario.fpsAfter} FPS
          </Txt>
        </View>

        {warnings.length > 0 && !open ? (
          <Txt variant="small" style={{ color: color.medium }}>
            {warnings[0]!.message}
          </Txt>
        ) : null}

        {open ? (
          <View style={{ gap: space.md, marginTop: space.xs }}>
            <Divider />
            <Txt variant="body" tone="dim">
              {scenario.rationale}
            </Txt>

            {scenario.advantages.length > 0 ? (
              <View style={{ gap: 4 }}>
                {scenario.advantages.map((a) => (
                  <Txt key={a} variant="small" tone="dim">
                    <Txt variant="small" style={{ color: color.good }}>
                      +{' '}
                    </Txt>
                    {a}
                  </Txt>
                ))}
              </View>
            ) : null}

            {scenario.disadvantages.length > 0 ? (
              <View style={{ gap: 4 }}>
                {scenario.disadvantages.map((d) => (
                  <Txt key={d} variant="small" tone="dim">
                    <Txt variant="small" style={{ color: color.medium }}>
                      −{' '}
                    </Txt>
                    {d}
                  </Txt>
                ))}
              </View>
            ) : null}

            {warnings.map((w) => (
              <View
                key={w.message}
                style={{
                  backgroundColor: color.mediumSoft,
                  borderRadius: radius.sm,
                  padding: space.md,
                  gap: 4,
                }}
              >
                <Txt variant="smallStrong" style={{ color: color.medium }}>
                  {w.message}
                </Txt>
                <Txt variant="small" tone="dim">
                  {w.detail}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

export default function Intelligence() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['intelligence', id],
    queryFn: () => api.get<IntelligenceResponse>(`/rigs/${id}/intelligence`),
  });

  if (isLoading) return <Loading label="Analisando seu PC" />;
  if (error || !data) {
    return (
      <Screen scroll>
        <ErrorState message={(error as Error)?.message ?? 'Erro'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const { diagnosis, score, scenarios } = data;
  const verdict = diagnosis.verdict as Verdict;
  const tint = verdictColor[verdict];
  const healthy = verdict === 'healthy';

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Txt variant="smallStrong" tone="faint">
            ← Voltar
          </Txt>
        </Pressable>
      </View>

      {/* Veredito. A primeira coisa que a pessoa lê, e a mais importante. */}
      <Animated.View entering={FadeIn.duration(320)} style={{ gap: space.md, marginBottom: space.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
          <Txt variant="label" style={{ color: tint }}>
            {VERDICT_TITLE[verdict].toUpperCase()}
          </Txt>
        </View>

        <Txt variant="title" style={{ lineHeight: 33 }}>
          {diagnosis.headline}
        </Txt>

        <Txt variant="body" tone="dim">
          {diagnosis.summary}
        </Txt>
      </Animated.View>

      {/* Números do momento: FPS e score, lado a lado, sem virar dashboard. */}
      {diagnosis.performance.fps ? (
        <Animated.View entering={FadeInDown.delay(80).duration(320)}>
          <Panel style={{ flexDirection: 'row', marginBottom: space.xxl }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label" tone="faint">
                FPS ESTIMADO
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Txt variant="title">{diagnosis.performance.fps.fps}</Txt>
                <Txt variant="small" tone="faint">
                  {diagnosis.performance.workloadLabel?.toLowerCase()}
                </Txt>
              </View>
            </View>
            <View style={{ width: 1, backgroundColor: color.borderSoft, marginHorizontal: space.lg }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label" tone="faint">
                SETUP SCORE
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Txt variant="title" style={{ color: tint }}>
                  {score.total}
                </Txt>
                <Txt variant="small" tone="faint">
                  de 100
                </Txt>
              </View>
            </View>
          </Panel>
        </Animated.View>
      ) : null}

      {/*
        PC saudável. Tratamento afirmativo, com o mesmo peso visual de um problema —
        porque para o usuário essa informação vale tanto quanto.
      */}
      {healthy ? (
        <Animated.View entering={FadeInDown.delay(140).duration(340)} style={{ marginBottom: space.xxl }}>
          <View
            style={{
              backgroundColor: color.goodSoft,
              borderColor: 'rgba(63,221,135,0.25)',
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: space.xl,
              gap: space.md,
            }}
          >
            <Txt variant="subheading" style={{ color: color.good }}>
              Nada para fazer agora
            </Txt>
            <Txt variant="body" tone="dim">
              As peças estão bem casadas entre si e adequadas ao que você faz. Guarde o dinheiro —
              quando aparecer algo que realmente valha a pena, o Pecê avisa.
            </Txt>
          </View>
        </Animated.View>
      ) : null}

      {/* Achados, já ordenados por severidade e impacto pelo servidor. */}
      {diagnosis.findings.length > 0 ? (
        <View style={{ marginBottom: space.xxl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            {healthy ? 'OBSERVAÇÕES' : 'POR ONDE COMEÇAR'}
          </Txt>
          <View style={{ gap: space.md }}>
            {diagnosis.findings.map((finding, index) => (
              <FindingItem key={finding.id} finding={finding} index={index} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Cenários. Só existem quando há uma ação de compra que faz sentido. */}
      {scenarios.length > 0 ? (
        <View style={{ marginBottom: space.xxl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.xs }}>
            CAMINHOS POSSÍVEIS
          </Txt>
          <Txt variant="small" tone="faint" style={{ marginBottom: space.md }}>
            Só peças compatíveis com a sua máquina, com o ganho já calculado.
          </Txt>
          <View style={{ gap: space.md }}>
            {scenarios.map((scenario) => (
              <ScenarioCard key={scenario.component.id} scenario={scenario} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Peças aprovadas. Dizer "isso aqui está ótimo" é parte do produto. */}
      {diagnosis.approved.length > 0 ? (
        <View style={{ marginBottom: space.xxl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            NENHUMA MUDANÇA NECESSÁRIA
          </Txt>
          <Panel style={{ gap: space.md }}>
            {diagnosis.approved.map((item, index) => (
              <View key={item.category}>
                {index > 0 ? <Divider style={{ marginBottom: space.md }} /> : null}
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <Txt variant="small" style={{ color: color.good }}>
                    ✓
                  </Txt>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="smallStrong">
                      {categoryLabel[item.category] ?? item.category} · {item.label}
                    </Txt>
                    <Txt variant="small" tone="faint">
                      {item.reason}
                    </Txt>
                  </View>
                </View>
              </View>
            ))}
          </Panel>
        </View>
      ) : null}

      {/* Dimensões do score, cada uma com a razão da nota. */}
      <View style={{ marginBottom: space.xxl }}>
        <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
          COMO CHEGAMOS NO SCORE
        </Txt>
        <Panel style={{ gap: space.lg }}>
          {score.dimensions.map((dimension) => (
            <View key={dimension.dimension} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Txt variant="smallStrong" style={{ flex: 1 }}>
                  {dimension.label}
                </Txt>
                <Txt variant="smallStrong" tone="dim">
                  {dimension.score}
                </Txt>
              </View>
              <Meter
                value={dimension.score}
                tint={dimension.score >= 70 ? color.good : dimension.score >= 45 ? color.medium : color.high}
                height={3}
              />
              <Txt variant="small" tone="faint">
                {dimension.reason}
              </Txt>
            </View>
          ))}
        </Panel>
      </View>

      {/* Limitações. Assumir o que não sabemos é parte de ser confiável. */}
      {diagnosis.limitations.length > 0 ? (
        <View style={{ marginBottom: space.xxl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.md }}>
            PARA MELHORAR A ANÁLISE
          </Txt>
          <Panel style={{ gap: space.sm }}>
            {diagnosis.limitations.map((limitation) => (
              <Txt key={limitation} variant="small" tone="dim">
                · {limitation}
              </Txt>
            ))}
          </Panel>
        </View>
      ) : null}

      <Txt variant="small" tone="faint" style={{ textAlign: 'center', lineHeight: 18 }}>
        Estimativas baseadas nas especificações das suas peças e no seu perfil de uso.{'\n'}
        O Pecê não recebe comissão por nenhuma recomendação.
      </Txt>
    </Screen>
  );
}
