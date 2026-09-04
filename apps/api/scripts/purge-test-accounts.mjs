/**
 * Remove contas de teste do banco.
 *
 * Por que existe: o smoke e a verificação visual rodam contra o Postgres de produção de
 * propósito — é isso que torna os testes reais. O preço é que cada execução criava gente
 * que nunca saía do banco, e essas contas apareciam no feed de descoberta de usuários de
 * verdade. Hoje os dois scripts apagam as próprias contas ao terminar; este aqui é para o
 * passivo que ficou, e para o dia em que uma execução morrer no meio sem limpar.
 *
 * O critério é o domínio do e-mail, nunca o handle: handle é escolhido pelo usuário e
 * alguém poderia legitimamente se chamar `demo_alan`. Endereço em `@pece.test` só existe
 * porque um script deste repositório o criou.
 *
 * Não apaga nada sem `--apply`. O padrão é listar o que faria — em produção, um script de
 * remoção que age por omissão é um acidente esperando data.
 *
 *   node scripts/purge-test-accounts.mjs            # lista
 *   node scripts/purge-test-accounts.mjs --apply    # remove
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Domínios usados exclusivamente por scripts deste repositório. */
const TEST_DOMAINS = ['@pece.test', '@pece.demo', '@t.test'];

const apply = process.argv.includes('--apply');

const where = { OR: TEST_DOMAINS.map((domain) => ({ email: { endsWith: domain } })) };

const doomed = await prisma.user.findMany({
  where,
  select: {
    id: true,
    handle: true,
    email: true,
    createdAt: true,
    _count: { select: { rigs: true, events: true, listings: true } },
  },
  orderBy: { createdAt: 'asc' },
});

const survivors = await prisma.user.count({ where: { NOT: where } });

if (doomed.length === 0) {
  console.log('Nenhuma conta de teste no banco. Nada a fazer.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`${doomed.length} contas de teste encontradas (${survivors} contas reais ficam):\n`);
for (const user of doomed) {
  const bits = [
    `${user._count.rigs} máquinas`,
    `${user._count.events} eventos`,
    `${user._count.listings} anúncios`,
  ].join(', ');
  console.log(`  @${user.handle.padEnd(20)} ${user.email.padEnd(30)} ${bits}`);
}

if (!apply) {
  console.log('\nNada foi removido. Rode de novo com --apply para executar.');
  await prisma.$disconnect();
  process.exit(0);
}

// Máquinas, peças, retratos, eventos, reações, comentários e anúncios caem por cascata.
const result = await prisma.user.deleteMany({ where });
console.log(`\n${result.count} contas removidas.`);

const left = await prisma.user.count();
console.log(`Restam ${left} contas no banco.`);

await prisma.$disconnect();
