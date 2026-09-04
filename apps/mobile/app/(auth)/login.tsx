import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, Field, Screen, Txt } from '../../src/ui.tsx';
import { space } from '../../src/theme.ts';
import { useSession } from '../../src/session.tsx';
import { ApiError } from '../../src/api.ts';

export default function Login() {
  const router = useRouter();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: space.xxl, gap: space.xxl }}>
          <View style={{ gap: space.sm }}>
            <Txt variant="title">Entrar</Txt>
            <Txt variant="body" tone="dim">
              Bom te ver de novo.
            </Txt>
          </View>

          <View style={{ gap: space.lg }}>
            <Field
              label="E-mail"
              placeholder="voce@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Field
              label="Senha"
              placeholder="Sua senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              error={error}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          </View>

          <View style={{ gap: space.md }}>
            <Button
              label="Entrar"
              onPress={submit}
              disabled={!email.includes('@') || password.length === 0}
              loading={busy}
            />
            <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
