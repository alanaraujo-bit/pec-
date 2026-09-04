import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, Field, Screen, Txt } from '../../src/ui.tsx';
import { space } from '../../src/theme.ts';
import { useSession } from '../../src/session.tsx';
import { ApiError } from '../../src/api.ts';

export default function Register() {
  const router = useRouter();
  const { signUp } = useSession();

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit =
    displayName.trim().length > 0 && handle.length >= 3 && email.includes('@') && password.length >= 8;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signUp({ displayName: displayName.trim(), handle, email: email.trim(), password });
      // O porteiro em _layout leva para o onboarding assim que a sessão existe.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: space.xxl, gap: space.xxl }}>
          <View style={{ gap: space.sm }}>
            <Txt variant="title">Criar conta</Txt>
            <Txt variant="body" tone="dim">
              Leva menos de um minuto.
            </Txt>
          </View>

          <View style={{ gap: space.lg }}>
            <Field
              label="Nome"
              placeholder="Como você quer aparecer"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Field
              label="Seu @"
              placeholder="alan"
              value={handle}
              // O @ é a identidade pública: normalizamos na digitação para evitar erro depois.
              onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              hint="Letras minúsculas, números e underline."
            />
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
              placeholder="Pelo menos 8 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              error={error}
            />
          </View>

          <View style={{ gap: space.md }}>
            <Button label="Criar conta" onPress={submit} disabled={!canSubmit} loading={busy} />
            <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
