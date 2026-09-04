/**
 * Primitivos de interface.
 *
 * Poucos componentes, usados em todo lugar. É assim que o app fica coeso sem virar um
 * catálogo de variações — cada um resolve um problema e não tenta resolver dois.
 */

import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { color, radius, space, type as typo } from './theme.ts';

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

type TextVariant = keyof typeof typo;

export function Txt({
  variant = 'body',
  tone = 'default',
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  tone?: 'default' | 'dim' | 'faint' | 'accent' | 'inherit';
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const toneColor =
    tone === 'dim'
      ? color.textDim
      : tone === 'faint'
        ? color.textFaint
        : tone === 'accent'
          ? color.accent
          : tone === 'inherit'
            ? undefined
            : color.text;

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[typo[variant] as TextStyle, toneColor ? { color: toneColor } : null, style]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

/** Container de tela. Cuida de fundo, safe area e rolagem — sempre igual. */
export function Screen({
  children,
  scroll = false,
  padded = true,
  style,
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<import('react-native').RefreshControlProps>;
}) {
  const insets = useSafeAreaInsets();
  const base: ViewStyle = {
    flex: 1,
    backgroundColor: color.bg,
    paddingTop: insets.top,
  };

  if (!scroll) {
    return (
      <View style={[base, padded && { paddingHorizontal: space.xl }, style]}>{children}</View>
    );
  }

  return (
    <View style={[base, style]}>
      <ScrollView
        contentContainerStyle={[
          padded && { paddingHorizontal: space.xl },
          { paddingBottom: insets.bottom + space.xxxl },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Botão
// ---------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'md',
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;

  const palette = {
    primary: { bg: color.accent, fg: '#04101F', border: 'transparent' },
    secondary: { bg: color.raised, fg: color.text, border: color.border },
    ghost: { bg: 'transparent', fg: color.textDim, border: 'transparent' },
    danger: { bg: 'transparent', fg: color.critical, border: color.border },
  }[variant];

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border === 'transparent' ? 0 : 1,
          borderRadius: radius.md,
          paddingVertical: size === 'sm' ? 9 : 15,
          paddingHorizontal: size === 'sm' ? space.lg : space.xl,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: inactive ? 0.45 : pressed ? 0.82 : 1,
          // Escala mínima: o toque precisa responder, não coreografar.
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <Text
          style={[
            size === 'sm' ? typo.smallStrong : typo.bodyStrong,
            { color: palette.fg },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Campo de texto
// ---------------------------------------------------------------------------

export const Field = forwardRef<TextInput, TextInputProps & { label?: string; hint?: string; error?: string | null }>(
  function Field({ label, hint, error, style, ...props }, ref) {
    return (
      <View style={{ gap: space.sm }}>
        {label ? (
          <Txt variant="label" tone="faint">
            {label.toUpperCase()}
          </Txt>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={color.textFaint}
          style={[
            typo.body as TextStyle,
            {
              color: color.text,
              backgroundColor: color.surface,
              borderWidth: 1,
              borderColor: error ? color.critical : color.border,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: 14,
            },
            style,
          ]}
          {...props}
        />
        {error ? (
          <Txt variant="small" style={{ color: color.critical }}>
            {error}
          </Txt>
        ) : hint ? (
          <Txt variant="small" tone="faint">
            {hint}
          </Txt>
        ) : null}
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// Estrutura
// ---------------------------------------------------------------------------

/** Bloco de conteúdo. Borda sutil em vez de sombra — em fundo escuro, funciona melhor. */
export function Panel({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={[
        {
          backgroundColor: color.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.borderSoft,
          padding: space.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {content}
    </Pressable>
  );
}

/** Rótulo de seção. Cria hierarquia sem custar peso visual. */
export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Txt variant="label" tone="faint" style={[{ marginBottom: space.md }, style]}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Txt>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: color.borderSoft }, style]} />;
}

/** Etiqueta compacta. Usada para severidade, categoria e status. */
export function Pill({
  label,
  tint = color.textDim,
  background,
  style,
}: {
  label: string;
  tint?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: background ?? 'transparent',
          borderColor: background ? 'transparent' : color.border,
          borderWidth: background ? 0 : 1,
          borderRadius: radius.full,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        style,
      ]}
    >
      <Text style={[typo.label as TextStyle, { color: tint }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <ActivityIndicator color={color.accent} />
      {label ? (
        <Txt variant="small" tone="faint">
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * Estado vazio. Sempre com uma ação — tela vazia sem saída é o lugar onde produto morre.
 */
export function Empty({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl, gap: space.md }}
    >
      <Txt variant="subheading" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="body" tone="dim" style={{ textAlign: 'center', maxWidth: 300 }}>
        {description}
      </Txt>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: space.md }} />
      ) : null}
    </Animated.View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.md }}>
      <Txt variant="subheading" style={{ textAlign: 'center' }}>
        Não foi possível carregar
      </Txt>
      <Txt variant="body" tone="dim" style={{ textAlign: 'center', maxWidth: 300 }}>
        {message}
      </Txt>
      {onRetry ? <Button label="Tentar de novo" variant="secondary" onPress={onRetry} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

/** Barra de progresso fina. Usada nas dimensões do score e em barras de comparação. */
export function Meter({
  value,
  tint = color.accent,
  height = 4,
  track = color.raised,
}: {
  /** 0 a 100. */
  value: number;
  tint?: string;
  height?: number;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={{ height, backgroundColor: track, borderRadius: radius.full, overflow: 'hidden' }}
    >
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: tint, borderRadius: radius.full }} />
    </View>
  );
}

/** Avatar por inicial. Evita rede e placeholder cinza até existir upload de imagem. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: color.raised,
        borderWidth: 1,
        borderColor: color.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: color.textDim, fontSize: size * 0.36, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

export { Pressable, type PressableProps };
