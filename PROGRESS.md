# Pecê — Estado e Retomada

> Documento vivo. Quem pegar o projeto daqui — pessoa ou IA — deve conseguir continuar
> sem reler o histórico da conversa. Atualize ao concluir cada etapa.

**Última atualização:** 04/09/2026
**Repositório:** https://github.com/alanaraujo-bit/pec-
**API em produção:** https://api-production-eb453.up.railway.app

---

## 1. Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| Mobile | Expo SDK 57 / RN 0.86 / expo-router | Android e iOS nativos reais, não PWA |
| Animação | Reanimated 4 + Gesture Handler | O gesto de reação roda na thread de UI |
| Backend | Fastify + TypeScript + Prisma | Performance e tipagem ponta a ponta |
| Banco | PostgreSQL no Railway | Persistência real desde o primeiro dia |
| Domínio | `packages/core` (TS puro) | Engine determinística, compartilhável |

**Vercel foi descartado.** O produto é React Native + API no Railway; espalhar por duas
plataformas não agregaria nada.

**IA generativa não está no núcleo.** Regras, índices e compatibilidade são determinísticos.
IA fica reservada para uma futura camada de explicação — a verdade técnica não pode depender
de resposta generativa.

---

## 2. Infraestrutura provisionada

| Recurso | Identificador |
|---|---|
| Projeto Railway | `pece` — `01208a56-40f9-4208-9969-d12897eb6cbd` |
| Ambiente | `production` — `82727ddf-776d-4196-a78d-eddfc48d59da` |
| Serviço Postgres | `dc3039aa-4411-4372-935d-f790cee786cf` |
| Serviço API | `418e0869-deef-496a-a179-04f2e5e61f01` |
| Proxy público do banco | `altaria.proxy.rlwy.net:43103` |
| Domínio da API | `api-production-eb453.up.railway.app` |

Credenciais ficam no Railway e em `apps/api/.env` (fora do Git). Modelo em `.env.example`.

**Deploy:** `railway up --detach --service api`
**Migração e seed são manuais de propósito** — o container não roda `db push` no boot, porque
o Railway reinicia containers sozinho e `--accept-data-loss` a cada reinício arriscaria dados
de produção. Por isso, mexer no schema é sempre dois passos: `npx prisma db push` contra o
proxy público **e depois** o deploy. A tabela `Listing` já foi ao banco de produção assim.

---

## 3. O que está pronto

### `packages/core` — domínio (52 testes ✅)

- **Modelo de FPS** calibrado contra pares CPU/GPU reais, com pontos de calibração travados
  por teste. Trata gargalo de CPU e de GPU de forma assimétrica (ver seção 6).
- **Diagnóstico** com achados ordenados por severidade e impacto, cada um com
  o quê / por quê / como / camada técnica.
- **Setup Score** em 5 dimensões explicadas: desempenho, equilíbrio, adequação, saúde, eficiência.
- **Cenários de upgrade** (econômico / equilibrado / entusiasta) com peças reais, já filtradas
  por compatibilidade e por ganho mínimo de 8%.
- **Valuation** regional com curva de depreciação, sempre em faixa — nunca número exato.
- **Comparação** contextual: o vencedor depende do perfil de quem pergunta.
- **Marketplace** (`market/listing.ts`): rascunho de anúncio a partir de uma peça do PC,
  leitura do preço pedido em quatro faixas explicadas e ciclo de vida do anúncio. Sem preço
  de referência no catálogo, devolve `null` em vez de inventar valor.
- **PC Health** (`health/health.ts`): eixo próprio, com nota, status e checks de
  refrigeração, energia, montagem, desgaste e manutenção. Todo check declara se resolver
  **custa dinheiro** — e a tela mostra primeiro o que não custa. Desgaste só é afirmado
  quando existe data de compra declarada; sem ela, vira lacuna declarada, não acusação.
- **Catálogo:** 167 componentes com specs reais (35 CPUs, 35 GPUs, placas, memória,
  armazenamento, fontes, coolers, gabinetes, monitores, periféricos).

### `apps/api` — Fastify + Prisma (118 verificações ponta a ponta ✅)

Auth, catálogo guiado em 3 níveis, máquinas, inteligência, valor, histórico/evolução, feed,
eventos, reações, comentários, perfil, rankings, comparação, marketplace, saúde do PC e
remoção de conta.

`recordSnapshot` e `loadRigContext` moram em `src/snapshots.ts`, não dentro de uma rota: hoje
quatro caminhos diferentes mudam a máquina (adicionar, trocar, remover e vender peça), e se
cada um gravasse seu próprio retrato, um deles acabaria gravando diferente.

### `apps/mobile` — Expo (19 telas, sem erro de console ✅)

Boas-vindas, login, cadastro, onboarding em 4 passos, Home com feed, Meus PCs, detalhe da
máquina, diagnóstico, cadastro guiado de peça, evolução, rankings, perfil próprio e de
terceiros, detalhe de evento com comentários, comparação, saúde do PC, mercado, detalhe de
anúncio e anúncio de peça.

---

## 4. Como verificar que está tudo de pé

```bash
# Domínio — use o glob (npm test), não uma lista de arquivos: com lista, um teste novo
# some da suíte sem ninguém perceber.
cd packages/core && npm test

# Gesto de reação
cd apps/mobile && node --test src/components/reactionGesture.test.ts

# API de produção, ponta a ponta
cd apps/api && API_URL=https://api-production-eb453.up.railway.app node scripts/smoke.mjs

# Visual (Metro precisa estar rodando com --web)
cd apps/mobile && npx expo start --web    # terminal 1
cd apps/mobile && node scripts/verify.mjs # terminal 2
```

---

## 5. Próximos passos, em ordem de valor

1. **Registro de manutenção** — o eixo de saúde existe, mas deduz manutenção pelo tempo de
   instalação. Um modelo `Maintenance` (rigId, tipo, data, notas) tornaria a dedução um fato,
   e `EventKind.MAINTENANCE` já existe esperando por ele.
2. **Notificações** — mudança relevante de preço, oportunidade de upgrade, atividade social.
3. **Preços reais de mercado** — hoje a valuation parte do MSRP com depreciação modelada.
   Ingestão de preço real (novo e usado) tornaria a estimativa muito mais precisa.
4. **Expandir o catálogo** — 167 peças cobrem o comum no Brasil. A ingestão é aditiva:
   acrescentar uma peça é acrescentar uma linha, sem tocar no engine.
5. **PC Companion (Windows)** — a arquitetura já está preparada; o domínio não depende do servidor.
6. **Fechar iOS e APK** — depende de credenciais suas, ver BLOCKERS.md.

---

## 6. Armadilhas — leia antes de mexer no engine

**Não simetrize o gargalo.** Limitado por GPU é o estado normal e desejável de um PC de jogo.
Limitado por CPU é desempenho comprado e parado. `wastedPotential()` implementa essa
assimetria e alimenta tanto o diagnóstico quanto o score, para os dois nunca se contradizerem.
Tratar igual faria o produto acusar de "desequilibrado" um 7800X3D com uma 4070 Super.

**Não transforme o score em ranking de preço.** Só uma das cinco dimensões olha desempenho
bruto, e ela é comprimida por raiz de propósito. O teste `PC mais barato e equilibrado vence
PC caro e desequilibrado` guarda essa promessa.

**Não gere cenário quando o veredito é `healthy`.** Lista vazia é a resposta certa.

**Não deixe o app recalcular domínio.** A API devolve tudo pronto pelo core. Já corrigi um
caso em que o perfil deduzia o veredito pelo score — a tela passou a discordar do engine.
No marketplace isso apareceu de novo: a tela de anunciar precisa reagir enquanto a pessoa
digita o preço. A saída **não** foi reimplementar a regra no app — foi `priceBands()`, que
manda as faixas com rótulo e explicação prontos, e um teste percorre 3.000 preços conferindo
que a faixa mostrada é a mesma que o servidor aplica ao salvar.

**Não deixe o marketplace ter preço próprio.** A faixa do anúncio é a da valuation, e o
engine avalia o preço sem nunca proibi-lo — `assessAskingPrice` devolve leitura, não permissão.
`listing.test.ts` compara diagnóstico e Setup Score antes e depois de anunciar todas as peças
do PC: se a monetização começar a mexer na verdade técnica, ele quebra primeiro.

**Anúncio nunca publica sozinho.** `publishEvent` chega `false` por padrão nas rotas de criar
e de vender. Vender marca `removedAt` na peça, como a troca — nunca DELETE.

**Health é o que se resolve sem comprar nada.** É o que dá identidade ao eixo e o que o
impede de virar uma segunda lista de compras. Todo `HealthCheck` carrega `costsMoney`, a
ordenação desempata a favor do que é grátis e a tela separa "dá para resolver sem gastar"
de "exige troca de peça". `health.test.ts` trava que um problema de saúde com conserto
grátis não gera cenário de compra.

**Health não reimplementa térmica, energia nem compatibilidade.** Ele consome
`analyzeThermals`, `analyzePower` e `analyzeCompatibility` — os mesmos do diagnóstico. Um
teste percorre os achados dos dois eixos e exige texto idêntico para o mesmo `id`. Reescrever
essa análise dentro do `health.ts` é exatamente como a aba Saúde passaria a discordar do
diagnóstico sobre a mesma máquina.

**Idade em Health ≠ idade na valuation.** Lá o ano de lançamento é piso da idade: um modelo
de 2018 vale menos hoje, tenha sido comprado quando for. Desgaste conta tempo *ligado*, e
uma fonte modelo 2018 comprada lacrada em 2025 não tem oito anos de uso. `serviceYears()`
devolve `null` sem `acquiredAt`, e a lacuna é declarada em vez de chutada — copiar a regra
da valuation aqui faria o produto mandar trocar a fonte de quem acabou de comprá-la.

**A dimensão `health` do Setup Score vem de `assessHealth`, não de filtrar achados.** Ao
unificar, achados de armazenamento saíram da saúde (— "instale um SSD" é desempenho, e já
pesava em `power` e `balance`; descontar de novo era punir duas vezes) e desgaste entrou.
Efeito medido: PC equilibrado e PC barato inalterados; PC caro e desequilibrado foi de 59
para 61, e a margem do teste `PC mais barato... vence...` foi de 22 para 20 pontos.

**O Setup Score passou a depender do tempo.** Consequência direta do item acima: com
desgaste dentro da dimensão de saúde, a nota de uma máquina parada cai devagar conforme as
peças envelhecem. Isso é o comportamento certo — hardware envelhece mesmo — e é o que o PC
Evolution quer registrar. Mas significa que dois retratos da mesma máquina sem nenhuma troca
podem ter notas diferentes, e que teste de score precisa fixar `now` para não apodrecer.

**`Loading` dentro de ScrollView precisa de `minHeight`.** `flex: 1` colapsa para altura zero
e a tela parece travada em branco. Já corrigido no componente compartilhado.

**Git Bash converte argumento começando com `/`** em caminho do Windows antes de chegar ao
Node. `scripts/shot.mjs` normaliza isso; o erro que aparecia ("Cannot navigate to invalid URL")
não tinha relação com a causa.

---

## 7. Validações de ambiente já feitas

- Caminho não-ASCII (`D:\PROJETOS\PECÊ`) — o Metro empacota normalmente, sem junction.
- Android SDK completo em `C:\Android\sdk` com AVDs, mas **o emulador não sobe** (BLOCKERS.md).
- Railway autenticado; Vercel autenticado, porém não utilizado.
