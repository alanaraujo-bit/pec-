# Pecê

Plataforma social e de inteligência sobre computadores. O usuário cadastra o PC uma vez, e
o app passa a entender a máquina: aponta o que está segurando o desempenho, o que vale a
pena trocar, o que **não** vale, quanto o setup vale e como ele evoluiu ao longo do tempo.

---

## O princípio que manda em tudo

> **O sistema precisa ser capaz de dizer: "seu PC está bom, não faça upgrade agora."**

Isso não é uma frase de efeito — é uma regra implementada e travada por teste. Um PC bem
casado recebe `verdict: 'healthy'` e **nenhum** cenário de compra é gerado. Publicidade,
afiliados ou marketplace jamais podem alterar a verdade técnica.

O outro lado da mesma moeda está no Setup Score: um PC de R$ 8.000 equilibrado **vence** um
de R$ 20.000 desequilibrado. O teste `PC mais barato e equilibrado vence PC caro e
desequilibrado` existe justamente para impedir que o produto vire um ranking de quem gastou mais.

---

## Arquitetura

```
packages/core     Domínio puro em TypeScript. Sem banco, sem HTTP, sem React.
                  Modelo de FPS, diagnóstico, Setup Score, valuation, comparação,
                  compatibilidade e o catálogo de hardware.

apps/api          Fastify + Prisma + PostgreSQL (Railway).
                  Consome o core; nenhuma regra de domínio vive aqui.

apps/mobile       Expo SDK 57 / React Native 0.86 / expo-router.
                  Android e iOS nativos. Não é PWA.
```

**Por que o domínio é um pacote separado:** a inteligência precisa ser a mesma no servidor
hoje e poder rodar no dispositivo amanhã (PC Companion). Se ela morasse dentro das rotas,
essa porta estaria fechada. Também é o que garante que a tela nunca discorde do histórico.

**Por que o catálogo é estruturado:** o usuário nunca digita "rtx 3070" livremente — ele
seleciona uma entrada real do catálogo, em três níveis (marca → família → modelo). Texto
livre não diz se é 8GB ou Ti, e sem isso não existe gargalo, score nem valor confiáveis.

---

## Estado atual

| Área | Situação |
|---|---|
| Engine de domínio | ✅ 35 testes passando |
| API em produção | ✅ 70 verificações ponta a ponta contra o Postgres real |
| App mobile | ✅ 15 telas, sem erro de console |
| Deploy | ✅ https://api-production-eb453.up.railway.app |
| Emulador Android | ⛔ Bloqueado — ver [BLOCKERS.md](BLOCKERS.md) |
| iOS | ⛔ Exige macOS ou EAS Build — ver [BLOCKERS.md](BLOCKERS.md) |

---

## Rodando localmente

```bash
npm install

# API — precisa de apps/api/.env (copie de apps/api/.env.example)
npm run api:dev

# App
cd apps/mobile && npx expo start
```

### Testes

```bash
# Domínio: modelo de FPS, diagnóstico, score, cenários
cd packages/core && node --test src/engine/performance.test.ts src/engine/diagnosis.test.ts

# Gesto de reação (lógica pura)
cd apps/mobile && node --test src/components/reactionGesture.test.ts

# Ponta a ponta contra a API (local ou de produção)
cd apps/api && node scripts/smoke.mjs
API_URL=https://api-production-eb453.up.railway.app node scripts/smoke.mjs
```

### Verificação visual

Como o emulador não sobe nesta máquina (BLOCKERS.md), a conferência visual roda em Chrome
headless com emulação de celular real via CDP. O script cria uma conta de verdade, monta um
PC com peças do catálogo e fotografa cada tela, reportando erros de console:

```bash
cd apps/mobile
npx expo start --web          # em um terminal
node scripts/verify.mjs       # em outro; capturas em .shots/
```

---

## Decisões que valem conhecer antes de mexer

**O modelo de FPS é calibrado, não chutado.** Os coeficientes em `engine/performance.ts`
foram ajustados contra pares CPU/GPU conhecidos, e `performance.test.ts` trava esses pontos.
Se alguém mudar um coeficiente e quebrar a realidade, o teste acusa.

**Gargalo de CPU e de GPU não são simétricos.** Estar limitado pela GPU é o estado *normal*
de um PC de jogo — significa que a placa está sendo usada até o fim. Estar limitado pela CPU
significa desempenho já comprado e parado. Tratar os dois igual faria o produto acusar de
"desequilibrado" um 7800X3D com uma 4070 Super, que é uma das melhores combinações que existem.

**Peça trocada não é apagada.** `RigComponent.removedAt` preserva a história — o PC Evolution
é funcionalidade, não log.

**Evento automático nunca publica sozinho.** Trocar uma peça registra a mudança na máquina e
então *pergunta* se o usuário quer publicar. O botão de não publicar é tão fácil de tocar
quanto o de publicar.

**Privacidade tem padrão fechado.** Visibilidade da máquina, exposição do valor estimado e
escopo dos eventos são explícitos e começam no mais restrito.

---

## Documentos

- [PROGRESS.md](PROGRESS.md) — estado detalhado, decisões e próximos passos
- [BLOCKERS.md](BLOCKERS.md) — o que precisa de ação sua, e como contornei cada caso
