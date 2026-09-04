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

---

## 4. Expo Go do celular está no SDK 54; o projeto está no SDK 57

**O que acontece**

Você pediu um link para abrir no Expo Go. O link está de pé (ver abaixo), mas um Expo Go
carrega **um** SDK por vez — o da versão instalada. Um Expo Go de SDK 54 recusa um projeto
SDK 57 com "Project is incompatible with this version of Expo Go".

**A saída, em ordem de custo**

1. **Baixar o Expo Go do SDK 57 em `expo.dev/go`.** Ali dá para escolher a versão do SDK
   explicitamente e instalar o APK. É o caminho certo independentemente do que a loja esteja
   servindo hoje — não conferi qual SDK a Play Store entrega no seu aparelho, e um Expo Go de
   SDK 58 recusaria este projeto do mesmo jeito que o de 54.
2. **Atualizar o Expo Go pela Play Store**, se a versão de lá for justamente a do SDK 57.
   Mais simples, mas depende de sorte com a propagação da atualização.
3. **Rebaixar o projeto para SDK 54** — descartado. Levaria junto React Native 0.86 e
   Reanimated 4, e o gesto de reação (que roda na thread de UI) depende deles. Trocar a
   fundação do app para caber num aplicativo desatualizado é a decisão errada.

**Por que eu não resolvo sozinho:** instalar/atualizar aplicativo no seu celular é ação física
sua. Do meu lado o túnel já está servindo o manifesto (HTTP 200, verificado).

**Como ligar o app no celular**

```
cd apps/mobile && npx expo start --tunnel
```

O túnel usa `@expo/ngrok` (já instalado como devDependency). O endereço sai no terminal em
QR code; se estiver rodando em modo não interativo, ele também aparece em
`http://127.0.0.1:4040/api/tunnels`. Na mesma Wi-Fi, `npx expo start` sozinho já basta e é
mais rápido — o celular acha a máquina em `10.100.20.42:8081`.

---

## 5. Deploy da API precisa da sua aprovação nesta sessão

O código do marketplace está pronto, tipado, testado e a tabela `Listing` **já está no
Postgres de produção** (`prisma db push` rodou). Falta só publicar a API nova:

```
railway up --detach --service api
```

Tanto o comando quanto a ferramenta equivalente do Railway foram bloqueados pelo
classificador de permissão desta sessão — não é falha técnica nem credencial faltando. Até
esse comando rodar, o app apontando para produção mostra o Mercado com erro de rota, porque
`/market` ainda não existe lá. Contra a API local (`localhost:3333`) tudo passa.

Isso também afeta a verificação visual: `scripts/verify.mjs` aponta para produção por padrão,
e as três telas de mercado ficam **puladas** (com aviso no terminal) até o deploy. Para vê-las
antes disso, suba a API local e um Metro que aponte para ela:

```
cd apps/api   && node --experimental-transform-types --env-file=.env src/server.ts
cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3333 npx expo start --web --port 8083
cd apps/mobile && APP_URL=http://localhost:8083 API_URL=http://localhost:3333 node scripts/verify.mjs
```
