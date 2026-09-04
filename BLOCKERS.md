# Bloqueios

Itens que exigem ação física, credencial ou privilégio que eu não tenho. **Nenhum deles
interrompeu o restante do projeto** — em cada caso segui por um caminho alternativo, descrito abaixo.

---

## 1. Emulador Android não sobe (falta driver de aceleração)

**O que acontece**

```
ERROR | x86_64 emulation currently requires hardware acceleration!
CPU acceleration status: Android Emulator hypervisor driver is not installed on this machine
```

O SDK está completo em `C:\Android\sdk`, as AVDs existem (`Orla_API34`, `test_avd`) e o
`adb` funciona. Falta apenas o driver de virtualização.

**Por que eu não resolvo sozinho**

As duas saídas exigem elevação de administrador, que esta sessão não tem:

- instalar o AEHD, já baixado em
  `C:\Android\sdk\extras\google\Android_Emulator_Hypervisor_Driver\silent_install.bat`;
- ou habilitar o Windows Hypervisor Platform / Hyper-V
  (`Get-WindowsOptionalFeature` respondeu *"A operação requer elevação"*).

Instalar driver de sistema é uma mudança que eu não faço sem o seu aval explícito.

**O que fazer quando você voltar** — abra um terminal **como administrador** e rode:

```
C:\Android\sdk\extras\google\Android_Emulator_Hypervisor_Driver\silent_install.bat
```

Depois confira com `C:\Android\sdk\emulator\emulator.exe -accel-check`.
Alternativa sem instalar nada: ligar o celular Android por USB com depuração USB ativada —
`adb devices` deve listá-lo, e aí `npx expo start --android` roda no aparelho de verdade.

**Como contornei**

A verificação visual foi feita via **Expo Web (react-native-web)**, que renderiza os
componentes React Native reais no navegador. Isso valida layout, tipografia, cor,
hierarquia, espaçamento, estados de carregamento e navegação — e foi inspecionado
com automação de browser, não "no escuro".

**O que ainda precisa de aparelho real para eu assinar embaixo:** a *sensação* do gesto de
reação (segurar → deslizar → soltar), o retorno háptico, o desfoque nativo (`expo-blur`) e
o desempenho de rolagem sob dedo. A lógica do gesto está coberta por teste; o tato, não.

---

## 2. iOS não pode ser compilado nem testado nesta máquina

A especificação pede Android **e** iOS com experiência nativa nas duas plataformas.

O código está pronto para as duas: é um app Expo/React Native sem nenhuma dependência
exclusiva de Android, e o `app.json` já traz a configuração de iOS (bundle identifier,
`supportsTablet`). O que falta é apenas **compilar e ver rodando**, e isso a Apple exige
que seja feito em macOS.

**Caminhos, quando você quiser fechar isso**

1. **EAS Build** (não precisa de Mac): `npx eas build --platform ios`. Exige conta paga no
   Apple Developer Program (US$ 99/ano) e login Expo. É o caminho recomendado.
2. **Expo Go num iPhone**: dá para abrir o app hoje mesmo, sem Mac e sem conta paga, mas
   sem build nativa própria.
3. **Um Mac** com Xcode, para build local e publicação na App Store.

**Decisão que ficou para você:** a conta do Apple Developer Program, por ser uma compra.

---

## 3. Distribuição por APK (Android) — pendente de decisão sua

A especificação pede distribuição por APK além das lojas. Isso está resolvido pelo
`eas build --platform android --profile preview`, que gera um APK instalável.

Não executei porque exige login na sua conta Expo. Não é um impedimento técnico: é uma
credencial. Quando você fizer `npx eas login`, o perfil `preview` já está configurado em
`apps/mobile/eas.json`.
