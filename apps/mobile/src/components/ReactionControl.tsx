/**
 * Reação por gesto contínuo: segurar → revelar → deslizar → soltar.
 *
 * Por que um gesto e não três botões: três botões permanentes ocupam espaço em toda
 * publicação e transformam o feed numa barra de controles. O gesto mantém a lista limpa
 * e ainda assim dá acesso imediato às três reações.
 *
 * É UM gesto só (`Pan` com `activateAfterLongPress`), não uma sequência de handlers.
 * Isso importa: o dedo nunca precisa levantar entre segurar e escolher, que é o que faz
 * a interação parecer contínua em vez de uma sucessão de toques.
 *
 * Toda a animação roda na thread de UI via worklets — nenhum quadro depende do JS.
 */

import { useCallback } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { color, radius, space, type as typo } from '../theme.ts';

export type ReactionKind = 'LOVE' | 'LIKE' | 'DISLIKE';

interface ReactionOption {
  kind: ReactionKind;
  emoji: string;
  label: string;
  tint: string;
}

const OPTIONS: ReactionOption[] = [
  { kind: 'LOVE', emoji: '❤️', label: 'Amei', tint: color.love },
  { kind: 'LIKE', emoji: '👍', label: 'Legal', tint: color.like },
  { kind: 'DISLIKE', emoji: '👎', label: 'Não curti', tint: color.dislike },
];

const ITEM_SIZE = 46;
const ITEM_GAP = 6;
const SLOT = ITEM_SIZE + ITEM_GAP;
const TRAY_PADDING = 8;

/** Retorno tátil só existe no aparelho; na web é ruído no console. */
function tap(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(style);
}

export function ReactionControl({
  current,
  counts,
  onReact,
  onClear,
}: {
  current: ReactionKind | null;
  counts: { LOVE: number; LIKE: number; DISLIKE: number };
  onReact: (kind: ReactionKind) => void;
  onClear: () => void;
}) {
  /** 0 = fechado, 1 = bandeja aberta. */
  const open = useSharedValue(0);
  /** Índice sob o dedo, ou -1. */
  const active = useSharedValue(-1);

  const total = counts.LOVE + counts.LIKE + counts.DISLIKE;
  const selected = current ? OPTIONS.find((o) => o.kind === current)! : null;

  const commit = useCallback(
    (index: number) => {
      if (index < 0) return;
      const option = OPTIONS[index]!;
      tap(Haptics.ImpactFeedbackStyle.Medium);
      // Escolher a reação que já está ativa desfaz — o mesmo gesto liga e desliga.
      if (option.kind === current) onClear();
      else onReact(option.kind);
    },
    [current, onReact, onClear],
  );

  const openTray = useCallback(() => tap(Haptics.ImpactFeedbackStyle.Light), []);
  const hoverTick = useCallback(() => tap(Haptics.ImpactFeedbackStyle.Light), []);

  /**
   * O gesto é ancorado no início do toque, então o mapeamento de posição para item
   * independe de onde o botão está na tela.
   */
  const gesture = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      open.value = withSpring(1, { damping: 16, stiffness: 220 });
      active.value = 0;
      runOnJS(openTray)();
    })
    .onUpdate((event) => {
      // A bandeja abre para a direita a partir do botão; x=0 é o centro do primeiro item.
      const index = Math.round(event.translationX / SLOT);
      const clamped = Math.max(0, Math.min(OPTIONS.length - 1, index));
      // Arrastar muito para baixo cancela — saída natural para quem se arrependeu.
      const cancelled = event.translationY > 90;
      const next = cancelled ? -1 : clamped;
      if (next !== active.value) {
        active.value = next;
        if (next >= 0) runOnJS(hoverTick)();
      }
    })
    .onEnd(() => {
      if (active.value >= 0) runOnJS(commit)(active.value);
      open.value = withTiming(0, { duration: 160 });
      active.value = -1;
    })
    .onFinalize(() => {
      open.value = withTiming(0, { duration: 160 });
      active.value = -1;
    });

  /** Toque simples alterna "Legal" — o caminho rápido para a reação mais comum. */
  const quickTap = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Light);
    if (current === 'LIKE') onClear();
    else onReact('LIKE');
  }, [current, onReact, onClear]);

  const trayStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [
      { translateY: interpolate(open.value, [0, 1], [10, -(ITEM_SIZE + 20)]) },
      { scale: interpolate(open.value, [0, 1], [0.86, 1]) },
    ],
    // `none` quando fechada para não roubar toques do conteúdo abaixo.
    pointerEvents: 'none',
  }));

  return (
    <View>
      {/* Bandeja. Fica fora do fluxo para não empurrar o layout do post ao abrir. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: -TRAY_PADDING,
            bottom: 0,
            flexDirection: 'row',
            gap: ITEM_GAP,
            backgroundColor: color.raised,
            borderColor: color.border,
            borderWidth: 1,
            borderRadius: radius.full,
            padding: TRAY_PADDING,
            zIndex: 10,
          },
          trayStyle,
        ]}
      >
        {OPTIONS.map((option, index) => (
          <TrayItem key={option.kind} option={option} index={index} active={active} />
        ))}
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Pressable
          onPress={quickTap}
          accessibilityRole="button"
          accessibilityLabel={
            selected ? `Sua reação: ${selected.label}. Toque para remover.` : 'Reagir. Segure para escolher.'
          }
          accessibilityHint="Segure e deslize para escolher entre Amei, Legal e Não curti."
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginLeft: -10,
            borderRadius: radius.full,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Animated.Text style={{ fontSize: 15 }}>{selected ? selected.emoji : '🤍'}</Animated.Text>
          <Animated.Text
            style={[
              typo.smallStrong,
              { color: selected ? selected.tint : color.textFaint },
            ]}
          >
            {total > 0 ? String(total) : 'Reagir'}
          </Animated.Text>
        </Pressable>
      </GestureDetector>
    </View>
  );
}

/** Item da bandeja. Cresce e revela o rótulo quando o dedo passa por cima. */
function TrayItem({
  option,
  index,
  active,
}: {
  option: ReactionOption;
  index: number;
  active: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const isActive = active.value === index;
    return {
      transform: [{ scale: withSpring(isActive ? 1.28 : 1, { damping: 13, stiffness: 260 }) }],
      backgroundColor: withTiming(isActive ? option.tint + '26' : 'transparent', { duration: 120 }),
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(active.value === index ? 1 : 0, { duration: 120 }),
    transform: [{ translateY: withTiming(active.value === index ? 0 : 4, { duration: 120 }) }],
  }));

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={[
          {
            width: ITEM_SIZE,
            height: ITEM_SIZE,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Animated.Text style={{ fontSize: 24 }}>{option.emoji}</Animated.Text>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -24,
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 1,
            borderRadius: radius.full,
            paddingHorizontal: space.sm,
            paddingVertical: 3,
          },
          labelStyle,
        ]}
      >
        <Animated.Text style={[typo.label, { color: color.text }]}>
          {option.label.toUpperCase()}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}
