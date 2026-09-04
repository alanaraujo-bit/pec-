/**
 * Cadastro guiado de peça: categoria → marca → família → modelo → quantidade.
 *
 * Por que quatro toques em vez de um campo de texto: o produto inteiro depende de saber
 * EXATAMENTE qual é a peça. "rtx 3070" digitado à mão não diz se é 8GB ou Ti, e sem isso
 * não há gargalo, score nem valor confiável. A navegação guiada torna o dado estruturado
 * sem parecer um formulário.
 *
 * A busca existe como atalho para quem já sabe o nome — mas ela também devolve entradas
 * do catálogo, nunca texto livre.
 */

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { api, type CatalogComponent } from '../../../../src/api.ts';
import { Button, Divider, Field, Loading, Panel, Pill, Screen, Txt } from '../../../../src/ui.tsx';
import { categoryIcon, categoryLabel, color, radius, space } from '../../../../src/theme.ts';

const CORE = ['CPU', 'GPU', 'MOTHERBOARD', 'RAM', 'STORAGE', 'PSU', 'COOLER', 'CASE', 'FAN'];
const PERIPHERALS = ['MONITOR', 'KEYBOARD', 'MOUSE', 'HEADSET', 'MICROPHONE', 'WEBCAM', 'MOUSEPAD', 'CONTROLLER'];

type Step = 'category' | 'brand' | 'family' | 'model' | 'confirm' | 'published';

/**
 * Resultado de uma troca de peça. Guardado para a etapa de consentimento: o evento só
 * vai para o feed se a pessoa disser que sim.
 */
interface UpgradeOutcome {
  fromModel: string;
  toModel: string;
  scoreBefore: number;
  scoreAfter: number;
}

/** Linha selecionável — o mesmo formato nos quatro passos mantém o ritmo. */
function Row({
  title,
  detail,
  glyph,
  onPress,
  count,
}: {
  title: string;
  detail?: string;
  glyph?: string;
  onPress: () => void;
  count?: number;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 }}>
        {glyph ? (
          <Txt variant="body" tone="faint" style={{ width: 22, textAlign: 'center' }}>
            {glyph}
          </Txt>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {title}
          </Txt>
          {detail ? (
            <Txt variant="small" tone="faint" numberOfLines={1}>
              {detail}
            </Txt>
          ) : null}
        </View>
        {count !== undefined ? (
          <Txt variant="small" tone="faint">
            {count}
          </Txt>
        ) : null}
        <Txt variant="small" tone="faint">
          ›
        </Txt>
      </View>
    </Pressable>
  );
}

export default function AddComponent() {
  /**
   * `replaces` chega quando o usuário veio de "trocar esta peça". Nesse caso o fluxo é o
   * mesmo, mas o resultado é uma substituição — e é o que alimenta o PC Evolution.
   */
  const { id, replaces, replacesName, replacesCategory } = useLocalSearchParams<{
    id: string;
    replaces?: string;
    replacesName?: string;
    replacesCategory?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isReplacing = Boolean(replaces);

  const [step, setStep] = useState<Step>(isReplacing && replacesCategory ? 'brand' : 'category');
  const [category, setCategory] = useState<string | null>(replacesCategory ?? null);
  const [brand, setBrand] = useState<string | null>(null);
  const [family, setFamily] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogComponent | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState<UpgradeOutcome | null>(null);
  const [publishing, setPublishing] = useState(false);

  // ---- Consultas de cada nível ----

  const brands = useQuery({
    queryKey: ['catalog', category, 'brands'],
    queryFn: () => api.get<{ brands: Array<{ brand: string; count: number }> }>(`/catalog/${category}/brands`),
    enabled: step === 'brand' && category !== null,
  });

  const families = useQuery({
    queryKey: ['catalog', category, brand, 'families'],
    queryFn: () =>
      api.get<{ families: Array<{ family: string; count: number }> }>(
        `/catalog/${category}/brands/${encodeURIComponent(brand!)}/families`,
      ),
    enabled: step === 'family' && category !== null && brand !== null,
  });

  const models = useQuery({
    queryKey: ['catalog', category, brand, family, 'models'],
    queryFn: () =>
      api.get<{ models: CatalogComponent[] }>(
        `/catalog/${category}/brands/${encodeURIComponent(brand!)}/families/${encodeURIComponent(family!)}/models`,
      ),
    enabled: step === 'model' && family !== null,
  });

  const searchResults = useQuery({
    queryKey: ['catalog', 'search', search],
    queryFn: () => api.get<{ results: CatalogComponent[] }>(`/catalog/search?q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: async () => {
      // Score antes da mudança, para conseguir mostrar o impacto real da troca.
      const before = isReplacing
        ? await api
            .get<{ score: { total: number } }>(`/rigs/${id}/intelligence`)
            .then((r) => r.score.total)
            .catch(() => null)
        : null;

      const result = await api.post<{ snapshot: { setupScore: number } | null }>(
        `/rigs/${id}/components`,
        {
          componentId: selected!.id,
          quantity,
          ...(replaces ? { replacesRigComponentId: replaces } : {}),
        },
      );

      return { before, after: result.snapshot?.setupScore ?? null };
    },
    onSuccess: async ({ before, after }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rig', id] }),
        queryClient.invalidateQueries({ queryKey: ['intelligence', id] }),
        queryClient.invalidateQueries({ queryKey: ['history', id] }),
        queryClient.invalidateQueries({ queryKey: ['rigs'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ]);

      /**
       * Troca de peça é um acontecimento — mas quem decide se ele vira publicação é o
       * dono. Nunca publicamos automaticamente: perguntamos, e o padrão é não publicar.
       */
      if (isReplacing && before !== null && after !== null) {
        setOutcome({
          fromModel: replacesName ?? 'peça anterior',
          toModel: selected!.model,
          scoreBefore: before,
          scoreAfter: after,
        });
        setStep('published');
      } else {
        router.back();
      }
    },
  });

  const publish = useMutation({
    mutationFn: () =>
      api.post('/events', {
        kind: 'UPGRADE',
        title: `Troquei ${(categoryLabel[category ?? ''] ?? 'a peça').toLowerCase()}: ${outcome!.fromModel} → ${outcome!.toModel}`,
        body: null,
        rigId: id,
        payload: {
          from: outcome!.fromModel,
          to: outcome!.toModel,
          scoreDelta: outcome!.scoreAfter - outcome!.scoreBefore,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      router.back();
    },
  });

  function back() {
    if (step === 'confirm') setStep('model');
    else if (step === 'model') setStep('family');
    else if (step === 'family') setStep('brand');
    else if (step === 'brand') setStep('category');
    else router.back();
  }

  function pick(component: CatalogComponent) {
    setSelected(component);
    // Memória e ventoinha quase sempre vêm em par ou trio; começar em 2 poupa um toque.
    setQuantity(component.category === 'RAM' || component.category === 'FAN' ? 2 : 1);
    setStep('confirm');
  }

  const title = {
    category: 'O que você quer cadastrar?',
    brand: isReplacing ? 'Qual a marca da nova peça?' : 'Qual a marca?',
    family: 'Qual a linha?',
    model: 'Qual o modelo exato?',
    confirm: isReplacing ? 'Confirmar a troca' : 'Confirmar',
    published: 'Pronto',
  }[step];

  return (
    <Screen scroll>
      <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
        <Pressable onPress={back} hitSlop={12}>
          <Txt variant="smallStrong" tone="faint">
            ← {step === 'category' ? 'Voltar' : 'Passo anterior'}
          </Txt>
        </Pressable>
      </View>

      <Txt variant="title" style={{ marginBottom: space.sm }}>
        {title}
      </Txt>

      {/* Migalhas: o usuário sempre sabe onde está. */}
      {category ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
          <Pill label={categoryLabel[category] ?? category} tint={color.accent} background={color.accentSoft} />
          {brand ? <Pill label={brand} /> : null}
          {family ? <Pill label={family} /> : null}
        </View>
      ) : (
        <View style={{ height: space.xl }} />
      )}

      {/* ---------- Passo 1: categoria ---------- */}
      {step === 'category' ? (
        <Animated.View entering={FadeInRight.duration(240)} style={{ gap: space.xl }}>
          <Field
            placeholder="Ou busque direto: RTX 4070, Ryzen 5..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />

          {search.trim().length >= 2 ? (
            <Panel style={{ paddingVertical: space.xs }}>
              {searchResults.isLoading ? (
                <View style={{ paddingVertical: space.xl }}>
                  <Loading />
                </View>
              ) : searchResults.data && searchResults.data.results.length > 0 ? (
                searchResults.data.results.map((component, index) => (
                  <View key={component.id}>
                    {index > 0 ? <Divider /> : null}
                    <Row
                      title={component.model}
                      detail={`${categoryLabel[component.category] ?? component.category} · ${component.brand} · ${component.releaseYear}`}
                      glyph={categoryIcon[component.category]}
                      onPress={() => pick(component)}
                    />
                  </View>
                ))
              ) : (
                <Txt variant="small" tone="faint" style={{ paddingVertical: space.lg, textAlign: 'center' }}>
                  Nada encontrado. Tente pela navegação abaixo.
                </Txt>
              )}
            </Panel>
          ) : (
            <>
              <View>
                <Txt variant="label" tone="faint" style={{ marginBottom: space.sm }}>
                  PEÇAS DO PC
                </Txt>
                <Panel style={{ paddingVertical: space.xs }}>
                  {CORE.map((cat, index) => (
                    <View key={cat}>
                      {index > 0 ? <Divider /> : null}
                      <Row
                        title={categoryLabel[cat] ?? cat}
                        glyph={categoryIcon[cat]}
                        onPress={() => {
                          setCategory(cat);
                          setStep('brand');
                        }}
                      />
                    </View>
                  ))}
                </Panel>
              </View>

              <View>
                <Txt variant="label" tone="faint" style={{ marginBottom: space.sm }}>
                  PERIFÉRICOS (OPCIONAL)
                </Txt>
                <Panel style={{ paddingVertical: space.xs }}>
                  {PERIPHERALS.map((cat, index) => (
                    <View key={cat}>
                      {index > 0 ? <Divider /> : null}
                      <Row
                        title={categoryLabel[cat] ?? cat}
                        glyph={categoryIcon[cat]}
                        onPress={() => {
                          setCategory(cat);
                          setStep('brand');
                        }}
                      />
                    </View>
                  ))}
                </Panel>
              </View>
            </>
          )}
        </Animated.View>
      ) : null}

      {/* ---------- Passo 2: marca ---------- */}
      {step === 'brand' ? (
        <Animated.View entering={FadeInRight.duration(240)}>
          {brands.isLoading ? (
            <Loading />
          ) : (
            <Panel style={{ paddingVertical: space.xs }}>
              {brands.data?.brands.map((item, index) => (
                <View key={item.brand}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    title={item.brand}
                    count={item.count}
                    onPress={() => {
                      setBrand(item.brand);
                      setStep('family');
                    }}
                  />
                </View>
              ))}
            </Panel>
          )}
        </Animated.View>
      ) : null}

      {/* ---------- Passo 3: família ---------- */}
      {step === 'family' ? (
        <Animated.View entering={FadeInRight.duration(240)}>
          {families.isLoading ? (
            <Loading />
          ) : (
            <Panel style={{ paddingVertical: space.xs }}>
              {families.data?.families.map((item, index) => (
                <View key={item.family}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    title={item.family}
                    count={item.count}
                    onPress={() => {
                      setFamily(item.family);
                      setStep('model');
                    }}
                  />
                </View>
              ))}
            </Panel>
          )}
        </Animated.View>
      ) : null}

      {/* ---------- Passo 4: modelo ---------- */}
      {step === 'model' ? (
        <Animated.View entering={FadeInRight.duration(240)}>
          {models.isLoading ? (
            <Loading />
          ) : (
            <Panel style={{ paddingVertical: space.xs }}>
              {models.data?.models.map((component, index) => (
                <View key={component.id}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    title={component.model}
                    detail={`${component.releaseYear}${component.discontinued ? ' · fora de linha' : ''}`}
                    onPress={() => pick(component)}
                  />
                </View>
              ))}
            </Panel>
          )}
        </Animated.View>
      ) : null}

      {/* ---------- Passo 5: quantidade e confirmação ---------- */}
      {step === 'confirm' && selected ? (
        <Animated.View entering={FadeInRight.duration(240)} style={{ gap: space.xl }}>
          <Panel style={{ gap: space.md }}>
            <Txt variant="label" tone="faint">
              {(categoryLabel[selected.category] ?? selected.category).toUpperCase()}
            </Txt>
            <Txt variant="heading">{selected.model}</Txt>
            <Txt variant="small" tone="faint">
              {selected.brand} · {selected.family} · {selected.releaseYear}
            </Txt>
          </Panel>

          {/*
            Quantidade é peça central da precisão: 2×16GB não é 1×32GB, e o engine usa
            essa diferença para detectar canal simples.
          */}
          <View style={{ gap: space.md }}>
            <Txt variant="label" tone="faint">
              QUANTAS UNIDADES?
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                hitSlop={10}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: color.raised,
                  borderWidth: 1,
                  borderColor: color.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Txt variant="heading" tone="dim">
                  −
                </Txt>
              </Pressable>

              <Txt variant="title" style={{ minWidth: 40, textAlign: 'center' }}>
                {quantity}
              </Txt>

              <Pressable
                onPress={() => setQuantity((q) => Math.min(16, q + 1))}
                hitSlop={10}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: color.raised,
                  borderWidth: 1,
                  borderColor: color.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Txt variant="heading" tone="dim">
                  +
                </Txt>
              </Pressable>

              <View style={{ flex: 1 }}>
                {selected.category === 'RAM' ? (
                  <Txt variant="small" tone="faint">
                    Dois pentes iguais ativam o canal duplo e rendem mais.
                  </Txt>
                ) : null}
              </View>
            </View>
          </View>

          <Button
            label={isReplacing ? 'Confirmar troca' : 'Adicionar ao PC'}
            onPress={() => add.mutate()}
            loading={add.isPending}
          />
        </Animated.View>
      ) : null}

      {/* ---------- Consentimento de publicação ---------- */}
      {step === 'published' && outcome ? (
        <Animated.View entering={FadeInRight.duration(240)} style={{ gap: space.xl }}>
          <Panel style={{ gap: space.lg }}>
            <Txt variant="label" tone="faint">
              TROCA REGISTRADA
            </Txt>

            <View style={{ gap: space.sm }}>
              <Txt variant="small" tone="faint" numberOfLines={1}>
                {outcome.fromModel}
              </Txt>
              <Txt variant="small" tone="accent">
                ↓
              </Txt>
              <Txt variant="heading" numberOfLines={1}>
                {outcome.toModel}
              </Txt>
            </View>

            <Divider />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Txt variant="small" tone="faint" style={{ flex: 1 }}>
                Setup Score
              </Txt>
              <Txt variant="small" tone="faint">
                {outcome.scoreBefore}
              </Txt>
              <Txt variant="small" tone="faint">
                →
              </Txt>
              <Txt
                variant="bodyStrong"
                style={{
                  color:
                    outcome.scoreAfter > outcome.scoreBefore
                      ? color.good
                      : outcome.scoreAfter < outcome.scoreBefore
                        ? color.high
                        : color.text,
                }}
              >
                {outcome.scoreAfter}
              </Txt>
            </View>
          </Panel>

          {/*
            Privacidade: nada é publicado sem a pessoa mandar. O botão de não publicar é
            tão fácil de tocar quanto o de publicar — não escondemos a saída.
          */}
          <View style={{ gap: space.md }}>
            <Txt variant="body" tone="dim">
              Quer publicar essa troca no seu feed? Só você decide — a máquina já foi
              atualizada de qualquer forma.
            </Txt>
            <Button
              label="Publicar no feed"
              onPress={() => {
                setPublishing(true);
                publish.mutate();
              }}
              loading={publishing && publish.isPending}
            />
            <Button label="Não publicar" variant="ghost" onPress={() => router.back()} />
          </View>
        </Animated.View>
      ) : null}
    </Screen>
  );
}
