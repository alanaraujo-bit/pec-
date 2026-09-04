/**
 * Onboarding.
 *
 * Só perguntamos o que muda a recomendação. Cada passo existe porque o engine usa a
 * resposta: sem uso não há prioridade, sem resolução não há gargalo correto, sem alvo de
 * FPS não dá para dizer se o PC atende. Nada aqui é coletado "para conhecer o usuário".
 *
 * Quatro passos, um por tela, com progresso visível — questionário longo em página única
 * é onde a maioria das pessoas desiste.
 */

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, Layout } from 'react-native-reanimated';

import { Button, Meter, Screen, Txt } from '../../src/ui.tsx';
import { color, radius, space } from '../../src/theme.ts';
import { api } from '../../src/api.ts';
import { useSession } from '../../src/session.tsx';

type WorkloadKind =
  | 'competitive-gaming'
  | 'aaa-gaming'
  | 'casual-gaming'
  | 'streaming'
  | 'video-editing'
  | 'game-development'
  | 'programming'
  | '3d-rendering'
  | 'productivity';

const WORKLOAD_OPTIONS: Array<{ kind: WorkloadKind; title: string; description: string }> = [
  { kind: 'competitive-gaming', title: 'Jogos competitivos', description: 'CS2, Valorant, LoL, Fortnite' },
  { kind: 'aaa-gaming', title: 'Jogos pesados', description: 'Cyberpunk, Baldur’s Gate 3, Alan Wake' },
  { kind: 'casual-gaming', title: 'Jogos leves', description: 'Minecraft, The Sims, indies' },
  { kind: 'streaming', title: 'Live e gravação', description: 'Transmitir ou gravar jogando' },
  { kind: 'video-editing', title: 'Edição de vídeo', description: 'Premiere, DaVinci, After Effects' },
  { kind: 'programming', title: 'Programação', description: 'IDEs, containers, compilação' },
  { kind: '3d-rendering', title: 'Render 3D', description: 'Blender, Maya, modelagem' },
  { kind: 'game-development', title: 'Fazer jogos', description: 'Unity, Unreal, Godot' },
  { kind: 'productivity', title: 'Uso geral', description: 'Navegador, Office, estudo' },
];

const RESOLUTIONS = [
  { value: '1080p', title: 'Full HD', detail: '1920 × 1080' },
  { value: '1440p', title: 'Quad HD', detail: '2560 × 1440' },
  { value: 'ultrawide-1440p', title: 'Ultrawide', detail: '3440 × 1440' },
  { value: '4K', title: '4K', detail: '3840 × 2160' },
] as const;

const FPS_TARGETS = [
  { value: 60, title: '60 FPS', detail: 'Suave para a maioria dos jogos' },
  { value: 120, title: '120 FPS', detail: 'Bem fluido' },
  { value: 144, title: '144 FPS', detail: 'Para monitor de alta taxa' },
  { value: 240, title: '240+ FPS', detail: 'Competitivo levado a sério' },
  { value: null, title: 'Não sei ainda', detail: 'Tudo bem — a gente sugere' },
] as const;

const BUDGETS = [
  { tier: 'none', title: 'Nada agora', detail: 'Só quero entender meu PC' },
  { tier: 'tight', title: 'Até R$ 1.500', detail: 'O essencial' },
  { tier: 'moderate', title: 'Até R$ 4.000', detail: 'Dá para resolver bem' },
  { tier: 'comfortable', title: 'Até R$ 10.000', detail: 'Com folga' },
  { tier: 'unlimited', title: 'Sem limite definido', detail: 'Quero o melhor caminho' },
] as const;

const BUDGET_AMOUNT: Record<string, number | null> = {
  none: 0,
  tight: 1500,
  moderate: 4000,
  comfortable: 10000,
  unlimited: null,
};

/** Opção selecionável. Um só componente para os quatro passos mantém o ritmo visual. */
function Option({
  title,
  detail,
  selected,
  onPress,
  badge,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            backgroundColor: selected ? color.accentSoft : color.surface,
            borderColor: selected ? color.accent : color.borderSoft,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingVertical: 14,
            paddingHorizontal: space.lg,
            opacity: pressed ? 0.8 : 1,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{title}</Txt>
            <Txt variant="small" tone="faint" style={{ marginTop: 2 }}>
              {detail}
            </Txt>
          </View>
          {badge ? (
            <View
              style={{
                backgroundColor: color.accent,
                borderRadius: radius.full,
                minWidth: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 6,
              }}
            >
              <Txt variant="label" style={{ color: '#04101F' }}>
                {badge}
              </Txt>
            </View>
          ) : (
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: selected ? color.accent : color.border,
                backgroundColor: selected ? color.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? (
                <View style={{ width: 7, height: 7, borderRadius: radius.full, backgroundColor: '#04101F' }} />
              ) : null}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function Onboarding() {
  const { markOnboarded } = useSession();

  const [step, setStep] = useState(0);
  const [workloads, setWorkloads] = useState<WorkloadKind[]>([]);
  const [resolution, setResolution] = useState<string>('1080p');
  const [targetFps, setTargetFps] = useState<number | null>(60);
  const [budgetTier, setBudgetTier] = useState<string>('moderate');
  const [busy, setBusy] = useState(false);

  const totalSteps = 4;

  /**
   * A ordem de escolha vira peso: o primeiro item marcado é o uso principal. Isso evita
   * uma pergunta extra ("qual é o principal?") sem perder a informação que o engine precisa.
   */
  function toggleWorkload(kind: WorkloadKind) {
    setWorkloads((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind].slice(0, 4),
    );
  }

  const canAdvance = useMemo(() => {
    if (step === 0) return workloads.length > 0;
    return true;
  }, [step, workloads]);

  async function finish() {
    setBusy(true);
    try {
      await api.put('/me/profile', {
        workloads: workloads.map((kind, index) => ({
          kind,
          weight: index === 0 ? 3 : index === 1 ? 2 : 1,
        })),
        resolution,
        targetFps,
        budgetTier,
        budgetAmount: BUDGET_AMOUNT[budgetTier] ?? null,
        currency: 'BRL',
        priorities: ['value-for-money'],
        expertise: 'beginner',
      });
      markOnboarded();
    } catch {
      setBusy(false);
    }
  }

  const steps = [
    {
      title: 'O que você faz no PC?',
      subtitle: 'Escolha até 4. A ordem importa: o primeiro é o seu uso principal.',
      content: (
        <View style={{ gap: space.sm }}>
          {WORKLOAD_OPTIONS.map((option) => {
            const index = workloads.indexOf(option.kind);
            return (
              <Option
                key={option.kind}
                title={option.title}
                detail={option.description}
                selected={index >= 0}
                badge={index >= 0 ? String(index + 1) : undefined}
                onPress={() => toggleWorkload(option.kind)}
              />
            );
          })}
        </View>
      ),
    },
    {
      title: 'Em que resolução você joga?',
      subtitle: 'Isso muda tudo no diagnóstico — o mesmo PC tem gargalos diferentes em cada resolução.',
      content: (
        <View style={{ gap: space.sm }}>
          {RESOLUTIONS.map((r) => (
            <Option
              key={r.value}
              title={r.title}
              detail={r.detail}
              selected={resolution === r.value}
              onPress={() => setResolution(r.value)}
            />
          ))}
        </View>
      ),
    },
    {
      title: 'Quantos FPS você quer?',
      subtitle: 'É o alvo que vamos usar para dizer se o seu PC já dá conta.',
      content: (
        <View style={{ gap: space.sm }}>
          {FPS_TARGETS.map((f) => (
            <Option
              key={String(f.value)}
              title={f.title}
              detail={f.detail}
              selected={targetFps === f.value}
              onPress={() => setTargetFps(f.value)}
            />
          ))}
        </View>
      ),
    },
    {
      title: 'Quanto você pensaria em investir?',
      subtitle: 'Só para não sugerirmos coisa fora da sua realidade. Dá para mudar depois.',
      content: (
        <View style={{ gap: space.sm }}>
          {BUDGETS.map((b) => (
            <Option
              key={b.tier}
              title={b.title}
              detail={b.detail}
              selected={budgetTier === b.tier}
              onPress={() => setBudgetTier(b.tier)}
            />
          ))}
        </View>
      ),
    },
  ];

  const current = steps[step]!;

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.xl, gap: space.xl }}>
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="label" tone="faint">
              PASSO {step + 1} DE {totalSteps}
            </Txt>
            {step > 0 ? (
              <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={12}>
                <Txt variant="smallStrong" tone="dim">
                  Voltar
                </Txt>
              </Pressable>
            ) : null}
          </View>
          <Meter value={((step + 1) / totalSteps) * 100} />
        </View>

        <Animated.View key={step} entering={FadeInRight.duration(260)} layout={Layout.duration(200)}>
          <View style={{ gap: space.sm, marginBottom: space.xl }}>
            <Txt variant="title">{current.title}</Txt>
            <Txt variant="body" tone="dim">
              {current.subtitle}
            </Txt>
          </View>
          {current.content}
        </Animated.View>

        <Animated.View entering={FadeIn.duration(200)}>
          {step < totalSteps - 1 ? (
            <Button label="Continuar" onPress={() => setStep((s) => s + 1)} disabled={!canAdvance} />
          ) : (
            <Button label="Concluir" onPress={finish} loading={busy} />
          )}
        </Animated.View>
      </View>
    </Screen>
  );
}
