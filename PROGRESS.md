# Pecê — Registro de Progresso

> Documento vivo. Atualizado a cada etapa concluída para permitir retomada da sessão.

## Stack decidida

| Camada | Escolha | Motivo |
|---|---|---|
| Mobile | Expo SDK 57 / React Native 0.86 / expo-router | Android + iOS nativos reais, não PWA |
| Animação | Reanimated 4 + Gesture Handler | Gesto press-and-hold das reações precisa rodar na UI thread |
| Backend | Fastify + TypeScript + Prisma | Performance, tipagem ponta a ponta |
| Banco | PostgreSQL no Railway | Persistência real de produção desde o início |
| Domínio | `packages/core` (TS puro) | Engine determinística compartilhada entre API e app |

## Decisões de arquitetura

- **Monorepo npm workspaces** — `apps/mobile`, `apps/api`, `packages/core`.
- **Vercel descartado.** O produto é RN + API Railway; espalhar por duas plataformas não agrega.
- **Engine de inteligência é determinística, não generativa.** Regras, índices de performance e
  compatibilidade vivem em `packages/core`. IA fica reservada para camada de explicação futura.
- **Catálogo de hardware é estruturado.** O usuário nunca digita o nome do componente livremente;
  seleciona a partir da base. Isso é pré-requisito para score, valuation e comparação.

## Validações feitas

- [x] Caminho não-ASCII (`D:\PROJETOS\PECÊ`) — Metro empacota normalmente. Sem necessidade de junction.
- [x] Android SDK completo em `C:\Android\sdk` com emulador e AVDs (`Orla_API34`) — verificação visual real é possível.
- [x] Railway autenticado (alanvitoraraujo2a@gmail.com).

## Status

| Etapa | Status |
|---|---|
| Monorepo + scaffold Expo | ✅ |
| Bundle Metro validado | ✅ |
| Railway: projeto + Postgres | 🔄 |
| `packages/core` (engine) | ⏳ |
| API Fastify + Prisma | ⏳ |
| Catálogo de hardware (seed) | ⏳ |
| App mobile | ⏳ |
