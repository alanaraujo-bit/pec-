/**
 * Comparação.
 *
 * Dois modos, uma tela: PC contra PC e peça contra peça.
 *
 * O que diferencia de uma tabela de especificações é o veredito no fim: ele responde
 * "qual é melhor PARA MIM", usando o perfil de uso de quem está perguntando. Por isso a
 * mesma comparação pode dar respostas diferentes para pessoas diferentes — e as duas
 * estarem certas.
 */

import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { api, type CatalogComponent, type RigSummary } from '../../src/api.ts';
import { Divider, Empty, Field, Loading, Panel, Screen, Txt } from '../../src/ui.tsx';
import { categoryLabel, color, radius, space } from '../../src/theme.ts';

interface ComparisonRow {
  label: string;
  left: string;
  right: string;
  winner: 'left' | 'right' | null;
  technical: boolean;
}

interface Verdict {
  winner: 'left' | 'right' | 'tie';
  headline: string;
  reasoning: string;
}

type Mode = 'rigs' | 'parts';

/** Tabela comparativa. O vencedor de cada linha é marcado com peso, não com cor forte. */
function ComparisonTable({
  rows,
  leftName,
  rightName,
  showTechnical,
}: {
  rows: ComparisonRow[];
  leftName: string;
  rightName: string;
  showTechnical: boolean;
}) {
  const visible = rows.filter((r) => showTechnical || !r.technical);

  return (
    <Panel style={{ paddingVertical: space.xs }}>
      <View style={{ flexDirection: 'row', paddingVertical: space.md, gap: space.sm }}>
        <View style={{ flex: 1.1 }} />
        <Txt variant="label" tone="faint" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
          {leftName.toUpperCase()}
        </Txt>
        <Txt variant="label" tone="faint" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
          {rightName.toUpperCase()}
        </Txt>
      </View>

      {visible.map((row, index) => (
        <View key={row.label}>
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.sm }}>
            <Txt variant="small" tone="faint" style={{ flex: 1.1 }}>
              {row.label}
            </Txt>
            <Txt
              variant={row.winner === 'left' ? 'smallStrong' : 'small'}
              tone={row.winner === 'left' ? 'default' : 'dim'}
              style={{ flex: 1, textAlign: 'center' }}
              numberOfLines={1}
            >
              {row.left}
            </Txt>
            <Txt
              variant={row.winner === 'right' ? 'smallStrong' : 'small'}
              tone={row.winner === 'right' ? 'default' : 'dim'}
              style={{ flex: 1, textAlign: 'center' }}
              numberOfLines={1}
            >
              {row.right}
            </Txt>
          </View>
        </View>
      ))}
    </Panel>
  );
}

function VerdictBlock({ verdict, leftName, rightName }: { verdict: Verdict; leftName: string; rightName: string }) {
  const tie = verdict.winner === 'tie';
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <View
        style={{
          backgroundColor: tie ? color.surface : color.accentSoft,
          borderColor: tie ? color.borderSoft : color.accentDim,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.md,
        }}
      >
        <Txt variant="label" tone={tie ? 'faint' : 'accent'}>
          QUAL É MELHOR PARA VOCÊ
        </Txt>
        <Txt variant="subheading">{verdict.headline}</Txt>
        <Txt variant="body" tone="dim">
          {verdict.reasoning}
        </Txt>
      </View>
    </Animated.View>
  );
}

export default function Compare() {
  const params = useLocalSearchParams<{ left?: string; right?: string; mode?: string }>();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>((params.mode as Mode) ?? 'rigs');
  const [leftRig, setLeftRig] = useState<string | null>(params.left ?? null);
  const [rightRig, setRightRig] = useState<string | null>(params.right ?? null);
  const [leftPart, setLeftPart] = useState<CatalogComponent | null>(null);
  const [rightPart, setRightPart] = useState<CatalogComponent | null>(null);
  const [search, setSearch] = useState('');
  // Chegando com o primeiro já definido pela rota, o que falta escolher é o segundo.
  const [picking, setPicking] = useState<'left' | 'right'>(params.left ? 'right' : 'left');
  const [technical, setTechnical] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const myRigs = useQuery({
    queryKey: ['rigs'],
    queryFn: () => api.get<{ rigs: RigSummary[] }>('/rigs'),
    enabled: mode === 'rigs',
  });

  const publicRigs = useQuery({
    queryKey: ['rankings', 'global'],
    queryFn: () =>
      api.get<{ entries: Array<{ rigId: string; rigName: string; owner: { handle: string }; setupScore: number }> }>(
        '/rankings?scope=global&limit=30',
      ),
    enabled: mode === 'rigs',
  });

  const rigComparison = useQuery({
    queryKey: ['compare-rigs', leftRig, rightRig],
    queryFn: () =>
      api.get<{ comparison: { rows: ComparisonRow[]; verdict: Verdict } }>(`/rigs/${leftRig}/compare/${rightRig}`),
    enabled: mode === 'rigs' && Boolean(leftRig && rightRig),
  });

  const partSearch = useQuery({
    queryKey: ['catalog', 'search', search],
    queryFn: () => api.get<{ results: CatalogComponent[] }>(`/catalog/search?q=${encodeURIComponent(search)}`),
    enabled: mode === 'parts' && search.trim().length >= 2,
  });

  const partComparison = useQuery({
    queryKey: ['compare-parts', leftPart?.id, rightPart?.id],
    queryFn: () =>
      api.get<{ comparison: { rows: ComparisonRow[]; verdict: Verdict } }>(
        `/catalog/compare?a=${leftPart!.id}&b=${rightPart!.id}`,
      ),
    enabled: mode === 'parts' && Boolean(leftPart && rightPart),
  });

  const rigOptions = [
    ...(myRigs.data?.rigs ?? []).map((r) => ({ id: r.id, name: r.name, detail: `Seu PC · ${r.setupScore}` })),
    ...(publicRigs.data?.entries ?? [])
      .filter((e) => !(myRigs.data?.rigs ?? []).some((r) => r.id === e.rigId))
      .map((e) => ({ id: e.rigId, name: e.rigName, detail: `@${e.owner.handle} · ${e.setupScore}` })),
  ];

  const leftName =
    mode === 'rigs'
      ? rigOptions.find((r) => r.id === leftRig)?.name ?? 'A'
      : leftPart?.model ?? 'A';
  const rightName =
    mode === 'rigs'
      ? rigOptions.find((r) => r.id === rightRig)?.name ?? 'B'
      : rightPart?.model ?? 'B';

  const comparison = mode === 'rigs' ? rigComparison.data?.comparison : partComparison.data?.comparison;
  const loading = mode === 'rigs' ? rigComparison.isLoading : partComparison.isLoading;
  const ready = mode === 'rigs' ? Boolean(leftRig && rightRig) : Boolean(leftPart && rightPart);
  const showPicker = !ready || pickerOpen;

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Txt variant="smallStrong" tone="faint">
            ← Voltar
          </Txt>
        </Pressable>
      </View>

      <Txt variant="title" style={{ marginBottom: space.lg }}>
        Comparar
      </Txt>

      {/* Modo */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.xl }}>
        {(
          [
            { key: 'rigs' as const, label: 'PC vs PC' },
            { key: 'parts' as const, label: 'Peça vs Peça' },
          ]
        ).map((option) => {
          const active = option.key === mode;
          return (
            <Pressable
              key={option.key}
              onPress={() => setMode(option.key)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: active ? color.accent : color.surface,
                borderColor: active ? color.accent : color.border,
                borderWidth: 1,
                borderRadius: radius.md,
                paddingVertical: 10,
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Txt variant="smallStrong" style={{ color: active ? '#04101F' : color.textDim }}>
                {option.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {/* Seleção dos dois lados */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.xl }}>
        {(['left', 'right'] as const).map((side) => {
          const name = side === 'left' ? leftName : rightName;
          const filled =
            mode === 'rigs' ? Boolean(side === 'left' ? leftRig : rightRig) : Boolean(side === 'left' ? leftPart : rightPart);
          const active = picking === side;

          return (
            <Pressable
              key={side}
              onPress={() => {
                setPicking(side);
                setPickerOpen(true);
              }}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: color.surface,
                borderColor: active ? color.accent : color.borderSoft,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space.md,
                gap: 3,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Txt variant="label" tone="faint">
                {side === 'left' ? 'PRIMEIRO' : 'SEGUNDO'}
              </Txt>
              <Txt variant="smallStrong" tone={filled ? 'default' : 'faint'} numberOfLines={1}>
                {filled ? name : 'Escolher'}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {/* Escolha — recolhe assim que os dois lados estão definidos. */}
      {showPicker && mode === 'rigs' ? (
        <View style={{ marginBottom: space.xl }}>
          <Txt variant="label" tone="faint" style={{ marginBottom: space.sm }}>
            ESCOLHER {picking === 'left' ? 'O PRIMEIRO' : 'O SEGUNDO'}
          </Txt>
          {myRigs.isLoading ? (
            <Loading />
          ) : rigOptions.length === 0 ? (
            <Empty title="Nada para comparar" description="Cadastre uma máquina para começar." />
          ) : (
            <Panel style={{ paddingVertical: space.xs }}>
              {rigOptions.slice(0, 12).map((option, index) => {
                const chosen = picking === 'left' ? leftRig === option.id : rightRig === option.id;
                return (
                  <View key={option.id}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => {
                        if (picking === 'left') {
                          setLeftRig(option.id);
                          setPicking('right');
                        } else {
                          setRightRig(option.id);
                          setPickerOpen(false);
                        }
                      }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: space.md }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Txt variant="smallStrong" numberOfLines={1}>
                            {option.name}
                          </Txt>
                          <Txt variant="small" tone="faint">
                            {option.detail}
                          </Txt>
                        </View>
                        {chosen ? (
                          <Txt variant="small" tone="accent">
                            ✓
                          </Txt>
                        ) : null}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </Panel>
          )}
        </View>
      ) : showPicker ? (
        <View style={{ marginBottom: space.xl, gap: space.md }}>
          <Field
            placeholder="Busque a peça: RTX 4070, Ryzen 5..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.trim().length >= 2 && partSearch.data ? (
            <Panel style={{ paddingVertical: space.xs }}>
              {partSearch.data.results.slice(0, 8).map((component, index) => (
                <View key={component.id}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => {
                      if (picking === 'left') {
                        setLeftPart(component);
                        setPicking('right');
                      } else {
                        setRightPart(component);
                        setPickerOpen(false);
                      }
                      setSearch('');
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={{ paddingVertical: 12, gap: 2 }}>
                      <Txt variant="smallStrong" numberOfLines={1}>
                        {component.model}
                      </Txt>
                      <Txt variant="small" tone="faint">
                        {categoryLabel[component.category] ?? component.category} · {component.brand}
                      </Txt>
                    </View>
                  </Pressable>
                </View>
              ))}
            </Panel>
          ) : null}
        </View>
      ) : null}

      {/* Resultado */}
      {ready ? (
        loading ? (
          <Loading />
        ) : comparison ? (
          <Animated.View entering={FadeInDown.duration(320)} style={{ gap: space.xl }}>
            <VerdictBlock verdict={comparison.verdict} leftName={leftName} rightName={rightName} />

            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
                <Txt variant="label" tone="faint" style={{ flex: 1 }}>
                  LADO A LADO
                </Txt>
                <Pressable onPress={() => setTechnical((v) => !v)} hitSlop={8}>
                  <Txt variant="small" tone="accent">
                    {technical ? 'Menos detalhes' : 'Mais detalhes'}
                  </Txt>
                </Pressable>
              </View>

              <ComparisonTable
                rows={comparison.rows}
                leftName={leftName}
                rightName={rightName}
                showTechnical={technical}
              />
            </View>
          </Animated.View>
        ) : null
      ) : null}
    </Screen>
  );
}
