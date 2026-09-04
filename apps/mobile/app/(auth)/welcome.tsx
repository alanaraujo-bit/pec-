/**
 * Boas-vindas.
 *
 * Uma tela, uma promessa, duas saídas. Sem carrossel de recursos: se o produto precisa
 * de quatro slides para se explicar, o problema não é o slide.
 */

import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button, Screen, Txt } from '../../src/ui.tsx';
import { space } from '../../src/theme.ts';

export default function Welcome() {
  const router = useRouter();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: space.xxxl }}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Txt variant="label" tone="accent" style={{ marginBottom: space.lg }}>
            PECÊ
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(520)}>
          <Txt variant="display" style={{ marginBottom: space.lg }}>
            Seu PC,{'\n'}entendido de verdade.
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(520)}>
          <Txt variant="body" tone="dim" style={{ maxWidth: 330, marginBottom: space.xxxl }}>
            Cadastre seu computador uma vez. O Pecê descobre o que está segurando ele, o
            que vale a pena trocar — e o que não vale.
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(520)} style={{ gap: space.md }}>
          <Button label="Criar minha conta" onPress={() => router.push('/(auth)/register')} />
          <Button
            label="Já tenho conta"
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
          />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(400)}>
          <Txt
            variant="small"
            tone="faint"
            style={{ textAlign: 'center', marginTop: space.xl, lineHeight: 18 }}
          >
            O Pecê nunca recomenda uma peça por comissão.{'\n'}
            Se o seu PC está bom, ele vai dizer que está bom.
          </Txt>
        </Animated.View>
      </View>

    </Screen>
  );
}
